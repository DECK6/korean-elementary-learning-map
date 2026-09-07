#!/usr/bin/env node
import { createHash } from 'node:crypto';
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyContentOverlay,
  contentOverlayDirectory,
  indexOverlayEntries,
  readContentOverlays,
} from './lib/kr-content-overlay.mjs';
import { repairTopicRecords, resolveKoreanText } from './lib/kr-content-quality.mjs';
import {
  normalizeKrSourceRecord,
  normalizeKrSourceRefs,
  STALE_KR_SOURCE_IDS,
} from './lib/kr-source-provenance.mjs';
import { candidateRelationSpecs } from './lib/candidate-relation-specs/index.mjs';
import {
  assertCollapseRulesWellFormed,
  facetCollapseRuleFor,
  FACET_COLLAPSE_RULES,
} from './lib/facet-collapse-rules.mjs';
import { officialRelationSpecs } from './lib/official-relation-specs/index.mjs';
import { anchorTopicsByCode, expandOfficialRelations } from './lib/official-relations.mjs';
import {
  anchorTopicOf,
  classifyLegacyBasis,
  computeScope,
  deriveFacetKey,
  normalizeCoverageGapSeverity,
  normalizeCoverageGapStatus,
  relationId,
  standardCodeOf,
} from './lib/relation-vocabulary.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KR_DATA = resolve(ROOT, 'data', 'kr');
const WORKSTREAM_DIR = resolve(KR_DATA, 'workstreams');
const VERSION = 'kr-full-depth-v0.5';
const CREATED_AT = '2026-07-09';
const GENERATED_AT = '2026-09-05T00:00:00+09:00';
const MIN_TOPICS = 1500;
// Cited editions whose enforcement date is later than the build date. Recorded
// under textPolicy so a consumer can tell "current notice" from "in force".
const EDITION_EFFECTIVE_FROM = [
  {
    sourceId: 'kr-ncic-2026-1-annex15-pdf',
    curriculumId: 'kr-2022-elem-integrated',
    effectiveFrom: '2028-03-01',
    note: '국가교육위원회 고시 제2026-1호 부칙: 초등학교 1·2학년은 2028-03-01부터 시행한다. 그 전 학년도의 현장 시행판은 교육부 고시 제2022-33호 [별책 15](첨부 10003571)이며, 이 데이터셋은 현행 고시본인 2026-1판을 따른다.',
  },
];
const TITLE_ENGLISH_PLACEHOLDER = /micro-topic\s+\d+/i;

const SUBJECT_ORDER = [
  '국어',
  '수학',
  '과학',
  '사회',
  '영어',
  '도덕',
  '실과(기술·가정)/정보',
  '통합교과',
  '미술',
  '음악',
  '체육',
];

const STATUS_RANK = {
  'official-source-checked': 0,
  'public-doc-derived': 1,
  'needs-official-code-check': 2,
};

const AGE_BY_GRADE_BAND = {
  '1-2': [6, 8],
  '3-4': [8, 10],
  '5-6': [10, 12],
};

const clone = (value) => JSON.parse(JSON.stringify(value));
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const writeJson = (path, value) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
};

function verificationMax(values) {
  let picked = 'official-source-checked';
  for (const value of values) {
    if ((STATUS_RANK[value] ?? 2) > (STATUS_RANK[picked] ?? 2)) picked = value;
  }
  return picked;
}

function codeSortKey(code = '') {
  const match = code.match(/^\[([246])([가-힣]+)(\d{2})-(\d{2})\]$/);
  if (!match) return [99, code, 99, 99];
  return [Number(match[1]), match[2], Number(match[3]), Number(match[4])];
}

function compareCode(a, b) {
  const ak = codeSortKey(a.code);
  const bk = codeSortKey(b.code);
  for (let i = 0; i < Math.max(ak.length, bk.length); i += 1) {
    if (ak[i] < bk[i]) return -1;
    if (ak[i] > bk[i]) return 1;
  }
  return String(a.key).localeCompare(String(b.key), 'ko');
}

function topicName(topic) {
  return topic.name || topic.title || topic.titleKorean || topic.titleEnglish || topic.summary || topic.id;
}

function topicSortKey(topic) {
  const standardKey = topic.standards?.[0] || '';
  const code = standardKey.includes(':') ? standardKey.split(':').at(-1) : '';
  return [...codeSortKey(code), topic.id];
}

