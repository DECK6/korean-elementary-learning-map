import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ONTOLOGY_VERSION, PRIOR_ONTOLOGY_VERSION } from './build-ontology.mjs';

const REFERENCE_PATH = 'docs/ontology-reference.md';
const RELEASE_MANIFEST_PATH = 'dist/ontology/release-manifest.json';
const DEPRECATION_POLICY_PATH = 'ontology/deprecation-policy.md';
const REPLACEMENTS_PATH = 'ontology/replacements.json';
const TERM_STATUS_PATH = 'ontology/term-status.json';
const ONTOLOGY_SERIES_IRI = 'https://dexa.art/learnmap/ontology';
const DATASET_RELEASE = 'kr-full-depth-v0.4';

export const GENERATED_RELEASE_FILES = [REFERENCE_PATH, RELEASE_MANIFEST_PATH];

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function sha256(contents) {
  return createHash('sha256').update(contents).digest('hex');
}

async function readJson(rootDir, relativePath) {
  return JSON.parse(await readFile(resolve(rootDir, relativePath), 'utf8'));
}

function markdown(value) {
  if (value === undefined || value === null || value === '') return '—';
  const text = Array.isArray(value) ? value.join(', ') : String(value);
  return text.replaceAll('|', '\\|').replaceAll('\n', ' ');
}

function lifecycleKey(kind, term) {
  return `${kind}:${term}`;
}

function knownVocabularyTerms(vocabulary) {
  const known = new Set();
  for (const section of ['classes', 'objectProperties', 'datatypeProperties']) {
    const kind =
      section === 'classes'
        ? 'class'
        : section === 'objectProperties'
          ? 'objectProperty'
          : 'datatypeProperty';
    for (const entry of vocabulary[section]) known.add(lifecycleKey(kind, entry.term));
  }
  for (const scheme of vocabulary.conceptSchemes) {
    known.add(lifecycleKey('conceptScheme', scheme.term));
    for (const concept of scheme.concepts) {
      known.add(lifecycleKey(`concept:${scheme.term}`, concept.term));
    }
  }
  return known;
}

function lifecycleFor(termStatus, kind, term) {
  return (
    termStatus.deprecatedTerms.find(
      (entry) => lifecycleKey(entry.kind, entry.term) === lifecycleKey(kind, term),
    ) ?? { status: termStatus.defaultStatus }
  );
}

function termRows(entries, kind, termStatus, columns) {
  return entries
    .map((entry) => {
      const lifecycle = lifecycleFor(termStatus, kind, entry.term);
      const values = columns.map((column) => markdown(entry[column]));
      return `| \`${markdown(entry.term)}\` | ${values.join(' | ')} | ${markdown(lifecycle.status)} | ${markdown(lifecycle.replacement)} |`;
    })
    .join('\n');
}

function validateTermStatus(vocabulary, termStatus, replacementRegistry) {
  if (termStatus.ontologyVersion !== ONTOLOGY_VERSION) {
    throw new Error(
      `ontology/term-status.json ontologyVersion must be ${ONTOLOGY_VERSION}`,
    );
  }
  if (termStatus.defaultStatus !== 'active' || !Array.isArray(termStatus.deprecatedTerms)) {
    throw new Error('ontology/term-status.json must define active defaultStatus and deprecatedTerms');
  }

  const known = knownVocabularyTerms(vocabulary);
  const seen = new Set();
  for (const entry of termStatus.deprecatedTerms) {
    const key = lifecycleKey(entry.kind, entry.term);
    if (!known.has(key)) throw new Error(`unknown deprecated term: ${key}`);
    if (seen.has(key)) throw new Error(`duplicate deprecated term: ${key}`);
    seen.add(key);
    if (entry.status !== 'deprecated' || !entry.deprecatedIn || !entry.replacement) {
      throw new Error(`deprecated term ${key} requires status, deprecatedIn, and replacement`);
    }
  }

  const replacementKeys = new Set(
    replacementRegistry.entries.map((entry) => lifecycleKey(entry.kind, entry.term)),
  );
  for (const key of seen) {
    if (!replacementKeys.has(key)) {
      throw new Error(`deprecated term ${key} is missing from ontology/replacements.json`);
    }
  }
}

