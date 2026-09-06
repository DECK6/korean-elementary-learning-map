#!/usr/bin/env node
// Integrated-subjects (통합교과) workstream, pinned to a single governing edition:
// 국가교육위원회 고시 제2026-1호 일부개정 [별책 15] (NCIC attachment 10004214).
// The 2022-33 Annex 15 is no longer a source here: the 2026 amendment reassigned
// every 즐거운 생활 code, deleted [2즐04-01]~[2즐04-04], added four 즐거운 생활 codes,
// and introduced 건강한 생활. Mixing the two editions produced ghost codes and
// code/meaning drift, so this builder reads one edition only.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { repairWorkstreamContent } from './lib/kr-content-quality.mjs';
import { standardSummary } from './lib/kr-standard-summaries.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'data', 'kr', 'workstreams', 'integrated.json');

const CURRICULUM_ID = 'kr-2022-elem-integrated';
const SUBJECT = 'Integrated Subjects';
const SUBJECT_KO = '통합교과';
const GRADE_BAND = '1-2';
const AGE_RANGE = { start: 6, end: 8, label: '초등학교 1~2학년' };

const ANNEX15_SOURCE_ID = 'kr-ncic-2026-1-annex15-pdf';
const ANNEX2_SOURCE_ID = 'kr-ncic-2026-1-annex2-pdf';
const INVENTORY_SOURCE_ID = 'kr-ncic-2026-elem-integrated-attachment';
const sourceRefs = [ANNEX15_SOURCE_ID, ANNEX2_SOURCE_ID, INVENTORY_SOURCE_ID];

const annexSha256 = '39954a4b5605b0ee691bd1a13e8207568ecb9079c97cdd6bf4ef490a7b7a41c6';
const annexAttachmentNo = '10004214';
// Every page in this attachment prints its page number six pages behind the PDF page.
const PRINTED_PAGE_OFFSET = 6;
// Elementary subjects start in 2028-03-01 under the 2026-1 addendum; the dataset
// tracks the current notice edition and records the enforcement date separately.
const EFFECTIVE_FROM = '2028-03-01';

const integratedStandardCode =
  /^\[2(?:(?:바|슬)(?:01|02|03|04)-0[1-4]|건(?:01-0[1-2]|02-0[1-5]|03-0[1-2])|즐(?:01-0[1-4]|02-0[1-6]|03-0[1-6]))\]$/;

const lifeQuestions = {
  '01': { slug: 'who', en: 'Who We Live As', ko: '우리는 누구로 살아갈까' },
  '02': { slug: 'where', en: 'Where We Live', ko: '우리는 어디서 살아갈까' },
  '03': { slug: 'now', en: 'How We Live Now', ko: '우리는 지금 어떻게 살아갈까' },
  '04': { slug: 'doing', en: 'What We Do As We Live', ko: '우리는 무엇을 하며 살아갈까' },
};

const healthAreas = {
  '01': {
    slug: 'healthy-body',
    en: 'Healthy Body',
    ko: '건강한 몸',
    facetTypes: ['CONCEPTUAL', 'PROCEDURAL', 'META'],
    facets: ['몸·건강·안전 이해', '안전한 신체 활동과 습관 실천', '몸 인식과 실천 돌아보기'],
  },
  '02': {
    slug: 'active-movement',
    en: 'Active Movement',
    ko: '활기찬 움직임',
    facetTypes: ['CONCEPTUAL', 'PROCEDURAL', 'META'],
    facets: ['움직임 특성과 상황 파악', '놀이 속 움직임 탐색·수행', '움직임 연결과 참여 돌아보기'],
  },
  '03': {
    slug: 'creative-expression',
    en: 'Creative Expression',
    ko: '창의적 표현',
    facetTypes: ['CONCEPTUAL', 'REPRESENTATIONAL', 'META'],
    facets: ['표현 대상과 움직임 요소 탐색', '움직임 변화로 생각과 느낌 표현', '표현 나눔과 창의적 개선'],
  },
};

// 2026-1 rebuilt 즐거운 생활 around music and art: 체험 → 표현 → 감상.
const joyfulAreas = {
  '01': {
    slug: 'experience',
    en: 'Sensory Experience',
    ko: '체험',
    facetTypes: ['CONCEPTUAL', 'PROCEDURAL', 'META'],
    facets: ['소리와 이미지의 특징 이해', '감각으로 탐색하고 나타내기', '탐색 경험 나누고 호기심 잇기'],
  },
  '02': {
    slug: 'expression',
    en: 'Artistic Expression',
    ko: '표현',
    facetTypes: ['CONCEPTUAL', 'REPRESENTATIONAL', 'META'],
    facets: ['표현의 기초 요소와 재료 이해', '소리와 조형으로 표현하기', '표현 과정 돌아보고 다시 하기'],
  },
  '03': {
    slug: 'appreciation',
    en: 'Appreciation',
    ko: '감상',
    facetTypes: ['CONCEPTUAL', 'PROCEDURAL', 'META'],
    facets: ['작품과 음악 요소 알아보기', '듣고 보며 반응하기', '감상 나누고 다양성 받아들이기'],
  },
};

const integratedSubjects = {
  바: {
    slug: 'right-life',
    en: 'Right Life',
    ko: '바른 생활',
    areaKind: 'integrated-life-question',
    facetTypes: ['CONCEPTUAL', 'PROCEDURAL', 'META'],
    facets: ['생활 맥락 이해', '바른 생활 실천', '성찰과 습관화'],
  },
  슬: {
    slug: 'wise-life',
    en: 'Wise Life',
    ko: '슬기로운 생활',
    areaKind: 'integrated-life-question',
    facetTypes: ['CONCEPTUAL', 'REPRESENTATIONAL', 'PROCEDURAL'],
    facets: ['탐구 질문 만들기', '관찰과 자료 읽기', '탐구 결과 설명'],
  },
  건: {
    slug: 'healthy-life',
    en: 'Healthy Life',
    ko: '건강한 생활',
    areaKind: 'health-domain',
  },
  즐: {
    slug: 'joyful-life',
    en: 'Joyful Life',
    ko: '즐거운 생활',
    areaKind: 'arts-domain',
  },
};

