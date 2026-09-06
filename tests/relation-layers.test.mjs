import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import sampleSpec from './fixtures/official-relation-spec.sample.mjs';
import {
  loadOfficialRelationSpecs,
  officialRelationSpecs,
} from '../scripts/lib/official-relation-specs/index.mjs';
import { expandOfficialRelations, officialBasisText } from '../scripts/lib/official-relations.mjs';
import {
  classifyLegacyBasis,
  computeScope,
  deriveFacetKey,
  FACET_KEYS,
  normalizeCoverageGapSeverity,
  normalizeCoverageGapStatus,
  RELATION_ENUMS,
  relationId,
} from '../scripts/lib/relation-vocabulary.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const readData = (name) => JSON.parse(readFileSync(resolve(ROOT, 'data', 'kr', name), 'utf8'));

const OFFICIAL = readData('dependencies.json');
const CANDIDATE = readData('dependencies.candidate.json');
const TOPICS = readData('topics.json');
const STANDARDS = readData('curriculum-standards.json');
const MANIFEST = readData('manifest.json');
const TOPIC_BY_ID = new Map(TOPICS.topics.map((topic) => [topic.id, topic]));

function hasCycle(edges) {
  const adjacency = new Map();
  for (const edge of edges) {
    if (!adjacency.has(edge.topicId)) adjacency.set(edge.topicId, []);
    adjacency.get(edge.topicId).push(edge.prerequisiteId);
    if (!adjacency.has(edge.prerequisiteId)) adjacency.set(edge.prerequisiteId, []);
  }
  const state = new Map();
  const visit = (node) => {
    state.set(node, 1);
    for (const next of adjacency.get(node) ?? []) {
      const seen = state.get(next);
      if (seen === 1) return true;
      if (seen === undefined && visit(next)) return true;
    }
    state.set(node, 2);
    return false;
  };
  for (const node of adjacency.keys()) {
    if (!state.has(node) && visit(node)) return true;
  }
  return false;
}

// --- Contract section 7.1: layer invariants ---------------------------------

test('official layer carries only official-source required prerequisites with printed pages', () => {
  const sourceIds = new Set(STANDARDS.sources.map((source) => source.id));
  assert.equal(OFFICIAL.layer, 'official');
  assert.equal(OFFICIAL.edgeCount, OFFICIAL.dependencies.length);
  assert.ok(OFFICIAL.dependencies.length > 0, 'the official layer must not be empty');

  for (const relation of OFFICIAL.dependencies) {
    assert.equal(relation.layer, 'official', relation.id);
    assert.equal(relation.basisKind, 'official-source', relation.id);
    assert.equal(relation.relationKind, 'required-prerequisite', relation.id);
    assert.ok(
      ['internal-reviewed', 'subject-expert-reviewed', 'classroom-reviewed'].includes(relation.reviewStatus),
      relation.id,
    );
    assert.ok(Number.isInteger(relation.sourceLocator?.printedPage), relation.id);
    assert.ok(sourceIds.has(relation.sourceLocator.sourceId), relation.id);
    assert.ok(relation.sourceRefs.length >= 1, relation.id);
    for (const ref of relation.sourceRefs) assert.ok(sourceIds.has(ref), `${relation.id} ${ref}`);
    assert.ok(RELATION_ENUMS.scope.includes(relation.scope), relation.id);
    assert.equal(relation.id, relationId(relation.topicId, relation.prerequisiteId));
    // The official basis string must name the source document and a printed page.
    assert.match(relation.basis, /별책\s*\d+.* p\.\d+$/, relation.id);
    assert.match(relation.basis, /내용 체계표|성취기준 해설/, relation.id);
  }
});

