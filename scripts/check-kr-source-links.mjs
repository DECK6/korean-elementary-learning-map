#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KR_DATA = process.env.KR_DATA_DIR ? resolve(process.env.KR_DATA_DIR) : resolve(ROOT, 'data', 'kr');
const standardsFile = JSON.parse(readFileSync(resolve(KR_DATA, 'curriculum-standards.json'), 'utf8'));

const timeoutArg = process.argv.find((arg) => arg.startsWith('--timeout-ms='));
const timeoutMs = timeoutArg ? Number(timeoutArg.split('=').at(-1)) : 15_000;
if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
  console.error('Usage: node scripts/check-kr-source-links.mjs [--timeout-ms=15000]');
  process.exit(2);
}

const urlToSourceIds = new Map();
for (const source of standardsFile.sources || []) {
  if (!/^https?:\/\//i.test(source.url || '')) continue;
  if (!urlToSourceIds.has(source.url)) urlToSourceIds.set(source.url, []);
  urlToSourceIds.get(source.url).push(source.id);
}

async function probe([url, sourceIds]) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        accept: '*/*',
        range: 'bytes=0-0',
        'user-agent': 'korean-elementary-learning-map-source-link-check/1.0 (+https://github.com/DECK6/korean-elementary-learning-map)',
      },
    });
    await response.body?.cancel();
    return {
      ok: response.ok,
      status: response.status,
      url,
      finalUrl: response.url,
      sourceIds,
      error: response.ok ? null : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      url,
      finalUrl: null,
      sourceIds,
      error: error?.name === 'AbortError' ? `timeout after ${timeoutMs}ms` : String(error?.message || error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

const results = await Promise.all([...urlToSourceIds.entries()].map(probe));
const failures = results.filter((result) => !result.ok);

for (const result of results) {
  const marker = result.ok ? '✓' : '✗';
  const status = result.status ?? 'ERR';
  const redirect = result.finalUrl && result.finalUrl !== result.url ? ` -> ${result.finalUrl}` : '';
  console.log(`${marker} ${status} ${result.sourceIds.join(', ')} ${result.url}${redirect}${result.error ? ` (${result.error})` : ''}`);
}

if (failures.length) {
  console.error(`✗ ${failures.length}/${results.length} unique HTTP(S) KR source link(s) failed.`);
  process.exit(1);
}

console.log(`✓ ${results.length} unique HTTP(S) KR source link(s) reachable for ${standardsFile.sources.length} source record(s).`);