// [code, repository-authored summary, PDF page in attachment 10004214].
// 바른 생활 / 슬기로운 생활 list four codes per area page; 건강한 생활 and
// 즐거운 생활 give each code its own commentary page.
const inventory = [
  ['바', '01', [
    ['[2바01-01]', '안전하고 건강한 학교 생활과 학습 습관 형성', 13],
    ['[2바01-02]', '자기 이해와 자기 존중을 바탕으로 생활하기', 13],
    ['[2바01-03]', '가족과 주변 사람을 배려하며 관계 맺기', 13],
    ['[2바01-04]', '사람과 자연이 함께 사는 생태환경 실천', 13],
  ]],
  ['바', '02', [
    ['[2바02-01]', '공동체 안에서 할 수 있는 일 찾기와 실천', 14],
    ['[2바02-02]', '우리나라의 소중함과 나라 사랑 마음 기르기', 14],
    ['[2바02-03]', '차이와 다양성을 존중하는 생활 태도', 14],
    ['[2바02-04]', '새로운 활동에 대한 호기심과 도전', 14],
  ]],
  ['바', '03', [
    ['[2바03-01]', '하루의 가치를 느끼고 지금을 소중히 여기기', 15],
    ['[2바03-02]', '계절 변화에 맞추어 생활하기', 15],
    ['[2바03-03]', '여러 인물의 삶에서 공동체성 배우기', 15],
    ['[2바03-04]', '지속가능한 삶의 방식을 찾아 실천하기', 15],
  ]],
  ['바', '04', [
    ['[2바04-01]', '모두를 위한 생활환경 만들기에 참여하기', 16],
    ['[2바04-02]', '다양한 생각과 의견에 열린 태도 형성', 16],
    ['[2바04-03]', '여럿이 하는 활동에 관심을 갖고 협력하기', 16],
    ['[2바04-04]', '생활 습관과 학습 습관 되돌아보기', 16],
  ]],
  ['슬', '01', [
    ['[2슬01-01]', '학교 안팎의 모습과 생활 탐색 및 안전한 학교 생활', 29],
    ['[2슬01-02]', '나를 탐색하고 나에 대해 설명하기', 29],
    ['[2슬01-03]', '가족과 주변 사람이 함께 살아가는 모습 탐구', 29],
    ['[2슬01-04]', '사람, 자연, 동식물이 어우러진 생태 탐구', 29],
  ]],
  ['슬', '02', [
    ['[2슬02-01]', '마을과 사람들이 생활하는 모습 살펴보기', 30],
    ['[2슬02-02]', '우리나라의 모습과 문화 조사하기', 30],
    ['[2슬02-03]', '알고 싶은 나라를 탐구하며 관심 넓히기', 30],
    ['[2슬02-04]', '궁금한 세계를 여러 매체로 탐색하기', 30],
  ]],
  ['슬', '03', [
    ['[2슬03-01]', '하루의 변화와 사람들의 하루 생활 탐색', 31],
    ['[2슬03-02]', '계절과 생활의 관계 탐구', 31],
    ['[2슬03-03]', '관심 대상의 과거와 현재를 살피고 미래 상상', 31],
    ['[2슬03-04]', '생활과 관련된 지속가능성 사례 탐색', 31],
  ]],
  ['슬', '04', [
    ['[2슬04-01]', '생활도구의 모양과 기능 탐색 및 바꾸기', 32],
    ['[2슬04-02]', '상상한 것을 매체와 재료로 구현하기', 32],
    ['[2슬04-03]', '경험에서 관심 주제를 정하고 조사하기', 32],
    ['[2슬04-04]', '배운 것과 배울 것을 연결하며 배움 상상', 32],
  ]],
  ['건', '01', [
    ['[2건01-01]', '자기 몸을 긍정적으로 바라보며 건강을 위한 신체 활동에 안전하게 참여하기', 45],
    ['[2건01-02]', '건강과 안전을 위한 생활 습관을 지속적으로 실천하기', 46],
  ]],
  ['건', '02', [
    ['[2건02-01]', '제자리 움직임의 특성을 알고 놀이에서 다양한 방식으로 스스로 탐색하기', 47],
    ['[2건02-02]', '걷고 달리는 움직임을 알고 놀이에서 적극적으로 시도하기', 48],
    ['[2건02-03]', '뜀뛰는 움직임을 알고 놀이에서 자신 있게 시도하기', 49],
    ['[2건02-04]', '도구를 다루는 움직임을 알고 서로 배려하며 상황에 맞게 수행하기', 50],
    ['[2건02-05]', '친구들과 어울려 여러 움직임을 이어서 수행하기', 51],
  ]],
  ['건', '03', [
    ['[2건03-01]', '다양한 움직임으로 사물이나 자연의 특징을 살려 즐겁게 표현하기', 52],
    ['[2건03-02]', '움직임 요소를 바꾸며 생각과 느낌을 창의적으로 표현하기', 53],
  ]],
  ['즐', '01', [
    ['[2즐01-01]', '주변에서 들리는 여러 소리의 특징을 호기심 있게 탐색하기', 69],
    ['[2즐01-02]', '소리를 내는 도구를 알아보고 소리로 나타내기', 70],
    ['[2즐01-03]', '감각적 경험의 즐거움을 느끼며 대상의 특징 탐색하기', 71],
    ['[2즐01-04]', '생활 속에서 이미지 발견하기', 72],
  ]],
  ['즐', '02', [
    ['[2즐02-01]', '기초적인 자세와 주법으로 노래하거나 악기 연주하기', 73],
    ['[2즐02-02]', '기초적인 음악 요소를 활용해 소리 모방하기', 74],
    ['[2즐02-03]', '목소리·악기·신체로 자유롭게 표현하며 표현의 소중함 느끼기', 75],
    ['[2즐02-04]', '조형 요소를 탐색하여 활용하기', 76],
    ['[2즐02-05]', '표현 재료를 탐색하고 용구 사용법 익히기', 77],
    ['[2즐02-06]', '관찰하고 상상하여 표현하는 과정 즐기기', 78],
  ]],
  ['즐', '03', [
    ['[2즐03-01]', '여러 가지 악곡을 듣고 다양한 방법으로 반응하기', 79],
    ['[2즐03-02]', '악곡을 듣고 기초적인 음악 요소 찾아보기', 80],
    ['[2즐03-03]', '미술 작품에 반응하며 느낌과 생각 나타내기', 81],
    ['[2즐03-04]', '미술 전시를 찾아보고 다양한 방법으로 관람하기', 82],
    ['[2즐03-05]', '생활 속 국악과 전통 미술에 친근감 가지기', 83],
    ['[2즐03-06]', '음악과 미술 작품 감상으로 다양성 받아들이기', 84],
  ]],
];

function codeParts(code) {
  const match = code.match(/^\[2([바슬건즐])(\d{2})-(\d{2})\]$/);
  if (!match) throw new Error(`Bad integrated standard code ${code}`);
  return { subjectCode: match[1], areaCode: match[2], number: match[3] };
}

