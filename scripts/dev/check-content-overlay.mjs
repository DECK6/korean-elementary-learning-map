#!/usr/bin/env node
// Gate for content authors: node scripts/dev/check-content-overlay.mjs <file> [--slug <subject>-<gradeBand>]
// Checks one 주제 콘텐츠 오버레이 file before the build merges it — schema, dangling topic ids,
// verbatim official-summary copies, exact duplicates, minimum lengths, entry counts.
import Ajv2020 from 'ajv/dist/2020.js';
import { readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  OVERLAY_SCHEMA_FILE,
  SUBJECT_SLUGS,
  analyzeOverlay,
  parseOverlaySlug,
  standardsByKeyFrom,
} from '../lib/kr-content-overlay.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const KR_DATA = process.env.KR_DATA_DIR ? resolve(process.env.KR_DATA_DIR) : resolve(ROOT, 'data', 'kr');
const usage = 'usage: node scripts/dev/check-content-overlay.mjs <file> [--slug <subject>-<gradeBand>]';

const args = process.argv.slice(2);
let target = null;
let flagSlug = null;
for (let index = 0; index < args.length; index += 1) {
  const value = args[index];
  if (value.startsWith('--slug=')) flagSlug = value.slice('--slug='.length);
  else if (value === '--slug') flagSlug = args[(index += 1)];
  else if (!value.startsWith('--') && !target) target = value;
}
if (!target) {
  console.error(usage);
  process.exit(2);
}

const path = resolve(target);
const slug = flagSlug ?? basename(path, '.json');
const { subject, gradeBand } = parseOverlaySlug(slug);
if (!subject || !gradeBand) {
  console.error(`cannot tell which subject and grade band ${target} belongs to; pass --slug <subject>-<gradeBand>`);
  console.error(`known subjects: ${SUBJECT_SLUGS.join(', ')}; grade bands: 1-2, 3-4, 5-6`);
  process.exit(2);
}
if (!SUBJECT_SLUGS.includes(subject)) {
  console.error(`unknown subject key ${subject}; expected one of ${SUBJECT_SLUGS.join(', ')}`);
  process.exit(2);
}

const readData = (name) => JSON.parse(readFileSync(resolve(KR_DATA, name), 'utf8'));
const overlay = { file: basename(path), slug, path, subject, gradeBand, document: JSON.parse(readFileSync(path, 'utf8')) };
const topicsById = new Map((readData('topics.json').topics || []).map((topic) => [topic.id, topic]));
const standardsFile = readData('curriculum-standards.json');
const standardsByKey = standardsByKeyFrom(standardsFile);
const sourceIds = new Set((standardsFile.sources || []).map((source) => source.id));

const errors = [];
const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });
const validate = ajv.compile(JSON.parse(readFileSync(resolve(ROOT, 'schema', OVERLAY_SCHEMA_FILE), 'utf8')));
if (!validate(overlay.document)) {
  for (const error of validate.errors || []) errors.push(`schema ${error.instancePath || '/'} ${error.message}`);
}
for (const ref of overlay.document.sourceRefs || []) {
  if (!sourceIds.has(ref)) errors.push(`unresolved sourceRef ${ref}`);
}
for (const [topicId, entry] of Object.entries(overlay.document.entries || {})) {
  const sourceId = entry.sourceLocator?.sourceId;
  if (sourceId && !sourceIds.has(sourceId)) errors.push(`${topicId}: unresolved sourceLocator.sourceId ${sourceId}`);
}
const label = `content/${overlay.file}`;
const { errors: contentErrors, stats } = analyzeOverlay({ label, overlay, topicsById, standardsByKey });
errors.push(...contentErrors);

console.log(
  `${label}: ${stats.entries} entries, ${stats.evidence} evidence, ${stats.assessmentPrompt} prompts, ` +
    `${stats.misconceptions} misconceptions, ${stats.verbatim} verbatim copies, ${stats.duplicates} exact duplicates`,
);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('content overlay check passed');