function compareTopic(a, b) {
  const ak = topicSortKey(a);
  const bk = topicSortKey(b);
  for (let i = 0; i < Math.max(ak.length, bk.length); i += 1) {
    if (ak[i] < bk[i]) return -1;
    if (ak[i] > bk[i]) return 1;
  }
  return a.id.localeCompare(b.id, 'ko');
}

function sourceUrls(sourceIds, sourcesById) {
  return [...sourceIds]
    .map((id) => sourcesById.get(id)?.url)
    .filter(Boolean)
    .filter((url, index, arr) => arr.indexOf(url) === index);
}

function normalizePrompt(topic) {
  const name = topicName(topic);
  const prompt = topic.assessmentPrompt || `${name}을/를 설명하고 적용할 수 있는지 관찰 과제로 확인한다.`;
  return resolveKoreanText(prompt.replaceAll('{{name}}', name));
}

function normalizeEvidence(topic, standardByKey) {
  const evidence = Array.isArray(topic.evidence) ? clone(topic.evidence) : [];
  if (evidence.length) return evidence;
  const standardKey = topic.standards?.[0];
  const standard = standardByKey.get(standardKey);
  return [
    {
      evidenceType: 'source-to-topic-decomposition',
      basis: `${standard?.code || standardKey || '성취기준'}에서 분해한 세부 주제이며 공식 원문은 재수록하지 않는다.`,
    },
  ];
}

function parentSummaryFor(cluster) {
  if (cluster.parentSummary) return cluster.parentSummary;
  const parts = [
    cluster.subjectKorean,
    cluster.gradeBand ? `${cluster.gradeBand}학년군` : null,
    cluster.domainKorean || cluster.domain,
    cluster.unit || cluster.module || cluster.lifeQuestionKorean || cluster.curriculumAreaKorean,
  ].filter(Boolean);
  const label = parts.join(' ');
  return `학부모는 이 묶음을 통해 ${label}에서 아이가 배우는 핵심 주제, 활동 증거, 평가 질문을 한눈에 확인할 수 있다.`;
}

function walkJsonFiles(dir) {
  const files = [];
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) files.push(...walkJsonFiles(path));
    else if (name.endsWith('.json') && name !== 'manifest.json') files.push(path);
  }
  return files;
}

const workstreamFiles = readdirSync(WORKSTREAM_DIR)
  .filter((name) => name.endsWith('.json'))
  .sort();

const workstreams = workstreamFiles.map((file) => ({
  file,
  data: readJson(resolve(WORKSTREAM_DIR, file)),
}));

const sourcesById = new Map();
const standardByKey = new Map();
const topicById = new Map();
const mappingByPair = new Map();
const clustersById = new Map();
const coverageGaps = [];