function cleanCode(code) {
  const { subjectCode, areaCode, number } = codeParts(code);
  const subjectToken = { 바: 'ba', 슬: 'seul', 건: 'geon', 즐: 'jeul' }[subjectCode];
  return `2${subjectToken}${areaCode}${number}`;
}

function areaCatalogFor(subjectCode) {
  if (subjectCode === '건') return healthAreas;
  if (subjectCode === '즐') return joyfulAreas;
  return lifeQuestions;
}

function curriculumAreaFor(subjectCode, areaCode) {
  const area = areaCatalogFor(subjectCode)[areaCode];
  if (!area) throw new Error(`Missing curriculum area for ${subjectCode}${areaCode}`);
  const subject = integratedSubjects[subjectCode];
  return {
    ...area,
    kind: subject.areaKind,
    sourceSection: `${subject.ko} > ${AGE_RANGE.label} > ${area.ko}`,
  };
}

function facetsFor(subjectCode, areaCode) {
  const subject = integratedSubjects[subjectCode];
  const owner = subjectCode === '건' || subjectCode === '즐' ? areaCatalogFor(subjectCode)[areaCode] : subject;
  return owner.facets.map((facet, index) => ({ facet, type: owner.facetTypes[index] }));
}

function standardKey(code) {
  return `${CURRICULUM_ID}:${code}`;
}

function topicId(standard, facetIndex) {
  return `kr.mt.integrated.${standard.domainSlug}.${standard.curriculumAreaSlug}.${cleanCode(standard.code)}.${String(facetIndex + 1).padStart(2, '0')}`;
}

function topicDescription(standard, facet) {
  const subject = integratedSubjects[standard.integratedSubjectCode];
  return `${AGE_RANGE.label} 학습자가 ${standard.summary}을/를 ${subject.ko}의 ${standard.curriculumAreaKorean} 맥락에서 ${facet} 단위로 다룰 수 있게 하는 세부 주제이다.`;
}

function evidenceFor(standard, facetIndex) {
  const subject = integratedSubjects[standard.integratedSubjectCode];
  if (standard.integratedSubjectCode === '바') {
    return [
      `${standard.summary}이/가 필요한 생활 장면을 학교, 가정, 마을 중 한 곳에서 찾고 설명한다.`,
      `${standard.lifeQuestionKorean} 질문과 연결해 자신이 실천할 수 있는 행동을 한 가지 정해 실행한다.`,
      `${subject.ko} 활동 뒤에 잘된 점과 다음에 고칠 점을 말, 그림, 짧은 글 중 하나로 기록한다.`,
    ];
  }
  if (standard.integratedSubjectCode === '슬') {
    return [
      `${standard.summary}에 대해 관찰하거나 조사할 질문을 만든다.`,
      `그림, 사진, 표, 이야기, 현장 관찰 중 알맞은 자료로 ${standard.lifeQuestionKorean} 맥락의 단서를 모은다.`,
      `탐구한 내용을 자신의 말로 설명하고 새로 궁금해진 점을 한 가지 제시한다.`,
    ];
  }
  if (standard.integratedSubjectCode === '건') {
    if (standard.curriculumAreaCode === '01') {
      return [
        [
          `${standard.summary}과/와 관련된 몸의 느낌, 건강 신호, 안전 조건을 그림이나 생활 장면에서 두 가지 이상 찾아 설명한다.`,
          `제시된 행동을 건강에 도움이 되는 행동과 안전을 다시 살펴야 하는 행동으로 나누고 판단 근거를 말한다.`,
        ],
        [
          `학교나 가정에서 ${standard.summary}을/를 실천할 방법과 안전 약속을 정한 뒤 실제로 수행한다.`,
          `수행 전·중·후에 몸의 느낌과 안전 상태를 확인하고 필요한 경우 활동 방법을 알맞게 조절한다.`,
        ],
        [
          `건강한 생활 실천표에서 수행 여부와 몸의 변화를 확인하고 잘된 점과 어려웠던 점을 각각 말한다.`,
          `${standard.summary}을/를 이어 가기 위해 다음 실천에서 유지하거나 바꿀 행동을 한 가지 정한다.`,
        ],
      ][facetIndex];
    }
    if (standard.curriculumAreaCode === '02') {
      return [
        [
          `${standard.summary}에 필요한 몸의 움직임, 공간, 도구, 안전 조건을 관찰해 두 가지 이상 구분한다.`,
          `시범이나 그림에서 움직임의 공통점과 달라지는 요소를 찾아 놀이 상황과 연결해 설명한다.`,
        ],
        [
          `놀이 규칙과 안전 약속을 지키며 ${standard.summary}을/를 두 가지 방식으로 시도하거나 연결한다.`,
          `공간, 속도, 방향, 도구, 친구의 위치 중 한 조건이 달라지면 움직임을 상황에 맞게 조절한다.`,
        ],
        [
          `자신과 친구의 움직임을 관찰해 잘된 점과 안전하거나 협력적으로 바꿀 점을 각각 말한다.`,
          `관찰한 내용을 반영해 ${standard.summary}을/를 한 번 다시 수행하고 달라진 점을 설명한다.`,
        ],
      ][facetIndex];
    }
    return [
      [
        `${standard.summary}에 활용할 사물·자연의 특징이나 생각·느낌을 움직임 요소 두 가지와 연결한다.`,
        `신체 부위, 방향, 높이, 속도, 무게, 상호 작용 중 표현 대상에 알맞은 요소를 선택하고 이유를 말한다.`,
      ],
      [
        `선택한 움직임 요소 두 가지 이상을 변화시켜 ${standard.summary}을/를 자신만의 움직임으로 표현한다.`,
        `표현의 시작과 끝을 정하고 공간과 다른 사람을 살피며 움직임을 안전하게 이어 간다.`,
      ],
      [
        `표현을 친구와 나누고 선택한 움직임이 대상이나 느낌을 어떻게 드러내는지 설명한다.`,
        `친구의 반응과 자신의 점검을 바탕으로 움직임 요소 한 가지를 바꾸어 다시 표현한다.`,
      ],
    ][facetIndex];
  }
  if (standard.curriculumAreaCode === '01') {
    return [
      [
        `${standard.summary} 활동에서 살펴볼 소리나 이미지의 특징을 두 가지 이상 찾아 설명한다.`,
        `찾은 특징을 길고 짧음, 높고 낮음, 세기, 모양, 색 등 알맞은 기준과 연결해 구분한다.`,
      ],
      [
        `교실과 학교 안팎에서 ${standard.summary}에 필요한 대상을 직접 듣거나 보며 탐색한다.`,
        `탐색한 것을 목소리, 물체, 악기, 몸짓, 그림 중 알맞은 방법으로 나타낸다.`,
      ],
      [
        `${standard.summary} 활동에서 새롭게 알게 된 점과 더 알고 싶은 점을 각각 말한다.`,
        `친구의 탐색 결과와 자신의 결과를 견주어 보고 다음 활동에서 시도할 방법을 한 가지 정한다.`,
      ],
    ][facetIndex];
  }
  if (standard.curriculumAreaCode === '02') {
    return [
      [
        `${standard.summary}에 필요한 음악 요소, 조형 요소, 재료와 용구를 두 가지 이상 찾아 설명한다.`,
        `찾은 요소가 표현하려는 느낌이나 대상과 어떻게 이어지는지 사례로 제시한다.`,
      ],
      [
        `${standard.summary}을/를 목소리, 악기, 신체, 재료와 용구 중 알맞은 방법으로 표현한다.`,
        `표현하는 동안 바른 자세와 사용법, 안전 약속을 지키며 활동을 끝까지 수행한다.`,
      ],
      [
        `자신과 친구의 표현에서 잘된 점과 바꾸고 싶은 점을 각각 한 가지씩 말한다.`,
        `돌아본 내용을 반영해 ${standard.summary}을/를 한 번 더 표현하고 달라진 점을 설명한다.`,
      ],
    ][facetIndex];
  }
  return [
    [
      `${standard.summary}에 쓰인 악곡이나 미술 작품에서 드러나는 특징을 두 가지 이상 찾아 말한다.`,
      `찾은 특징을 기초적인 음악 요소나 전통 미술·전시의 성격과 연결해 구분한다.`,
    ],
    [
      `${standard.summary} 활동에서 악곡이나 작품을 끝까지 듣거나 보고 몸짓, 말, 그림 중 알맞은 방법으로 반응한다.`,
      `반응한 까닭을 들은 소리나 본 장면에서 찾아 근거로 제시한다.`,
    ],
    [
      `자신의 감상과 친구의 감상이 어떻게 다른지 견주어 설명한다.`,
      `서로 다른 감상을 존중하며 다음에 더 듣거나 보고 싶은 작품을 한 가지 고른다.`,
    ],
  ][facetIndex];
}

