import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const ROOT = resolve(import.meta.dirname, '..');
const readJson = (...parts) => JSON.parse(readFileSync(resolve(ROOT, ...parts), 'utf8'));
const readWorkstream = (name) => readJson('data', 'kr', 'workstreams', name);

const ENGLISH_SHA256 = '596d13897b002a4279a3e21f16396bdae7ac74988450f45fb348f87af943f92a';
const HEALTH_SHA256 = '39954a4b5605b0ee691bd1a13e8207568ecb9079c97cdd6bf4ef490a7b7a41c6';
const HEALTH_PAGE_BY_CODE = new Map([
  ['[2건01-01]', 45],
  ['[2건01-02]', 46],
  ['[2건02-01]', 47],
  ['[2건02-02]', 48],
  ['[2건02-03]', 49],
  ['[2건02-04]', 50],
  ['[2건02-05]', 51],
  ['[2건03-01]', 52],
  ['[2건03-02]', 53],
]);

test('English EFL workstream emits ten distinct skill-specific classroom task families', () => {
  const artifact = readWorkstream('english-efl.json');
  const expectedSkills = [
    'culture',
    'interaction',
    'listening',
    'media',
    'phonics',
    'reading',
    'speaking',
    'strategy',
    'vocabulary',
    'writing',
  ];
  const promptMarkerBySkill = new Map([
    ['listening', /두 번 들/],
    ['speaking', /한국 교실 상황 카드/],
    ['phonics', /소리·글자 카드/],
    ['vocabulary', /목표 어휘·표현/],
    ['reading', /짧은 영어 글/],
    ['writing', /낱말 은행|예시문/],
    ['interaction', /정보 차이 카드|역할 카드/],
    ['media', /매체 자료/],
    ['strategy', /전략/],
    ['culture', /한국 교실/],
  ]);

  assert.equal(artifact.standards.length, 40);
  assert.equal(artifact.microTopics.length, 120);
  assert.deepEqual([...new Set(artifact.microTopics.map((topic) => topic.assessmentSkill))].sort(), expectedSkills);
  assert.equal(new Set(artifact.microTopics.map((topic) => topic.assessmentPrompt)).size, 120);

  for (const [skill, marker] of promptMarkerBySkill) {
    const topics = artifact.microTopics.filter((topic) => topic.assessmentSkill === skill);
    assert.ok(topics.length > 0, `missing ${skill} topics`);
    assert.ok(topics.every((topic) => topic.evidence.length >= 2), `${skill} topics need observable evidence`);
    assert.ok(topics.some((topic) => marker.test(topic.assessmentPrompt)), `${skill} prompt marker missing`);
  }

  const learnerFacingText = artifact.microTopics
    .flatMap((topic) => [topic.description, topic.assessmentPrompt, ...topic.evidence])
    .join('\n');
  assert.doesNotMatch(learnerFacingText, /짧은 듣기·말하기·읽기·쓰기 과업/);
  assert.doesNotMatch(learnerFacingText, /Common Core|United States|US state|UK national|native-speaker literary analysis/i);
});

test('English standards preserve exact NCIC locators and document the unmapped language-form appendix', () => {
  const artifact = readWorkstream('english-efl.json');
  const pageByBlock = {
    '3-4:Understanding': 16,
    '3-4:Expression': 18,
    '5-6:Understanding': 21,
    '5-6:Expression': 23,
  };

  for (const standard of artifact.standards) {
    assert.equal(standard.sourceLocator.sourceId, 'kr-ncic-2022-english-pdf');
    assert.equal(standard.sourceLocator.attachmentNo, '10003794');
    assert.equal(standard.sourceLocator.sha256, ENGLISH_SHA256);
    assert.equal(standard.sourceLocator.pdfPage, pageByBlock[`${standard.gradeBand}:${standard.officialArea}`]);
    assert.equal(standard.sourceLocator.code, standard.code);
  }

  const appendixSource = artifact.sources.find((source) => source.id === 'kr-ncic-2022-english-appendix4');
  assert.equal(appendixSource.evidence.attachmentNo, '10003794');
  assert.equal(appendixSource.evidence.sha256, ENGLISH_SHA256);
  assert.deepEqual(appendixSource.evidence.pdfPages, [297, 306]);

  const gap = artifact.coverageGaps.find((candidate) => candidate.id === 'gap-language-forms');
  assert.equal(gap.status, 'source-located-explicit-gap');
  assert.equal(gap.itemMappedLanguageFormCount, 0);
  assert.ok(gap.broadSkillTopicCount > 0);
  assert.ok(gap.standardKeys.length > 0);
  assert.equal(gap.sourceLocator.sha256, ENGLISH_SHA256);
});

