#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { repairWorkstreamContent } from './lib/kr-content-quality.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'data', 'kr', 'workstreams', 'korean.json');

const CURRICULUM_ID = 'kr-2022-elem-korean';
const SUBJECT = 'Korean Language';
const SUBJECT_KO = '국어';

const domains = {
  '01': {
    slug: 'listening-speaking',
    en: 'Listening & Speaking',
    ko: '듣기·말하기',
    signal: '한국어 구어 담화, 말차례, 청자 고려, 협력적 의사소통'
  },
  '02': {
    slug: 'reading',
    en: 'Reading',
    ko: '읽기',
    signal: '한글 해독, 의미 단위 읽기, 중심 내용 파악, 추론과 평가'
  },
  '03': {
    slug: 'writing',
    en: 'Writing',
    ko: '쓰기',
    signal: '문장·문단 구성, 목적·독자 고려, 장르별 글 생산과 고쳐쓰기'
  },
  '04': {
    slug: 'grammar',
    en: 'Grammar',
    ko: '문법',
    signal: '한글 자모와 소릿값, 표기, 어휘, 문장 성분, 담화 표현'
  },
  '05': {
    slug: 'literature',
    en: 'Literature',
    ko: '문학',
    signal: '시·노래·이야기·소설·극·수필 감상, 상상, 창작, 삶의 성찰'
  },
  '06': {
    slug: 'media',
    en: 'Media',
    ko: '매체',
    signal: '디지털 자료 탐색, 매체 양식, 신뢰성 판단, 복합양식 제작과 윤리'
  }
};

const TOPICS_PER_STANDARD = 4;

const domainFocusTemplates = {
  '01': [
    { slug: 'discourse-purpose', type: 'CONCEPTUAL', label: '담화 상황과 목적 파악' },
    { slug: 'listening-organization', type: 'LANGUAGE', label: '듣기 단서와 정보 조직' },
    { slug: 'speaking-interaction', type: 'PROCEDURAL', label: '말하기 수행과 상호작용' },
    { slug: 'participation-reflection', type: 'META', label: '참여 태도와 조정 성찰' }
  ],
  '02': [
    { slug: 'decoding-cues', type: 'LANGUAGE', label: '글자·어휘·문장 단서 확인' },
    { slug: 'meaning-structure', type: 'CONCEPTUAL', label: '중심 내용과 구조 파악' },
    { slug: 'reading-strategy', type: 'PROCEDURAL', label: '추론·평가 읽기 전략' },
    { slug: 'reading-reflection', type: 'META', label: '읽기 과정 점검과 독서 태도' }
  ],
  '03': [
    { slug: 'planning-purpose', type: 'CONCEPTUAL', label: '내용 생성과 목적·독자 설정' },
    { slug: 'sentence-paragraph', type: 'LANGUAGE', label: '문장·문단·장르 구성' },
    { slug: 'drafting-expression', type: 'PROCEDURAL', label: '초고 작성과 표현 수행' },
    { slug: 'revision-sharing', type: 'META', label: '고쳐쓰기·공유와 쓰기 태도' }
  ],
  '04': [
    { slug: 'language-observation', type: 'CONCEPTUAL', label: '국어 자료 관찰과 개념화' },
    { slug: 'rule-application', type: 'LANGUAGE', label: '음운·표기·어휘·문장 규칙 적용' },
    { slug: 'context-expression', type: 'PROCEDURAL', label: '상황 맥락에 맞는 표현 조정' },
    { slug: 'language-life-reflection', type: 'META', label: '언어생활 성찰과 국어 의식' }
  ],
  '05': [
    { slug: 'literary-elements', type: 'CONCEPTUAL', label: '작품 요소와 갈래 단서 파악' },
    { slug: 'response-language', type: 'LANGUAGE', label: '감상 근거와 반응 표현' },
    { slug: 'imaginative-production', type: 'PROCEDURAL', label: '상상·창작·낭송 수행' },
    { slug: 'literary-life-reflection', type: 'META', label: '문학 향유와 삶 연결 성찰' }
  ],
  '06': [
    { slug: 'media-form-purpose', type: 'CONCEPTUAL', label: '매체 종류·양식·목적 파악' },
    { slug: 'search-selection', type: 'PROCEDURAL', label: '정보 탐색·선별·신뢰성 판단' },
    { slug: 'multimodal-production', type: 'REPRESENTATIONAL', label: '복합양식 자료 제작과 공유' },
    { slug: 'media-ethics-reflection', type: 'META', label: '매체 이용 윤리와 성찰' }
  ]
};