function assessmentPromptFor(standard, facet, facetIndex) {
  if (standard.integratedSubjectCode === '바') {
    return `학습자가 ${standard.summary}과/와 관련된 생활 장면을 알아차리고, ${standard.lifeQuestionKorean} 맥락에서 실천한 뒤 자신의 습관 변화를 설명할 수 있는가?`;
  }
  if (standard.integratedSubjectCode === '슬') {
    return `학습자가 ${standard.summary}에 대한 질문을 세우고 자료를 살핀 뒤, ${standard.lifeQuestionKorean} 맥락의 탐구 결과를 근거와 함께 설명할 수 있는가?`;
  }
  if (standard.integratedSubjectCode === '건') {
    if (standard.curriculumAreaCode === '01') {
      return [
        `${standard.summary}에 관한 생활 장면 두 가지를 제시한다. 학습자가 몸·건강·안전 조건을 찾아 행동을 분류하고 각 판단의 근거를 설명하게 한다.`,
        `${standard.summary}을/를 실천할 학교 또는 가정 과제를 제시한다. 학습자가 안전 약속을 정하고 수행하면서 몸의 상태에 맞게 방법을 조절하는지 관찰한다.`,
        `${standard.summary} 실천표를 살펴보게 한다. 학습자가 수행과 몸의 변화를 근거로 잘된 점·어려운 점을 말하고 다음 실천 행동을 정하게 한다.`,
      ][facetIndex];
    }
    if (standard.curriculumAreaCode === '02') {
      return [
        `${standard.summary}의 시범·그림과 놀이 공간을 제시한다. 학습자가 움직임의 특성과 안전 조건을 찾아 공통점과 차이점을 설명하게 한다.`,
        `${standard.summary} 놀이 과제를 제시한다. 학습자가 규칙과 안전 약속을 지키며 두 가지 방식으로 시도하고 달라진 조건에 맞게 움직임을 조절하는지 관찰한다.`,
        `${standard.summary} 수행 기록이나 짝 관찰 결과를 제시한다. 학습자가 잘된 점과 바꿀 점을 정해 다시 수행하고 변화의 근거를 설명하게 한다.`,
      ][facetIndex];
    }
    return [
      `${standard.summary}에 맞는 사물·자연·생각·느낌 자료를 제시한다. 학습자가 특징과 움직임 요소 두 가지를 연결하고 선택 이유를 설명하게 한다.`,
      `${standard.summary} 표현 과제를 제시한다. 학습자가 움직임 요소 두 가지 이상을 변화시키고 공간과 다른 사람을 살피며 시작부터 끝까지 안전하게 표현하는지 관찰한다.`,
      `${standard.summary} 표현을 나누게 한다. 학습자가 선택한 움직임의 효과를 설명하고 자신과 친구의 반응을 반영해 요소 한 가지를 바꾸어 다시 표현하게 한다.`,
    ][facetIndex];
  }
  if (standard.curriculumAreaCode === '01') {
    return [
      `${standard.summary}에 쓸 소리나 이미지 자료를 제시한다. 학습자가 특징을 두 가지 이상 찾아 알맞은 기준으로 구분하고 판단 근거를 말하게 한다.`,
      `${standard.summary} 탐색 과제를 제시한다. 학습자가 교실 안팎에서 대상을 직접 탐색하고 목소리·물체·악기·몸짓·그림 중 알맞은 방법으로 나타내는지 관찰한다.`,
      `${standard.summary} 탐색 결과를 나누게 한다. 학습자가 새로 알게 된 점과 더 알고 싶은 점을 말하고 다음 활동에서 시도할 방법을 정하게 한다.`,
    ][facetIndex];
  }
  if (standard.curriculumAreaCode === '02') {
    return [
      `${standard.summary}에 필요한 음악 요소·조형 요소·재료와 용구 자료를 제시한다. 학습자가 두 가지 이상을 찾아 표현 의도와 연결해 설명하게 한다.`,
      `${standard.summary} 표현 과제를 제시한다. 학습자가 목소리·악기·신체·재료 중 알맞은 방법을 골라 바른 자세와 사용법, 안전 약속을 지키며 표현하는지 관찰한다.`,
      `${standard.summary} 표현을 서로 나누게 한다. 학습자가 잘된 점과 바꿀 점을 말하고 이를 반영해 다시 표현한 뒤 달라진 점을 설명하게 한다.`,
    ][facetIndex];
  }
  return [
    `${standard.summary}에 쓸 악곡이나 미술 작품을 제시한다. 학습자가 드러나는 특징을 두 가지 이상 찾아 음악 요소나 전통 미술·전시의 성격과 연결해 말하게 한다.`,
    `${standard.summary} 감상 과제를 제시한다. 학습자가 작품을 끝까지 듣거나 보고 몸짓·말·그림 중 알맞은 방법으로 반응하며 그 까닭을 근거로 드는지 관찰한다.`,
    `${standard.summary} 감상을 나누게 한다. 학습자가 자신과 친구의 감상 차이를 설명하고 서로 다른 관점을 존중하며 다음에 감상할 작품을 고르게 한다.`,
  ][facetIndex];
}

