import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { attachJosa, resolveKoreanText } from '../scripts/lib/kr-content-quality.mjs';
import { STALE_KR_SOURCE_IDS } from '../scripts/lib/kr-source-provenance.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const KR_DATA = resolve(ROOT, 'data', 'kr');

function runValidator(dataDir) {
  return spawnSync(process.execPath, ['scripts/validate-kr.mjs'], {
    cwd: ROOT,
    env: { ...process.env, KR_DATA_DIR: dataDir },
    encoding: 'utf8',
  });
}

function fixture() {
  const dataDir = mkdtempSync(join(tmpdir(), 'korean-elementary-learning-map-validator-test-'));
  cpSync(KR_DATA, dataDir, { recursive: true });
  return dataDir;
}

function readJson(dataDir, name) {
  return JSON.parse(readFileSync(resolve(dataDir, name), 'utf8'));
}

function writeJson(dataDir, name, data) {
  const contents = `${JSON.stringify(data, null, 2)}\n`;
  writeFileSync(resolve(dataDir, name), contents);

  const manifestPath = resolve(dataDir, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  manifest.files[name] = {
    bytes: Buffer.byteLength(contents),
    sha256: createHash('sha256').update(contents).digest('hex'),
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function combinedOutput(result) {
  return `${result.stdout}\n${result.stderr}`;
}

function assertRejected(result, ...patterns) {
  assert.notEqual(result.status, 0, 'adversarial KR fixture must fail validation');
  const output = combinedOutput(result);
  for (const pattern of patterns) assert.match(output, pattern);
}

test('KR validation accepts the canonical generated data', () => {
  const baseline = runValidator(KR_DATA);
  assert.equal(baseline.status, 0, baseline.stderr || baseline.stdout);
});

test('KR workstream source records contain no stale source aliases', () => {
  const workstreamDir = resolve(KR_DATA, 'workstreams');
  for (const file of readdirSync(workstreamDir).filter((name) => name.endsWith('.json'))) {
    const contents = readFileSync(resolve(workstreamDir, file), 'utf8');
    for (const sourceId of STALE_KR_SOURCE_IDS) {
      assert.equal(contents.includes(`"${sourceId}"`), false, `${file} still contains ${sourceId}`);
    }
    assert.equal(/\/bbs\/eduNotice2022\//.test(contents), false, `${file} still contains a stale NCIC notice route`);
  }
});

test('KR workstream learner fields contain no known direct-josa regressions', () => {
  const workstreamDir = resolve(KR_DATA, 'workstreams');
  const patterns = [
    /(?:의사소통|성찰|호응|표현|문식성|제작|실천|존중|선택|해결|활용)와\b/,
    /(?:돌봄|활용|영향|제작|실천|선택|활동|계획|탐색|예절|과정|체험|기술)를\b/,
    /[가-힣]+하기이\b/,
    /(?:느끼기|어울리기|즐기기|지내기|누리기|만들기)과\b/,
    /말하기 말하기를/,
    /과\/와/,
    /개념를\b/,
    /(?:실천 실천|생활 생활|수행 수행을)/,
  ];

  for (const file of readdirSync(workstreamDir).filter((name) => name.endsWith('.json'))) {
    const artifact = JSON.parse(readFileSync(resolve(workstreamDir, file), 'utf8'));
    const learnerFacingText = (artifact.microTopics || [])
      .flatMap((topic) => [
        topic.name,
        topic.description,
        topic.assessmentPrompt,
        ...(topic.evidence || []),
      ])
      .filter((value) => typeof value === 'string')
      .join('\n');
    for (const pattern of patterns) assert.doesNotMatch(learnerFacingText, pattern, `${file}: ${pattern}`);
  }
});

test('KR dependency validation accepts the canonical DAG and rejects a reciprocal cycle', () => {
  const dataDir = fixture();
  const dependencyFile = readJson(dataDir, 'dependencies.json');
  const original = dependencyFile.dependencies.find(
    (candidate) =>
      !dependencyFile.dependencies.some(
        (other) => other.topicId === candidate.prerequisiteId && other.prerequisiteId === candidate.topicId,
      ),
  );
  assert.ok(original, 'expected at least one non-reciprocal dependency edge');
  dependencyFile.dependencies.push({
    ...original,
    topicId: original.prerequisiteId,
    prerequisiteId: original.topicId,
    reason: 'Adversarial regression fixture: reverse an existing prerequisite edge.',
  });
  dependencyFile.edgeCount = dependencyFile.dependencies.length;
  writeJson(dataDir, 'dependencies.json', dependencyFile);

  const mutated = runValidator(dataDir);
  assertRejected(mutated, /reciprocal dependency pair/, /cyclic prerequisite SCC/);
});

test('KR validation executes Draft 2020-12 schemas and rejects sourceUrl aliases for required url fields', () => {
  const dataDir = fixture();
  const standardsFile = readJson(dataDir, 'curriculum-standards.json');
  const source = standardsFile.sources.find((candidate) => candidate.id === 'kr-moe-2022-33-annex5-pdf');
  source.sourceUrl = source.url;
  delete source.url;
  writeJson(dataDir, 'curriculum-standards.json', standardsFile);

  assertRejected(runValidator(dataDir), /JSON Schema curriculum-standards\.json.*required property.*url/, /source .* missing url/);
});

test('KR validation rejects source records without the normalized sourceType field', () => {
  const dataDir = fixture();
  const standardsFile = readJson(dataDir, 'curriculum-standards.json');
  delete standardsFile.sources[0].sourceType;
  writeJson(dataDir, 'curriculum-standards.json', standardsFile);

  assertRejected(
    runValidator(dataDir),
    /JSON Schema curriculum-standards\.json.*required property.*sourceType/,
    /source .* missing sourceType/,
  );
});

test('KR validation rejects an incomplete standard-to-topic mapping', () => {
  const dataDir = fixture();
  const standardsFile = readJson(dataDir, 'curriculum-standards.json');
  const removed = standardsFile.standardMappings.shift();
  standardsFile.mappingCount = standardsFile.standardMappings.length;
  writeJson(dataDir, 'curriculum-standards.json', standardsFile);

  assertRejected(
    runValidator(dataDir),
    new RegExp(`topic missing standard mapping ${removed.standardKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}->`),
  );
});

test('KR validation rejects reversed topic age ranges', () => {
  const dataDir = fixture();
  const topicsFile = readJson(dataDir, 'topics.json');
  topicsFile.topics[0].ageRangeStart = 12;
  topicsFile.topics[0].ageRangeEnd = 6;
  writeJson(dataDir, 'topics.json', topicsFile);

  assertRejected(runValidator(dataDir), /topic age range reversed/);
});

test('KR validation enforces cluster coverage for every topic', () => {
  const dataDir = fixture();
  const topicsFile = readJson(dataDir, 'topics.json');
  const clustersFile = readJson(dataDir, 'clusters.json');
  const topicId = topicsFile.topics[0].id;
  for (const cluster of clustersFile.clusters) {
    cluster.topics = cluster.topics.filter((id) => id !== topicId);
    cluster.topicCount = cluster.topics.length;
  }
  writeJson(dataDir, 'clusters.json', clustersFile);

  assertRejected(runValidator(dataDir), new RegExp(`topic missing cluster membership ${topicId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
});

test('KR validation rejects placeholder-quality topic fields', () => {
  const dataDir = fixture();
  const topicsFile = readJson(dataDir, 'topics.json');
  const topic = topicsFile.topics.find((candidate) => candidate.subjectKorean === '실과(기술·가정)/정보');
  topic.description = 'x';
  topic.assessmentPrompt = 'x';
  topic.evidence = ['x'];
  topic.generationBasis = 'x';
  writeJson(dataDir, 'topics.json', topicsFile);

  assertRejected(
    runValidator(dataDir),
    /topic description is empty or placeholder-quality/,
    /topic missing evidence/,
    /topic assessmentPrompt is empty or placeholder-quality/,
    /topic missing generationBasis/,
  );
});

test('KR validation rejects literal undefined placeholders in learner-facing fields', () => {
  const dataDir = fixture();
  const topicsFile = readJson(dataDir, 'topics.json');
  const topic = topicsFile.topics.find((candidate) => candidate.subjectKorean === '국어');
  topic.description += ' undefined 값을 학습 내용으로 사용한다.';
  writeJson(dataDir, 'topics.json', topicsFile);

  assertRejected(runValidator(dataDir), /content quality: Korean-facing fields contain .* undefined placeholder/);
});

test('KR validation rejects unsupported official-source-checked status inflation', () => {
  const dataDir = fixture();
  const standardsFile = readJson(dataDir, 'curriculum-standards.json');
  const standard = standardsFile.curricula.flatMap((curriculum) => curriculum.standards)[0];
  assert.ok(standard, 'expected at least one standard to mutate');
  standard.verificationStatus = 'official-source-checked';
  standard.sourceBasis = 'Adversarial placeholder claims a review that has no supporting evidence.';
  for (const field of [
    'sourceLocator',
    'sourceSection',
    'evidence',
    'sourceEvidence',
    'verificationNotes',
    'verificationNote',
  ]) {
    delete standard[field];
  }
  writeJson(dataDir, 'curriculum-standards.json', standardsFile);

  assertRejected(runValidator(dataDir), /official-source-checked standard missing verification evidence/);
});

test('KR validation rejects official topic status inflation without source provenance', () => {
  const dataDir = fixture();
  const topicsFile = readJson(dataDir, 'topics.json');
  const topic = topicsFile.topics.find((candidate) => candidate.verificationStatus === 'public-doc-derived');
  assert.ok(topic, 'expected a public-doc-derived topic to mutate');
  topic.verificationStatus = 'official-source-checked';
  for (const field of [
    'sourceLocator',
    'sourceSection',
    'provenanceEvidence',
    'sourceEvidence',
    'verificationNotes',
    'verificationNote',
  ]) {
    delete topic[field];
  }
  writeJson(dataDir, 'topics.json', topicsFile);

  assertRejected(runValidator(dataDir), /official-source-checked topic missing verification evidence/);
});

test('KR official-inventory gates reject direct-source and status drift', () => {
  const dataDir = fixture();
  const standardsFile = readJson(dataDir, 'curriculum-standards.json');
  const social = standardsFile.curricula.find((curriculum) => curriculum.id === 'kr-2022-elem-social-studies');
  const standard = social.standards[0];
  standard.verificationStatus = 'public-doc-derived';
  standard.sourceRefs = ['kr-repo-mapping-method'];
  writeJson(dataDir, 'curriculum-standards.json', standardsFile);

  assertRejected(
    runValidator(dataDir),
    /official inventory standard status mismatch/,
    /official inventory direct source missing/,
  );
});

test('KR official-inventory gates reject code-inventory, source-fingerprint, and item-locator drift', () => {
  const dataDir = fixture();
  const standardsFile = readJson(dataDir, 'curriculum-standards.json');
  const social = standardsFile.curricula.find((curriculum) => curriculum.id === 'kr-2022-elem-social-studies');
  const standard = social.standards[0];
  standard.code = '[4사99-99]';
  delete standard.sourceLocator;
  standard.sourceEvidence = [];
  standard.sourceSection = '사회과 위치 정보를 제거한 회귀 픽스처';
  const socialSource = standardsFile.sources.find((source) => source.id === 'kr-ncic-2022-social-pdf');
  socialSource.sha256 = '0'.repeat(64);
  writeJson(dataDir, 'curriculum-standards.json', standardsFile);

  assertRejected(
    runValidator(dataDir),
    /official inventory code digest mismatch kr-2022-elem-social-studies/,
    /official source fingerprint mismatch kr-ncic-2022-social-pdf\.sha256/,
    /official inventory structured source locator missing/,
  );
});

test('KR validation rejects official grade-band drift even when checksums are refreshed', () => {
  const dataDir = fixture();
  const standardsFile = readJson(dataDir, 'curriculum-standards.json');
  const social = standardsFile.curricula.find((curriculum) => curriculum.id === 'kr-2022-elem-social-studies');
  social.standards[0].gradeBand = '1-2';
  writeJson(dataDir, 'curriculum-standards.json', standardsFile);

  assertRejected(runValidator(dataDir), /standard gradeBand mismatch kr-2022-elem-social-studies:\[4사01-01\]/);
});

test('KR validation rejects code-only evidence in place of a structured official locator', () => {
  const dataDir = fixture();
  const standardsFile = readJson(dataDir, 'curriculum-standards.json');
  const social = standardsFile.curricula.find((curriculum) => curriculum.id === 'kr-2022-elem-social-studies');
  const standard = social.standards[0];
  for (const field of ['sourceLocator', 'sourceSection', 'sourceEvidence', 'evidence']) delete standard[field];
  standard.evidence = [`Official code ${standard.code} reviewed.`];
  writeJson(dataDir, 'curriculum-standards.json', standardsFile);

  assertRejected(runValidator(dataDir), /official inventory structured source locator missing/);
});

test('KR validation rejects manifest omissions even when remaining checksums are valid', () => {
  const dataDir = fixture();
  const manifest = readJson(dataDir, 'manifest.json');
  delete manifest.files['workstreams/social.json'];
  writeFileSync(resolve(dataDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  assertRejected(runValidator(dataDir), /manifest missing file entry workstreams\/social\.json/);
});

test('KR validation rejects stale aliases and dead NCIC notice URLs', () => {
  const aliasDir = fixture();
  const aliasStandards = readJson(aliasDir, 'curriculum-standards.json');
  aliasStandards.sources.push({
    id: 'kr-ncic-inventory-api',
    name: 'Adversarial stale alias',
    url: 'https://ncic.re.kr/inv/org/list.do',
    accessDate: '2026-07-10',
    usage: 'Adversarial source alias fixture.',
    sourceType: 'official-inventory',
  });
  aliasStandards.sourceCount = aliasStandards.sources.length;
  writeJson(aliasDir, 'curriculum-standards.json', aliasStandards);
  assertRejected(runValidator(aliasDir), /stale KR source alias remains kr-ncic-inventory-api/);

  const noticeDir = fixture();
  const noticeStandards = readJson(noticeDir, 'curriculum-standards.json');
  noticeStandards.sources[0].url = 'https://ncic.re.kr/bbs/eduNotice2022/view/1864.do';
  writeJson(noticeDir, 'curriculum-standards.json', noticeStandards);
  assertRejected(runValidator(noticeDir), /dead NCIC notice URL remains/);
});

test('KR validation rejects malformed source URLs and missing repository-local sources', () => {
  const malformedDir = fixture();
  const malformedStandards = readJson(malformedDir, 'curriculum-standards.json');
  const malformedSource = malformedStandards.sources.find((source) => /^https?:\/\//i.test(source.url));
  malformedSource.url = 'not a valid URL';
  writeJson(malformedDir, 'curriculum-standards.json', malformedStandards);
  assertRejected(runValidator(malformedDir), new RegExp(`source URL\\/path invalid ${malformedSource.id}`));

  const missingDir = fixture();
  const missingStandards = readJson(missingDir, 'curriculum-standards.json');
  const missingSource = missingStandards.sources.find((source) => !/^https?:\/\//i.test(source.url)) || missingStandards.sources[0];
  missingSource.url = 'file:data/kr/does-not-exist.json';
  writeJson(missingDir, 'curriculum-standards.json', missingStandards);
  assertRejected(runValidator(missingDir), new RegExp(`local source path missing ${missingSource.id}`));
});

test('KR validation enforces the explicit no-cross-subject-edge policy', () => {
  const dataDir = fixture();
  const topicsFile = readJson(dataDir, 'topics.json');
  const dependencyFile = readJson(dataDir, 'dependencies.json');
  const dependency = dependencyFile.dependencies[0];
  const topicSubject = topicsFile.topics.find((topic) => topic.id === dependency.topicId).subjectKorean;
  dependency.prerequisiteId = topicsFile.topics.find((topic) => topic.subjectKorean !== topicSubject).id;
  writeJson(dataDir, 'dependencies.json', dependencyFile);

  assertRejected(runValidator(dataDir), /synthetic cross-subject dependency forbidden/);
});

test('Korean josa resolver deterministically handles final consonants and legacy placeholders', () => {
  assert.equal(attachJosa('조건', '과/와'), '조건과');
  assert.equal(attachJosa('존중', '을/를'), '존중을');
  assert.equal(attachJosa('학교', '이/가'), '학교가');
  assert.equal(
    resolveKoreanText('학교이/가 조건와 존중를 실천하기과 표현을/를 살핀다.'),
    '학교가 조건과 존중을 실천하기와 표현을 살핀다.',
  );
  assert.equal(resolveKoreanText('의사소통과/와 연결한다.'), '의사소통과 연결한다.');
});

test('KR validation rejects unresolved and known-malformed Korean particles', () => {
  const dataDir = fixture();
  const topicsFile = readJson(dataDir, 'topics.json');
  topicsFile.topics[0].description += ' 조사을/를 조건와 연결한다.';
  writeJson(dataDir, 'topics.json', topicsFile);

  assertRejected(
    runValidator(dataDir),
    /content quality: Korean-facing fields contain .* unresolved josa placeholder/,
    /content quality: Korean-facing fields contain .* known malformed josa form/,
  );
});

test('KR validation rejects English facet labels in Korean-facing topic fields', () => {
  const dataDir = fixture();
  const topicsFile = readJson(dataDir, 'topics.json');
  topicsFile.topics[0].name += ' practice';
  writeJson(dataDir, 'topics.json', topicsFile);

  assertRejected(runValidator(dataDir), /content quality: Korean-facing fields contain .* English facet label/);
});

test('KR validation rejects exact semantic duplicate topic records', () => {
  const dataDir = fixture();
  const topicsFile = readJson(dataDir, 'topics.json');
  const [first, second] = topicsFile.topics.filter((topic) => topic.subjectKorean === '미술').slice(0, 2);
  second.name = first.name;
  second.title = first.title;
  second.titleKorean = first.titleKorean;
  second.description = first.description;
  writeJson(dataDir, 'topics.json', topicsFile);

  assertRejected(runValidator(dataDir), /content quality: topics contain .* exact semantic duplicate group/);
});

test('KR validation requires two learner-observable evidence criteria and keeps provenance separate', () => {
  const tooShortDir = fixture();
  const tooShortTopics = readJson(tooShortDir, 'topics.json');
  tooShortTopics.topics[0].evidence = ['학습자가 핵심 내용을 설명한다.'];
  writeJson(tooShortDir, 'topics.json', tooShortTopics);
  assertRejected(
    runValidator(tooShortDir),
    /JSON Schema topics\.json.*must NOT have fewer than 2 items/,
    /content quality: .*fewer than two mastery criteria/,
  );

  const provenanceDir = fixture();
  const provenanceTopics = readJson(provenanceDir, 'topics.json');
  provenanceTopics.topics[0].evidence = [
    'NCIC PDF source link records the official code location.',
    'Mapped to official achievement standard without copied wording.',
  ];
  provenanceTopics.topics[0].provenanceEvidence = [
    'Source metadata remains available in this dedicated provenance field.',
  ];
  writeJson(provenanceDir, 'topics.json', provenanceTopics);
  assertRejected(runValidator(provenanceDir), /content quality: topic evidence contains .* non-observable or provenance-only item/);
});

test('KR validation rejects exact duplicate assessment prompts within one standard', () => {
  const dataDir = fixture();
  const topicsFile = readJson(dataDir, 'topics.json');
  const first = topicsFile.topics[0];
  const second = topicsFile.topics.find(
    (topic) => topic.id !== first.id && topic.standards.some((standard) => first.standards.includes(standard)),
  );
  assert.ok(second, 'expected two topic facets mapped to one standard');
  second.assessmentPrompt = first.assessmentPrompt;
  writeJson(dataDir, 'topics.json', topicsFile);

  assertRejected(runValidator(dataDir), /content quality: standards contain .* exact duplicate assessment-prompt group/);
});