const gradeMeta = {
  '1-2': { codePrefix: '2', ageRangeStart: 6, ageRangeEnd: 8, label: '초등학교 1~2학년' },
  '3-4': { codePrefix: '4', ageRangeStart: 8, ageRangeEnd: 10, label: '초등학교 3~4학년' },
  '5-6': { codePrefix: '6', ageRangeStart: 10, ageRangeEnd: 12, label: '초등학교 5~6학년' }
};

const inventory = [
  ['1-2', '01', [
    ['[2국01-01]', '중요 내용과 사건 순서를 고려하는 듣기·말하기'],
    ['[2국01-02]', '바르고 고운 말로 감정을 나누는 대화'],
    ['[2국01-03]', '집중해서 듣고 말차례를 지키는 대화'],
    ['[2국01-04]', '경험과 생각을 바른 자세로 발표하기'],
    ['[2국01-05]', '듣기·말하기에 대한 흥미와 관심']
  ]],
  ['1-2', '02', [
    ['[2국02-01]', '글자·단어·문장·짧은 글을 정확히 소리 내어 읽기'],
    ['[2국02-02]', '의미가 드러나도록 알맞게 띄어 읽기'],
    ['[2국02-03]', '글을 읽고 중심 내용 확인하기'],
    ['[2국02-04]', '인물의 마음과 생각을 짐작하며 읽기'],
    ['[2국02-05]', '읽기에 흥미를 가지고 즐겨 읽는 태도']
  ]],
  ['1-2', '03', [
    ['[2국03-01]', '글자와 단어를 바르게 쓰기'],
    ['[2국03-02]', '생각과 느낌을 문장으로 표현하기'],
    ['[2국03-03]', '주변 소재를 소개하는 글쓰기'],
    ['[2국03-04]', '겪은 일을 자유롭게 쓰고 함께 읽기']
  ]],
  ['1-2', '04', [
    ['[2국04-01]', '한글 자모 이름과 소릿값을 알고 발음·쓰기'],
    ['[2국04-02]', '소리와 표기의 차이를 고려하여 읽고 쓰기'],
    ['[2국04-03]', '문장과 문장 부호를 알맞게 쓰기']
  ]],
  ['1-2', '05', [
    ['[2국05-01]', '말놀이와 낭송으로 말의 재미 느끼기'],
    ['[2국05-02]', '작품을 듣거나 읽고 느낌과 생각 말하기'],
    ['[2국05-03]', '작품 속 인물을 상상해 다양한 방식으로 표현하기'],
    ['[2국05-04]', '시·노래·이야기에 흥미 가지기']
  ]],
  ['1-2', '06', [
    ['[2국06-01]', '일상 매체와 매체 자료에 관심 가지기'],
    ['[2국06-02]', '일상 경험과 생각을 글과 그림으로 표현하기']
  ]],
  ['3-4', '01', [
    ['[4국01-01]', '중요 내용과 주제를 파악하고 요약하며 듣기'],
    ['[4국01-02]', '원인과 결과 관계로 내용을 예측하며 듣고 말하기'],
    ['[4국01-03]', '상황에 맞는 준언어·비언어 표현 활용'],
    ['[4국01-04]', '상황과 상대 입장을 이해하고 예의를 지키는 대화'],
    ['[4국01-05]', '목적과 주제에 맞게 자료를 정리해 발표하기'],
    ['[4국01-06]', '의견과 이유를 제시하며 생각을 교환하는 토의']
  ]],
  ['3-4', '02', [
    ['[4국02-01]', '글의 의미를 파악하며 유창하게 읽기'],
    ['[4국02-02]', '문단과 글의 중심 생각을 파악하고 간추리기'],
    ['[4국02-03]', '질문으로 예측하며 읽고 읽기 과정 점검'],
    ['[4국02-04]', '사실과 의견을 구분하고 의견 비교하기'],
    ['[4국02-05]', '글과 자료 출처의 믿을 만함 판단'],
    ['[4국02-06]', '바람직한 읽기 습관과 읽기 자신감']
  ]],
  ['3-4', '03', [
    ['[4국03-01]', '중심 문장과 뒷받침 문장을 갖춘 문단 쓰기'],
    ['[4국03-02]', '절차와 결과가 드러나는 보고 글쓰기'],
    ['[4국03-03]', '의견과 이유가 드러나는 글쓰기'],
    ['[4국03-04]', '목적과 주제를 고려해 마음을 전하는 글쓰기'],
    ['[4국03-05]', '쓰기 과정을 점검하며 자신감 갖기']
  ]],
  ['3-4', '04', [
    ['[4국04-01]', '단어 사이의 의미 관계 파악'],
    ['[4국04-02]', '단어 분류와 국어사전 활용'],
    ['[4국04-03]', '기본 문장 짜임 이해와 사용'],
    ['[4국04-04]', '높임·지시·접속 표현을 상황에 맞게 사용'],
    ['[4국04-05]', '언어를 소통과 관계 형성의 수단으로 이해']
  ]],
  ['3-4', '05', [
    ['[4국05-01]', '인물과 이야기 흐름 중심의 작품 감상'],
    ['[4국05-02]', '경험을 바탕으로 작품 세계와 현실 세계 비교'],
    ['[4국05-03]', '마음에 드는 작품 소개하기'],
    ['[4국05-04]', '감각적 표현을 감상하고 활용해 표현하기'],
    ['[4국05-05]', '재미와 감동을 느끼며 작품을 즐기는 태도']
  ]],
  ['3-4', '06', [
    ['[4국06-01]', '인터넷에서 학습 자료를 탐색하고 선택하기'],
    ['[4국06-02]', '매체를 활용해 간단한 발표 자료 만들기'],
    ['[4국06-03]', '매체 소통 윤리를 고려해 자료 활용·공유하기']
  ]],
  ['5-6', '01', [
    ['[6국01-01]', '대화에서 생략된 내용을 추론하며 듣기'],
    ['[6국01-02]', '주장과 근거의 타당성을 평가하며 듣기'],
    ['[6국01-03]', '궁금한 내용을 질문하며 적극적으로 듣고 말하기'],
    ['[6국01-04]', '면담 절차와 상대·매체를 고려한 면담'],
    ['[6국01-05]', '핵심 정보를 선별해 매체를 활용하여 발표하기'],
    ['[6국01-06]', '협력적 토의에서 의견 비교와 조정'],
    ['[6국01-07]', '절차와 규칙을 지키며 이유와 근거로 토론하기']
  ]],
  ['5-6', '02', [
    ['[6국02-01]', '글 구조를 고려해 주제·주장을 파악하고 요약하기'],
    ['[6국02-02]', '문맥으로 생략·함축 내용을 추론하기'],
    ['[6국02-03]', '내용 타당성과 표현 적절성 평가하기'],
    ['[6국02-04]', '여러 관점의 글을 문제 해결에 활용하기'],
    ['[6국02-05]', '긍정적 읽기 동기와 적극적 읽기 참여']
  ]],
  ['5-6', '03', [
    ['[6국03-01]', '대상 특성이 드러나는 설명 글쓰기'],
    ['[6국03-02]', '근거와 출처를 갖춘 주장 글쓰기'],
    ['[6국03-03]', '체험한 일에 대한 감상 글쓰기'],
    ['[6국03-04]', '독자와 매체를 고려한 내용 생성과 표현'],
    ['[6국03-05]', '쓰기 과정 점검·조정과 글 전체 고쳐쓰기'],
    ['[6국03-06]', '글을 독자와 공유하는 적극적 쓰기 태도']
  ]],
  ['5-6', '04', [
    ['[6국04-01]', '음성·문자 언어 특성과 매체 표현 효과 평가'],
    ['[6국04-02]', '표준어와 방언 기능 및 언어 공동체 이해'],
    ['[6국04-03]', '고유어와 관용 표현의 가치와 상황별 사용'],
    ['[6국04-04]', '문장 성분과 호응 관계에 맞는 문장 구성'],
    ['[6국04-05]', '시간 표현을 상황에 맞게 이해하고 사용'],
    ['[6국04-06]', '단어·문장·띄어쓰기를 민감하게 살펴 고치기']
  ]],
  ['5-6', '05', [
    ['[6국05-01]', '작가의 의도를 생각하며 작품 읽기'],
    ['[6국05-02]', '비유적 표현 효과에 유의한 작품 감상'],
    ['[6국05-03]', '소설·극의 인물·사건·배경 파악'],
    ['[6국05-04]', '인상적인 부분 중심으로 작품 의견 나누기'],
    ['[6국05-05]', '경험을 시·소설·극·수필 등으로 표현하기'],
    ['[6국05-06]', '작품을 삶과 연관 지어 성찰하는 태도']
  ]],
  ['5-6', '06', [
    ['[6국06-01]', '정보 검색 도구로 목적에 맞는 매체 자료 찾기'],
    ['[6국06-02]', '뉴스와 정보 매체 자료의 신뢰성 평가'],
    ['[6국06-03]', '양식과 수용자 반응을 고려한 복합양식 자료 제작'],
    ['[6국06-04]', '자신의 매체 이용 양상 성찰']
  ]]
];