const standards = [];
for (const [integratedSubjectCode, areaCode, rows] of inventory) {
  const subject = integratedSubjects[integratedSubjectCode];
  const curriculumArea = curriculumAreaFor(integratedSubjectCode, areaCode);
  const usesLifeQuestion = subject.areaKind === 'integrated-life-question';
  for (const [code, summary, pdfPage] of rows) {
    const parts = codeParts(code);
    if (parts.subjectCode !== integratedSubjectCode || parts.areaCode !== areaCode) {
      throw new Error(`Inventory mismatch for ${code}`);
    }
    const standard = {
      key: standardKey(code),
      code,
      gradeBand: GRADE_BAND,
      subject: SUBJECT,
      subjectKorean: SUBJECT_KO,
      domain: subject.en,
      domainKorean: subject.ko,
      domainSlug: subject.slug,
      integratedSubjectCode,
      curriculumArea: curriculumArea.en,
      curriculumAreaKorean: curriculumArea.ko,
      curriculumAreaSlug: curriculumArea.slug,
      curriculumAreaCode: areaCode,
      curriculumAreaKind: curriculumArea.kind,
      summary: standardSummary(code, summary),
      officialTextIncluded: false,
      sourceRefs: [...sourceRefs],
      sourceSection: curriculumArea.sourceSection,
      verificationStatus: 'official-source-checked',
      sourceBasis:
        'Achievement-standard code, subject section, and page placement were checked against the current NCIC attachment 10004214 (국가교육위원회 고시 제2026-1호 일부개정 [별책 15]) and cross-checked against [별책 2] 초등학교 교육과정 attachment 10004180; this artifact stores concise source-derived paraphrases rather than official standard text.',
      effectiveFrom: EFFECTIVE_FROM,
      evidence: [
        'NCIC current inventory tuple checked: degreeCode=1014, classCode=1002, subjectCode=3417, openYear=2026, openMonth=01.',
        `Official current attachment checked: 국가교육위원회 고시 제2026-1호 일부개정 [별책 15], attachmentNo=${annexAttachmentNo}.`,
        `Code ${code} appears in the ${subject.ko} ${curriculumArea.ko} achievement-standard section for ${AGE_RANGE.label} on PDF page ${pdfPage} (printed page ${pdfPage - PRINTED_PAGE_OFFSET}).`,
        `Cross-check: code ${code} also appears in [별책 2] 초등학교 교육과정 attachmentNo=10004180, which carries all 620 elementary codes in one document.`,
      ],
      sourceLocator: {
        sourceId: ANNEX15_SOURCE_ID,
        attachmentNo: annexAttachmentNo,
        sha256: annexSha256,
        pdfPage,
        printedPage: pdfPage - PRINTED_PAGE_OFFSET,
        section: curriculumArea.sourceSection,
        code,
      },
    };
    if (usesLifeQuestion) {
      standard.lifeQuestion = curriculumArea.en;
      standard.lifeQuestionKorean = curriculumArea.ko;
    }
    standards.push(standard);
  }
}

const microTopics = [];
const standardMappings = [];
const standardTopicMap = new Map();

for (const standard of standards) {
  const subject = integratedSubjects[standard.integratedSubjectCode];
  const topicIds = [];
  facetsFor(standard.integratedSubjectCode, standard.curriculumAreaCode).forEach(({ facet, type }, i) => {
    const id = topicId(standard, i);
    const name = `${standard.summary} - ${facet}`;
    topicIds.push(id);
    microTopics.push({
      id,
      type,
      subject: SUBJECT,
      subjectKorean: SUBJECT_KO,
      domain: subject.en,
      domainKorean: subject.ko,
      gradeBand: GRADE_BAND,
      ageRangeStart: AGE_RANGE.start,
      ageRangeEnd: AGE_RANGE.end,
      curriculumArea: standard.curriculumArea,
      curriculumAreaKorean: standard.curriculumAreaKorean,
      curriculumAreaKind: standard.curriculumAreaKind,
      ...(standard.lifeQuestion ? {
        lifeQuestion: standard.lifeQuestion,
        lifeQuestionKorean: standard.lifeQuestionKorean,
      } : {}),
      name,
      title: name,
      titleKorean: name,
      titleEnglish: `${subject.en} ${standard.curriculumArea} ${standard.code} micro-topic ${i + 1}`,
      description: topicDescription(standard, facet),
      evidence: evidenceFor(standard, i),
      assessmentPrompt: assessmentPromptFor(standard, facet, i),
      standards: [standard.key],
      sourceStandardCode: standard.code,
      sourceRefs: [...standard.sourceRefs],
      sourceLocator: { ...standard.sourceLocator },
      verificationStatus: 'public-doc-derived',
      generationBasis: `${standard.code} ${subject.ko} 성취기준을 ${standard.curriculumAreaKorean} 영역의 ${facet} 세부 주제로 분해했다.`,
    });
    standardMappings.push({
      standardKey: standard.key,
      microTopicId: id,
      relationship: i === 0 ? 'introduces' : i === 1 ? 'supports' : 'assesses',
      confidence: 'official-source-derived',
      note: `${standard.code} ${subject.ko} 성취기준을 ${facet} 세부 주제로 연결한다.`,
    });
  });
  standardTopicMap.set(standard.code, topicIds);
}

for (const standard of standards) {
  delete standard.domainSlug;
  delete standard.integratedSubjectCode;
  delete standard.curriculumAreaSlug;
  delete standard.curriculumAreaCode;
}

