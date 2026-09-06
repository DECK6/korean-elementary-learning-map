#!/usr/bin/env node
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  computeContentProvenanceMetrics,
  contentOverlayDirectory,
  readContentOverlays,
  summaryByStandardKey,
} from './lib/kr-content-overlay.mjs';
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

if (failed) process.exit(1);
console.log('✓ KR content quality gates passed.');