const sourceRefs = [
  'kr-moe-2022-33-annex5-pdf',
  'kr-ncic-2022-elem-korean-attachment'
];

function codeParts(code) {
  const match = code.match(/^\[([246])국(\d{2})-(\d{2})\]$/);
  if (!match) throw new Error(`Bad code ${code}`);
  return { bandCode: match[1], domainCode: match[2], number: match[3] };
}

function cleanCode(code) {
  const { bandCode, domainCode, number } = codeParts(code);
  return `${bandCode}guk${domainCode}${number}`;
}

function standardKey(code) {
  return `${CURRICULUM_ID}:${code}`;
}

function topicId(standard, facetIndex) {
  const domain = domains[standard.domainCode];
  return `kr.mt.korean.${domain.slug}.${standard.gradeBand}.${cleanCode(standard.code)}.${String(facetIndex + 1).padStart(2, '0')}`;
}

function sourceSection(gradeBand, domainCode) {
  return `공통 교육과정 > 국어 > ${gradeMeta[gradeBand].label} > ${domains[domainCode].ko}`;
}

function sourceLocator(gradeBand, domainCode, code) {
  return `NCIC PDF [별책5] 국어과 교육과정, ${sourceSection(gradeBand, domainCode)}, 성취기준 ${code}`;
}

