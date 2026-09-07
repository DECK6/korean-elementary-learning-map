// Subject-by-subject pedagogical-candidate specifications (contract section 9).
// Each sibling `<subject>.mjs` default-exports one spec whose `recommendedBefore` tuples are code
// pairs a review document decided on but that no workstream suggests. The directory is read at load
// time, so adding or removing a subject module needs no edit here.
import { readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SPEC_DIR = dirname(fileURLToPath(import.meta.url));

export function listCandidateRelationSpecFiles(directory = SPEC_DIR) {
  let entries;
  try {
    entries = readdirSync(directory);
  } catch {
    return [];
  }
  return entries.filter((name) => name.endsWith('.mjs') && name !== 'index.mjs').sort();
}

export async function loadCandidateRelationSpecs(directory = SPEC_DIR) {
  const specs = [];
  for (const file of listCandidateRelationSpecFiles(directory)) {
    const module = await import(pathToFileURL(resolve(directory, file)).href);
    const spec = module.default;
    if (!spec) continue;
    specs.push({ ...spec, specFile: file });
  }
  return specs.sort((left, right) => String(left.subject).localeCompare(String(right.subject)));
}

export const candidateRelationSpecs = await loadCandidateRelationSpecs();