const dependencySuggestions = [];
const edgeKeys = new Set();
function addEdge(topicIdValue, prerequisiteId, strength, reason) {
  const key = `${topicIdValue}->${prerequisiteId}`;
  if (topicIdValue === prerequisiteId || edgeKeys.has(key)) return;
  edgeKeys.add(key);
  dependencySuggestions.push({
    topicId: topicIdValue,
    prerequisiteId,
    strength,
    status: 'suggested-for-review',
    reason,
  });
}

for (const [integratedSubjectCode, areaCode, rows] of inventory) {
  const subject = integratedSubjects[integratedSubjectCode];
  const curriculumArea = curriculumAreaFor(integratedSubjectCode, areaCode);
  for (const [code] of rows) {
    const ids = standardTopicMap.get(code);
    addEdge(ids[1], ids[0], 'hard', `${code} ${subject.ko} 수행 주제는 먼저 ${curriculumArea.ko} 맥락의 핵심 조건 이해가 필요하다.`);
    addEdge(ids[2], ids[1], 'soft', `${code} ${subject.ko} 성찰·나눔 주제는 실제 활동 수행 뒤에 점검하는 흐름이 자연스럽다.`);
  }
  for (let i = 1; i < rows.length; i += 1) {
    const previous = standardTopicMap.get(rows[i - 1][0]);
    const current = standardTopicMap.get(rows[i][0]);
    addEdge(current[0], previous[2], 'soft', `${subject.ko} ${curriculumArea.ko} 영역 안의 순차 학습 제안이다.`);
  }
}

// 2026-1 keeps the four shared life questions only in 바른 생활 and 슬기로운 생활;
// 즐거운 생활 moved to its own 체험·표현·감상 areas, so the old
// 바 → 슬 → 즐 life-question bridge now stops at 슬기로운 생활.
for (const areaCode of Object.keys(lifeQuestions)) {
  for (let i = 0; i < 4; i += 1) {
    const rightCode = inventory.find(([s, a]) => s === '바' && a === areaCode)[2][i][0];
    const wiseCode = inventory.find(([s, a]) => s === '슬' && a === areaCode)[2][i][0];
    addEdge(
      standardTopicMap.get(wiseCode)[0],
      standardTopicMap.get(rightCode)[2],
      'soft',
      `${lifeQuestions[areaCode].ko} 통합 흐름에서 바른 생활 실천 경험이 슬기로운 생활 탐구 질문을 뒷받침한다.`,
    );
  }
}

for (const subjectCode of ['바', '슬', '즐']) {
  const subject = integratedSubjects[subjectCode];
  const subjectRows = inventory.filter(([s]) => s === subjectCode);
  for (let i = 1; i < subjectRows.length; i += 1) {
    const previousArea = curriculumAreaFor(subjectCode, subjectRows[i - 1][1]);
    const currentArea = curriculumAreaFor(subjectCode, subjectRows[i][1]);
    const previousLastCode = subjectRows[i - 1][2].at(-1)[0];
    const currentFirstCode = subjectRows[i][2][0][0];
    addEdge(
      standardTopicMap.get(currentFirstCode)[0],
      standardTopicMap.get(previousLastCode)[2],
      'soft',
      `${subject.ko} ${previousArea.ko} 영역에서 형성한 경험이 ${currentArea.ko} 영역의 첫 주제를 준비한다.`,
    );
  }
}

const clusters = [];
for (const [integratedSubjectCode, areaCode, rows] of inventory) {
  const subject = integratedSubjects[integratedSubjectCode];
  const curriculumArea = curriculumAreaFor(integratedSubjectCode, areaCode);
  const usesLifeQuestion = subject.areaKind === 'integrated-life-question';
  const topicIds = rows.flatMap(([code]) => standardTopicMap.get(code));
  clusters.push({
    id: `kr.cluster.integrated.${subject.slug}.${curriculumArea.slug}.${GRADE_BAND}`,
    name: `${subject.ko} - ${curriculumArea.ko}`,
    title: `${subject.ko} - ${curriculumArea.ko}`,
    titleKorean: `${subject.ko} - ${curriculumArea.ko}`,
    titleEnglish: `${subject.en} - ${curriculumArea.en}`,
    subject: SUBJECT,
    subjectKorean: SUBJECT_KO,
    domain: subject.en,
    domainKorean: subject.ko,
    gradeBand: GRADE_BAND,
    curriculumArea: curriculumArea.en,
    curriculumAreaKorean: curriculumArea.ko,
    curriculumAreaKind: curriculumArea.kind,
    ...(usesLifeQuestion ? {
      lifeQuestion: curriculumArea.en,
      lifeQuestionKorean: curriculumArea.ko,
    } : {}),
    topicCount: topicIds.length,
    topics: topicIds,
    summary: `${AGE_RANGE.label} ${subject.ko} ${curriculumArea.ko} 영역의 공식 성취기준 ${rows.length}개를 ${topicIds.length}개 세부 주제로 분해한 클러스터이다.`,
  });
}

const coverageGaps = [
  {
    id: 'gap.kr.integrated.official-text-omitted',
    severity: 'intentional',
    status: 'intentional',
    note: 'Official achievement-standard wording is not embedded verbatim; this artifact stores codes, source-derived paraphrases, and NCIC/MOE source metadata.',
  },
  {
    id: 'gap.kr.integrated.hwp-crosscheck',
    severity: 'review-needed',
    note: 'The PDF attachment was downloaded and checked. The paired HWP attachment orgAttNo=10004213 should be retained as a secondary format for human review.',
  },
  {
    id: 'gap.kr.integrated.dependency-expert-review',
    severity: 'review-needed',
    note: 'Dependency suggestions encode plausible first-school-life, inquiry, movement, and arts flow, but have not been reviewed by an integrated-curriculum specialist.',
  },
  {
    id: 'gap.kr.integrated.classroom-assessment-calibration',
    severity: 'review-needed',
    note: 'Evidence statements and assessment prompts are source-aligned generated checks and should be calibrated with grade 1-2 classroom examples before product use.',
  },
  {
    id: 'gap.kr.integrated.2026-1-repin',
    severity: 'low',
    status: 'resolved',
    note: 'Resolved 2026-09-05. The inventory previously mixed 48 codes from 2022-33 Annex 15 with the nine 2026 건강한 생활 codes. It is now pinned to attachment 10004214 alone: [2즐04-01]~[2즐04-04] were dropped, [2즐02-05], [2즐02-06], [2즐03-05], [2즐03-06] were added, and the twelve [2즐01-01]~[2즐03-04] codes were rewritten to the reassigned 2026 meanings (즐거운 생활 areas moved from four life questions to 체험·표현·감상).',
    sourceRefs: [ANNEX15_SOURCE_ID, ANNEX2_SOURCE_ID],
  },
  {
    id: 'gap.kr.integrated.2026-1-enforcement-date',
    severity: 'low',
    status: 'intentional',
    note: `Policy: the dataset tracks the current notice edition, not the edition in force. The 2026-1 addendum applies Annex 15 to elementary grades 1-2 from ${EFFECTIVE_FROM}, so classrooms follow the 2022-33 edition until then. Each standard carries effectiveFrom and the release textPolicy documents the choice.`,
    sourceRefs: [ANNEX15_SOURCE_ID],
  },
];

