import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const ROOT = resolve(import.meta.dirname, '..');
const readJson = (...parts) => JSON.parse(readFileSync(resolve(ROOT, ...parts), 'utf8'));
const readWorkstream = (name) => readJson('data', 'kr', 'workstreams', name);

const ENGLISH_SHA256 = '596d13897b002a4279a3e21f16396bdae7ac74988450f45fb348f87af943f92a';
const ANNEX15_SHA256 = '39954a4b5605b0ee691bd1a13e8207568ecb9079c97cdd6bf4ef490a7b7a41c6';
const HEALTH_SHA256 = ANNEX15_SHA256;
// Attachment 10004214 prints every page number six pages behind the PDF page.
const PRINTED_PAGE_OFFSET = 6;
const INTEGRATED_SOURCE_REFS = [
  'kr-ncic-2026-1-annex15-pdf',
  'kr-ncic-2026-1-annex2-pdf',
  'kr-ncic-2026-elem-integrated-attachment',
];
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
// 2026-1 rebuilt 즐거운 생활 around 체험·표현·감상 and gave every code its own page.
const JOYFUL_PAGE_BY_CODE = new Map([
  ['[2즐01-01]', 69],
  ['[2즐01-02]', 70],
  ['[2즐01-03]', 71],
  ['[2즐01-04]', 72],
  ['[2즐02-01]', 73],
  ['[2즐02-02]', 74],
  ['[2즐02-03]', 75],
  ['[2즐02-04]', 76],
  ['[2즐02-05]', 77],
  ['[2즐02-06]', 78],
  ['[2즐03-01]', 79],
  ['[2즐03-02]', 80],
  ['[2즐03-03]', 81],
  ['[2즐03-04]', 82],
  ['[2즐03-05]', 83],
  ['[2즐03-06]', 84],
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

test('integrated workstream is pinned to the 2026-1 Annex 15 alone', () => {
  const artifact = readWorkstream('integrated.json');
  const codes = artifact.standards.map((standard) => standard.code);
  const annexSource = artifact.sources.find((source) => source.id === 'kr-ncic-2026-1-annex15-pdf');
  const crossCheckSource = artifact.sources.find((source) => source.id === 'kr-ncic-2026-1-annex2-pdf');
  const inventorySource = artifact.sources.find((source) => source.id === 'kr-ncic-2026-elem-integrated-attachment');

  assert.equal(artifact.standards.length, 57);
  assert.equal(artifact.microTopics.length, 171);
  // The superseded 2022-33 edition must not survive anywhere in the artifact.
  assert.deepEqual(artifact.sources.map((source) => source.id).sort(), INTEGRATED_SOURCE_REFS);
  assert.ok(!JSON.stringify(artifact).includes('kr-moe-2022-33-annex15-pdf'));
  // The superseded attachment number survives only as the `supersedes` note on the source record.
  assert.ok(!JSON.stringify(artifact.standards).includes('10003571'));
  assert.ok(!JSON.stringify(artifact.microTopics).includes('10003571'));
  assert.equal(annexSource.supersedes.includes('10003571'), true);

  assert.deepEqual(codes.filter((code) => code.startsWith('[2건')), [...HEALTH_PAGE_BY_CODE.keys()]);
  assert.deepEqual(codes.filter((code) => code.startsWith('[2즐')), [...JOYFUL_PAGE_BY_CODE.keys()]);
  assert.equal(codes.filter((code) => code.startsWith('[2바')).length, 16);
  assert.equal(codes.filter((code) => code.startsWith('[2슬')).length, 16);
  // Deleted by the amendment; a ghost code here is the failure this gate exists for.
  assert.ok(!codes.some((code) => code.startsWith('[2즐04')));

  assert.equal(annexSource.attachmentNo, '10004214');
  assert.equal(annexSource.sha256, ANNEX15_SHA256);
  assert.equal(annexSource.fileSizeBytes, 1449216);
  assert.equal(annexSource.pdfPages, 90);
  assert.equal(annexSource.printedPageOffset, PRINTED_PAGE_OFFSET);
  assert.equal(annexSource.effectiveFrom, '2028-03-01');
  assert.deepEqual(annexSource.achievementStandardPdfPages['건강한 생활'], [45, 53]);
  assert.deepEqual(annexSource.achievementStandardPdfPages['즐거운 생활'], [69, 84]);
  assert.equal(crossCheckSource.attachmentNo, '10004180');
  assert.equal(crossCheckSource.sha256, 'f943dab812a4b1fdb48af16fd724b5391d0db64bda83ed4e4b3b2a95faf3d4f9');
  assert.equal(inventorySource.apiIdentifiers.subjectCode, '3417');
  assert.equal(inventorySource.apiIdentifiers.openYear, '2026');
  assert.equal(inventorySource.apiIdentifiers.openMonth, '01');

  const pageByCode = new Map([...HEALTH_PAGE_BY_CODE, ...JOYFUL_PAGE_BY_CODE]);
  for (const standard of artifact.standards) {
    assert.equal(standard.verificationStatus, 'official-source-checked');
    assert.equal(standard.officialTextIncluded, false);
    assert.deepEqual(standard.sourceRefs, INTEGRATED_SOURCE_REFS);
    assert.equal(standard.effectiveFrom, '2028-03-01');
    assert.equal(standard.sourceLocator.sourceId, 'kr-ncic-2026-1-annex15-pdf');
    assert.equal(standard.sourceLocator.attachmentNo, '10004214');
    assert.equal(standard.sourceLocator.sha256, ANNEX15_SHA256);
    assert.equal(standard.sourceLocator.code, standard.code);
    assert.equal(standard.sourceLocator.printedPage, standard.sourceLocator.pdfPage - PRINTED_PAGE_OFFSET);
    const expectedPdfPage = pageByCode.get(standard.code);
    if (expectedPdfPage) assert.equal(standard.sourceLocator.pdfPage, expectedPdfPage);
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

test('즐거운 생활 uses the 2026 체험·표현·감상 areas rather than the four life questions', () => {
  const artifact = readWorkstream('integrated.json');
  const joyfulTopics = artifact.microTopics.filter((topic) => topic.domainKorean === '즐거운 생활');
  const joyfulClusters = artifact.clusters.filter((cluster) => cluster.domainKorean === '즐거운 생활');

  assert.equal(joyfulTopics.length, 48);
  assert.equal(new Set(joyfulTopics.map((topic) => topic.assessmentPrompt)).size, 48);
  assert.ok(joyfulTopics.every((topic) => topic.curriculumAreaKind === 'arts-domain'));
  assert.ok(joyfulTopics.every((topic) => topic.lifeQuestion == null && topic.lifeQuestionKorean == null));
  assert.ok(joyfulTopics.every((topic) => topic.evidence.length >= 2));
  assert.ok(joyfulTopics.every((topic) => topic.sourceLocator?.attachmentNo === '10004214'));

  assert.deepEqual(joyfulClusters.map((cluster) => cluster.curriculumAreaKorean), ['체험', '표현', '감상']);
  assert.deepEqual(joyfulClusters.map((cluster) => cluster.topicCount), [12, 18, 18]);
  assert.deepEqual(joyfulClusters.map((cluster) => cluster.id), [
    'kr.cluster.integrated.joyful-life.experience.1-2',
    'kr.cluster.integrated.joyful-life.expression.1-2',
    'kr.cluster.integrated.joyful-life.appreciation.1-2',
  ]);
  // Life questions survive only in 바른 생활 and 슬기로운 생활.
  const lifeQuestionDomains = new Set(
    artifact.clusters.filter((cluster) => cluster.lifeQuestionKorean).map((cluster) => cluster.domainKorean),
  );
  assert.deepEqual([...lifeQuestionDomains].sort(), ['바른 생활', '슬기로운 생활']);
});

test('KR schema code pattern accepts every current 건강한 생활 and 즐거운 생활 code', () => {
  const schema = readJson('schema', 'kr-curriculum-standards.schema.json');
  const pattern = new RegExp(schema.$defs.standard.properties.code.pattern);
  for (const code of [...HEALTH_PAGE_BY_CODE.keys(), ...JOYFUL_PAGE_BY_CODE.keys()]) assert.match(code, pattern);
  assert.doesNotMatch('[2헬01-01]', pattern);
});

test('full-depth build preserves EFL tasks and the current 2026-1 integrated inventory', () => {
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
  assert.deepEqual(
    integrated.standards.filter((standard) => standard.code.startsWith('[2즐')).map((standard) => standard.code),
    [...JOYFUL_PAGE_BY_CODE.keys()],
  );
  assert.equal(healthTopics.length, 27);
  assert.equal(healthClusters.length, 3);
  assert.ok(healthTopics.every((topic) => topic.sourceLocator?.sha256 === HEALTH_SHA256));
  const integratedTopics = topicsFile.topics.filter((topic) => topic.subjectKorean === '통합교과');
  assert.equal(integratedTopics.length, 171);
  assert.ok(integratedTopics.every((topic) => topic.sourceLocator?.sha256 === ANNEX15_SHA256));
  assert.ok(
    integrated.sourceIds.every((id) => INTEGRATED_SOURCE_REFS.includes(id)),
    'integrated curriculum must cite the 2026-1 edition only',
  );
});
