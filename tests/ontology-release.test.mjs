import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  buildOntologyReference,
  buildOntologyReleaseArtifacts,
} from '../scripts/build-ontology-release.mjs';

const ROOT = resolve(import.meta.dirname, '..');

async function read(relativePath) {
  return readFile(resolve(ROOT, relativePath), 'utf8');
}

function sha256(contents) {
  return createHash('sha256').update(contents).digest('hex');
}

test('P3 uses stable versionIRI and priorVersion semantics', async () => {
  const [tbox, metadata] = await Promise.all([
    read('ontology/learning-map.ttl'),
    read('ontology/metadata.ttl'),
  ]);
  for (const document of [tbox, metadata]) {
    assert.match(
      document,
      /owl:versionIRI <https:\/\/dexa\.art\/learnmap\/ontology\/0\.3\.0-p3>/,
    );
    assert.match(
      document,
      /owl:priorVersion <https:\/\/dexa\.art\/learnmap\/ontology\/0\.2\.0-p2>/,
    );
  }
  assert.match(metadata, /dcterms:isVersionOf <https:\/\/dexa\.art\/learnmap\/ontology>/);
  assert.match(metadata, /lm:status "formal-ontology-release"/);
  assert.match(metadata, /external curriculum, subject, pedagogy, and classroom review remains ongoing/i);
});

test('P3 governance defines non-reassignment, deprecation, and replacement rules', async () => {
  const [governance, changelog, termStatusText] = await Promise.all([
    read('ontology/governance.md'),
    read('ontology/CHANGELOG.md'),
    read('ontology/term-status.json'),
  ]);
  const termStatus = JSON.parse(termStatusText);
  assert.match(governance, /never silently reassigned/i);
  assert.match(governance, /owl:deprecated true/);
  assert.match(governance, /dcterms:isReplacedBy/);
  assert.match(governance, /must not be used to diagnose an individual learner/i);
  assert.match(changelog, /\[0\.3\.0-p3\]/);
  assert.equal(termStatus.defaultStatus, 'active');
  assert.deepEqual(termStatus.deprecatedTerms, []);
});

test('P3 generated reference is complete and byte-current', async () => {
  const [expected, actual, vocabularyText] = await Promise.all([
    buildOntologyReference({ rootDir: ROOT }),
    read('docs/ontology-reference.md'),
    read('ontology/controlled-vocabulary.json'),
  ]);
  assert.equal(actual, expected);
  const vocabulary = JSON.parse(vocabularyText);
  for (const section of ['classes', 'objectProperties', 'datatypeProperties']) {
    for (const entry of vocabulary[section]) assert.ok(actual.includes('| `' + entry.term + '` |'));
  }
  for (const scheme of vocabulary.conceptSchemes) {
    assert.match(actual, new RegExp(`### ${scheme.term}`));
    for (const concept of scheme.concepts) {
      assert.ok(actual.includes('| `' + concept.term + '` |'));
    }
  }
});

test('P3 release manifest is deterministic and verifies every file hash', async () => {
  const first = await buildOntologyReleaseArtifacts({ rootDir: ROOT });
  const second = await buildOntologyReleaseArtifacts({ rootDir: ROOT });
  assert.deepEqual(first, second);
  const expectedText = first.files['dist/ontology/release-manifest.json'];
  assert.equal(await read('dist/ontology/release-manifest.json'), expectedText);

  const manifest = JSON.parse(expectedText);
  assert.equal(manifest.title, 'Korean Elementary Curriculum Learning Ontology');
  assert.equal(manifest.ontologyVersion, '0.3.0-p3');
  assert.equal(manifest.priorOntologyVersion, '0.2.0-p2');
  assert.equal(manifest.releaseStatus, 'formal');
  assert.equal(manifest.review.formalGateCount, 7);
  assert.equal(manifest.review.externalDomainReviewStatus, 'ongoing');
  assert.equal(manifest.review.learnerDiagnosisSupported, false);
  assert.equal(manifest.rights.status, 'HOLD');
  assert.equal(manifest.rights.permissionGranted, false);
  assert.equal(manifest.officialStatus, 'independent-non-official');
  assert.ok(manifest.files.length >= 35);
  assert.deepEqual(
    manifest.files.map(({ path }) => path),
    manifest.files.map(({ path }) => path).toSorted(),
  );
  for (const file of manifest.files) {
    const contents = await readFile(resolve(ROOT, file.path));
    assert.equal(file.bytes, contents.byteLength, file.path);
    assert.equal(file.sha256, sha256(contents), file.path);
  }
});

test('P3 CI declares six canonical Node gates and a temporary pinned Python gate', async () => {
  const [workflow, packageText] = await Promise.all([
    read('.github/workflows/ontology-release.yml'),
    read('package.json'),
  ]);
  for (const marker of ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7']) {
    assert.match(workflow, new RegExp(`${marker} —`));
  }
  assert.match(workflow, /python -m venv "\$RUNNER_TEMP\/ontology-venv"/);
  assert.match(workflow, /pip install --disable-pip-version-check -r requirements-ontology\.txt/);
  assert.match(workflow, /git diff --exit-code -- dist\/ontology\/validation-report\.json/);

  const packageJson = JSON.parse(packageText);
  assert.match(
    packageJson.scripts['verify:formal'],
    /verify:formal:python.*check:ontology:release/,
  );
});

test('formal README label preserves provenance, rights, and interpretation limits', async () => {
  const [readme, releaseReport, validationReportText] = await Promise.all([
    read('README.md'),
    read('docs/ontology-release-report.md'),
    read('dist/ontology/validation-report.json'),
  ]);
  assert.match(readme, /Korean Elementary Curriculum Learning Ontology/);
  assert.match(readme, /withmarbleapp\/os-taxonomy/);
  assert.match(readme, /독립적으로 구축/);
  assert.match(readme, /https:\/\/dexa\.art\/learnmap\//);
  assert.match(readme, /HOLD/);
  assert.match(readme, /교육부.*NCIC.*공식/);
  assert.match(readme, /학습자.*진단/);
  assert.match(readme, /20,446/);
  assert.match(readme, /53,656/);

  assert.match(releaseReport, /62\/62 Node/);
  assert.match(releaseReport, /Python `3\.12\.10`/);
  assert.match(releaseReport, /5\/5 Python tests/);
  assert.match(releaseReport, /15\/15 competency queries/);
  assert.match(releaseReport, /9\/9 adversarial fixtures/);

  const validationReport = JSON.parse(validationReportText);
  assert.equal(validationReport.overallPass, true);
  assert.equal(validationReport.toolVersions.python, '3.12.10');
  assert.equal(validationReport.shacl.violationCount, 0);
  assert.equal(validationReport.competencyQueries.queryCount, 15);
  assert.equal(Object.keys(validationReport.fixtures.adversarial).length, 9);
});