function gradeDomainEmphasis(gradeBand, domainCode) {
  if (gradeBand === '1-2' && (domainCode === '02' || domainCode === '04')) {
    return '초기 한글 해독, 자모-소릿값 연결, 의미 단위 읽기와 기초 표기';
  }
  if (gradeBand === '1-2' && domainCode === '03') {
    return '글자·단어 쓰기에서 문장 표현으로 이어지는 기초 문식성';
  }
  if (gradeBand === '5-6' && domainCode === '06') {
    return '정보 검색, 뉴스·정보 매체 신뢰성 판단, 복합양식 제작';
  }
  if (gradeBand === '5-6' && domainCode === '04') {
    return '음성·문자 언어 특성, 표준어·방언, 관용 표현, 문장 호응';
  }
  return domains[domainCode].signal;
}

function relationshipForFocus(index) {
  return ['introduces', 'supports', 'extends', 'assesses'][index] ?? 'supports';
}

const standards = [];
for (const [gradeBand, domainCode, rows] of inventory) {
  for (const [code, summary] of rows) {
    const { bandCode } = codeParts(code);
    if (bandCode !== gradeMeta[gradeBand].codePrefix) {
      throw new Error(`Grade band mismatch for ${code}`);
    }
    const domain = domains[domainCode];
    standards.push({
      key: standardKey(code),
      code,
      gradeBand,
      subject: SUBJECT,
      subjectKorean: SUBJECT_KO,
      domain: domain.en,
      domainKorean: domain.ko,
      summary,
      officialTextIncluded: false,
      sourceRefs,
      sourceSection: sourceSection(gradeBand, domainCode),
      sourceLocator: sourceLocator(gradeBand, domainCode, code),
      sourceTextIncluded: false,
      verificationStatus: 'official-source-checked',
      sourceBasis: 'Code inventory checked against the NCIC-hosted Ministry of Education 2022-33 Annex 5 PDF; this record stores a source-derived paraphrase rather than the official standard text.',
      verificationNotes: 'Official code present in extracted PDF text; achievement-standard wording is intentionally not copied into this artifact.'
    });
  }
}

