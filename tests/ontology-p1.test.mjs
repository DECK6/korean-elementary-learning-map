import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import {
  buildOntologyArtifacts,
  mintInstanceIri,
  stableRecordId,
} from '../scripts/build-ontology.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const execFileAsync = promisify(execFile);
const INSTANCE_NAMESPACE = 'https://dexa.art/learnmap/#/';
const VOCABULARY_NAMESPACE = 'https://dexa.art/learnmap/vocab/#/';
const ONTOLOGY_NAMESPACE = 'https://dexa.art/learnmap/ontology#';
const STATIC_FILES = [
  'ontology/learning-map.ttl',
  'ontology/context.jsonld',
  'ontology/shapes.ttl',
  'ontology/metadata.ttl',
];
const GENERATED_FILES = [
  'dist/ontology/learning-map.jsonld',
  'dist/ontology/learning-map.ttl',
  'dist/ontology/manifest.json',
];
const EXPECTED_SOURCE_COUNTS = {
  curricula: 11,
  standards: 620,
  topics: 1956,
  dependencies: 1894,
  clusters: 153,
  standardMappings: 1956,
  coverageGaps: 43,
};
const EXPECTED_GRAPH_COUNTS = {
  AchievementStandard: 620,
  AssessmentPrompt: 1956,
  CoverageGap: 43,
  Curriculum: 11,
  DatasetRelease: 1,
  EvidenceCriterion: 4056,
  GradeBand: 5,
  LearningCluster: 153,
  LearningDomain: 79,
  LearningTopic: 1956,
  PrerequisiteAssertion: 1894,
  SourceDocument: 17,
  SourceLocator: 1232,
  StandardTopicAlignment: 1956,
  Subject: 12,
  VerificationRecord: 6455,
};

async function readProjectFile(relativePath) {
  return readFile(resolve(ROOT, relativePath), 'utf8');
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function parseGeneratedGraph(artifacts) {
  return JSON.parse(artifacts.files['dist/ontology/learning-map.jsonld'])['@graph'];
}

function byType(graph, type) {
  return graph.filter((node) => node['@type'] === `lm:${type}`);
}

function asArray(value) {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function walkValues(value, visit, path = []) {
  visit(value, path);
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkValues(item, visit, [...path, String(index)]));
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      walkValues(item, visit, [...path, key]);
    }
  }
}

test('P1 static ontology files are loaded byte-identically by the builder', async () => {
  const artifacts = await buildOntologyArtifacts({ rootDir: ROOT });
  for (const relativePath of STATIC_FILES) {
    assert.equal(artifacts.files[relativePath], await readProjectFile(relativePath), relativePath);
  }
});

test('P1 static TBox covers the P0 registry and preserves semantic guardrails', async () => {
  const [tbox, registryText] = await Promise.all([
    readProjectFile('ontology/learning-map.ttl'),
    readProjectFile('ontology/controlled-vocabulary.json'),
  ]);
  const registry = JSON.parse(registryText);

  for (const prefix of ['lm', 'dcterms', 'owl', 'rdf', 'rdfs', 'skos', 'xsd']) {
    assert.match(tbox, new RegExp(`@prefix ${prefix}:`), `missing ${prefix} prefix`);
  }
  assert.match(tbox, /owl:versionIRI <https:\/\/dexa\.art\/learnmap\/ontology\/0\.2\.0-p2>/);

  for (const section of ['classes', 'objectProperties', 'datatypeProperties']) {
    for (const { term } of registry[section]) {
      assert.match(tbox, new RegExp(`\\blm:${term}\\b`), `${section}.${term}`);
    }
  }
  for (const scheme of registry.conceptSchemes) {
    const schemeIri = `https://dexa.art/learnmap/vocab/#/${scheme.term}`;
    assert.ok(tbox.includes(`<${schemeIri}>`), scheme.term);
    for (const concept of scheme.concepts) {
      assert.ok(tbox.includes(`<${schemeIri}/${concept.term}>`), `${scheme.term}/${concept.term}`);
    }
  }

  assert.match(tbox, /lm:directRequires[\s\S]*?owl:inverseOf lm:unlocks/);
  assert.doesNotMatch(tbox, /lm:directRequires\s+a\s+owl:TransitiveProperty/);
  assert.doesNotMatch(tbox, /owl:AllDisjointClasses|owl:disjointWith/);
  assert.match(tbox, /lm:topicType[\s\S]*?rdfs:range skos:Concept/);
  assert.match(tbox, /lm:PrerequisiteAssertion[\s\S]*?authoritative n-ary record/i);
  assert.match(tbox, /lm:StandardTopicAlignment[\s\S]*?authoritative n-ary record/i);
});

