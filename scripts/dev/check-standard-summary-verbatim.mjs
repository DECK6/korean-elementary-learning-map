#!/usr/bin/env node
// Authoring-time gate for standard summaries. The repository never stores official standard text,
// so this check runs against an extracted text file kept outside the repository:
//
//   pdftotext -layout <별책2 2026-1, attachment 10004180, sha256 f943dab8…> annex2.txt
//   node scripts/dev/check-standard-summary-verbatim.mjs annex2.txt
//
// It fails when any published summary shares a run of VERBATIM_RUN_LIMIT + 1 characters or more
// with the official text once spacing and punctuation are removed. scripts/validate-kr.mjs runs the
// same rule between authored overlay content and the summaries, which is the part CI can check.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERBATIM_RUN_LIMIT, longestSharedRun } from '../lib/kr-content-overlay.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const [, , officialTextPath] = process.argv;
if (!officialTextPath) {
  console.error('usage: node scripts/dev/check-standard-summary-verbatim.mjs <official-text-file>');
  process.exit(2);
}

const officialText = readFileSync(officialTextPath, 'utf8');
const standardsFile = JSON.parse(readFileSync(resolve(ROOT, 'data/kr/curriculum-standards.json'), 'utf8'));

const failures = [];
let checked = 0;
let longest = { length: 0, fragment: '', code: '' };

for (const curriculum of standardsFile.curricula ?? []) {
  for (const standard of curriculum.standards ?? []) {
    checked += 1;
    const run = longestSharedRun(standard.summary, officialText, VERBATIM_RUN_LIMIT);
    if (run.length > longest.length) longest = { ...run, code: standard.code };
    if (run.length > VERBATIM_RUN_LIMIT) {
      failures.push(`${standard.code}: ${run.length}-character run reused (${run.fragment})`);
    }
  }
}

if (failures.length) {
  console.error(`FAIL ${failures.length} of ${checked} summaries reuse official wording:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(
  `standard summary verbatim check passed: ${checked} summaries, longest shared run ${longest.length} characters (${longest.code}), limit ${VERBATIM_RUN_LIMIT}`,
);