for (const { file, data } of workstreams) {
  for (const source of data.sources || []) {
    if (STALE_KR_SOURCE_IDS.has(source.id)) continue;
    if (!sourcesById.has(source.id)) sourcesById.set(source.id, normalizeKrSourceRecord(source, file));
  }

  for (const standard of data.standards || []) {
    const normalized = {
      ...clone(standard),
      key: standard.key || `${data.curriculumId}:${standard.code}`,
      sourceRefs: normalizeKrSourceRefs(standard.sourceRefs),
      sourceTextIncluded: false,
      workstreamFile: file,
    };
    if (!normalized.sourceBasis) {
      normalized.sourceBasis =
        data.sourceBasis ||
        data.sourcePosture ||
        `${normalized.subjectKorean} workstream evidence records the source posture for ${normalized.code}; official standard text is not reproduced.`;
    }
    standardByKey.set(normalized.key, normalized);
  }

  for (const topic of data.microTopics || []) {
    const normalized = {
      ...clone(topic),
      name: topic.name || topic.title || topic.titleKorean || topic.titleEnglish || topic.summary || topic.id,
      title: topic.title || topic.name || topic.titleKorean || topic.titleEnglish || topic.summary || topic.id,
      description: topic.description || topic.summary || topic.name || topic.title || topic.id,
      evidence: clone(Array.isArray(topic.evidence) ? topic.evidence : []),
      assessmentPrompt: normalizePrompt(topic),
      sourceTextIncluded: false,
      workstreamFile: file,
    };
    const topicStandards = (normalized.standards || []).map((key) => standardByKey.get(key)).filter(Boolean);
    if (!STATUS_RANK.hasOwnProperty(normalized.verificationStatus)) {
      normalized.verificationStatus = verificationMax(topicStandards.map((standard) => standard.verificationStatus));
    }
    normalized.sourceRefs = [
      ...new Set(normalizeKrSourceRefs([
        ...(normalized.sourceRefs || []),
        ...topicStandards.flatMap((standard) => standard.sourceRefs || []),
      ])),
    ].sort();
    normalized.generationBasis ||=
      normalized.sourceBasis ||
      `${normalized.standards?.[0] || '연결 성취기준'}에서 ${file} workstream의 검토 가능한 주제·증거·평가 필드를 통합했다.`;
    if (normalized.ageRangeStart == null || normalized.ageRangeEnd == null) {
      const ages = AGE_BY_GRADE_BAND[normalized.gradeBand];
      if (ages) {
        normalized.ageRangeStart ??= ages[0];
        normalized.ageRangeEnd ??= ages[1];
      }
    }
    topicById.set(normalized.id, normalized);
  }

  for (const mapping of data.standardMappings || []) {
    mappingByPair.set(`${mapping.standardKey}->${mapping.microTopicId}`, {
      relationship: 'supports',
      confidence: 'workstream-reviewed',
      ...clone(mapping),
      workstreamFile: file,
    });
  }

  for (const cluster of data.clusters || []) {
    const topics = [...(cluster.topics || [])];
    clustersById.set(cluster.id, {
      ...clone(cluster),
      name: cluster.name || cluster.title || cluster.titleKorean || `${cluster.subjectKorean} ${cluster.gradeBand || ''} ${cluster.domainKorean || cluster.domain || ''}`.trim(),
      summary:
        cluster.summary ||
        cluster.description ||
        `${cluster.subjectKorean} ${cluster.gradeBand || ''} ${cluster.domainKorean || cluster.domain || ''} 세부 주제를 묶은 클러스터입니다.`.trim(),
      parentSummary: parentSummaryFor(cluster),
      topicCount: topics.length,
      topics,
      workstreamFile: file,
    });
  }

  const artifactSubject = typeof data.subject === 'object' ? data.subject?.subject : data.subject;
  const artifactSubjectKorean =
    data.subjectKorean ||
    (typeof data.subject === 'object' ? data.subject?.subjectKorean : undefined) ||
    data.standards?.[0]?.subjectKorean;
  for (const gap of data.coverageGaps || []) {
    const body = typeof gap === 'string' ? { description: gap } : clone(gap);
    body.description ||= body.note || body.gap || body.issue || body.title || body.id || 'Documented workstream coverage gap.';
    const status = normalizeCoverageGapStatus(body.status);
    const severity = normalizeCoverageGapSeverity(body.severity, status);
    coverageGaps.push({
      workstreamFile: file,
      subject: artifactSubject,
      subjectKorean: artifactSubjectKorean,
      ...body,
      severity,
      status,
      ...(body.severity ? { severitySource: body.severity } : {}),
      ...(body.status ? { statusSource: body.status } : {}),
      ...(body.sourceRefs ? { sourceRefs: normalizeKrSourceRefs(body.sourceRefs) } : {}),
    });
  }
}

for (const topic of topicById.values()) {
  topic.evidence = normalizeEvidence(topic, standardByKey);
}

const repairedTopics = repairTopicRecords([...topicById.values()]);
topicById.clear();
for (const topic of repairedTopics) topicById.set(topic.id, topic);

// K-12 common topic fields (contract section 4). Elementary decomposition is
// always subject-facet; facetKey comes from the id suffix with a `type` fallback.
for (const topic of topicById.values()) {
  topic.decompositionKind = 'subject-facet';
  topic.facetKey = deriveFacetKey(topic);
  topic.standardKey = topic.standards?.[0] ?? null;
  const code = standardCodeOf(topic);
  if (code) topic.sourceStandardCode = code;
  if (topic.titleEnglish === null || TITLE_ENGLISH_PLACEHOLDER.test(String(topic.titleEnglish ?? ''))) {
    delete topic.titleEnglish;
  }
}