const microTopics = [];
const standardMappings = [];
const standardTopicMap = new Map();

for (const standard of standards) {
  const { domainCode } = codeParts(standard.code);
  standard.domainCode = domainCode;
  const domain = domains[domainCode];
  const meta = gradeMeta[standard.gradeBand];
  const emphasis = gradeDomainEmphasis(standard.gradeBand, domainCode);
  const topicIds = [];
  domainFocusTemplates[domainCode].forEach((focus, i) => {
    const id = topicId(standard, i);
    topicIds.push(id);
    const name = `${standard.summary} - ${focus.label}`;
    microTopics.push({
      id,
      type: focus.type,
      subject: SUBJECT,
      subjectKorean: SUBJECT_KO,
      domain: domain.en,
      domainKorean: domain.ko,
      gradeBand: standard.gradeBand,
      ageRangeStart: meta.ageRangeStart,
      ageRangeEnd: meta.ageRangeEnd,
      name,
      title: name,
      titleKorean: name,
      titleEnglish: `${domain.en} ${standard.gradeBand} ${standard.code} ${focus.slug}`,
      description: `${meta.label} 학습자가 ${standard.summary}을/를 ${domain.ko} 영역의 실제 국어 활동으로 다룰 수 있게 하는 세부 주제이다. 초점은 ${focus.label}이며, ${emphasis}을/를 기준으로 관찰한다.`,
      summary: `${standard.code} ${domain.ko} 성취기준을 ${focus.label} 단위로 분해한 국어 마이크로토픽.`,
      evidence: [
        `Source link: ${standard.sourceLocator}; official code verified, official wording not reproduced.`,
        `${focus.label}에 필요한 핵심 단서와 조건을 학년군에 맞는 한국어 자료에서 찾고 자신의 말로 설명한다.`,
        `${emphasis}과/와 관련된 교실·생활 맥락 과업을 수행하고, 수행 결과를 ${domain.ko} 영역 언어로 설명한다.`,
        `성취기준 ${standard.code}에 비추어 잘된 점, 보완할 점, 다음 연습 대상을 한 가지 이상 말한다.`
      ],
      assessmentPrompt: `{{name}}이/가 ${standard.summary} 활동에서 ${focus.label}의 핵심 조건을 설명하고, 실제 국어 자료나 의사소통 상황에 적용한 뒤 개선점을 말할 수 있나요?`,
      standards: [standard.key],
      sourceStandardCode: standard.code,
      sourceRefs,
      sourceLocator: standard.sourceLocator,
      sourceTextIncluded: false,
      verificationStatus: 'official-source-checked',
      generationBasis: `${standard.code} ${domain.ko} 성취기준의 초등 학년군 도달 행동을 ${focus.label} 세부 주제로 분해했다.`
    });
    standardMappings.push({
      standardKey: standard.key,
      microTopicId: id,
      relationship: relationshipForFocus(i),
      confidence: 'official-source-derived',
      note: `${standard.code}의 ${domain.ko} 학습 요구를 ${focus.label} 세부 주제로 연결한다.`
    });
  });
  standardTopicMap.set(standard.code, topicIds);
}

for (const standard of standards) {
  delete standard.domainCode;
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
    reason
  });
}

for (const standard of standards) {
  const ids = standardTopicMap.get(standard.code);
  for (let i = 1; i < ids.length; i += 1) {
    addEdge(
      ids[i],
      ids[i - 1],
      i === 1 ? 'hard' : 'soft',
      `${standard.code} ${i + 1}번째 세부 주제는 앞선 ${i}번째 세부 주제의 이해와 수행 경험을 바탕으로 한다.`
    );
  }
}

