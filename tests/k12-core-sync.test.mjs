import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';

// The K-12 core TBox is kept as a byte-identical copy in the elementary and secondary
// repositories. The baseline hash recorded in the file header is the sha256 of the file with the
// header hash line removed, so both copies can be checked offline and independently.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CORE_PATH = resolve(ROOT, 'ontology/k12-core.ttl');
const HASH_LINE = /^# k12-core-sync-sha256: ([0-9a-f]{64})\n/m;
const CORE_ONTOLOGY_IRI = 'https://dexa.art/learnmap/ontology/k12-core';
const CORE_VERSION_IRI = 'https://dexa.art/learnmap/ontology/k12-core/1.0.0';

const coreText = await readFile(CORE_PATH, 'utf8');

test('k12-core.ttl declares its own sync baseline hash', () => {
  const match = HASH_LINE.exec(coreText);
  assert.ok(match, 'k12-core.ttl must carry a # k12-core-sync-sha256: header line');
  const body = coreText.replace(HASH_LINE, '');
  const actual = createHash('sha256').update(body).digest('hex');
  assert.equal(
    actual,
    match[1],
    'k12-core.ttl content no longer matches the declared baseline; update the header hash in BOTH repositories',
  );
});

test('k12-core.ttl carries the versioned core ontology IRI', () => {
  assert.match(coreText, new RegExp(`<${CORE_ONTOLOGY_IRI}>\\s+a owl:Ontology`));
  assert.ok(coreText.includes(`owl:versionIRI <${CORE_VERSION_IRI}>`));
});

test('the repository TBox imports the core module', async () => {
  const tbox = await readFile(resolve(ROOT, 'ontology/learning-map.ttl'), 'utf8');
  assert.ok(
    tbox.includes(`owl:imports <${CORE_ONTOLOGY_IRI}>`),
    'ontology/learning-map.ttl must declare owl:imports for the K-12 core',
  );
});