// Topic roles and facet collapse (contract section 8). Every standard gets exactly one anchor; the
// facets an authored rule names become auxiliary and point at the sibling a tutor shows instead.
// No topic is dropped, so ids, overlays, clusters, and relations all keep their referents.
assertCollapseRulesWellFormed();
const topicsByStandardKey = new Map();
for (const topic of topicById.values()) {
  const key = topic.standardKey;
  if (!topicsByStandardKey.has(key)) topicsByStandardKey.set(key, []);
  topicsByStandardKey.get(key).push(topic);
}
const appliedCollapseCodes = new Set();
let auxiliaryTopicCount = 0;
for (const [standardKey, members] of topicsByStandardKey) {
  const anchor = anchorTopicOf(members);
  const rule = facetCollapseRuleFor(standardCodeOf(anchor));
  const byFacetKey = new Map(members.map((topic) => [topic.facetKey, topic]));
  const auxiliaryFacetKeys = new Set(rule?.auxiliaryFacetKeys ?? []);
  if (rule) {
    appliedCollapseCodes.add(rule.code);
    if (auxiliaryFacetKeys.has(anchor.facetKey)) {
      throw new Error(`facet collapse rule ${rule.code}: the anchor facet ${anchor.facetKey} cannot be auxiliary`);
    }
    for (const facetKey of auxiliaryFacetKeys) {
      if (!byFacetKey.has(facetKey)) {
        throw new Error(`facet collapse rule ${rule.code}: ${standardKey} has no ${facetKey} topic`);
      }
    }
  }
  const collapseTarget = rule?.collapseIntoFacetKey ? byFacetKey.get(rule.collapseIntoFacetKey) : anchor;
  if (rule?.collapseIntoFacetKey && !collapseTarget) {
    throw new Error(`facet collapse rule ${rule.code}: ${standardKey} has no ${rule.collapseIntoFacetKey} topic`);
  }
  for (const topic of members) {
    delete topic.collapseInto;
    delete topic.collapseReason;
    if (topic.id === anchor.id) {
      topic.topicRole = 'anchor';
    } else if (auxiliaryFacetKeys.has(topic.facetKey)) {
      topic.topicRole = 'auxiliary';
      topic.collapseInto = collapseTarget.id;
      topic.collapseReason = rule.reason;
      auxiliaryTopicCount += 1;
    } else {
      topic.topicRole = 'facet';
    }
  }
}
for (const rule of FACET_COLLAPSE_RULES) {
  if (!appliedCollapseCodes.has(rule.code)) {
    throw new Error(`facet collapse rule ${rule.code} matches no achievement standard`);
  }
}

// Contract section 9: the anchor topic represents and assesses its own achievement standard.
// Every other alignment keeps the relationship the workstream recorded.
let anchorAlignmentsRaised = 0;
for (const mapping of mappingByPair.values()) {
  const topic = topicById.get(mapping.microTopicId);
  if (topic?.topicRole !== 'anchor' || topic.standardKey !== mapping.standardKey) continue;
  if (mapping.relationship === 'assesses') continue;
  mapping.relationship = 'assesses';
  anchorAlignmentsRaised += 1;
}
const assessesAlignmentCount = [...mappingByPair.values()].filter(
  (mapping) => mapping.relationship === 'assesses',
).length;

// 주제 콘텐츠 오버레이(P3-2). data/kr/content 디렉터리가 없으면 기계적 템플릿을 그대로 둔다.
const contentOverlays = readContentOverlays(contentOverlayDirectory(KR_DATA));
const { entries: contentOverlayEntries, errors: contentOverlayErrors } = indexOverlayEntries(contentOverlays);
if (contentOverlayErrors.length) throw new Error(contentOverlayErrors.join('\n'));
const unusedOverlayEntries = new Set(contentOverlayEntries.keys());
let sourceGroundedTopicCount = 0;
for (const topic of topicById.values()) {
  if (!applyContentOverlay(topic, contentOverlayEntries.get(topic.id))) continue;
  unusedOverlayEntries.delete(topic.id);
  sourceGroundedTopicCount += 1;
}
if (unusedOverlayEntries.size > 0) {
  throw new Error(
    `data/kr/content: ${unusedOverlayEntries.size} overlay entries reference unknown topics ` +
      `(${[...unusedOverlayEntries].slice(0, 3).join(', ')})`,
  );
}

const standardByCurriculum = new Map();
for (const standard of standardByKey.values()) {
  const curriculumId = standard.key.split(':')[0];
  if (!standardByCurriculum.has(curriculumId)) standardByCurriculum.set(curriculumId, []);
  standardByCurriculum.get(curriculumId).push(standard);
}