for (const [gradeBand, domainCode, rows] of inventory) {
  for (let i = 1; i < rows.length; i += 1) {
    const previous = standardTopicMap.get(rows[i - 1][0]);
    const current = standardTopicMap.get(rows[i][0]);
    addEdge(current[0], previous[previous.length - 1], 'soft', `${gradeMeta[gradeBand].label} ${domains[domainCode].ko} 영역 안의 순차 학습 제안이다.`);
  }
}

for (const domainCode of Object.keys(domains)) {
  const gradeRows = ['1-2', '3-4', '5-6'].map((gradeBand) =>
    inventory.find(([gb, dc]) => gb === gradeBand && dc === domainCode)
  );
  for (let i = 1; i < gradeRows.length; i += 1) {
    const previousRows = gradeRows[i - 1][2];
    const currentRows = gradeRows[i][2];
    const previousLast = standardTopicMap.get(previousRows[previousRows.length - 1][0]);
    const currentFirst = standardTopicMap.get(currentRows[0][0]);
    addEdge(currentFirst[0], previousLast[previousLast.length - 1], 'soft', `${domains[domainCode].ko} 영역의 이전 학년군 태도·점검 경험이 다음 학년군 첫 주제를 뒷받침한다.`);
  }
}

const crossDomainEdges = [
  ['[2국02-01]', 0, '[2국04-01]', 1, '한글 자모와 소릿값 이해가 정확한 소리 내어 읽기의 토대이다.'],
  ['[2국03-01]', 0, '[2국04-01]', 1, '글자 쓰기는 한글 자모의 이름과 소릿값 이해를 전제로 한다.'],
  ['[2국03-02]', 1, '[2국03-01]', 1, '문장 표현은 글자와 단어 쓰기 기초 위에서 안정된다.'],
  ['[2국06-02]', 1, '[2국03-02]', 1, '글과 그림 표현은 자신의 생각을 문장으로 표현하는 경험과 연결된다.'],
  ['[4국03-01]', 0, '[2국03-04]', 2, '문단 쓰기는 이전 학년군의 자유 글쓰기와 공유 경험을 확장한다.'],
  ['[4국06-02]', 1, '[4국01-05]', 1, '발표 자료 제작은 목적과 주제에 맞춘 발표 구성 경험을 필요로 한다.'],
  ['[4국06-02]', 1, '[4국03-04]', 1, '발표 자료의 문구와 구성은 목적·주제·독자를 고려한 쓰기 경험과 연결된다.'],
  ['[6국01-05]', 1, '[6국06-01]', 1, '매체 활용 발표는 목적에 맞는 정보 검색과 자료 선별을 요구한다.'],
  ['[6국01-07]', 1, '[4국01-06]', 1, '토론은 의견과 이유를 교환하는 토의 경험에서 확장된다.'],
  ['[6국02-03]', 1, '[4국02-04]', 1, '타당성 평가는 사실과 의견 구분 경험을 바탕으로 한다.'],
  ['[6국02-03]', 1, '[4국02-05]', 1, '표현과 내용 평가에는 출처 신뢰성 판단 경험이 필요하다.'],
  ['[6국03-02]', 1, '[4국03-03]', 1, '주장 글쓰기는 의견과 이유가 드러나는 글쓰기에서 확장된다.'],
  ['[6국03-02]', 1, '[4국02-05]', 1, '근거와 출처를 갖춘 주장은 자료 출처 판단 경험을 요구한다.'],
  ['[6국06-02]', 1, '[6국02-03]', 1, '뉴스와 정보 매체 신뢰성 평가는 내용 타당성 평가와 연결된다.'],
  ['[6국06-03]', 1, '[6국03-04]', 1, '복합양식 자료 제작은 독자와 매체를 고려한 내용 생성 경험을 확장한다.'],
  ['[6국06-03]', 1, '[6국01-05]', 1, '복합양식 자료 공유는 핵심 정보를 매체로 발표하는 경험과 연결된다.'],
  ['[6국05-05]', 1, '[4국05-04]', 1, '갈래별 창작은 감각적 표현을 활용해 생각을 표현하는 경험을 확장한다.'],
  ['[6국04-06]', 1, '[4국04-03]', 1, '단어·문장·띄어쓰기 고치기는 기본 문장 짜임 이해 위에서 가능하다.']
];