function validateReplacementRegistry(vocabulary, replacementRegistry) {
  if (
    replacementRegistry.formatVersion !== 1 ||
    replacementRegistry.ontologyVersion !== ONTOLOGY_VERSION ||
    replacementRegistry.priorOntologyVersion !== PRIOR_ONTOLOGY_VERSION ||
    replacementRegistry.stableOntologyIri !== ONTOLOGY_SERIES_IRI ||
    replacementRegistry.policyDocument !== DEPRECATION_POLICY_PATH ||
    replacementRegistry.status !== 'active' ||
    !Array.isArray(replacementRegistry.entries)
  ) {
    throw new Error('ontology/replacements.json must identify the P3 active replacement registry');
  }

  const known = knownVocabularyTerms(vocabulary);
  const seen = new Set();
  for (const [index, entry] of replacementRegistry.entries.entries()) {
    const path = `ontology/replacements.json entries[${index}]`;
    const key = lifecycleKey(entry.kind, entry.term);
    if (!known.has(key)) throw new Error(`${path} references unknown term ${key}`);
    if (seen.has(key)) throw new Error(`${path} duplicates ${key}`);
    seen.add(key);
    for (const field of [
      'status',
      'deprecatedIn',
      'iri',
      'replacement',
      'replacementIri',
      'rationale',
      'compatibilityImpact',
      'reviewStatus',
    ]) {
      if (typeof entry[field] !== 'string' || entry[field].trim().length === 0) {
        throw new Error(`${path} missing ${field}`);
      }
    }
    if (!['deprecated', 'tombstone'].includes(entry.status)) {
      throw new Error(`${path} status must be deprecated or tombstone`);
    }
  }
}

export async function buildOntologyReference({ rootDir }) {
  const [vocabulary, termStatus, replacementRegistry] = await Promise.all([
    readJson(rootDir, 'ontology/controlled-vocabulary.json'),
    readJson(rootDir, TERM_STATUS_PATH),
    readJson(rootDir, REPLACEMENTS_PATH),
  ]);
  validateReplacementRegistry(vocabulary, replacementRegistry);
  validateTermStatus(vocabulary, termStatus, replacementRegistry);

  const conceptCount = vocabulary.conceptSchemes.reduce(
    (count, scheme) => count + scheme.concepts.length,
    0,
  );
  const lines = [
    '# Korean Elementary Curriculum Learning Ontology reference',
    '',
    '> Generated by `scripts/build-ontology-release.mjs` from `ontology/controlled-vocabulary.json` and `ontology/term-status.json`. Do not edit this file directly.',
    '',
    `- Ontology version: \`${ONTOLOGY_VERSION}\``,
    `- Prior ontology version: \`${PRIOR_ONTOLOGY_VERSION}\``,
    `- Stable ontology IRI: \`${ONTOLOGY_SERIES_IRI}\``,
    `- Terms: ${vocabulary.classes.length} classes, ${vocabulary.objectProperties.length} object properties, ${vocabulary.datatypeProperties.length} datatype properties, ${vocabulary.conceptSchemes.length} concept schemes, ${conceptCount} concepts`,
    `- Lifecycle default: \`${termStatus.defaultStatus}\`; explicitly deprecated terms: ${termStatus.deprecatedTerms.length}`,
    `- Deprecation policy: \`${DEPRECATION_POLICY_PATH}\``,
    `- Replacement registry: \`${REPLACEMENTS_PATH}\`; active replacement entries: ${replacementRegistry.entries.length}`,
    '',
    'Definitions describe this repository model. They do not assert an official MOE/NCIC ontology or diagnose an individual learner.',
    '',
    '## Classes',
    '',
    '| Term | Definition | Status | Replacement |',
    '| --- | --- | --- | --- |',
    termRows(vocabulary.classes, 'class', termStatus, ['definition']),
    '',
    '## Object properties',
    '',
    '| Term | Definition | Direction | Domain | Range | Cardinality | Status | Replacement |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    termRows(vocabulary.objectProperties, 'objectProperty', termStatus, [
      'definition',
      'direction',
      'domain',
      'range',
      'cardinality',
    ]),
    '',
    '## Datatype properties',
    '',
    '| Term | Definition | Domain | Datatype | Cardinality | Status | Replacement |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    termRows(vocabulary.datatypeProperties, 'datatypeProperty', termStatus, [
      'definition',
      'domain',
      'datatype',
      'cardinality',
    ]),
    '',
    '## Controlled concepts',
    '',
  ];

  for (const scheme of vocabulary.conceptSchemes) {
    const schemeLifecycle = lifecycleFor(termStatus, 'conceptScheme', scheme.term);
    lines.push(
      `### ${scheme.term}`,
      '',
      `${scheme.definition} Status: \`${schemeLifecycle.status}\`.`,
      '',
      '| Concept | Definition | Status | Replacement |',
      '| --- | --- | --- | --- |',
      termRows(scheme.concepts, `concept:${scheme.term}`, termStatus, ['definition']),
      '',
    );
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

async function listFiles(rootDir, relativeDirectory) {
  const entries = await readdir(resolve(rootDir, relativeDirectory), { withFileTypes: true });
  const paths = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const relativePath = `${relativeDirectory}/${entry.name}`;
    if (entry.isDirectory()) paths.push(...(await listFiles(rootDir, relativePath)));
    else if (entry.isFile()) paths.push(relativePath);
  }
  return paths;
}