const curricula = [...standardByCurriculum.entries()]
  .map(([id, standards]) => {
    standards.sort(compareCode);
    const first = standards[0];
    const sourceIds = new Set(standards.flatMap((standard) => standard.sourceRefs || []));
    const verificationStatus = verificationMax(standards.map((standard) => standard.verificationStatus));
    return {
      id,
      slug: id,
      country: 'KR',
      subject: first.subject,
      subjectKorean: first.subjectKorean,
      schoolLevel: 'elementary',
      name: `${first.subjectKorean} 2022 개정 초등 교육과정`,
      version: '2022 revised national curriculum',
      sourceIds: [...sourceIds].sort(),
      sourceUrls: sourceUrls(sourceIds, sourcesById),
      textIncluded: false,
      license: 'MIT (repository code and derived data). The cited Korean curriculum documents are state-published public materials openly available from their original sources; work-level reuse is CLEARED with attribution. See LICENSE and PROVENANCE.md. This dataset stores original summaries, provenance, and code anchors without verbatim standard text.',
      verificationStatus,
      sourceBasis: `Integrated from workstream artifacts for ${first.subjectKorean}; official text is not reproduced.`,
      standardCount: standards.length,
      standards,
    };
  })
  .sort((a, b) => {
    const ai = SUBJECT_ORDER.indexOf(a.subjectKorean);
    const bi = SUBJECT_ORDER.indexOf(b.subjectKorean);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.id.localeCompare(b.id);
  });

const topics = [...topicById.values()].sort(compareTopic);
const clusters = [...clustersById.values()].sort((a, b) => a.id.localeCompare(b.id, 'ko'));
const mappings = [...mappingByPair.values()].sort(
  (a, b) =>
    a.standardKey.localeCompare(b.standardKey, 'ko') ||
    a.microTopicId.localeCompare(b.microTopicId, 'ko'),
);

// Layer 1 — official: only what a subject spec module backs with a printed page.
const { relations: officialDependencies } = expandOfficialRelations({
  specs: officialRelationSpecs,
  topics,
  sourcesById,
});
const officialPairs = new Set();
for (const relation of officialDependencies) {
  officialPairs.add(`${relation.topicId}->${relation.prerequisiteId}`);
  // Reverse direction too: an official edge outranks the candidate ordering and
  // keeping both would make the union graph cyclic.
  officialPairs.add(`${relation.prerequisiteId}->${relation.topicId}`);
}

// Union graph reachability, seeded with the official layer. Candidate edges that
// would contradict an official ordering are dropped: official always wins.
const unionEdges = new Map();
const addUnionEdge = (from, to) => {
  if (!unionEdges.has(from)) unionEdges.set(from, new Set());
  unionEdges.get(from).add(to);
};
for (const relation of officialDependencies) addUnionEdge(relation.topicId, relation.prerequisiteId);
function unionReaches(start, target) {
  const stack = [start];
  const seen = new Set();
  while (stack.length > 0) {
    const node = stack.pop();
    if (node === target) return true;
    if (seen.has(node)) continue;
    seen.add(node);
    for (const next of unionEdges.get(node) || []) stack.push(next);
  }
  return false;
}

// Layer 2 — pedagogical candidate: every workstream suggestion, vocabulary-normalized.
const candidateDependencies = [];
const candidateKeys = new Set();
let officialPromotions = 0;
let candidateConflicts = 0;

