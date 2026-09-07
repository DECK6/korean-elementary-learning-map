import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const ROOT = resolve(import.meta.dirname, '..');

test('validator fixtures do not accumulate in the system temporary directory', () => {
  // Keep the probe on the project volume too; a failing run preserves it for inspection while a
  // passing run removes it, so repeated runs cannot fill the disk.
  const probe = mkdtempSync(join(ROOT, '.fixture-storage-probe-'));
  const env = { ...process.env, TMPDIR: probe, TMP: probe, TEMP: probe };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, [
    '--test', '--test-name-pattern=rejects a reciprocal cycle',
    'tests/validate-kr.test.mjs',
  ], {
    cwd: ROOT,
    env,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /rejects a reciprocal cycle/, 'expected fixture test to execute');
  assert.deepEqual(readdirSync(probe), [], 'validator fixtures leaked into system temp');
  rmSync(probe, { recursive: true, force: true });
});