for (const [topicCode, topicFacet, prereqCode, prereqFacet, reason] of crossDomainEdges) {
  addEdge(standardTopicMap.get(topicCode)[topicFacet], standardTopicMap.get(prereqCode)[prereqFacet], 'soft', reason);
}

const clusters = [];
for (const [gradeBand, domainCode, rows] of inventory) {
  const domain = domains[domainCode];
  const topicIds = rows.flatMap(([code]) => standardTopicMap.get(code));
  clusters.push({
    id: `kr.cluster.korean.${domain.slug}.${gradeBand}`,
    subject: SUBJECT,
    subjectKorean: SUBJECT_KO,
    domain: domain.en,
    domainKorean: domain.ko,
    gradeBand,
    topicCount: topicIds.length,
    topics: topicIds,
    summary: `${gradeMeta[gradeBand].label} ${domain.ko} 영역의 공식 성취기준 ${rows.length}개를 ${topicIds.length}개 세부 주제로 분해한 작업 클러스터이다.`
  });
}

const coverageGaps = [
  {
    id: 'gap.kr.korean.official-text-omitted',
    severity: 'intentional',
    note: 'Official achievement-standard wording is not embedded verbatim; this artifact stores codes and source-derived paraphrases, with the NCIC/MOE PDF as the governing source.'
  },
  {
    id: 'gap.kr.korean.2026-amendment-reconciliation',
    severity: 'review-needed',
    note: 'The inventory was checked against the NCIC 2022.12 elementary Korean Language attachment. NCIC also lists 2026.01 amended curriculum rows; integration should decide whether a successor artifact must reconcile amendments.'
  },
  {
    id: 'gap.kr.korean.dependency-expert-review',
    severity: 'review-needed',
    note: 'Dependency suggestions encode plausible prerequisite flow, but they have not been reviewed by Korean Language curriculum specialists.'
  },
  {
    id: 'gap.kr.korean.classroom-assessment-review',
    severity: 'review-needed',
    note: 'Evidence statements and assessment prompts are source-aligned generated checks and should be calibrated with classroom examples before product use.'
  }
];