// Authored candidate edges (contract section 9). A review document decided these code pairs; no
// workstream suggests them, and the official layer cannot hold them because the source sentence
// states the link in both directions. Expanded through the same anchor topics as the official layer.
const anchorsByCode = anchorTopicsByCode(topics);
let candidateSpecEdges = 0;
for (const spec of candidateRelationSpecs) {
  const source = sourcesById.get(spec.sourceId);
  if (!source) throw new Error(`candidate relation spec ${spec.subject}: unknown sourceId ${spec.sourceId}`);
  for (const [fromCode, toCode, printedPage, note] of spec.recommendedBefore || []) {
    const prerequisiteTopic = anchorsByCode.get(fromCode);
    const dependentTopic = anchorsByCode.get(toCode);
    if (!prerequisiteTopic || !dependentTopic) {
      throw new Error(
        `candidate relation spec ${spec.subject}: no topic for ${!prerequisiteTopic ? fromCode : toCode}`,
      );
    }
    if (!Number.isInteger(printedPage)) {
      throw new Error(`candidate relation spec ${spec.subject}: printedPage must be an integer for ${fromCode}->${toCode}`);
    }
    const key = `${dependentTopic.id}->${prerequisiteTopic.id}`;
    if (officialPairs.has(key) || candidateKeys.has(key)) {
      throw new Error(`candidate relation spec ${spec.subject}: ${fromCode}->${toCode} is already claimed by another edge`);
    }
    candidateKeys.add(key);
    addUnionEdge(dependentTopic.id, prerequisiteTopic.id);
    candidateDependencies.push({
      id: relationId(dependentTopic.id, prerequisiteTopic.id),
      layer: 'pedagogical-candidate',
      topicId: dependentTopic.id,
      prerequisiteId: prerequisiteTopic.id,
      relationKind: 'recommended-before',
      basisKind: 'repository-authored',
      scope: computeScope(dependentTopic, prerequisiteTopic),
      strength: 'soft',
      reviewStatus: 'candidate',
      reason: `${fromCode} → ${toCode}: 공식 문장이 양방향 연계를 서술해 선후를 확정할 수 없으므로 권장 순서로만 남긴다. ${note}`,
      basis: `${source.name} 성취기준 적용 시 고려 사항 p.${printedPage} (연계 서술, 방향 미판정)`,
      source: `candidate-relation-spec:${spec.specFile || `${spec.subject}.mjs`}`,
      sourceRefs: [
        ...new Set([
          spec.sourceId,
          ...(dependentTopic.sourceRefs || []),
          ...(prerequisiteTopic.sourceRefs || []),
        ]),
      ].sort(),
    });
    candidateSpecEdges += 1;
  }
}
for (const { file, data } of workstreams) {
  for (const dep of data.dependencySuggestions || []) {
    const topic = topicById.get(dep.topicId);
    const prerequisite = topicById.get(dep.prerequisiteId);
    if (!topic || !prerequisite || dep.topicId === dep.prerequisiteId) continue;
    const key = `${dep.topicId}->${dep.prerequisiteId}`;
    if (candidateKeys.has(key)) continue;
    if (officialPairs.has(key)) {
      officialPromotions += 1;
      candidateKeys.add(key);
      continue;
    }
    if (unionReaches(dep.prerequisiteId, dep.topicId)) {
      candidateConflicts += 1;
      candidateKeys.add(key);
      continue;
    }
    candidateKeys.add(key);
    addUnionEdge(dep.topicId, dep.prerequisiteId);
    const basis = dep.basis || dep.relationship || 'workstream-authored';
    candidateDependencies.push({
      id: relationId(dep.topicId, dep.prerequisiteId),
      layer: 'pedagogical-candidate',
      topicId: dep.topicId,
      prerequisiteId: dep.prerequisiteId,
      relationKind: 'recommended-before',
      basisKind: classifyLegacyBasis(basis),
      scope: computeScope(topic, prerequisite),
      strength: dep.strength || 'soft',
      reviewStatus: 'candidate',
      reason: dep.reason || dep.rationale || 'Workstream-authored prerequisite suggestion.',
      basis,
      source: `workstream:${file}`,
      sourceRefs: [
        ...new Set([...(topic.sourceRefs || []), ...(prerequisite.sourceRefs || [])]),
      ].sort(),
    });
  }
}
candidateDependencies.sort(
  (left, right) =>
    left.topicId.localeCompare(right.topicId) || left.prerequisiteId.localeCompare(right.prerequisiteId),
);

const sources = [...sourcesById.values()].sort((a, b) => a.id.localeCompare(b.id));
const aggregateVerification = verificationMax([
  ...curricula.map((curriculum) => curriculum.verificationStatus),
  ...topics.map((topic) => topic.verificationStatus),
]);

const curriculumStandards = {
  $schema: '../../schema/kr-curriculum-standards.schema.json',
  dataset: 'Korean Elementary Learning Map full-depth integrated workstream build',
  taxonomyVersion: VERSION,
  locale: 'ko-KR',
  country: 'KR',
  status: 'integrated-workstream-candidate',
  verificationStatus: aggregateVerification,
  sourceBasis:
    'Merged subject workstream artifacts generated from the Korean 2022 revised curriculum source posture; stores code anchors, original summaries, provenance, mappings, and coverage gaps without copying official standard text.',
  createdAt: CREATED_AT,
  generatedAt: GENERATED_AT,
  textPolicy: {
    standardTextIncluded: false,
    summaryPolicy: 'Original summaries, source-derived paraphrases, evidence notes, and assessment prompts only; no bulk verbatim curriculum text.',
    licensingStatus: 'public-government-document',
    licenseCaution: 'CLEARED: the cited Korean curriculum documents are state-published public materials openly available from their original sources (Ministry of Education, National Education Commission, NCIC). Preserve attribution and see PROVENANCE.md.',
    // Edition policy: pin every subject to the notice edition NCIC currently
    // serves, not to the edition in force in classrooms. Where the two differ,
    // the difference is recorded here and on the affected standards rather than
    // by keeping two parallel inventories.
    sourceEditionPolicy: 'Current notice edition ("현행 고시본"), not the edition currently enforced ("현재 시행판"). Where a cited edition is not yet enforced, the affected standards carry effectiveFrom and the entry is listed in effectiveFrom below.',
    effectiveFrom: EDITION_EFFECTIVE_FROM,
  },
  sourceCount: sources.length,
  sources,
  curriculumCount: curricula.length,
  standardCount: standardByKey.size,
  microTopicCount: topics.length,
  mappingCount: mappings.length,
  coverageGapCount: coverageGaps.length,
  curricula,
  standardMappings: mappings,
  coverageGaps,
};