const artifact = {
  dataset: 'Korean Elementary Learning Map integrated-subjects workstream',
  taxonomyVersion: 'kr-full-depth-v0.5-workstream-integrated',
  generatedAt: '2026-09-05T00:00:00+09:00',
  locale: 'ko-KR',
  country: 'KR',
  subject: SUBJECT,
  subjectKorean: SUBJECT_KO,
  curriculumId: CURRICULUM_ID,
  status: 'subject-workstream-artifact',
  verificationStatus: 'official-source-checked',
  sourceBasis:
    'Pinned to a single governing edition: 국가교육위원회 고시 제2026-1호 일부개정 [별책 15] (NCIC attachment 10004214), which carries 바른 생활 16, 슬기로운 생활 16, 건강한 생활 9, and 즐거운 생활 16 achievement standards for 57 total. [별책 2] 초등학교 교육과정 (attachment 10004180) is cited as an independent cross-check of the same code set.',
  textPolicy: {
    officialStandardTextIncluded: false,
    summaryPolicy: 'Concise source-derived paraphrases only; no bulk verbatim curriculum text is included.',
    licensingStatus: 'Public Korean national curriculum source metadata plus local generated workstream design.',
    licenseCaution: 'Keep official curriculum text in external source references and preserve attribution to NCIC, the Ministry of Education, and the National Education Commission amendment.',
    sourceEditionPolicy: `Current notice edition, not the edition in force. Annex 15 as amended by 국가교육위원회 고시 제2026-1호 governs; elementary enforcement begins ${EFFECTIVE_FROM}.`,
  },
  sources: [
    {
      id: INVENTORY_SOURCE_ID,
      name: 'NCIC 2026.01 elementary integrated-subjects inventory row',
      sourceType: 'official-inventory',
      url: 'https://ncic.re.kr/inv/org/list.do',
      accessDate: '2026-09-05',
      usage: 'Official inventory path and attachment metadata for the current 바른 생활, 슬기로운 생활, 건강한 생활, 즐거운 생활 branch.',
      inventoryPath: '2022 개정 시기 > 초등학교(2026.01) > 바른 생활, 슬기로운 생활, 건강한 생활, 즐거운 생활',
      apiIdentifiers: {
        degreeCode: '1014',
        classCode: '1002',
        subjectCode: '3417',
        openYear: '2026',
        openMonth: '01',
      },
    },
    {
      id: ANNEX15_SOURCE_ID,
      name: '국가교육위원회 고시 제2026-1호 일부개정 [별책 15] 바른 생활, 슬기로운 생활, 건강한 생활, 즐거운 생활 교육과정',
      sourceType: 'official-pdf',
      publisher: '교육부·국가교육위원회',
      via: 'NCIC 국가교육과정정보센터',
      url: 'https://ncic.re.kr/inv/org/download.do?year=2026&seq=10004214&orgType=ogi4',
      accessDate: '2026-09-05',
      usage: 'Sole governing source for the 57 integrated-subject achievement-standard codes, their subject sections, and their page placement.',
      attachmentName: '바른 생활, 슬기로운 생활, 건강한 생활, 즐거운 생활 교육과정.pdf',
      attachmentNo: annexAttachmentNo,
      pairedHwpAttachmentNo: '10004213',
      sha256: annexSha256,
      fileSizeBytes: 1449216,
      pdfPages: 90,
      pdfCreationDate: '2026-02-02',
      printedPageOffset: PRINTED_PAGE_OFFSET,
      effectiveFrom: EFFECTIVE_FROM,
      supersedes: '교육부 고시 제2022-33호 [별책 15] (attachmentNo 10003571)',
      achievementStandardPdfPages: {
        '바른 생활': [13, 16],
        '슬기로운 생활': [29, 32],
        '건강한 생활': [45, 53],
        '즐거운 생활': [69, 84],
      },
    },
    {
      id: ANNEX2_SOURCE_ID,
      name: '국가교육위원회 고시 제2026-1호 [별책 2] 초등학교 교육과정',
      sourceType: 'official-pdf',
      publisher: '교육부·국가교육위원회',
      via: 'NCIC 국가교육과정정보센터',
      url: 'https://ncic.re.kr/inv/org/download.do?year=2026&seq=10004180&orgType=ogi4',
      accessDate: '2026-09-05',
      usage: 'Independent cross-check: this single document carries all 620 elementary achievement-standard codes, including the amended integrated-subject inventory. Used for code-set verification only; no text is reproduced.',
      attachmentName: '[별책2] 초등학교 교육과정.pdf',
      attachmentNo: '10004180',
      pairedHwpAttachmentNo: '10004179',
      sha256: 'f943dab812a4b1fdb48af16fd724b5391d0db64bda83ed4e4b3b2a95faf3d4f9',
      fileSizeBytes: 6402622,
      pdfPages: 563,
      pdfCreationDate: '2026-01-20',
    },
  ],
  domains: Object.entries(integratedSubjects).map(([code, subject]) => ({
    code,
    slug: subject.slug,
    domain: subject.en,
    domainKorean: subject.ko,
    curriculumAreaKind: subject.areaKind,
  })),
  lifeQuestions: Object.entries(lifeQuestions).map(([code, question]) => ({
    code,
    slug: question.slug,
    lifeQuestion: question.en,
    lifeQuestionKorean: question.ko,
    appliesTo: ['바른 생활', '슬기로운 생활'],
  })),
  healthAreas: Object.entries(healthAreas).map(([code, area]) => ({
    code,
    slug: area.slug,
    curriculumArea: area.en,
    curriculumAreaKorean: area.ko,
    sourceSection: `건강한 생활 > ${AGE_RANGE.label} > ${area.ko}`,
  })),
  joyfulAreas: Object.entries(joyfulAreas).map(([code, area]) => ({
    code,
    slug: area.slug,
    curriculumArea: area.en,
    curriculumAreaKorean: area.ko,
    sourceSection: `즐거운 생활 > ${AGE_RANGE.label} > ${area.ko}`,
  })),
  counts: {},
  sourceCount: 0,
  standardCount: 0,
  microTopicCount: 0,
  mappingCount: 0,
  dependencySuggestionCount: 0,
  clusterCount: 0,
  coverageGapCount: 0,
  standards,
  microTopics,
  standardMappings,
  dependencySuggestions,
  clusters,
  coverageGaps,
};