test('candidate layer never claims an official source and stays recommended-before', () => {
  assert.equal(CANDIDATE.layer, 'pedagogical-candidate');
  assert.equal(CANDIDATE.edgeCount, CANDIDATE.dependencies.length);
  assert.ok(CANDIDATE.dependencies.length > 0);

  for (const relation of CANDIDATE.dependencies) {
    assert.equal(relation.layer, 'pedagogical-candidate', relation.id);
    assert.notEqual(relation.basisKind, 'official-source', relation.id);
    assert.ok(
      ['official-code-order', 'decomposition-order', 'repository-authored', 'expert-authored'].includes(
        relation.basisKind,
      ),
      `${relation.id}: ${relation.basisKind}`,
    );
    assert.equal(relation.relationKind, 'recommended-before', relation.id);
    assert.equal(relation.reviewStatus, 'candidate', relation.id);
    // The legacy hard/soft strength and free-text basis are preserved verbatim.
    assert.ok(['hard', 'soft'].includes(relation.strength), relation.id);
    assert.ok(typeof relation.basis === 'string' && relation.basis.length > 0, relation.id);
    assert.equal(relation.basisKind, classifyLegacyBasis(relation.basis), relation.id);
    assert.equal(relation.id, relationId(relation.topicId, relation.prerequisiteId));
  }
});

test('the two layers are disjoint and both are recorded in the manifest', () => {
  const officialPairs = new Set(
    OFFICIAL.dependencies.map((relation) => `${relation.topicId}->${relation.prerequisiteId}`),
  );
  for (const relation of CANDIDATE.dependencies) {
    assert.ok(
      !officialPairs.has(`${relation.topicId}->${relation.prerequisiteId}`),
      `pair promoted to official must leave the candidate layer: ${relation.id}`,
    );
  }

  for (const [layer, file] of [
    ['official', 'dependencies.json'],
    ['pedagogical-candidate', 'dependencies.candidate.json'],
  ]) {
    const entry = MANIFEST.relationLayers[layer];
    assert.equal(entry.file, file);
    const bytes = readFileSync(resolve(ROOT, 'data', 'kr', file));
    assert.equal(entry.bytes, bytes.length, file);
    assert.equal(entry.sha256, createHash('sha256').update(bytes).digest('hex'), file);
    assert.equal(MANIFEST.files[file].sha256, entry.sha256, file);
  }
  assert.equal(MANIFEST.counts.dependencies, OFFICIAL.edgeCount);
  assert.equal(MANIFEST.counts.candidateDependencies, CANDIDATE.edgeCount);
  assert.equal(MANIFEST.graphPolicy.edgeSelection, 'official-source-only');
});

// --- Contract section 7.2: graph invariants ---------------------------------

test('each layer and their union are acyclic, subject-local, and free of dangling ids', () => {
  const layers = [OFFICIAL.dependencies, CANDIDATE.dependencies];
  for (const edges of layers) {
    for (const edge of edges) {
      assert.ok(TOPIC_BY_ID.has(edge.topicId), edge.topicId);
      assert.ok(TOPIC_BY_ID.has(edge.prerequisiteId), edge.prerequisiteId);
      assert.notEqual(edge.topicId, edge.prerequisiteId);
      assert.equal(
        TOPIC_BY_ID.get(edge.topicId).subjectKorean,
        TOPIC_BY_ID.get(edge.prerequisiteId).subjectKorean,
        `cross-subject edge ${edge.id}`,
      );
    }
    assert.equal(hasCycle(edges), false);
  }
  assert.equal(hasCycle([...layers[0], ...layers[1]]), false, 'the union graph must be a DAG');
});

test('scope is the mechanical comparison of standard, domain, and subject', () => {
  for (const relation of [...OFFICIAL.dependencies, ...CANDIDATE.dependencies]) {
    assert.equal(
      relation.scope,
      computeScope(TOPIC_BY_ID.get(relation.topicId), TOPIC_BY_ID.get(relation.prerequisiteId)),
      relation.id,
    );
  }
});

// --- Contract section 7.3: topic fields -------------------------------------

