import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  buildOntologyReference,
  buildOntologyReleaseArtifacts,
} from '../scripts/build-ontology-release.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const readData = (name) => JSON.parse(readFileSync(resolve(ROOT, 'data', 'kr', name), 'utf8'));
const OFFICIAL_RELATION_COUNT = readData('dependencies.json').dependencies.length;
const CANDIDATE_RELATION_COUNT = readData('dependencies.candidate.json').dependencies.length;
const CURRICULUM_STANDARDS = readData('curriculum-standards.json');
const STANDARD_MAPPING_COUNT = CURRICULUM_STANDARDS.standardMappings.length;
const COVERAGE_GAP_COUNT = CURRICULUM_STANDARDS.coverageGaps.length;

function formatCount(value) {
  return value.toLocaleString('en-US');
}

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
      /owl:versionIRI <https:\/\/dexa\.art\/learnmap\/ontology\/0\.4\.0>/,
    );
    assert.match(
      document,
      /owl:priorVersion <https:\/\/dexa\.art\/learnmap\/ontology\/0\.3\.0-p3>/,
    );
  }
  assert.match(metadata, /dcterms:isVersionOf <https:\/\/dexa\.art\/learnmap\/ontology>/);
  assert.match(metadata, /lm:status "formal-ontology-release"/);
  assert.match(metadata, /external curriculum, subject, pedagogy, and classroom review remains ongoing/i);
});