artifact.sourceCount = artifact.sources.length;
artifact.standardCount = artifact.standards.length;
artifact.microTopicCount = artifact.microTopics.length;
artifact.mappingCount = artifact.standardMappings.length;
artifact.dependencySuggestionCount = artifact.dependencySuggestions.length;
artifact.clusterCount = artifact.clusters.length;
artifact.coverageGapCount = artifact.coverageGaps.length;
artifact.counts = {
  sources: artifact.sourceCount,
  standards: artifact.standardCount,
  microTopics: artifact.microTopicCount,
  standardMappings: artifact.mappingCount,
  dependencySuggestions: artifact.dependencySuggestionCount,
  clusters: artifact.clusterCount,
  coverageGaps: artifact.coverageGapCount,
};

const errors = [];
const check = (condition, message) => {
  if (!condition) errors.push(message);
};

const expectedCodes = inventory.flatMap(([, , rows]) => rows.map(([code]) => code));
const sourceIds = new Set(artifact.sources.map((source) => source.id));
const standardKeys = new Set(artifact.standards.map((standard) => standard.key));
const topicIds = new Set(artifact.microTopics.map((topic) => topic.id));
// Per-subject counts published by the 2026-1 edition; the total follows from them.
const EXPECTED_SUBJECT_COUNTS = { 바: 16, 슬: 16, 건: 9, 즐: 16 };
for (const [token, expected] of Object.entries(EXPECTED_SUBJECT_COUNTS)) {
  const actual = expectedCodes.filter((code) => code.startsWith(`[2${token}`)).length;
  check(actual === expected, `expected ${expected} [2${token}…] codes in the 2026-1 inventory, got ${actual}`);
}
check(artifact.standardCount === expectedCodes.length, `standard count ${artifact.standardCount} != inventory ${expectedCodes.length}`);
check(new Set(expectedCodes).size === expectedCodes.length, 'duplicate code in inventory');
check(artifact.microTopicCount === artifact.standardCount * 3, 'micro-topic count must be 3 per standard');
check(standardKeys.size === artifact.standardCount, 'duplicate standard keys');
check(topicIds.size === artifact.microTopicCount, 'duplicate topic ids');
for (const code of expectedCodes) {
  check(standardKeys.has(standardKey(code)), `missing official standard code ${code}`);
}
for (const standard of artifact.standards) {
  check(integratedStandardCode.test(standard.code), `bad integrated standard code ${standard.code}`);
  check(standard.verificationStatus === 'official-source-checked', `bad standard verification ${standard.code}`);
  check(Array.isArray(standard.evidence) && standard.evidence.length >= 3, `standard evidence too short ${standard.code}`);
  for (const sourceRef of standard.sourceRefs) check(sourceIds.has(sourceRef), `unknown source ref ${sourceRef} on ${standard.code}`);
  check(standard.sourceLocator?.sourceId === ANNEX15_SOURCE_ID, `bad locator source id ${standard.code}`);
  check(standard.sourceLocator?.attachmentNo === annexAttachmentNo, `bad locator attachment ${standard.code}`);
  check(standard.sourceLocator?.sha256 === annexSha256, `bad locator hash ${standard.code}`);
  check(Number.isInteger(standard.sourceLocator?.pdfPage), `bad locator PDF page ${standard.code}`);
  check(
    standard.sourceLocator?.printedPage === standard.sourceLocator?.pdfPage - PRINTED_PAGE_OFFSET,
    `bad locator printed page ${standard.code}`,
  );
  check(standard.sourceLocator?.code === standard.code, `locator code mismatch ${standard.code}`);
}
for (const topic of artifact.microTopics) {
  check(topic.id.startsWith('kr.mt.integrated.'), `bad topic id ${topic.id}`);
  check(topic.evidence.length >= 2, `topic evidence too short ${topic.id}`);
  check(typeof topic.assessmentPrompt === 'string' && topic.assessmentPrompt.length > 20, `topic assessmentPrompt missing ${topic.id}`);
  for (const key of topic.standards) check(standardKeys.has(key), `topic ${topic.id} unknown standard ${key}`);
}
for (const mapping of artifact.standardMappings) {
  check(standardKeys.has(mapping.standardKey), `mapping unknown standard ${mapping.standardKey}`);
  check(topicIds.has(mapping.microTopicId), `mapping unknown topic ${mapping.microTopicId}`);
}
for (const dep of artifact.dependencySuggestions) {
  check(topicIds.has(dep.topicId), `dependency unknown topic ${dep.topicId}`);
  check(topicIds.has(dep.prerequisiteId), `dependency unknown prerequisite ${dep.prerequisiteId}`);
  check(dep.topicId !== dep.prerequisiteId, `self dependency ${dep.topicId}`);
}
for (const cluster of artifact.clusters) {
  check(cluster.topicCount === cluster.topics.length, `cluster count mismatch ${cluster.id}`);
  for (const id of cluster.topics) check(topicIds.has(id), `cluster unknown topic ${id}`);
}
check(artifact.counts.sources === artifact.sources.length, 'source count mismatch');
check(artifact.counts.standards === artifact.standards.length, 'standard count mismatch');
check(artifact.counts.microTopics === artifact.microTopics.length, 'micro-topic count mismatch');
check(artifact.counts.standardMappings === artifact.standardMappings.length, 'mapping count mismatch');
check(artifact.counts.dependencySuggestions === artifact.dependencySuggestions.length, 'dependency count mismatch');
check(artifact.counts.clusters === artifact.clusters.length, 'cluster count mismatch');
check(artifact.counts.coverageGaps === artifact.coverageGaps.length, 'coverage gap count mismatch');

if (errors.length) {
  console.error(`Integrated workstream validation failed with ${errors.length} problem(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(repairWorkstreamContent(artifact), null, 2)}\n`);
console.log(`Wrote ${OUT}`);
console.log(`Counts: ${artifact.standardCount} standards, ${artifact.microTopicCount} microTopics, ${artifact.mappingCount} mappings, ${artifact.dependencySuggestionCount} dependencies, ${artifact.clusterCount} clusters, ${artifact.coverageGapCount} gaps.`);