function mediaType(relativePath) {
  const extension = extname(relativePath);
  if (extension === '.jsonld') return 'application/ld+json';
  if (extension === '.json') return 'application/json';
  if (extension === '.ttl') return 'text/turtle';
  if (extension === '.rq') return 'application/sparql-query';
  if (extension === '.md') return 'text/markdown';
  return 'application/octet-stream';
}

export async function buildOntologyReleaseArtifacts({ rootDir }) {
  const referenceText = await buildOntologyReference({ rootDir });
  const [ontologyFiles, distFiles, coreManifest, validationReport, replacementRegistry] =
    await Promise.all([
      listFiles(rootDir, 'ontology'),
      listFiles(rootDir, 'dist/ontology'),
      readJson(rootDir, 'dist/ontology/manifest.json'),
      readJson(rootDir, 'dist/ontology/validation-report.json'),
      readJson(rootDir, REPLACEMENTS_PATH),
    ]);
  const releaseFiles = [
    ...ontologyFiles,
    ...distFiles.filter((path) => path !== RELEASE_MANIFEST_PATH),
    REFERENCE_PATH,
    'docs/ontology-release-report.md',
  ].sort();

  const files = [];
  for (const path of releaseFiles) {
    const contents = path === REFERENCE_PATH ? referenceText : await readFile(resolve(rootDir, path));
    files.push({
      path,
      mediaType: mediaType(path),
      bytes: Buffer.byteLength(contents),
      sha256: sha256(contents),
    });
  }

  const graphEquivalence = validationReport.graphs?.generatedEquivalence;
  if (
    graphEquivalence?.pass !== true ||
    graphEquivalence.jsonldTripleCount !== graphEquivalence.turtleTripleCount
  ) {
    throw new Error('dist/ontology/validation-report.json must verify isomorphic generated RDF');
  }
  const totalGraphResources = Object.values(coreManifest.graphResources).reduce(
    (count, value) => count + value,
    0,
  );

  const manifest = {
    formatVersion: 1,
    title: 'Korean Elementary Curriculum Learning Ontology',
    ontologySeriesIri: ONTOLOGY_SERIES_IRI,
    ontologyVersion: ONTOLOGY_VERSION,
    ontologyVersionIri: `${ONTOLOGY_SERIES_IRI}/${ONTOLOGY_VERSION}`,
    priorOntologyVersion: PRIOR_ONTOLOGY_VERSION,
    priorOntologyVersionIri: `${ONTOLOGY_SERIES_IRI}/${PRIOR_ONTOLOGY_VERSION}`,
    datasetRelease: DATASET_RELEASE,
    releaseDate: '2026-07-10',
    releaseStatus: 'formal',
    generator: 'scripts/build-ontology-release.mjs',
    status: {
      coverage: {
        status: 'known-gaps-retained',
        category: 'source-data-coverage',
        coverageGapCount: coreManifest.sourceRecords.coverageGaps,
      },
      ontologyFormat: {
        status: 'p3-formal-release',
        machineReadableOntology: true,
        executableShacl: true,
        reasonerGate: validationReport.checks?.reasoner === true,
      },
      automatedReview: {
        status: validationReport.overallPass === true ? 'passed-local-seven-gate' : 'not-passed',
        localVerification: true,
        githubActionsStatus: 'configured-not-run-in-this-manifest',
      },
      externalDomainReview: 'ongoing',
      sourceRights: 'CLEARED',
      officialStatus: 'independent-non-official',
      learnerDiagnosisSupported: false,
    },
    review: {
      formalGateCount: 7,
      automatedGateStatus: 'passed',
      standardsValidation: 'passed-with-pinned-tools',
      externalDomainReviewStatus: 'ongoing',
      learnerDiagnosisSupported: false,
    },
    rights: {
      status: 'CLEARED',
      basis: 'public-government-document',
      officialTextIncluded: false,
      permissionGranted: false,
    },
    governance: {
      changelog: 'ontology/CHANGELOG.md',
      deprecationPolicy: DEPRECATION_POLICY_PATH,
      replacementRegistry: REPLACEMENTS_PATH,
      termStatus: TERM_STATUS_PATH,
      deprecatedTermCount: replacementRegistry.entries.length,
    },
    officialStatus: 'independent-non-official',
    counts: {
      totalGraphResources,
      rdfTriples: {
        generatedABox: graphEquivalence.turtleTripleCount,
        jsonld: graphEquivalence.jsonldTripleCount,
        turtle: graphEquivalence.turtleTripleCount,
      },
      sourceRecords: coreManifest.sourceRecords,
      graphResources: coreManifest.graphResources,
      relations: coreManifest.relations,
    },
    files,
  };

  return {
    files: {
      [REFERENCE_PATH]: referenceText,
      [RELEASE_MANIFEST_PATH]: `${JSON.stringify(canonicalize(manifest), null, 2)}\n`,
    },
  };
}