test('every topic carries decompositionKind, one of the eight facets, and a standard key', () => {
  const standardKeys = new Set(
    STANDARDS.curricula.flatMap((curriculum) => curriculum.standards.map((standard) => standard.key)),
  );
  for (const topic of TOPICS.topics) {
    assert.equal(topic.decompositionKind, 'subject-facet', topic.id);
    assert.ok(FACET_KEYS.includes(topic.facetKey), `${topic.id}: ${topic.facetKey}`);
    assert.equal(topic.facetKey, deriveFacetKey(topic), topic.id);
    assert.equal(topic.standardKey, topic.standards[0], topic.id);
    assert.ok(standardKeys.has(topic.standardKey), topic.id);
    assert.equal(topic.sourceStandardCode, topic.standardKey.split(':').at(-1), topic.id);
    // Placeholder or null English titles are dropped rather than published.
    if ('titleEnglish' in topic) {
      assert.equal(typeof topic.titleEnglish, 'string', topic.id);
      assert.doesNotMatch(topic.titleEnglish, /micro-topic \d+/i, topic.id);
    }
  }
});

test('coverage gap severity and status use the controlled vocabulary and keep source values', () => {
  for (const gap of STANDARDS.coverageGaps) {
    assert.ok(['high', 'medium', 'low', 'intentional'].includes(gap.severity), gap.id);
    assert.ok(
      ['open', 'needs-review', 'resolved', 'intentional', 'out-of-scope'].includes(gap.status),
      gap.id,
    );
    if (gap.severitySource) assert.equal(gap.severity, normalizeCoverageGapSeverity(gap.severitySource, gap.status));
    if (gap.statusSource) assert.equal(gap.status, normalizeCoverageGapStatus(gap.statusSource));
  }
});

// --- Vocabulary and expansion units -----------------------------------------

test('classifyLegacyBasis maps the twelve legacy basis strings onto the shared vocabulary', () => {
  assert.equal(classifyLegacyBasis('within-standard decomposition order'), 'decomposition-order');
  assert.equal(classifyLegacyBasis('within-standard evidence-to-inquiry bridge'), 'decomposition-order');
  assert.equal(classifyLegacyBasis('within-standard language-to-reflection bridge'), 'decomposition-order');
  assert.equal(classifyLegacyBasis('official-code sequence within grade-band/domain'), 'official-code-order');
  assert.equal(classifyLegacyBasis('within-unit official sequence candidate'), 'official-code-order');
  assert.equal(classifyLegacyBasis('grade-band progression by domain'), 'repository-authored');
  assert.equal(classifyLegacyBasis('same-grade domain sequence candidate'), 'repository-authored');
  assert.equal(
    classifyLegacyBasis('cross-grade official linkage candidate from PDF 고려 사항 and content progression'),
    'repository-authored',
  );
  assert.equal(classifyLegacyBasis('workstream-authored'), 'repository-authored');
  assert.equal(classifyLegacyBasis(''), 'repository-authored');
  assert.equal(classifyLegacyBasis(undefined), 'repository-authored');
});

test('deriveFacetKey prefers the id suffix and falls back to the topic type', () => {
  assert.equal(deriveFacetKey({ id: 'kr.mt.x.concept', type: 'PROCEDURAL' }), 'concept');
  assert.equal(deriveFacetKey({ id: 'kr.mt.x.understand', type: 'PROCEDURAL' }), 'concept');
  assert.equal(deriveFacetKey({ id: 'kr.mt.x.perform', type: 'CONCEPTUAL' }), 'procedure');
  assert.equal(deriveFacetKey({ id: 'kr.mt.x.make', type: 'CONCEPTUAL' }), 'procedure');
  assert.equal(deriveFacetKey({ id: 'kr.mt.x.practice', type: 'CONCEPTUAL' }), 'application');
  assert.equal(deriveFacetKey({ id: 'kr.mt.x.evidence', type: 'CONCEPTUAL' }), 'inquiry');
  assert.equal(deriveFacetKey({ id: 'kr.mt.x.reflect', type: 'CONCEPTUAL' }), 'reflection');
  // Numeric and free-text suffixes fall through to the type map.
  assert.equal(deriveFacetKey({ id: 'kr.mt.x.01', type: 'LANGUAGE' }), 'communication');
  assert.equal(deriveFacetKey({ id: 'kr.mt.x.02', type: 'META' }), 'reflection');
  assert.equal(deriveFacetKey({ id: 'kr.mt.x.알파벳-소리', type: 'REPRESENTATIONAL' }), 'representation');
});