const artifact = {
  dataset: 'kr-korean-language-workstream',
  taxonomyVersion: 'kr-full-depth-v0.3-workstream',
  workstreamTaskId: 't_e42090f5',
  locale: 'ko-KR',
  country: 'KR',
  subject: SUBJECT,
  subjectKorean: SUBJECT_KO,
  curriculumId: CURRICULUM_ID,
  generatedAt: '2026-07-09',
  createdAt: '2026-07-09',
  status: 'subject-worker-artifact',
  verificationStatus: 'official-source-checked',
  textPolicy: {
    officialStandardTextIncluded: false,
    rationale: 'Use official public curriculum documents as source of truth while storing only codes and concise source-derived paraphrases in this workstream artifact.'
  },
  sourceBasis: 'Official source located through NCIC inventory API: 2022 개정 시기 > 초등학교(2022.12) > 국어, attachment [별책5] 국어과 교육과정.pdf.',
  verificationSummary: {
    officialPdfSha256: '5c30ae42a973a8f912bae156b160cd16d56636b3a64af84c3bdc378c9b482544',
    officialCodeInventoryCount: 87,
    generatedStandardCount: 87,
    gradeBandStandardCounts: {
      '1-2': 23,
      '3-4': 30,
      '5-6': 34
    },
    method: 'Downloaded NCIC attachment 10003553 and extracted unique elementary Korean achievement-standard codes matching [246]국01-06; generated inventory matches exactly.',
    textPolicy: 'Official achievement-standard text is not embedded verbatim; summaries, topics, evidence, prompts, and dependency reasons are original source-derived records.'
  },
  sources: [
    {
      id: 'kr-moe-2022-33-annex5-pdf',
      name: '교육부 고시 제2022-33호 [별책 5] 국어과 교육과정',
      sourceType: 'official-pdf',
      publisher: '교육부',
      via: 'NCIC 국가교육과정정보센터',
      attachmentName: '[별책5] 국어과 교육과정.pdf',
      attachmentNo: '10003553',
      url: 'https://ncic.re.kr/inv/org/download.do?year=2022&seq=10003553&orgType=ogi4',
      accessDate: '2026-07-09',
      usage: 'Governing official source for the 87 elementary Korean achievement-standard codes and reviewed locators; official wording is not reproduced.',
      sha256: '5c30ae42a973a8f912bae156b160cd16d56636b3a64af84c3bdc378c9b482544'
    },
    {
      id: 'kr-ncic-2022-elem-korean-attachment',
      name: 'NCIC 원문 및 해설서 inventory row for 2022 elementary Korean Language',
      sourceType: 'official-inventory',
      publisher: 'NCIC 국가교육과정정보센터',
      url: 'https://ncic.re.kr/inv/org/list.do',
      inventoryPath: '2022 개정 시기 > 초등학교(2022.12) > 국어',
      apiIdentifiers: {
        degreeCode: '1014',
        classCode: '1002',
        subjectCode: '1713',
        openYear: '2022',
        openMonth: '12'
      },
      accessDate: '2026-07-09',
      usage: 'Official inventory row used to bind the Korean subject branch and subjectCode 1713 to the Annex 5 attachment.'
    }
  ],
  domains: Object.entries(domains).map(([code, domain]) => ({
    code,
    slug: domain.slug,
    domain: domain.en,
    domainKorean: domain.ko,
    sourceSignal: domain.signal,
    focusTemplates: domainFocusTemplates[code].map(({ slug, type, label }) => ({ slug, type, label }))
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
  coverageGaps
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
  coverageGaps: artifact.coverageGapCount
};

const errors = [];
const check = (condition, message) => {
  if (!condition) errors.push(message);
};

const standardKeys = new Set(artifact.standards.map((standard) => standard.key));
const topicIds = new Set(artifact.microTopics.map((topic) => topic.id));
check(artifact.standardCount === 87, `expected 87 standards, got ${artifact.standardCount}`);
check(artifact.microTopicCount === artifact.standards.length * TOPICS_PER_STANDARD, `micro-topic count must be ${TOPICS_PER_STANDARD} per standard`);
check(artifact.verificationSummary.officialCodeInventoryCount === artifact.standardCount, 'verified official code count must match standards');
check(standardKeys.size === artifact.standardCount, 'duplicate standard keys');
check(topicIds.size === artifact.microTopicCount, 'duplicate topic ids');
for (const standard of artifact.standards) {
  check(/^\[[246]국(01|02|03|04|05|06)-[0-9]{2}\]$/.test(standard.code), `bad standard code ${standard.code}`);
  check(standard.verificationStatus === 'official-source-checked', `bad standard verification ${standard.code}`);
  check(standard.sourceTextIncluded === false, `standard source text policy missing ${standard.code}`);
  check(standard.sourceLocator?.includes(standard.code), `standard source locator missing code ${standard.code}`);
}
for (const topic of artifact.microTopics) {
  check(topic.evidence.length >= 4, `topic evidence too short ${topic.id}`);
  check(topic.assessmentPrompt.includes('{{name}}'), `topic assessmentPrompt missing placeholder ${topic.id}`);
  check(topic.sourceTextIncluded === false, `topic source text policy missing ${topic.id}`);
  check(topic.sourceLocator?.includes(topic.sourceStandardCode), `topic source locator missing code ${topic.id}`);
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
check(artifact.counts.microTopics === artifact.microTopics.length, 'microTopic count mismatch');
check(artifact.counts.standardMappings === artifact.standardMappings.length, 'mapping count mismatch');
check(artifact.counts.dependencySuggestions === artifact.dependencySuggestions.length, 'dependency count mismatch');
check(artifact.counts.clusters === artifact.clusters.length, 'cluster count mismatch');
check(artifact.counts.coverageGaps === artifact.coverageGaps.length, 'coverage gap count mismatch');

if (errors.length) {
  console.error(`Refusing to write ${OUT}; ${errors.length} problem(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(repairWorkstreamContent(artifact), null, 2)}\n`);
console.log(`Wrote ${OUT}`);
console.log(`${artifact.standardCount} standards, ${artifact.microTopicCount} micro-topics, ${artifact.dependencySuggestionCount} dependency suggestions, ${artifact.clusterCount} clusters.`);
