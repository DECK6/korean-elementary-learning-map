import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const VOCABULARY_SECTIONS = [
  'classes',
  'objectProperties',
  'datatypeProperties',
  'conceptSchemes',
];

const REQUIRED_TERMS = {
  classes: [
    'DatasetRelease',
    'Curriculum',
    'GradeBand',
    'Subject',
    'LearningDomain',
    'AchievementStandard',
    'LearningTopic',
    'LearningCluster',
    'EvidenceCriterion',
    'AssessmentPrompt',
    'SourceDocument',
    'SourceLocator',
    'VerificationRecord',
    'CoverageGap',
    'PrerequisiteAssertion',
    'StandardTopicAlignment',
  ],
  objectProperties: [
    'alignedToStandard',
    'hasStandardTopicAlignment',
    'alignmentTopic',
    'alignmentStandard',
    'hasEvidenceCriterion',
    'hasAssessmentPrompt',
    'directRequires',
    'indirectRequires',
    'unlocks',
    'hasPrerequisiteAssertion',
    'dependentTopic',
    'prerequisiteTopic',
    'hasSourceLocator',
    'hasVerificationRecord',
    'reportsCoverageGap',
  ],
  datatypeProperties: [
    'prerequisiteStrength',
    'prerequisiteReason',
    'assertionBasis',
    'assertionSource',
    'alignmentKind',
    'confidence',
    'note',
    'verificationStatus',
    'rightsStatus',
  ],
  conceptSchemes: [
    'LearningTopicType',
    'DependencyRequirementLevel',
    'AlignmentKind',
    'CoverageGapCategory',
    'GapSeverity',
    'VerificationStatus',
    'RightsStatus',
  ],
};

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function requireFields(entry, path, fields, errors) {
  for (const field of fields) {
    if (!isNonEmptyString(entry?.[field])) {
      errors.push(`${path} missing ${field}`);
    }
  }
}

function registerTerm(entry, path, seenTerms, errors) {
  requireFields(entry, path, ['term', 'definition'], errors);
  if (!isNonEmptyString(entry?.term)) return;

  if (seenTerms.has(entry.term)) {
    errors.push(`${path} duplicate term ${entry.term}`);
  }
  seenTerms.add(entry.term);
}

