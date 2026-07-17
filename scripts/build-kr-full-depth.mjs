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
import { repairTopicRecords, resolveKoreanText } from './lib/kr-content-quality.mjs';
import {
  normalizeKrSourceRecord,
  normalizeKrSourceRefs,
  STALE_KR_SOURCE_IDS,
} from './lib/kr-source-provenance.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KR_DATA = resolve(ROOT, 'data', 'kr');
const WORKSTREAM_DIR = resolve(KR_DATA, 'workstreams');
const VERSION = 'kr-full-depth-v0.4';
const CREATED_AT = '2026-07-09';
const GENERATED_AT = '2026-07-09T00:00:00+09:00';
const MIN_TOPICS = 1500;

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
    coverageGaps.push({
      workstreamFile: file,
      subject: artifactSubject,
      subjectKorean: artifactSubjectKorean,
      ...body,
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
      license: 'Work-level KOGL and commercial-reuse permission are unresolved; see PROVENANCE.md. This dataset stores original summaries, provenance, and code anchors without verbatim standard text.',
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

const dependencies = [];
const dependencyKeys = new Set();
function addDependency(topicId, prerequisiteId, strength, reason, basis, source) {
  if (!topicById.has(topicId) || !topicById.has(prerequisiteId) || topicId === prerequisiteId) return false;
  const key = `${topicId}->${prerequisiteId}`;
  if (dependencyKeys.has(key)) return false;
  dependencyKeys.add(key);
  dependencies.push({ topicId, prerequisiteId, strength, reason, basis, source });
  return true;
}

for (const { file, data } of workstreams) {
  for (const dep of data.dependencySuggestions || []) {
    addDependency(
      dep.topicId,
      dep.prerequisiteId,
      dep.strength || 'soft',
      dep.reason || dep.rationale || 'Workstream-authored prerequisite suggestion.',
      dep.basis || dep.relationship || 'workstream-authored',
      `workstream:${file}`,
    );
  }
}

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

const dependenciesFile = {
  $schema: '../../schema/kr-dependencies.schema.json',
  version: VERSION,
  taxonomyVersion: VERSION,
  locale: 'ko-KR',
  country: 'KR',
  edgeCount: dependencies.length,
  graphPolicy: {
    relation: 'prerequisite',
    acyclic: true,
    edgeSelection: 'workstream-reviewed-only',
    crossSubjectEdges: 'none',
  },
  dependencies,
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
    dependencies: dependencies.length,
    clusters: clusters.length,
    standardMappings: mappings.length,
    coverageGaps: coverageGaps.length,
    workstreams: workstreams.length,
  },
  targets: {
    topicsAtLeast: MIN_TOPICS,
  },
  graphPolicy: dependenciesFile.graphPolicy,
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
      posture: 'Current accessible 2026 amendment retained with nine directly located 건강한 생활 standards.',
      standards: [...standardByKey.values()].filter((standard) => standard.code.startsWith('[2건')).length,
      topics: topics.filter((topic) => topic.domainKorean === '건강한 생활').length,
    },
  },
  workstreams: workstreamFiles,
  files,
  sourcePosture: {
    recordSchema: 'All integrated source records use id, name, url, accessDate, usage, and sourceType; stale portal aliases and dead notice URLs are excluded.',
    verification: 'Official-inventory gates bind every curriculum to an exact standard count and direct official PDF source.',
    workLevelReuseStatus: 'CLEARED: the cited Korean official curriculum documents are state-published public materials openly available from their original sources; see PROVENANCE.md.',
  },
});

console.log(
  `Built KR full-depth data: ${curricula.length} curricula, ${standardByKey.size} standards, ${topics.length} topics, ${dependencies.length} dependencies, ${clusters.length} clusters.`,
);