const topicsFile = {
  $schema: '../../schema/kr-topics.schema.json',
  version: VERSION,
  taxonomyVersion: VERSION,
  locale: 'ko-KR',
  country: 'KR',
  topicCount: topics.length,
  topics,
};

const relationLayerPolicy = {
  official: {
    file: 'dependencies.json',
    relationKind: 'required-prerequisite',
    basisKind: 'official-source',
    reviewStatus: 'internal-reviewed',
    edgeCount: officialDependencies.length,
    derivesOntologyViews: true,
    note: 'Only official-source relations are materialized as directRequires/unlocks/indirectRequires.',
  },
  'pedagogical-candidate': {
    file: 'dependencies.candidate.json',
    relationKind: 'recommended-before',
    basisKind: 'official-code-order | decomposition-order | repository-authored',
    reviewStatus: 'candidate',
    edgeCount: candidateDependencies.length,
    derivesOntologyViews: false,
    note: 'Product surfaces these as recommended order only; they are not prerequisite claims.',
  },
};

const dependenciesFile = {
  $schema: '../../schema/kr-dependencies.schema.json',
  version: VERSION,
  taxonomyVersion: VERSION,
  locale: 'ko-KR',
  country: 'KR',
  layer: 'official',
  edgeCount: officialDependencies.length,
  graphPolicy: {
    relation: 'prerequisite',
    acyclic: true,
    edgeSelection: 'official-source-only',
    crossSubjectEdges: 'none',
    layers: relationLayerPolicy,
  },
  dependencies: officialDependencies,
};

const candidateDependenciesFile = {
  $schema: '../../schema/kr-dependencies-candidate.schema.json',
  version: VERSION,
  taxonomyVersion: VERSION,
  locale: 'ko-KR',
  country: 'KR',
  layer: 'pedagogical-candidate',
  edgeCount: candidateDependencies.length,
  graphPolicy: {
    relation: 'recommended-order',
    acyclic: true,
    edgeSelection: 'pedagogical-candidate-only',
    crossSubjectEdges: 'none',
    layers: relationLayerPolicy,
  },
  dependencies: candidateDependencies,
};

const clustersFile = {
  $schema: '../../schema/kr-clusters.schema.json',
  version: VERSION,
  taxonomyVersion: VERSION,
  locale: 'ko-KR',
  country: 'KR',
  clusterCount: clusters.length,
  coveragePolicy: {
    membership: 'at-least-one',
    minimumMembership: 1,
    allowMultiple: true,
  },
  clusters,
};

if (topics.length < MIN_TOPICS) throw new Error(`KR topic target missed: ${topics.length} < ${MIN_TOPICS}`);

writeJson(resolve(KR_DATA, 'curriculum-standards.json'), curriculumStandards);
writeJson(resolve(KR_DATA, 'topics.json'), topicsFile);
writeJson(resolve(KR_DATA, 'dependencies.json'), dependenciesFile);
writeJson(resolve(KR_DATA, 'dependencies.candidate.json'), candidateDependenciesFile);
writeJson(resolve(KR_DATA, 'clusters.json'), clustersFile);