test('P1 JSON-LD context is local, complete, and IRI-coerces graph relations', async () => {
  const [contextText, registryText] = await Promise.all([
    readProjectFile('ontology/context.jsonld'),
    readProjectFile('ontology/controlled-vocabulary.json'),
  ]);
  const context = JSON.parse(contextText)['@context'];
  const registry = JSON.parse(registryText);

  assert.equal(context['@version'], 1.1);
  assert.equal(context['@base'], 'https://dexa.art/learnmap/#/');
  assert.equal(context['@vocab'], 'https://dexa.art/learnmap/ontology#');
  assert.equal(context.lmv, 'https://dexa.art/learnmap/vocab/#/');
  assert.equal(context['@import'], undefined);

  for (const { term } of registry.classes) assert.equal(context[term], `lm:${term}`);
  for (const { term } of [...registry.objectProperties, ...registry.datatypeProperties]) {
    assert.ok(context[term], `context missing ${term}`);
  }
  for (const term of [
    'directRequires',
    'unlocks',
    'hasPrerequisiteAssertion',
    'dependentTopic',
    'prerequisiteTopic',
    'alignedToStandard',
    'hasStandardTopicAlignment',
    'alignmentTopic',
    'alignmentStandard',
    'topicType',
    'prerequisiteStrength',
    'alignmentKind',
    'rightsStatus',
  ]) {
    assert.equal(context[term]['@type'], '@id', term);
  }
});

test('P1 SHACL contract validates qualified assertions and controlled concept IRIs', async () => {
  const shapes = await readProjectFile('ontology/shapes.ttl');
  for (const prefix of ['lm', 'sh', 'xsd']) {
    assert.match(shapes, new RegExp(`@prefix ${prefix}:`), `missing ${prefix} prefix`);
  }
  assert.match(shapes, /lm:PrerequisiteAssertionShape a sh:NodeShape/);
  assert.match(shapes, /sh:path lm:dependentTopic ; sh:minCount 1 ; sh:maxCount 1/);
  assert.match(shapes, /sh:path lm:prerequisiteTopic ; sh:minCount 1 ; sh:maxCount 1/);
  assert.match(shapes, /sh:path lm:prerequisiteStrength[\s\S]*?sh:nodeKind sh:IRI/);
  assert.match(shapes, /lm:StandardTopicAlignmentShape a sh:NodeShape/);
  assert.match(shapes, /sh:path lm:alignmentTopic ; sh:minCount 1 ; sh:maxCount 1/);
  assert.match(shapes, /sh:path lm:alignmentStandard ; sh:minCount 1 ; sh:maxCount 1/);
  assert.match(shapes, /sh:path lm:alignmentKind[\s\S]*?sh:nodeKind sh:IRI/);
  assert.match(shapes, /sh:path lm:confidence[\s\S]*?sh:minInclusive 0 ; sh:maxInclusive 1/);
  assert.match(shapes, /hasPrerequisiteAssertion \$this ; lm:directRequires \?prerequisite/);
  assert.match(shapes, /hasStandardTopicAlignment \$this ; lm:alignedToStandard \?standard/);
});