export function validateControlledVocabulary(vocabulary) {
  const errors = [];
  const seenTerms = new Set();

  if (!vocabulary || typeof vocabulary !== 'object' || Array.isArray(vocabulary)) {
    return ['controlled vocabulary must be a JSON object'];
  }

  const expectedNamespaces = {
    ontology: 'https://dexa.art/learnmap/ontology#',
    instance: 'https://dexa.art/learnmap/#/',
    vocabulary: 'https://dexa.art/learnmap/vocab/',
  };
  for (const [name, expected] of Object.entries(expectedNamespaces)) {
    if (vocabulary.namespaces?.[name] !== expected) {
      errors.push(`namespaces.${name} must be ${expected}`);
    }
  }

  for (const section of VOCABULARY_SECTIONS) {
    const entries = vocabulary[section];
    if (!Array.isArray(entries) || entries.length === 0) {
      errors.push(`${section} must be a non-empty array`);
      continue;
    }

    entries.forEach((entry, index) => {
      const path = `${section}[${index}]`;
      registerTerm(entry, path, seenTerms, errors);

      if (section === 'classes') {
        if (
          !Array.isArray(entry?.nonExamples) ||
          entry.nonExamples.length === 0 ||
          entry.nonExamples.some((nonExample) => !isNonEmptyString(nonExample))
        ) {
          errors.push(`${path} requires at least one non-example`);
        }
      }

      if (section === 'objectProperties') {
        requireFields(entry, path, ['direction', 'cardinality'], errors);
        if (!Array.isArray(entry?.domain) || entry.domain.length === 0) {
          errors.push(`${path} requires a domain`);
        }
        if (!Array.isArray(entry?.range) || entry.range.length === 0) {
          errors.push(`${path} requires a range`);
        }
      }

      if (section === 'datatypeProperties') {
        requireFields(entry, path, ['datatype', 'cardinality'], errors);
        if (!Array.isArray(entry?.domain) || entry.domain.length === 0) {
          errors.push(`${path} requires a domain`);
        }
      }

      if (section === 'conceptSchemes') {
        if (!Array.isArray(entry?.concepts) || entry.concepts.length === 0) {
          errors.push(`${path} requires concepts`);
          return;
        }

        entry.concepts.forEach((concept, conceptIndex) => {
          registerTerm(
            concept,
            `${path}.concepts[${conceptIndex}]`,
            seenTerms,
            errors,
          );
        });

        const conceptTerms = new Set(entry.concepts.map((concept) => concept?.term));
        for (const [sourceValue, targetTerm] of Object.entries({
          ...(entry.sourceValueMap ?? {}),
          ...(entry.legacyValueMap ?? {}),
        })) {
          if (!isNonEmptyString(sourceValue) || !conceptTerms.has(targetTerm)) {
            errors.push(`${path} maps ${sourceValue} to unknown concept ${targetTerm}`);
          }
        }
      }
    });
  }

  for (const [section, requiredTerms] of Object.entries(REQUIRED_TERMS)) {
    const sectionTerms = new Set((vocabulary[section] ?? []).map((entry) => entry?.term));
    for (const requiredTerm of requiredTerms) {
      if (!sectionTerms.has(requiredTerm)) {
        errors.push(`${section} missing required term ${requiredTerm}`);
      }
    }
  }

  const properties = new Map(
    (vocabulary.objectProperties ?? []).map((entry) => [entry.term, entry]),
  );
  const directRequires = properties.get('directRequires');
  const indirectRequires = properties.get('indirectRequires');
  const unlocks = properties.get('unlocks');
  if (directRequires?.transitive === true) {
    errors.push('directRequires must not be transitive');
  }
  if (directRequires?.inverseOf !== 'unlocks' || unlocks?.inverseOf !== 'directRequires') {
    errors.push('directRequires and unlocks must declare each other as inverse terms');
  }
  if (indirectRequires?.assertionPolicy !== 'derived-only') {
    errors.push('indirectRequires must be derived-only');
  }
  if (indirectRequires?.minimumDirectPathLength !== 2) {
    errors.push('indirectRequires must require a direct path length of at least 2');
  }

  const schemes = new Map(
    (vocabulary.conceptSchemes ?? []).map((entry) => [entry.term, entry]),
  );
  const topicTypes = schemes.get('LearningTopicType');
  if (topicTypes?.modeling !== 'skos:Concept' || topicTypes?.disjointnessAsserted !== false) {
    errors.push('LearningTopicType values must remain non-disjoint skos:Concept values');
  }
  const dependencyLevels = schemes.get('DependencyRequirementLevel');
  if (
    dependencyLevels?.legacyValueMap?.hard !== 'required' ||
    dependencyLevels?.legacyValueMap?.soft !== 'recommended'
  ) {
    errors.push('DependencyRequirementLevel must map hard/soft to required/recommended');
  }

  const release = vocabulary.releaseMetadata;
  if (release?.coverageGapCount !== 43) {
    errors.push('releaseMetadata.coverageGapCount must preserve the 43 source-data gaps');
  }
  if (release?.sourceRightsStatus !== 'HOLD') {
    errors.push('releaseMetadata.sourceRightsStatus must preserve HOLD');
  }
  if (release?.coverageGapCategory === release?.sourceRightsCategory) {
    errors.push('coverage gaps and source-rights metadata must use distinct categories');
  }

  return errors;
}

async function main() {
  const vocabularyUrl = new URL('../ontology/controlled-vocabulary.json', import.meta.url);
  const vocabulary = JSON.parse(await readFile(vocabularyUrl, 'utf8'));
  const errors = validateControlledVocabulary(vocabulary);

  if (errors.length > 0) {
    console.error(`Ontology P0 validation failed with ${errors.length} error(s):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  const termCount = VOCABULARY_SECTIONS.reduce(
    (count, section) => count + vocabulary[section].length,
    0,
  );
  const conceptCount = vocabulary.conceptSchemes.reduce(
    (count, scheme) => count + scheme.concepts.length,
    0,
  );
  console.log(
    `Ontology P0 controlled vocabulary valid (${termCount + conceptCount} defined terms and concepts).`,
  );
}

if (process.argv[1] && import.meta.url === new URL(`file://${fileURLToPath(new URL(import.meta.url))}`).href) {
  await main();
}