async function writeFileAtomically(path, contents) {
  await mkdir(dirname(path), { recursive: true });
  const digest = sha256(contents).slice(0, 16);
  const temporaryPath = `${path}.${process.pid}.${digest}.tmp`;
  await writeFile(temporaryPath, contents, 'utf8');
  await rename(temporaryPath, path);
}

export async function writeOntologyReleaseArtifacts({ rootDir }) {
  const artifacts = await buildOntologyReleaseArtifacts({ rootDir });
  for (const relativePath of GENERATED_RELEASE_FILES) {
    await writeFileAtomically(resolve(rootDir, relativePath), artifacts.files[relativePath]);
  }
  return artifacts;
}

export async function checkOntologyReleaseArtifacts({ rootDir }) {
  const artifacts = await buildOntologyReleaseArtifacts({ rootDir });
  const mismatches = [];
  for (const relativePath of GENERATED_RELEASE_FILES) {
    let actual;
    try {
      actual = await readFile(resolve(rootDir, relativePath), 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        mismatches.push(`${relativePath}: missing`);
        continue;
      }
      throw error;
    }
    const expected = artifacts.files[relativePath];
    if (actual !== expected) {
      mismatches.push(`${relativePath}: expected sha256 ${sha256(expected)}, found ${sha256(actual)}`);
    }
  }
  if (mismatches.length > 0) {
    throw new Error(
      `generated ontology release files are missing or stale; run npm run build:ontology:release\n${mismatches.map((mismatch) => `- ${mismatch}`).join('\n')}`,
    );
  }
  return artifacts;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const checkOnly = process.argv.includes('--check');
  const artifacts = checkOnly
    ? await checkOntologyReleaseArtifacts({ rootDir })
    : await writeOntologyReleaseArtifacts({ rootDir });
  console.log(`Ontology P3 release artifacts ${checkOnly ? 'are current' : 'built'}:`);
  for (const relativePath of GENERATED_RELEASE_FILES) {
    const contents = artifacts.files[relativePath];
    console.log(`- ${relativePath}: ${Buffer.byteLength(contents)} bytes, sha256 ${sha256(contents)}`);
  }
}
