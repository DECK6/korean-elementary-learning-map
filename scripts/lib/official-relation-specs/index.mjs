// Subject-by-subject official prerequisite specifications.
// Each sibling `<subject>.mjs` default-exports one spec (contract section 3).
// The directory is read at load time so a subject module can be added or removed
// without touching this file; an empty directory yields an empty official layer.
import { readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SPEC_DIR = dirname(fileURLToPath(import.meta.url));

export function listOfficialRelationSpecFiles(directory = SPEC_DIR) {
  let entries;
  try {
    entries = readdirSync(directory);
  } catch {
    return [];
  }
  return entries.filter((name) => name.endsWith('.mjs') && name !== 'index.mjs').sort();
}

export async function loadOfficialRelationSpecs(directory = SPEC_DIR) {
  const specs = [];
  for (const file of listOfficialRelationSpecFiles(directory)) {
    const module = await import(pathToFileURL(resolve(directory, file)).href);
    const spec = module.default;
    if (!spec) continue;
    specs.push({ ...spec, specFile: file });
  }
  return specs.sort((left, right) => String(left.subject).localeCompare(String(right.subject)));
}

export const officialRelationSpecs = await loadOfficialRelationSpecs();