test('current Annex 15 workstream adds exactly nine located 건강한 생활 standards', () => {
  const artifact = readWorkstream('integrated.json');
  const healthStandards = artifact.standards.filter((standard) => standard.code.startsWith('[2건'));
  const healthSource = artifact.sources.find((source) => source.id === 'kr-ncic-2026-1-annex15-pdf');
  const inventorySource = artifact.sources.find((source) => source.id === 'kr-ncic-2026-elem-integrated-attachment');

  assert.equal(artifact.standards.length, 57);
  assert.equal(artifact.microTopics.length, 171);
  assert.deepEqual(healthStandards.map((standard) => standard.code), [...HEALTH_PAGE_BY_CODE.keys()]);
  assert.equal(healthSource.attachmentNo, '10004214');
  assert.equal(healthSource.sha256, HEALTH_SHA256);
  assert.equal(healthSource.fileSizeBytes, 1449216);
  assert.equal(healthSource.pdfPages, 90);
  assert.deepEqual(healthSource.healthAchievementStandardPdfPages, [45, 53]);
  assert.deepEqual(healthSource.healthAchievementStandardPrintedPages, [39, 47]);
  assert.equal(inventorySource.apiIdentifiers.subjectCode, '3417');
  assert.equal(inventorySource.apiIdentifiers.openYear, '2026');
  assert.equal(inventorySource.apiIdentifiers.openMonth, '01');

  for (const standard of healthStandards) {
    const expectedPdfPage = HEALTH_PAGE_BY_CODE.get(standard.code);
    assert.equal(standard.verificationStatus, 'official-source-checked');
    assert.equal(standard.officialTextIncluded, false);
    assert.deepEqual(standard.sourceRefs, [
      'kr-ncic-2026-1-annex15-pdf',
      'kr-ncic-2026-elem-integrated-attachment',
    ]);
    assert.equal(standard.sourceLocator.sourceId, 'kr-ncic-2026-1-annex15-pdf');
    assert.equal(standard.sourceLocator.attachmentNo, '10004214');
    assert.equal(standard.sourceLocator.sha256, HEALTH_SHA256);
    assert.equal(standard.sourceLocator.pdfPage, expectedPdfPage);
    assert.equal(standard.sourceLocator.printedPage, expectedPdfPage - 6);
    assert.equal(standard.sourceLocator.code, standard.code);
  }
});

test('건강한 생활 topics and clusters use health areas rather than legacy life-question labels', () => {
  const artifact = readWorkstream('integrated.json');
  const healthTopics = artifact.microTopics.filter((topic) => topic.domainKorean === '건강한 생활');
  const healthClusters = artifact.clusters.filter((cluster) => cluster.domainKorean === '건강한 생활');

  assert.equal(healthTopics.length, 27);
  assert.equal(new Set(healthTopics.map((topic) => topic.assessmentPrompt)).size, 27);
  assert.ok(healthTopics.every((topic) => topic.curriculumAreaKind === 'health-domain'));
  assert.ok(healthTopics.every((topic) => topic.lifeQuestion == null && topic.lifeQuestionKorean == null));
  assert.ok(healthTopics.every((topic) => topic.evidence.length >= 2));
  assert.ok(healthTopics.every((topic) => topic.sourceLocator?.attachmentNo === '10004214'));

  assert.equal(healthClusters.length, 3);
  assert.deepEqual(healthClusters.map((cluster) => cluster.curriculumAreaKorean), [
    '건강한 몸',
    '활기찬 움직임',
    '창의적 표현',
  ]);
  assert.deepEqual(healthClusters.map((cluster) => cluster.topicCount), [6, 15, 6]);
  assert.ok(healthClusters.every((cluster) => cluster.curriculumAreaKind === 'health-domain'));
  assert.ok(healthClusters.every((cluster) => cluster.lifeQuestion == null && cluster.lifeQuestionKorean == null));
  assert.equal(artifact.coverageGaps.some((gap) => gap.id === 'gap.kr.integrated.2026-amendment-reconciliation'), false);
});

test('KR schema code pattern accepts every current 건강한 생활 code', () => {
  const schema = readJson('schema', 'kr-curriculum-standards.schema.json');
  const pattern = new RegExp(schema.$defs.standard.properties.code.pattern);
  for (const code of HEALTH_PAGE_BY_CODE.keys()) assert.match(code, pattern);
  assert.doesNotMatch('[2헬01-01]', pattern);
});

test('full-depth build preserves EFL tasks and the current 건강한 생활 amendment', () => {
  const standardsFile = readJson('data', 'kr', 'curriculum-standards.json');
  const topicsFile = readJson('data', 'kr', 'topics.json');
  const clustersFile = readJson('data', 'kr', 'clusters.json');
  const english = standardsFile.curricula.find((curriculum) => curriculum.id === 'kr-2022-elem-english-efl');
  const integrated = standardsFile.curricula.find((curriculum) => curriculum.id === 'kr-2022-elem-integrated');
  const englishTopics = topicsFile.topics.filter((topic) => topic.subjectKorean === '영어');
  const healthTopics = topicsFile.topics.filter((topic) => topic.domainKorean === '건강한 생활');
  const healthClusters = clustersFile.clusters.filter((cluster) => cluster.domainKorean === '건강한 생활');

  assert.equal(english.standardCount, 40);
  assert.equal(englishTopics.length, 120);
  assert.equal(new Set(englishTopics.map((topic) => topic.assessmentSkill)).size, 10);
  assert.equal(new Set(englishTopics.map((topic) => topic.assessmentPrompt)).size, 120);
  assert.ok(englishTopics.every((topic) => topic.sourceLocator?.sha256 === ENGLISH_SHA256));

  assert.equal(integrated.standardCount, 57);
  assert.deepEqual(
    integrated.standards.filter((standard) => standard.code.startsWith('[2건')).map((standard) => standard.code),
    [...HEALTH_PAGE_BY_CODE.keys()],
  );
  assert.equal(healthTopics.length, 27);
  assert.equal(healthClusters.length, 3);
  assert.ok(healthTopics.every((topic) => topic.sourceLocator?.sha256 === HEALTH_SHA256));
});