test('relationId is a deterministic 20-hex sha256 prefix of the ordered pair', () => {
  const id = relationId('kr.mt.a', 'kr.mt.b');
  assert.match(id, /^kr\.dep\.[0-9a-f]{20}$/);
  assert.equal(id, relationId('kr.mt.a', 'kr.mt.b'));
  assert.notEqual(id, relationId('kr.mt.b', 'kr.mt.a'));
  assert.equal(
    id,
    `kr.dep.${createHash('sha256').update('kr.mt.a->kr.mt.b').digest('hex').slice(0, 20)}`,
  );
});

test('official basis text names the notice, annex, section, and printed page', () => {
  assert.equal(
    officialBasisText({
      sourceName: '교육부 고시 제2022-33호 [별책8] 수학과 교육과정.pdf',
      sourceId: 'kr-ncic-math-pdf-2022',
      printedPage: 13,
      domainLabel: '수와 연산',
      tier: 'content-system',
    }),
    "교육부 고시 제2022-33호 별책8 내용 체계표 '수와 연산' p.13",
  );
  assert.equal(
    officialBasisText({
      sourceName: '교육부 고시 제2022-33호 [별책8] 수학과 교육과정.pdf',
      sourceId: 'kr-ncic-math-pdf-2022',
      printedPage: 17,
      tier: 'commentary',
    }),
    '교육부 고시 제2022-33호 별책8 성취기준 해설 p.17',
  );
});

test('the spec index loads every sibling module and tolerates a missing directory', async () => {
  assert.ok(officialRelationSpecs.length > 0, 'at least one subject spec module must be present');
  for (const spec of officialRelationSpecs) {
    assert.ok(spec.subject, 'spec needs a workstream subject key');
    assert.ok(spec.sourceId, `${spec.subject} needs a sourceId`);
    assert.match(spec.specFile, /\.mjs$/);
    assert.ok(Array.isArray(spec.contentSystemRequired));
    assert.ok(Array.isArray(spec.commentaryRequired));
    assert.ok(typeof spec.expansionRules === 'string' && spec.expansionRules.length > 0);
  }
  assert.deepEqual(await loadOfficialRelationSpecs(resolve(ROOT, 'does-not-exist')), []);
});

test('an injected spec expands code pairs onto concept topics with a printed-page locator', () => {
  const sourcesById = new Map(STANDARDS.sources.map((source) => [source.id, source]));
  const { relations, expansions } = expandOfficialRelations({
    specs: [sampleSpec],
    topics: TOPICS.topics,
    sourcesById,
  });
  assert.equal(relations.length, 2);
  assert.equal(expansions.length, 2);

  const [contentSystem] = relations.filter((relation) => relation.sourceLocator.section.startsWith('내용 체계표'));
  assert.equal(TOPIC_BY_ID.get(contentSystem.prerequisiteId).sourceStandardCode, '[2수01-01]');
  assert.equal(TOPIC_BY_ID.get(contentSystem.topicId).sourceStandardCode, '[4수01-01]');
  // Each standard is represented by its facetKey: concept topic.
  assert.equal(TOPIC_BY_ID.get(contentSystem.prerequisiteId).facetKey, 'concept');
  assert.equal(TOPIC_BY_ID.get(contentSystem.topicId).facetKey, 'concept');
  assert.equal(contentSystem.layer, 'official');
  assert.equal(contentSystem.strength, 'hard');
  assert.equal(contentSystem.sourceLocator.printedPage, 13);

  assert.throws(
    () => expandOfficialRelations({ specs: [{ ...sampleSpec, sourceId: 'nope' }], topics: TOPICS.topics, sourcesById }),
    /unknown sourceId/,
  );
  assert.throws(
    () =>
      expandOfficialRelations({
        specs: [{ ...sampleSpec, contentSystemRequired: [['[2수01-01]', '[9수99-99]', '수와 연산', 13]] }],
        topics: TOPICS.topics,
        sourcesById,
      }),
    /no topic for \[9수99-99\]/,
  );
});