test('P1 metadata keeps format, provenance, version, and rights HOLD independent', async () => {
  const metadata = await readProjectFile('ontology/metadata.ttl');
  for (const prefix of ['lm', 'dcterms', 'owl', 'prov', 'xsd']) {
    assert.match(metadata, new RegExp(`@prefix ${prefix}:`), `missing ${prefix} prefix`);
  }
  assert.match(metadata, /lm:rightsStatus <https:\/\/dexa\.art\/learnmap\/vocab\/#\/RightsStatus\/hold>/);
  assert.match(metadata, /dcterms:rights "HOLD/);
  assert.match(metadata, /dcterms:hasVersion "0\.2\.0-p2"/);
  assert.match(metadata, /dcterms:format "text\/turtle", "application\/ld\+json"/);
  assert.match(metadata, /prov:wasDerivedFrom/);
  assert.match(metadata, /lm:officialTextIncluded false/);
});

test('P1 instance IRIs use the published learnmap fragment route and stable source IDs', () => {
  assert.equal(
    mintInstanceIri('standard', 'kr-2022-elem-korean:[2국02-01]'),
    'https://dexa.art/learnmap/#/standard/kr-2022-elem-korean%3A%5B2%EA%B5%AD02-01%5D',
  );
  assert.equal(
    mintInstanceIri('topic', 'kr.mt.example'),
    'https://dexa.art/learnmap/#/topic/kr.mt.example',
  );
  assert.throws(() => mintInstanceIri('unknown-kind', 'x'), /unsupported resource kind/);
});

test('P1 assertion IDs are deterministic, qualifier-sensitive, and independent of object key order', () => {
  const left = stableRecordId('pa', {
    release: 'kr-full-depth-v0.4',
    dependentTopic: 'topic-b',
    prerequisiteTopic: 'topic-a',
    strength: 'hard',
    basis: 'reviewed',
    source: 'workstream:math.json',
    duplicateOrdinal: 0,
  });
  const reordered = stableRecordId('pa', {
    source: 'workstream:math.json',
    duplicateOrdinal: 0,
    basis: 'reviewed',
    strength: 'hard',
    prerequisiteTopic: 'topic-a',
    dependentTopic: 'topic-b',
    release: 'kr-full-depth-v0.4',
  });
  const changedQualifier = stableRecordId('pa', {
    release: 'kr-full-depth-v0.4',
    dependentTopic: 'topic-b',
    prerequisiteTopic: 'topic-a',
    strength: 'soft',
    basis: 'reviewed',
    source: 'workstream:math.json',
    duplicateOrdinal: 0,
  });

  assert.match(left, /^pa-[a-f0-9]{24}$/);
  assert.equal(left, reordered);
  assert.notEqual(left, changedQualifier);
});

test('P1 ABox preserves qualified prerequisite and standard-alignment assertions', async () => {
  const artifacts = await buildOntologyArtifacts({ rootDir: ROOT });
  const jsonld = JSON.parse(artifacts.files['dist/ontology/learning-map.jsonld']);
  const byType = (type) =>
    jsonld['@graph'].filter((node) => node['@type'] === `lm:${type}`);

  assert.deepEqual(artifacts.counts.sourceRecords, EXPECTED_SOURCE_COUNTS);

  const prerequisiteAssertions = byType('PrerequisiteAssertion');
  assert.equal(prerequisiteAssertions.length, 1894);
  assert.ok(
    prerequisiteAssertions.every(
      (node) =>
        node['lm:dependentTopic']?.['@id'] &&
        node['lm:prerequisiteTopic']?.['@id'] &&
        ['hard', 'soft'].includes(node['lm:legacyPrerequisiteStrength']) &&
        ['required', 'recommended'].some((term) =>
          node['lm:prerequisiteStrength']?.['@id'].endsWith(`/DependencyRequirementLevel/${term}`),
        ) &&
        node['lm:prerequisiteReason']?.['@language'] === 'ko' &&
        node['lm:assertionBasis'] &&
        node['lm:assertionSource'],
    ),
  );

  const directPrerequisiteCount = byType('LearningTopic').reduce(
    (count, node) => count + (node['lm:directRequires']?.length ?? 0),
    0,
  );
  assert.equal(directPrerequisiteCount, 1894);

  const alignments = byType('StandardTopicAlignment');
  assert.equal(alignments.length, 1956);
  assert.ok(
    alignments.every(
      (node) =>
        node['lm:alignmentTopic']?.['@id'] &&
        node['lm:alignmentStandard']?.['@id'] &&
        node['lm:alignmentKind']?.['@id'] &&
        node['lm:sourceConfidenceValue'] &&
        node['lm:confidenceDefaulted'] === true &&
        node['lm:defaultingPolicy'] === 'alignment-confidence-default-v1' &&
        node['lm:assertionBasis'] &&
        node['lm:assertionSource'],
    ),
  );

  const directAlignmentCount = byType('LearningTopic').reduce(
    (count, node) => count + (node['lm:alignedToStandard']?.length ?? 0),
    0,
  );
  assert.equal(directAlignmentCount, 1956);
});

test('P1 ABox exports the complete source profile with rights and provenance intact', async () => {
  const artifacts = await buildOntologyArtifacts({ rootDir: ROOT });
  const jsonld = JSON.parse(artifacts.files['dist/ontology/learning-map.jsonld']);
  const graph = jsonld['@graph'];
  const byType = (type) => graph.filter((node) => node['@type'] === `lm:${type}`);

  assert.deepEqual(artifacts.counts.graphResources, EXPECTED_GRAPH_COUNTS);
  assert.equal(byType('DatasetRelease').length, 1);
  assert.equal(byType('Curriculum').length, 11);
  assert.equal(byType('AchievementStandard').length, 620);
  assert.equal(byType('LearningTopic').length, 1956);
  assert.equal(byType('LearningCluster').length, 153);
  assert.equal(byType('EvidenceCriterion').length, 4056);
  assert.equal(byType('AssessmentPrompt').length, 1956);
  assert.equal(byType('SourceDocument').length, 17);
  assert.equal(byType('CoverageGap').length, 43);

  const ids = graph.map((node) => node['@id']);
  assert.equal(new Set(ids).size, ids.length, 'all generated resource IRIs must be unique');
  assert.ok(ids.every((id) => id.startsWith('https://dexa.art/learnmap/#/')));
  assert.ok(ids.every((id) => !id.includes('/learnmap/id/')));
  assert.ok(graph.every((node) => node['lm:identifier']));

  const release = byType('DatasetRelease')[0];
  assert.equal(release['lm:officialTextIncluded'], false);
  assert.ok(release['lm:rightsStatus']['@id'].endsWith('/RightsStatus/hold'));
  assert.equal(release['lm:reportsCoverageGap'].length, 43);
  assert.equal(release['lm:containsTopic'].length, 1956);
  assert.equal(release['lm:hasCluster'].length, 153);

  assert.ok(
    byType('SourceDocument').every(
      (node) => node['lm:rightsStatus']?.['@id'] && node['dcterms:source'] && node['prov:wasDerivedFrom'],
    ),
  );
  assert.ok(
    byType('SourceDocument')
      .filter((node) => node['lm:sourceType'] !== 'repository-document')
      .every((node) => node['lm:rightsStatus']['@id'].endsWith('/RightsStatus/hold')),
  );
  assert.ok(
    byType('LearningTopic').every(
      (node) =>
        node['lm:officialTextIncluded'] === false &&
        node['lm:hasSubject']?.['@id'] &&
        node['lm:hasGradeBand']?.['@id'] &&
        node['lm:hasLearningDomain']?.['@id'] &&
        node['lm:hasEvidenceCriterion']?.length >= 1 &&
        node['lm:hasAssessmentPrompt']?.length >= 1 &&
        node['lm:hasVerificationRecord']?.['@id'] &&
        node['prov:wasDerivedFrom']?.length >= 1,
    ),
  );
  assert.equal(
    byType('LearningCluster').reduce(
      (count, node) => count + node['lm:hasClusterMember'].length,
      0,
    ),
    2822,
  );
  assert.ok(
    byType('CoverageGap').every(
      (node) =>
        node['lm:gapCategory']?.['@id'] &&
        node['lm:gapSeverity']?.['@id'] &&
        node['lm:gapDescription']?.['@language'] === 'ko' &&
        typeof node['lm:sourceGapSeverityPresent'] === 'boolean',
    ),
  );
});

test('P1 generated JSON-LD, Turtle, and manifest are byte-identical across builds', async () => {
  const first = await buildOntologyArtifacts({ rootDir: ROOT });
  const second = await buildOntologyArtifacts({ rootDir: ROOT });

  for (const relativePath of GENERATED_FILES) {
    assert.ok(first.files[relativePath]?.length > 0, relativePath);
    assert.equal(sha256(first.files[relativePath]), sha256(second.files[relativePath]), relativePath);
    assert.equal(first.files[relativePath], second.files[relativePath], relativePath);
  }

  const ttl = first.files['dist/ontology/learning-map.ttl'];
  for (const prefix of ['lm', 'dcterms', 'prov', 'xsd']) {
    assert.match(ttl, new RegExp(`@prefix ${prefix}:`), `generated Turtle missing ${prefix}`);
  }
  assert.doesNotMatch(ttl, /\bundefined\b|\[object Object\]/);
  assert.match(ttl, /<https:\/\/dexa\.art\/learnmap\/#\/release\/kr-full-depth-v0\.4>/);

  const manifest = JSON.parse(first.files['dist/ontology/manifest.json']);
  assert.equal(manifest.formatVersion, 2);
  assert.equal(manifest.phase, 'P2');
  assert.equal(manifest.ontologyVersion, '0.2.0-p2');
  assert.equal(manifest.datasetRelease, 'kr-full-depth-v0.4');
  assert.equal(manifest.generator, 'scripts/build-ontology.mjs');
  assert.deepEqual(manifest.sourceRecords, EXPECTED_SOURCE_COUNTS);
  assert.deepEqual(manifest.graphResources, EXPECTED_GRAPH_COUNTS);
  assert.deepEqual(
    manifest.files.map(({ path }) => path),
    ['dist/ontology/learning-map.jsonld', 'dist/ontology/learning-map.ttl'],
  );
  for (const file of manifest.files) {
    assert.equal(file.bytes, Buffer.byteLength(first.files[file.path], 'utf8'), file.path);
    assert.equal(file.sha256, sha256(first.files[file.path]), file.path);
  }
});

test('P1 ABox has unique resources, no dangling instance IRIs, and no forbidden public URLs', async () => {
  const artifacts = await buildOntologyArtifacts({ rootDir: ROOT });
  const graph = parseGeneratedGraph(artifacts);
  const nodeIds = new Set(graph.map((node) => node['@id']));
  assert.equal(nodeIds.size, graph.length);

  for (const node of graph) {
    assert.ok(node['@id'].startsWith(INSTANCE_NAMESPACE), node['@id']);
    assert.ok(!node['@id'].includes('/learnmap/id/'), node['@id']);
    assert.ok(node['lm:identifier'], node['@id']);
  }

  walkValues(graph, (value, path) => {
    const key = path.at(-1);
    if (typeof key === 'string') {
      assert.doesNotMatch(key, /sourceUrl|sourceTextIncluded|officialText(?!Included)/i);
    }
    if (value && typeof value === 'object' && typeof value['@id'] === 'string') {
      const id = value['@id'];
      if (id.startsWith(INSTANCE_NAMESPACE)) assert.ok(nodeIds.has(id), id);
      if (/^https?:\/\//.test(id)) {
        assert.ok(
          id.startsWith(INSTANCE_NAMESPACE) ||
            id.startsWith(VOCABULARY_NAMESPACE) ||
            id.startsWith(ONTOLOGY_NAMESPACE),
          id,
        );
      }
    }
    if (typeof value === 'string' && key !== '@id') {
      assert.doesNotMatch(value, /https?:\/\//, path.join('.'));
    }
  });
});

test('P1 qualified assertions exactly agree with simple navigation relations', async () => {
  const artifacts = await buildOntologyArtifacts({ rootDir: ROOT });
  const graph = parseGeneratedGraph(artifacts);
  const topics = byType(graph, 'LearningTopic');

  const directRequires = new Set(
    topics.flatMap((topic) =>
      asArray(topic['lm:directRequires']).map(
        (prerequisite) => `${topic['@id']} -> ${prerequisite['@id']}`,
      ),
    ),
  );
  const qualifiedRequires = new Set(
    byType(graph, 'PrerequisiteAssertion').map(
      (assertion) =>
        `${assertion['lm:dependentTopic']['@id']} -> ${assertion['lm:prerequisiteTopic']['@id']}`,
    ),
  );
  assert.deepEqual(directRequires, qualifiedRequires);

  const directAlignments = new Set(
    topics.flatMap((topic) =>
      asArray(topic['lm:alignedToStandard']).map(
        (standard) => `${topic['@id']} -> ${standard['@id']}`,
      ),
    ),
  );
  const qualifiedAlignments = new Set(
    byType(graph, 'StandardTopicAlignment').map(
      (alignment) =>
        `${alignment['lm:alignmentTopic']['@id']} -> ${alignment['lm:alignmentStandard']['@id']}`,
    ),
  );
  assert.deepEqual(directAlignments, qualifiedAlignments);
});

test('P1 graph preserves HOLD rights and excludes official achievement-standard text fields', async () => {
  const artifacts = await buildOntologyArtifacts({ rootDir: ROOT });
  const graph = parseGeneratedGraph(artifacts);
  const release = byType(graph, 'DatasetRelease')[0];
  assert.equal(release['lm:officialTextIncluded'], false);
  assert.equal(release['lm:rightsStatus']['@id'], `${VOCABULARY_NAMESPACE}RightsStatus/hold`);

  assert.ok(
    byType(graph, 'SourceDocument').every(
      (node) =>
        node['lm:rightsStatus']['@id'] === `${VOCABULARY_NAMESPACE}RightsStatus/hold` &&
        node['lm:officialTextIncluded'] === false &&
        !node['lm:sourceUrl'],
    ),
  );
  assert.ok(
    byType(graph, 'AchievementStandard').every(
      (node) => node['lm:officialTextIncluded'] === false && !node['lm:officialText'],
    ),
  );
  assert.ok(
    byType(graph, 'LearningTopic').every(
      (node) => node['lm:officialTextIncluded'] === false && !node['lm:sourceTextIncluded'],
    ),
  );
});

test('P1 CLI writes deterministic JSON-LD, Turtle, and manifest artifacts', async () => {
  await execFileAsync(process.execPath, ['scripts/build-ontology.mjs'], { cwd: ROOT });
  const first = Object.fromEntries(
    await Promise.all(
      GENERATED_FILES.map(async (relativePath) => [
        relativePath,
        await readProjectFile(relativePath),
      ]),
    ),
  );

  await execFileAsync(process.execPath, ['scripts/build-ontology.mjs'], { cwd: ROOT });
  const second = Object.fromEntries(
    await Promise.all(
      GENERATED_FILES.map(async (relativePath) => [
        relativePath,
        await readProjectFile(relativePath),
      ]),
    ),
  );

  const inMemory = await buildOntologyArtifacts({ rootDir: ROOT });
  for (const relativePath of GENERATED_FILES) {
    assert.equal(first[relativePath], second[relativePath], relativePath);
    assert.equal(second[relativePath], inMemory.files[relativePath], relativePath);
  }
});
