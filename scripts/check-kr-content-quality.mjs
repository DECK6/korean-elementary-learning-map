#!/usr/bin/env node
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FACET_OVERLAP_JACCARD_THRESHOLD,
  computeContentProvenanceMetrics,
  contentOverlayDirectory,
  facetOverlapCandidates,
  readContentOverlays,
  summaryByStandardKey,
} from './lib/kr-content-overlay.mjs';
import { FACET_COLLAPSE_RULES } from './lib/facet-collapse-rules.mjs';
import { computeContentQualityMetrics, contentQualityErrors } from './lib/kr-content-quality.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KR_DATA = process.env.KR_DATA_DIR ? resolve(process.env.KR_DATA_DIR) : resolve(ROOT, 'data', 'kr');
const WORKSTREAM_DIR = resolve(ROOT, 'data', 'kr', 'workstreams');
const finalTopics = JSON.parse(readFileSync(resolve(KR_DATA, 'topics.json'), 'utf8')).topics || [];
const workstreamTopics = readdirSync(WORKSTREAM_DIR)
  .filter((name) => name.endsWith('.json'))
  .sort()
  .flatMap((name) => JSON.parse(readFileSync(resolve(WORKSTREAM_DIR, name), 'utf8')).microTopics || []);

const checks = [
  ['generated topics', finalTopics],
  ['workstream topics', workstreamTopics],
];
let failed = false;
for (const [label, topics] of checks) {
  const metrics = computeContentQualityMetrics(topics);
  const errors = contentQualityErrors(topics);
  console.log(`${label}: ${JSON.stringify(metrics)}`);
  if (errors.length) {
    failed = true;
    for (const error of errors) console.error(`- ${label}: ${error}`);
  }
}

// 주제 콘텐츠 오버레이(P3-2) 지표: 출처 기반 초안 수, 완전 중복 evidence/prompt, 템플릿 비율.
const standardsFile = JSON.parse(readFileSync(resolve(KR_DATA, 'curriculum-standards.json'), 'utf8'));
const overlayFiles = readContentOverlays(contentOverlayDirectory(KR_DATA)).length;
const { metrics: provenance, errors: provenanceErrors } = computeContentProvenanceMetrics(
  finalTopics,
  summaryByStandardKey(standardsFile),
);
console.log(`content provenance: ${JSON.stringify({ ...provenance, overlayFiles })}`);
console.log(
  `${provenance.sourceGroundedDraft} source-grounded-draft / ${provenance.topics} topics, ` +
    `duplicates evidence ${provenance.duplicateEvidence} prompt ${provenance.duplicateAssessmentPrompt}, ` +
    `template ratio ${(provenance.templateRatio * 100).toFixed(1)}%, misconceptions ${provenance.misconceptions}`,
);
if (provenanceErrors.length) {
  failed = true;
  for (const error of provenanceErrors) console.error(`- content provenance: ${error}`);
}

// 계약 8절 자동 후보: 한 성취기준의 두 주제 오버레이가 이만큼 겹치면 facet 축약 후보로 보고한다.
// 규칙 파일에 없는 후보는 경고만 낸다(빌드 실패 아님).
const ruledCodes = new Set(FACET_COLLAPSE_RULES.map((rule) => rule.code));
const { candidates: overlapCandidates, maximum: overlapMaximum } = facetOverlapCandidates(finalTopics);
const unruledCandidates = overlapCandidates.filter((candidate) => !ruledCodes.has(candidate.standardCode));
console.log(
  `facet collapse: ${FACET_COLLAPSE_RULES.length} authored rules, ` +
    `${overlapCandidates.length} sibling pair(s) at or above Jaccard ${FACET_OVERLAP_JACCARD_THRESHOLD} ` +
    `(${unruledCandidates.length} not covered by a rule), highest sibling overlap ${overlapMaximum}`,
);
for (const candidate of unruledCandidates) {
  console.warn(
    `! facet collapse candidate ${candidate.standardCode} ${candidate.facetKeys.join('/')} ` +
      `Jaccard ${candidate.similarity}: ${candidate.topicIds.join(' ~ ')}`,
  );
}

// 계약 8절 게이트: official 층은 anchor 주제로만 전개하므로 auxiliary 끝점은 0이어야 한다.
const officialDependencies = JSON.parse(readFileSync(resolve(KR_DATA, 'dependencies.json'), 'utf8')).dependencies || [];
const topicById = new Map(finalTopics.map((topic) => [topic.id, topic]));
const auxiliaryEndpoints = officialDependencies.filter((edge) =>
  [edge.topicId, edge.prerequisiteId].some((id) => topicById.get(id)?.topicRole === 'auxiliary'),
);
console.log(`official layer auxiliary endpoints: ${auxiliaryEndpoints.length}`);
for (const edge of auxiliaryEndpoints) {
  console.warn(`! official relation touches an auxiliary topic ${edge.topicId} -> ${edge.prerequisiteId}`);
}

if (failed) process.exit(1);
console.log('✓ KR content quality gates passed.');