test('P3 governance defines non-reassignment, deprecation, and replacement rules', async () => {
  const [governance, changelog, deprecationPolicy, replacementsText, termStatusText] = await Promise.all([
    read('ontology/governance.md'),
    read('ontology/CHANGELOG.md'),
    read('ontology/deprecation-policy.md'),
    read('ontology/replacements.json'),
    read('ontology/term-status.json'),
  ]);
  const replacements = JSON.parse(replacementsText);
  const termStatus = JSON.parse(termStatusText);
  assert.match(governance, /never silently reassigned/i);
  assert.match(governance, /ontology\/deprecation-policy\.md/);
  assert.match(governance, /ontology\/replacements\.json/);
  assert.match(deprecationPolicy, /Released ontology and vocabulary IRIs are stable identifiers/);
  assert.match(governance, /owl:deprecated true/);
  assert.match(governance, /dcterms:isReplacedBy/);
  assert.match(governance, /must not be used to diagnose an individual learner/i);
  assert.match(changelog, /\[0\.4\.0\]/);
  assert.match(changelog, /\[0\.3\.0-p3\]/);
  assert.equal(replacements.formatVersion, 1);
  assert.equal(replacements.ontologyVersion, '0.4.0');
  assert.equal(replacements.priorOntologyVersion, '0.3.0-p3');
  assert.equal(replacements.stableOntologyIri, 'https://dexa.art/learnmap/ontology');
  assert.equal(replacements.policyDocument, 'ontology/deprecation-policy.md');
  assert.equal(replacements.status, 'active');
  assert.deepEqual(replacements.entries, []);
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
  assert.equal(manifest.ontologyVersion, '0.4.0');
  assert.equal(manifest.priorOntologyVersion, '0.3.0-p3');
  assert.equal(manifest.releaseStatus, 'formal');
  assert.equal(
    manifest.counts.totalGraphResources,
    Object.values(manifest.counts.graphResources).reduce((total, value) => total + value, 0),
  );
  assert.equal(manifest.counts.rdfTriples.generatedABox, manifest.counts.rdfTriples.turtle);
  assert.equal(manifest.counts.sourceRecords.dependencies, OFFICIAL_RELATION_COUNT);
  assert.equal(manifest.counts.sourceRecords.candidateDependencies, CANDIDATE_RELATION_COUNT);
  assert.equal(
    manifest.counts.graphResources.PrerequisiteAssertion,
    OFFICIAL_RELATION_COUNT + CANDIDATE_RELATION_COUNT,
  );
  // Only the official layer materializes the binary prerequisite views.
  assert.equal(manifest.counts.relations.directRequires.count, OFFICIAL_RELATION_COUNT);
  assert.equal(manifest.counts.relations.unlocks.count, OFFICIAL_RELATION_COUNT);
  assert.ok(manifest.counts.relations.indirectRequires.count >= 0);
  assert.equal(manifest.counts.relations.alignedToStandard.count, STANDARD_MAPPING_COUNT);
  assert.equal(manifest.status.coverage.coverageGapCount, COVERAGE_GAP_COUNT);
  assert.equal(manifest.status.coverage.category, 'source-data-coverage');
  assert.equal(manifest.status.ontologyFormat.status, 'p3-formal-release');
  assert.equal(manifest.status.automatedReview.status, 'passed-local-seven-gate');
  assert.equal(manifest.status.automatedReview.githubActionsStatus, 'configured-not-run-in-this-manifest');
  assert.equal(manifest.status.sourceRights, 'CLEARED');
  assert.equal(manifest.review.formalGateCount, 7);
  assert.equal(manifest.review.externalDomainReviewStatus, 'ongoing');
  assert.equal(manifest.review.learnerDiagnosisSupported, false);
  assert.equal(manifest.rights.status, 'CLEARED');
  assert.equal(manifest.rights.permissionGranted, false);
  assert.equal(manifest.governance.deprecationPolicy, 'ontology/deprecation-policy.md');
  assert.equal(manifest.governance.replacementRegistry, 'ontology/replacements.json');
  assert.equal(manifest.governance.deprecatedTermCount, 0);
  assert.equal(manifest.officialStatus, 'independent-non-official');
  assert.ok(manifest.files.length >= 35);
  const paths = manifest.files.map(({ path }) => path);
  assert.deepEqual(paths, paths.toSorted());
  assert.ok(paths.includes('ontology/deprecation-policy.md'));
  assert.ok(paths.includes('ontology/replacements.json'));
  assert.ok(!paths.includes('dist/ontology/release-manifest.json'));
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
  for (const command of [
    'npm ci',
    'npm run build',
    'npm test',
    'npm run validate',
    'npm run check:content',
    'npm run validate:ontology',
    'npm run build:ontology',
    'npm run check:ontology:artifacts',
    'npm run build:ontology:release',
    'npm run check:ontology:release',
    'npm audit',
  ]) {
    assert.match(workflow, new RegExp(command.replaceAll(' ', '\\s+')));
  }
  assert.match(workflow, /git diff --check/);
  assert.match(
    workflow,
    /git diff --exit-code -- dist\/ontology\/validation-report\.json dist\/ontology\/release-manifest\.json/,
  );

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
  assert.match(readme, /공개 공식 자료|cleared/i);
  assert.match(readme, /교육부.*NCIC.*공식/);
  assert.match(readme, /학습자.*진단/);
  const releaseManifest = JSON.parse(await read('dist/ontology/release-manifest.json'));
  assert.ok(readme.includes(formatCount(releaseManifest.counts.totalGraphResources)));
  assert.ok(readme.includes(formatCount(releaseManifest.counts.rdfTriples.generatedABox)));
  assert.ok(readme.includes(formatCount(releaseManifest.counts.relations.indirectRequires.count)));
  assert.match(readme, /공개 공식 출처 URL/);
  assert.match(readme, /dependencies\.candidate\.json/);

  assert.match(releaseReport, /96\/96 Node/);
  assert.match(releaseReport, /local tracked-artifact verification/i);
  assert.match(releaseReport, /does not claim a CI run has completed/i);
  assert.match(releaseReport, /Python `3\.14\.7`/);
  assert.match(releaseReport, /5\/5 Python tests/);
  assert.match(releaseReport, /18\/18 competency queries/);
  assert.match(releaseReport, /10\/10 adversarial fixtures/);

  const validationReport = JSON.parse(validationReportText);
  assert.equal(validationReport.overallPass, true);
  assert.equal(validationReport.toolVersions.python, '3.14.7');
  assert.equal(validationReport.shacl.violationCount, 0);
  assert.equal(validationReport.competencyQueries.queryCount, 18);
  assert.equal(Object.keys(validationReport.fixtures.adversarial).length, 10);
});
