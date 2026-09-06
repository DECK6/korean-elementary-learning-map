#!/usr/bin/env node
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentQualityErrors, repairWorkstreamContent } from './lib/kr-content-quality.mjs';
import { STANDARD_SUMMARY_KIND, standardSummary } from './lib/kr-standard-summaries.mjs';
import {
  KR_SOURCE_ALIAS_REPLACEMENTS,
  normalizeKrSourceRecord,
  normalizeKrSourceRefs,
  STALE_KR_SOURCE_IDS,
} from './lib/kr-source-provenance.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORKSTREAM_DIR = resolve(ROOT, 'data', 'kr', 'workstreams');
const files = readdirSync(WORKSTREAM_DIR)
  .filter((name) => name.endsWith('.json'))
  .sort();

let topicCount = 0;

function normalizeSourceAliases(value, governingSourceId) {
  if (Array.isArray(value)) return value.map((item) => normalizeSourceAliases(item, governingSourceId));
  if (!value || typeof value !== 'object') return value;

  const normalized = {};
  for (const [key, item] of Object.entries(value)) {
    if ((key === 'sourceRefs' || key === 'sourceIds') && Array.isArray(item)) {
      normalized[key] = normalizeKrSourceRefs(item);
    } else if (key === 'sourceId' && typeof item === 'string' && STALE_KR_SOURCE_IDS.has(item)) {
      normalized[key] = KR_SOURCE_ALIAS_REPLACEMENTS.get(item) || governingSourceId;
    } else {
      normalized[key] = normalizeSourceAliases(item, governingSourceId);
    }
  }
  return normalized;
}

for (const file of files) {
  const path = resolve(WORKSTREAM_DIR, file);
  const artifact = JSON.parse(readFileSync(path, 'utf8'));
  const repairedContent = repairWorkstreamContent(artifact);
  // Standard summaries are release data: one authored paraphrase table governs every workstream,
  // including the hand-maintained ones that no generator rewrites.
  for (const standard of repairedContent.standards || []) {
    standard.summary = standardSummary(standard.code, standard.summary);
    standard.summaryKind = STANDARD_SUMMARY_KIND;
  }
  repairedContent.sources = (repairedContent.sources || [])
    .map((source) => normalizeKrSourceRecord(source, file))
    .filter((source) => !STALE_KR_SOURCE_IDS.has(source.id))
    .filter((source, index, sources) => sources.findIndex((candidate) => candidate.id === source.id) === index)
    .sort((a, b) => a.id.localeCompare(b.id));
  repairedContent.textPolicy ||= {};
  repairedContent.textPolicy.licensingStatus = 'public-government-document';
  repairedContent.textPolicy.licenseCaution =
    'CLEARED: the cited Korean curriculum documents are state-published public materials openly available from their original sources (Ministry of Education, National Education Commission, NCIC). Preserve attribution and consult PROVENANCE.md.';
  if (repairedContent.counts && typeof repairedContent.counts === 'object') {
    repairedContent.counts.sources = repairedContent.sources.length;
    repairedContent.counts.standards = repairedContent.standards?.length || 0;
    repairedContent.counts.microTopics = repairedContent.microTopics?.length || 0;
    repairedContent.counts.standardMappings = repairedContent.standardMappings?.length || 0;
    repairedContent.counts.dependencySuggestions = repairedContent.dependencySuggestions?.length || 0;
    repairedContent.counts.clusters = repairedContent.clusters?.length || 0;
    repairedContent.counts.coverageGaps = repairedContent.coverageGaps?.length || 0;
  }
  const governingSourceId = repairedContent.sources.find((source) => source.sourceType === 'official-pdf')?.id;
  const repaired = normalizeSourceAliases(repairedContent, governingSourceId);
  const errors = contentQualityErrors(repaired.microTopics || []);
  if (errors.length) {
    throw new Error(`${file} content repair left ${errors.length} problem(s):\n- ${errors.join('\n- ')}`);
  }
  topicCount += repaired.microTopics?.length || 0;
  writeFileSync(path, `${JSON.stringify(repaired, null, 2)}\n`);
}

console.log(`Repaired ${files.length} KR workstreams (${topicCount} topics).`);