const files = {};
for (const path of walkJsonFiles(KR_DATA)) {
  const rel = relative(KR_DATA, path);
  const bytes = readFileSync(path);
  files[rel] = {
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

writeJson(resolve(KR_DATA, 'manifest.json'), {
  dataset: curriculumStandards.dataset,
  taxonomyVersion: VERSION,
  generatedAt: GENERATED_AT,
  locale: 'ko-KR',
  country: 'KR',
  status: curriculumStandards.status,
  verificationStatus: aggregateVerification,
  counts: {
    sources: sources.length,
    curricula: curricula.length,
    standards: standardByKey.size,
    topics: topics.length,
    dependencies: officialDependencies.length,
    candidateDependencies: candidateDependencies.length,
    clusters: clusters.length,
    standardMappings: mappings.length,
    coverageGaps: coverageGaps.length,
    workstreams: workstreams.length,
    contentOverlayFiles: contentOverlays.length,
    sourceGroundedTopics: sourceGroundedTopicCount,
    anchorTopics: topicsByStandardKey.size,
    auxiliaryTopics: auxiliaryTopicCount,
    assessesAlignments: assessesAlignmentCount,
  },
  targets: {
    topicsAtLeast: MIN_TOPICS,
  },
  graphPolicy: dependenciesFile.graphPolicy,
  relationLayers: {
    official: {
      file: 'dependencies.json',
      edgeCount: officialDependencies.length,
      bytes: files['dependencies.json'].bytes,
      sha256: files['dependencies.json'].sha256,
    },
    'pedagogical-candidate': {
      file: 'dependencies.candidate.json',
      edgeCount: candidateDependencies.length,
      bytes: files['dependencies.candidate.json'].bytes,
      sha256: files['dependencies.candidate.json'].sha256,
      supersededByOfficial: officialPromotions,
      droppedForOfficialOrdering: candidateConflicts,
      authoredFromSpecs: candidateSpecEdges,
    },
  },
  coverageNotes: {
    social: {
      posture: 'Korea-first official Annex 7 inventory; no imported US/UK social-studies defaults.',
      standards: standardByCurriculum.get('kr-2022-elem-social-studies')?.length || 0,
      topics: topics.filter((topic) => topic.subjectKorean === '사회').length,
    },
    englishEfl: {
      posture: 'Korean-learner EFL with listening, speaking, phonics, vocabulary, reading, writing, interaction, media, strategy, and culture task families; not native ELA.',
      standards: standardByCurriculum.get('kr-2022-elem-english-efl')?.length || 0,
      topics: topics.filter((topic) => topic.subjectKorean === '영어').length,
    },
    artsAndPhysicalEducation: {
      posture: 'Direct Annex 11-13 inventories for grades 3-6; grades 1-2 arts and movement remain in integrated subjects rather than synthetic standalone codes.',
      standards: ['kr-2022-elem-art', 'kr-2022-elem-music', 'kr-2022-elem-physical-education']
        .reduce((count, id) => count + (standardByCurriculum.get(id)?.length || 0), 0),
      topics: topics.filter((topic) => ['미술', '음악', '체육'].includes(topic.subjectKorean)).length,
    },
    amendedAnnex15: {
      posture:
        'Integrated subjects are pinned to the 2026-1 amended Annex 15 alone (attachment 10004214): 바 16 + 슬 16 + 건 9 + 즐 16. The 2022-33 Annex 15 is no longer cited because the amendment reassigned every 즐거운 생활 code.',
      standards: standardByCurriculum.get('kr-2022-elem-integrated')?.length || 0,
      healthStandards: [...standardByKey.values()].filter((standard) => standard.code.startsWith('[2건')).length,
      joyfulStandards: [...standardByKey.values()].filter((standard) => standard.code.startsWith('[2즐')).length,
      topics: topics.filter((topic) => topic.subjectKorean === '통합교과').length,
    },
  },
  workstreams: workstreamFiles,
  files,
  sourcePosture: {
    recordSchema: 'All integrated source records use id, name, url, accessDate, usage, and sourceType; stale portal aliases and dead notice URLs are excluded.',
    verification: 'Official-inventory gates bind every curriculum to an exact standard count, an exact code-set digest, and a direct official PDF source.',
    editionPolicy: curriculumStandards.textPolicy.sourceEditionPolicy,
    effectiveFrom: EDITION_EFFECTIVE_FROM,
    workLevelReuseStatus: 'CLEARED: the cited Korean official curriculum documents are state-published public materials openly available from their original sources; see PROVENANCE.md.',
  },
});

console.log(
  `Built KR full-depth data: ${curricula.length} curricula, ${standardByKey.size} standards, ${topics.length} topics, ` +
    `${officialDependencies.length} official + ${candidateDependencies.length} candidate relations, ${clusters.length} clusters. ` +
    `Roles: ${topicsByStandardKey.size} anchor / ${auxiliaryTopicCount} auxiliary, ` +
    `${assessesAlignmentCount} assesses alignments (${anchorAlignmentsRaised} raised for anchors), ` +
    `${candidateSpecEdges} authored candidate edges.`,
);
