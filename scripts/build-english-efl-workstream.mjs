#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { repairWorkstreamContent } from './lib/kr-content-quality.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = resolve(ROOT, 'data', 'kr', 'workstreams', 'english-efl.json');

const subject = 'English as a Foreign Language';
const subjectKorean = '영어';
const curriculumId = 'kr-2022-elem-english-efl';
const sourceRefs = ['kr-ncic-2022-english-pdf'];
const englishPdfSha256 = '596d13897b002a4279a3e21f16396bdae7ac74988450f45fb348f87af943f92a';
const englishPdfPageByBlock = {
  '3-4:Understanding': 16,
  '3-4:Expression': 18,
  '5-6:Understanding': 21,
  '5-6:Expression': 23
};

const sources = [
  {
    id: 'kr-ncic-2022-english-pdf',
    name: '교육부 고시 제2022-33호 [별책 14] 영어과 교육과정',
    sourceType: 'official-pdf',
    publisher: '교육부',
    via: 'NCIC 국가교육과정정보센터',
    url: 'https://ncic.re.kr/inv/org/download.do?year=2022&seq=10003794&orgType=ogi4',
    accessDate: '2026-07-09',
    usage: 'Governing official source for elementary English achievement-standard codes and Korean EFL framing.',
    subjectCode: '3360',
    attachmentName: '[별책14] 영어과 교육과정.pdf',
    attachmentNo: '10003794',
    pairedHwpAttachmentNo: '10003795',
    sha256: englishPdfSha256,
    fileSizeBytes: 2313266,
    pdfPages: 306,
    evidence: {
      fileName: '[별책14] 영어과 교육과정.pdf',
      pages: 306,
      fileSizeBytes: 2313266,
      sha256: englishPdfSha256,
      pdfCreationDate: '2022-12-19',
      ncicUploadDate: '2023-10-12 13:54:25',
      elementaryCodeBlocks: [
        'PDF extracted pages 14-25: [초등학교 3∼4학년] and [초등학교 5∼6학년] achievement standards',
        'Text extraction lines 379-388, 462-471, 564-573, 645-654 in local verification copy'
      ]
    }
  },
  {
    id: 'kr-ncic-2022-english-appendix4',
    name: '교육부 고시 제2022-33호 [별책 14] [별표 4] 의사소통에 필요한 언어 형식',
    sourceType: 'official-pdf',
    url: 'https://ncic.re.kr/inv/org/download.do?year=2022&seq=10003794&orgType=ogi4',
    accessDate: '2026-07-10',
    usage: 'Official source location for elementary recommended language forms. The workstream records the current item-level mapping gap and does not claim that broad vocabulary or expression topics cover the appendix.',
    evidence: {
      attachmentNo: '10003794',
      sha256: englishPdfSha256,
      pdfPages: [297, 306],
      printedPages: [291, 300],
      section: '[별표 4] 의사소통에 필요한 언어 형식'
    }
  },
  {
    id: 'kr-repo-mapping-method',
    name: 'Repository Korean curriculum mapping method',
    sourceType: 'repository-document',
    url: 'docs/kr-curriculum-mapping-method.md',
    accessDate: '2026-07-09',
    usage: 'Local project rules for KR EFL, provenance, micro-topic decomposition, evidence, assessment prompts, and dependency graph staging.'
  }
];

const standards = [
  ['[4영01-01]', '3-4', 'Understanding', '이해', ['Listening', 'Vocabulary & Expressions'], '알파벳과 쉬운 단어의 소리를 듣고 구별하는 초입 듣기 표준', ['알파벳 소리와 글자 이름 듣기 식별', '한국어 음운 전이를 고려한 기초 단어 소리 구별', '그림 단서로 들은 기초 어휘 확인']],
  ['[4영01-02]', '3-4', 'Understanding', '이해', ['Reading', 'Alphabet & Phonics'], '알파벳 대소문자를 식별하여 읽는 초기 문자 인식 표준', ['대문자와 소문자 모양 식별', '알파벳 이름 읽기와 순서 감각', '교실 자료에서 알파벳 찾기']],
  ['[4영01-03]', '3-4', 'Understanding', '이해', ['Listening', 'Pronunciation'], '쉬운 단어ㆍ어구ㆍ문장에서 강세, 리듬, 억양을 듣고 알아차리는 표준', ['단어 강세 듣기', '짧은 어구 리듬 따라 듣기', '문장 억양 의미 구별']],
  ['[4영01-04]', '3-4', 'Understanding', '이해', ['Reading', 'Alphabet & Phonics'], '소리와 철자의 관계를 바탕으로 쉬운 단어ㆍ어구ㆍ문장을 소리 내어 읽는 표준', ['기초 음철 대응 읽기', '쉬운 단어 블렌딩 읽기', '짧은 어구와 문장 소리내어 읽기']],
  ['[4영01-05]', '3-4', 'Understanding', '이해', ['Listening', 'Reading', 'Vocabulary & Expressions'], '쉬운 단어ㆍ어구ㆍ문장의 의미를 이해하는 기초 의미 파악 표준', ['기초 어휘 의미 연결', '교실 표현 의미 이해', '쉬운 문장 의미 확인']],
  ['[4영01-06]', '3-4', 'Understanding', '이해', ['Listening', 'Reading'], '자기 주변 주제의 담화에서 주요 정보를 파악하는 표준', ['자기소개 담화 주요 정보 듣기', '가족ㆍ친구 주제 정보 찾기', '학교생활 담화 핵심 파악']],
  ['[4영01-07]', '3-4', 'Understanding', '이해', ['Listening', 'Reading', 'Strategies'], '담화나 문장을 듣거나 읽을 때 단서를 활용하는 기초 이해 전략 표준', ['시각 단서로 예측하기', '반복 듣기와 다시 읽기', '몸짓ㆍ그림ㆍ상황 단서 활용']],
  ['[4영01-08]', '3-4', 'Understanding', '이해', ['Listening', 'Reading', 'Media'], '다양한 매체의 쉬운 담화나 문장을 흥미를 가지고 듣거나 읽는 표준', ['그림책ㆍ영상 듣기 읽기', '디지털 카드 문장 이해', '매체 자료에 흥미 표현']],
  ['[4영01-09]', '3-4', 'Understanding', '이해', ['Listening', 'Culture & Intercultural'], '시, 노래, 이야기를 공감하며 듣는 정서ㆍ문학 감상 표준', ['영어 노래 듣고 분위기 느끼기', '짧은 이야기 장면 이해', '시와 챈트에 감정 반응하기']],
  ['[4영01-10]', '3-4', 'Understanding', '이해', ['Listening', 'Reading', 'Culture & Intercultural'], '자기 주변 주제나 문화 자료를 존중의 태도로 듣거나 읽는 표준', ['문화 소재 그림ㆍ문장 이해', '다른 생활 방식 존중하기', '주변 문화 표현 듣고 읽기']],
  ['[4영02-01]', '3-4', 'Expression', '표현', ['Speaking', 'Pronunciation'], '쉬운 단어ㆍ어구ㆍ문장을 강세, 리듬, 억양에 맞게 따라 말하는 표준', ['교사 모델 따라 말하기', '챈트 리듬으로 어구 말하기', '짧은 문장 억양 재현']],
  ['[4영02-02]', '3-4', 'Expression', '표현', ['Writing', 'Alphabet & Phonics'], '알파벳 대소문자를 구별하여 쓰는 초기 쓰기 표준', ['대소문자 모양 따라 쓰기', '획순과 위치 맞춰 쓰기', '알파벳 카드 보고 쓰기']],
  ['[4영02-03]', '3-4', 'Expression', '표현', ['Writing', 'Alphabet & Phonics'], '소리와 철자의 관계를 바탕으로 쉬운 단어를 쓰는 표준', ['소리 듣고 첫 글자 쓰기', '쉬운 단어 보고 쓰기', '철자 점검하며 다시 쓰기']],
  ['[4영02-04]', '3-4', 'Expression', '표현', ['Speaking', 'Writing'], '실물ㆍ그림ㆍ동작을 보고 쉬운 문장으로 말하거나 단어ㆍ어구를 쓰는 표준', ['실물 보고 한 문장 말하기', '그림 단어 라벨 쓰기', '동작 보고 표현 연결']],
  ['[4영02-05]', '3-4', 'Expression', '표현', ['Speaking', 'Writing', 'Vocabulary & Expressions'], '자신과 주변 사람ㆍ사물을 쉬운 문장으로 소개하거나 묘사하는 표준', ['이름ㆍ나이ㆍ좋아하는 것 말하기', '가족ㆍ친구 간단히 소개', '사물 색ㆍ크기 묘사']],
  ['[4영02-06]', '3-4', 'Expression', '표현', ['Speaking', 'Writing'], '행동 지시를 쉬운 문장으로 말하거나 보고 쓰는 표준', ['교실 행동 지시 말하기', '동작 카드 보고 명령문 쓰기', '순서 있는 행동 표현']],
  ['[4영02-07]', '3-4', 'Expression', '표현', ['Speaking', 'Writing'], '자신의 감정을 쉬운 문장으로 말하거나 보고 쓰는 표준', ['기분 단어 말하기', '감정 그림 보고 문장 만들기', '짧은 감정 카드 쓰기']],
  ['[4영02-08]', '3-4', 'Expression', '표현', ['Speaking', 'Interaction'], '자기 주변 주제 담화의 주요 정보를 묻거나 답하는 표준', ['개인 정보 묻고 답하기', '학교생활 정보 질문하기', '짝 대화에서 핵심 답하기']],
  ['[4영02-09]', '3-4', 'Expression', '표현', ['Speaking', 'Writing', 'Media'], '매체나 전략을 활용하여 창의적으로 의미를 표현하는 표준', ['그림 카드로 의미 표현', '디지털 스티커와 단어 조합', '비언어 전략으로 의사 전달']],
  ['[4영02-10]', '3-4', 'Expression', '표현', ['Speaking', 'Interaction', 'Culture & Intercultural'], '의사소통 활동에 흥미와 자신감을 가지고 예절을 지키며 참여하는 표준', ['인사와 차례 지키기', '실수해도 다시 말하기', '짝 활동에서 예의 있게 반응']],
  ['[6영01-01]', '5-6', 'Understanding', '이해', ['Listening', 'Pronunciation'], '간단한 단어ㆍ어구ㆍ문장에서 강세, 리듬, 억양을 식별하는 심화 듣기 표준', ['강세 변화 듣기', '어구 리듬 패턴 구별', '의문문ㆍ평서문 억양 구별']],
  ['[6영01-02]', '5-6', 'Understanding', '이해', ['Reading', 'Pronunciation'], '간단한 단어ㆍ어구ㆍ문장을 강세, 리듬, 억양에 맞게 소리 내어 읽는 표준', ['어구 단위 소리내어 읽기', '문장 리듬 살려 읽기', '의미 단위로 끊어 읽기']],
  ['[6영01-03]', '5-6', 'Understanding', '이해', ['Listening', 'Reading', 'Vocabulary & Expressions'], '간단한 단어ㆍ어구ㆍ문장의 의미를 이해하는 표준', ['확장 어휘 의미 파악', '일상 표현 의미 이해', '문장 속 단서로 뜻 확인']],
  ['[6영01-04]', '5-6', 'Understanding', '이해', ['Listening', 'Reading'], '일상생활 주제 담화나 글의 세부 정보를 파악하는 표준', ['시간ㆍ장소 세부 정보 찾기', '인물ㆍ사물 정보 확인', '표와 그림에서 정보 대조']],
  ['[6영01-05]', '5-6', 'Understanding', '이해', ['Listening', 'Reading'], '일상생활 주제 담화나 글의 중심 내용을 파악하는 표준', ['짧은 대화 요지 파악', '간단한 글 중심 생각 찾기', '제목과 그림으로 주제 추론']],
  ['[6영01-06]', '5-6', 'Understanding', '이해', ['Listening', 'Reading'], '일상생활 주제 담화나 글에서 일이나 사건의 순서를 파악하는 표준', ['사건 순서 듣기', '절차 글 순서 배열', '전후 관계 단서 찾기']],
  ['[6영01-07]', '5-6', 'Understanding', '이해', ['Listening', 'Reading', 'Strategies'], '일상생활 주제의 담화나 글을 이해하기 위해 전략을 활용하는 표준', ['듣기 전 예측하기', '특정 정보 찾아 듣기 읽기', '내용 확인하며 다시 듣기 읽기']],
  ['[6영01-08]', '5-6', 'Understanding', '이해', ['Listening', 'Reading', 'Media'], '다양한 매체의 담화나 글을 흥미와 자신감을 가지고 듣거나 읽는 표준', ['영상ㆍ앱 자료 핵심 이해', '디지털 텍스트 읽기', '매체 선택 이유 말하기']],
  ['[6영01-09]', '5-6', 'Understanding', '이해', ['Listening', 'Reading', 'Culture & Intercultural'], '시, 노래, 이야기를 공감하며 듣거나 읽는 표준', ['이야기 인물 감정 이해', '노래 가사 분위기 파악', '짧은 문학 텍스트 감상']],
  ['[6영01-10]', '5-6', 'Understanding', '이해', ['Listening', 'Reading', 'Culture & Intercultural'], '일상생활 주제나 문화 자료를 포용의 태도로 듣거나 읽는 표준', ['문화 비교 표현 이해', '다양한 관점 수용하기', '일상 문화 자료 읽고 반응']],
  ['[6영02-01]', '5-6', 'Expression', '표현', ['Speaking', 'Pronunciation'], '간단한 단어ㆍ어구ㆍ문장을 강세, 리듬, 억양에 맞게 말하는 표준', ['강세 살려 문장 말하기', '리듬 있는 짧은 발표', '억양으로 의도 표현']],
  ['[6영02-02]', '5-6', 'Expression', '표현', ['Speaking', 'Writing'], '실물ㆍ그림ㆍ동작을 보고 간단한 단어ㆍ어구ㆍ문장으로 말하거나 쓰는 표준', ['그림 정보 문장화', '실물 관찰 표현 쓰기', '동작과 표현 연결 발표']],
  ['[6영02-03]', '5-6', 'Expression', '표현', ['Writing', 'Alphabet & Phonics'], '알파벳 대소문자와 문장 부호를 문장에서 바르게 사용하는 표준', ['문장 첫 글자 대문자 쓰기', '마침표ㆍ물음표 사용', '문장 부호 점검']],
  ['[6영02-04]', '5-6', 'Expression', '표현', ['Speaking', 'Writing', 'Vocabulary & Expressions'], '주변 사람이나 사물을 간단한 문장으로 소개하거나 묘사하는 표준', ['친구 소개 문장 말하기', '사물 특징 묘사 쓰기', '비교 표현으로 설명']],
  ['[6영02-05]', '5-6', 'Expression', '표현', ['Speaking', 'Writing'], '주변 장소ㆍ위치ㆍ행동 순서ㆍ방법을 간단한 문장으로 설명하는 표준', ['위치 표현으로 길 안내', '행동 순서 말하기', '방법 설명문 쓰기']],
  ['[6영02-06]', '5-6', 'Expression', '표현', ['Speaking', 'Writing'], '감정ㆍ의견ㆍ경험ㆍ계획을 간단한 문장으로 표현하는 표준', ['감정과 이유 말하기', '경험 한두 문장 쓰기', '미래 계획 표현']],
  ['[6영02-07]', '5-6', 'Expression', '표현', ['Speaking', 'Interaction', 'Writing'], '일상생활 주제 담화나 글의 세부 정보를 간단한 문장으로 묻거나 답하는 표준', ['세부 정보 질문 만들기', '들은 내용 답하기', '읽은 정보로 짝 대화']],
  ['[6영02-08]', '5-6', 'Expression', '표현', ['Writing'], '예시문을 참고하여 목적에 맞는 간단한 글을 쓰는 표준', ['초대ㆍ감사 카드 쓰기', '짧은 이메일 형식 쓰기', '경험 글 초안과 수정']],
  ['[6영02-09]', '5-6', 'Expression', '표현', ['Speaking', 'Writing', 'Media'], '매체와 전략을 활용하여 창의적으로 의미를 생성하고 표현하는 표준', ['사진 자료로 말하기', '디지털 도구로 짧은 글 구성', '전략 선택해 의사 전달']],
  ['[6영02-10]', '5-6', 'Expression', '표현', ['Speaking', 'Interaction', 'Culture & Intercultural'], '의사소통 활동에 흥미와 자신감을 가지고 협력적으로 참여하는 표준', ['모둠 대화 역할 수행', '온라인ㆍ오프라인 협력 과업', '상호 피드백으로 다시 표현']]
].map(([code, gradeBand, officialArea, officialAreaKorean, domainTags, summary, focuses]) => {
  const key = `${curriculumId}:${code}`;
  return {
    key,
    code,
    gradeBand,
    subject,
    subjectKorean,
    officialArea,
    officialAreaKorean,
    domainTags,
    summary,
    sourceTextIncluded: false,
    sourceRefs,
    verificationStatus: 'official-source-checked',
    sourceBasis: 'Code and grade-band placement verified against the official NCIC [별책14] English curriculum PDF; summary is a source-derived paraphrase, not copied standard text.',
    sourceLocator: {
      sourceId: 'kr-ncic-2022-english-pdf',
      attachmentNo: '10003794',
      sha256: englishPdfSha256,
      pdfPage: englishPdfPageByBlock[`${gradeBand}:${officialArea}`],
      section: `초등학교 ${gradeBand}학년 ${officialAreaKorean}`,
      code
    },
    sourceEvidence: [
      `Official elementary ${gradeBand} ${officialAreaKorean} block in 교육부 고시 제2022-33호 [별책14].`,
      `NCIC attachment [별책14] 영어과 교육과정.pdf, subjectCode 3360, attachmentNo 10003794.`
    ],
    focuses
  };
});

const typeCycle = ['LANGUAGE', 'PROCEDURAL', 'META'];
const relationshipCycle = ['introduces', 'supports', 'assesses'];

const slugify = (text) => text
  .toLowerCase()
  .replace(/[·ㆍ]/g, '-')
  .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
  .replace(/^-|-$/g, '');

const standardSlug = (code) => code.replace(/[\[\]]/g, '').toLowerCase();
const areaByCode = (code) => code.includes('01-') ? 'understanding' : 'expression';

function assessmentSkillFor(standard, domain, focus) {
  if (domain === 'Interaction') return 'interaction';
  if (domain === 'Media') return 'media';
  if (domain === 'Strategies') return 'strategy';
  if (domain === 'Culture & Intercultural') return 'culture';
  if (domain === 'Alphabet & Phonics') return 'phonics';
  if (domain === 'Vocabulary & Expressions') return 'vocabulary';
  if (domain === 'Listening') return 'listening';
  if (domain === 'Speaking') return 'speaking';
  if (domain === 'Reading') return 'reading';
  if (domain === 'Writing') return 'writing';
  if (domain === 'Pronunciation') {
    if (standard.officialArea === 'Expression') return 'speaking';
    return /읽기|읽어|끊어/.test(focus) ? 'reading' : 'listening';
  }
  return standard.officialArea === 'Expression' ? 'speaking' : 'listening';
}

function eflAssessmentFor(skill, standard, focus) {
  const productionLoad = standard.gradeBand === '3-4'
    ? '낱말·어구 또는 한 문장'
    : '두세 개의 간단한 문장';
  const tasks = {
    listening: {
      evidence: [
        `${focus}에 맞는 짧은 영어 입력을 두 번 듣고 그림·순서·핵심어 중 알맞은 답을 선택하거나 표시한다.`,
        `다시 들은 영어의 목표 소리나 핵심어를 근거로 ${focus} 답을 확인하고 선택 이유를 말한다.`
      ],
      prompt: `${focus}용 그림·번호 선택지를 먼저 보여 주고 짧은 영어 입력을 두 번 들려준다. 학습자가 들은 소리·정보를 선택하고 영어 핵심어를 근거로 답을 확인하는지 기록한다.`
    },
    speaking: {
      evidence: [
        `교실 상황 카드와 말하기 틀을 활용해 ${focus}에 맞는 ${productionLoad}을 알아들을 수 있게 말한다.`,
        `${focus} 과정을 녹음하거나 짝에게 들려준 뒤 의미 전달, 목표 표현, 말의 리듬 중 한 항목을 점검해 다시 말한다.`
      ],
      prompt: `${focus}에 맞는 한국 교실 상황 카드와 필요한 낱말만 제공하고 ${productionLoad}으로 말하게 한다. 특정 억양 모방이 아니라 의미 전달, 목표 표현 사용, 다시 말하기 증거로 판정한다.`
    },
    phonics: {
      evidence: [
        `소리·글자 카드를 조작해 ${focus}의 음가와 철자 관계를 세 항목 이상 연결하고 소리 내어 확인한다.`,
        `처음 보는 쉬운 낱말에서 ${focus} 규칙을 적용해 읽거나 쓰고, 틀린 항목은 소리 단위로 고쳐 본다.`
      ],
      prompt: `${focus}에 필요한 소리·글자 카드와 쉬운 낱말을 제시한다. 학습자가 음가와 철자를 연결하고 낯선 항목 하나에 적용해 읽거나 쓰며, 한국어식 발음 자체가 아니라 음철 대응 증거로 판정한다.`
    },
    vocabulary: {
      evidence: [
        `그림·실물·짧은 영어 맥락에서 ${focus}의 목표 낱말이나 표현을 뜻과 연결해 분류한다.`,
        `분류한 낱말이나 표현을 ${productionLoad}에 넣어 말하거나 쓰고 그림 또는 행동으로 의미를 확인한다.`
      ],
      prompt: `${focus}에 맞는 그림·실물·짧은 영어 맥락을 제시해 목표 어휘·표현을 뜻과 연결하게 한다. 이어 ${productionLoad}에 사용하게 하며 한국어 번역만으로는 숙달로 판정하지 않는다.`
    },
    reading: {
      evidence: [
        `그림이 있는 짧은 영어 글에서 ${focus}에 필요한 글자·낱말·정보를 찾아 밑줄이나 번호로 표시한다.`,
        `표시한 문자 단서와 문맥을 근거로 ${focus} 답을 고르고, 필요할 때 의미 단위로 다시 읽어 확인한다.`
      ],
      prompt: `${focus}에 맞는 짧은 영어 글과 그림을 제시한다. 학습자가 목표 글자·낱말·정보를 찾아 표시하고 문자 단서나 문맥으로 답을 확인하는지 보며, 소리 내어 읽기는 해당 초점일 때만 요구한다.`
    },
    writing: {
      evidence: [
        `낱말 은행이나 예시문을 참고해 ${focus}에 맞는 ${productionLoad}을 목적에 맞게 쓴다.`,
        `쓴 결과에서 목표 어휘·철자·대소문자·문장 부호 중 ${focus}과/와 관련된 항목을 점검하고 한 번 고쳐 쓴다.`
      ],
      prompt: `${focus}에 맞는 그림·목적 카드와 수준별 낱말 은행 또는 예시문을 제공한다. 학습자가 ${productionLoad}을 쓰고 목표 표현과 해당 철자·대소문자·문장 부호를 점검해 수정하는지 확인한다.`
    },
    interaction: {
      evidence: [
        `짝과 서로 다른 정보 카드를 사용해 ${focus}에 필요한 질문과 응답을 주고받아 빠진 정보를 채운다.`,
        `차례 지키기, 되묻기, 다시 말하기 중 한 가지 상호작용 전략을 사용해 ${focus} 대화를 끝까지 이어 간다.`
      ],
      prompt: `${focus}용 정보 차이 카드나 역할 카드를 짝에게 나누어 준다. 학습자가 영어로 질문·응답하고 차례를 지키며, 못 알아들었을 때 되묻거나 다시 말해 공동 과업을 완성하는지 관찰한다.`
    },
    media: {
      evidence: [
        `짧은 영상·그림책·디지털 카드에서 ${focus}에 필요한 영어 정보와 시각·음성 단서를 찾아 표시한다.`,
        `찾은 매체 단서를 활용해 ${focus}의 의미를 ${productionLoad}으로 말하거나 쓰고 사용한 자료를 밝힌다.`
      ],
      prompt: `${focus}에 맞는 짧고 개인정보가 없는 매체 자료를 제시한다. 학습자가 영어 정보와 시각·음성 단서를 찾아 연결하고 ${productionLoad}으로 반응하며, 매체 효과 자체가 아니라 의미 이해·표현 증거를 남기는지 확인한다.`
    },
    strategy: {
      evidence: [
        `예측하기, 그림 단서 활용, 다시 듣기·읽기 중 ${focus}에 알맞은 전략을 선택하고 선택 이유를 말한다.`,
        `선택한 전략을 적용하기 전후의 ${focus} 답을 비교해 무엇이 달라졌는지 기록하고 다음 전략을 정한다.`
      ],
      prompt: `${focus} 과업 전후에 사용할 전략을 고르게 하고 예측·단서 표시·다시 듣기 또는 읽기의 흔적을 남기게 한다. 정답뿐 아니라 전략 선택, 적용, 확인의 세 단계를 관찰한다.`
    },
    culture: {
      evidence: [
        `한국 교실이나 일상에서 출발해 ${focus} 자료 속 두 생활·문화 맥락의 공통점과 차이점을 각각 찾는다.`,
        `한 문화를 기준으로 단정하지 않고 ${focus}의 인물·표현·관습을 존중하는 말로 반응하며 자료 근거를 제시한다.`
      ],
      prompt: `한국 교실의 익숙한 장면과 서로 다른 두 영어 사용 맥락을 담은 ${focus} 자료를 함께 제시한다. 학습자가 공통점·차이점을 자료에서 찾고 고정관념 없이 존중하는 표현으로 반응하는지 확인한다.`
    }
  };
  return tasks[skill];
}

const microTopics = [];
const standardMappings = [];

for (const standard of standards) {
  standard.focuses.forEach((focus, index) => {
    const domain = standard.domainTags[Math.min(index, standard.domainTags.length - 1)];
    const assessmentSkill = assessmentSkillFor(standard, domain, focus);
    const assessment = eflAssessmentFor(assessmentSkill, standard, focus);
    const id = `kr.mt.english-efl.${standard.gradeBand}.${areaByCode(standard.code)}.${standardSlug(standard.code)}.${String(index + 1).padStart(2, '0')}.${slugify(focus)}`;
    const topic = {
      id,
      name: focus,
      title: focus,
      description: `${standard.gradeBand} 학년군 한국어 화자 EFL 학습자가 ${standard.summary}에 도달하도록 ${focus}을/를 분리해 연습하는 세부 주제입니다.`,
      evidence: assessment.evidence,
      provenanceEvidence: [
        `Mapped to verified official achievement standard ${standard.code} in the NCIC [별책14] English curriculum PDF.`,
        `Pedagogical strand ${domain} is derived from the official ${standard.officialAreaKorean} area plus the standard focus; this is EFL decomposition, not native ELA import.`
      ],
      assessmentPrompt: assessment.prompt,
      assessmentSkill,
      type: typeCycle[index],
      subject,
      subjectKorean,
      domain,
      officialArea: standard.officialArea,
      officialAreaKorean: standard.officialAreaKorean,
      gradeBand: standard.gradeBand,
      standards: [standard.key],
      verificationStatus: 'official-source-checked',
      sourceRefs,
      sourceLocator: { ...standard.sourceLocator }
    };
    microTopics.push(topic);
    standardMappings.push({
      standardKey: standard.key,
      microTopicId: id,
      relationship: relationshipCycle[index],
      confidence: 'official-code-checked',
      note: `${standard.code}의 공식 성취기준을 ${domain} 세부 주제로 분해한 매핑입니다.`
    });
  });
}

const topicByStandard = new Map();
for (const topic of microTopics) {
  const standardKey = topic.standards[0];
  if (!topicByStandard.has(standardKey)) topicByStandard.set(standardKey, []);
  topicByStandard.get(standardKey).push(topic);
}

const dependencySuggestions = [];
const addDep = (topicId, prerequisiteId, strength, reason) => {
  if (topicId !== prerequisiteId) {
    dependencySuggestions.push({ topicId, prerequisiteId, strength, reason });
  }
};

for (const standard of standards) {
  const topics = topicByStandard.get(standard.key);
  addDep(topics[1].id, topics[0].id, 'hard', '같은 성취기준 안에서 인식 주제가 절차 연습보다 먼저 필요합니다.');
  addDep(topics[2].id, topics[1].id, 'soft', '평가·전이 주제는 절차 연습 뒤에 배치하는 것이 자연스럽습니다.');
}

for (const group of ['3-4:Understanding', '3-4:Expression', '5-6:Understanding', '5-6:Expression']) {
  const [gradeBand, officialArea] = group.split(':');
  const groupStandards = standards.filter((s) => s.gradeBand === gradeBand && s.officialArea === officialArea);
  for (let i = 1; i < groupStandards.length; i += 1) {
    const prevTopics = topicByStandard.get(groupStandards[i - 1].key);
    const nextTopics = topicByStandard.get(groupStandards[i].key);
    addDep(nextTopics[0].id, prevTopics[2].id, 'soft', `${gradeBand} ${officialArea} 영역 안의 공식 코드 순서를 반영한 약한 진행 관계입니다.`);
  }
}

const parallelGradeBridges = [
  ['[6영01-01]', '[4영01-03]'], ['[6영01-02]', '[4영01-04]'], ['[6영01-03]', '[4영01-05]'],
  ['[6영01-04]', '[4영01-06]'], ['[6영01-05]', '[4영01-06]'], ['[6영01-06]', '[4영01-07]'],
  ['[6영01-07]', '[4영01-07]'], ['[6영01-08]', '[4영01-08]'], ['[6영01-09]', '[4영01-09]'],
  ['[6영01-10]', '[4영01-10]'], ['[6영02-01]', '[4영02-01]'], ['[6영02-02]', '[4영02-04]'],
  ['[6영02-03]', '[4영02-02]'], ['[6영02-04]', '[4영02-05]'], ['[6영02-05]', '[4영02-06]'],
  ['[6영02-06]', '[4영02-07]'], ['[6영02-07]', '[4영02-08]'], ['[6영02-08]', '[4영02-03]'],
  ['[6영02-09]', '[4영02-09]'], ['[6영02-10]', '[4영02-10]']
];

const standardByCode = new Map(standards.map((s) => [s.code, s]));
for (const [advanced, prerequisite] of parallelGradeBridges) {
  const advancedTopics = topicByStandard.get(standardByCode.get(advanced).key);
  const prerequisiteTopics = topicByStandard.get(standardByCode.get(prerequisite).key);
  addDep(advancedTopics[0].id, prerequisiteTopics[2].id, 'soft', `5-6학년 ${advanced}는 3-4학년 ${prerequisite}의 기초 경험을 확장합니다.`);
}

const crossSkillBridges = [
  ['[4영02-02]', '[4영01-02]'], ['[4영02-03]', '[4영01-04]'], ['[4영02-08]', '[4영01-06]'],
  ['[4영02-09]', '[4영01-08]'], ['[4영02-10]', '[4영01-10]'], ['[6영02-01]', '[6영01-02]'],
  ['[6영02-03]', '[6영01-02]'], ['[6영02-07]', '[6영01-04]'], ['[6영02-09]', '[6영01-08]'],
  ['[6영02-10]', '[6영01-10]']
];

for (const [expressive, receptive] of crossSkillBridges) {
  const expressiveTopics = topicByStandard.get(standardByCode.get(expressive).key);
  const receptiveTopics = topicByStandard.get(standardByCode.get(receptive).key);
  addDep(expressiveTopics[1].id, receptiveTopics[1].id, 'soft', `${expressive} 표현 과업은 ${receptive} 이해 경험과 연계하면 안정적입니다.`);
}

const clusterDomains = [
  ['Listening', '듣기'],
  ['Speaking', '말하기'],
  ['Reading', '읽기'],
  ['Writing', '쓰기'],
  ['Vocabulary & Expressions', '어휘·표현'],
  ['Culture & Intercultural', '문화·상호문화']
];

const domainAliases = {
  Listening: ['Listening', 'Pronunciation'],
  Speaking: ['Speaking', 'Interaction', 'Pronunciation'],
  Reading: ['Reading', 'Alphabet & Phonics'],
  Writing: ['Writing', 'Alphabet & Phonics'],
  'Vocabulary & Expressions': ['Vocabulary & Expressions'],
  'Culture & Intercultural': ['Culture & Intercultural']
};

function topicMatchesCluster(topic, domain) {
  if (domainAliases[domain].includes(topic.domain)) return true;
  if (topic.domain === 'Strategies') {
    return domain === (topic.officialArea === 'Understanding' ? 'Listening' : 'Speaking');
  }
  if (topic.domain === 'Media') {
    return domain === (topic.officialArea === 'Understanding' ? 'Reading' : 'Writing');
  }
  return false;
}

const clusters = [];
for (const gradeBand of ['3-4', '5-6']) {
  for (const [domain, domainKorean] of clusterDomains) {
    const topics = microTopics
      .filter((topic) => topic.gradeBand === gradeBand && topicMatchesCluster(topic, domain))
      .map((topic) => topic.id);
    clusters.push({
      id: `kr.cluster.english-efl.${gradeBand}.${slugify(domain)}`,
      subject,
      subjectKorean,
      domain,
      domainKorean,
      gradeBand,
      topicCount: topics.length,
      topics,
      summary: `${gradeBand} 학년군 ${domainKorean} 관련 English EFL micro-topic cluster. Official standards remain organized as 이해/표현, so this cluster is a pedagogical strand view.`
    });
  }
}

const coverageGaps = [
  {
    id: 'gap-english-domain-remap',
    status: 'documented',
    note: 'The 2022 English curriculum organizes elementary standards into 이해 and 표현. Listening, speaking, reading, writing, vocabulary, and culture are pedagogical decomposition tags, not one-to-one official domains.'
  },
  {
    id: 'gap-standard-text-policy',
    status: 'documented',
    note: 'Official standard text is not embedded in this artifact; summaries are paraphrases and sourceEvidence points back to NCIC [별책14].'
  },
  {
    id: 'gap-language-forms',
    status: 'source-located-explicit-gap',
    severity: 'review-needed',
    note: 'The official [별표 4] source is located, but its elementary-marked language-form examples are not yet represented as item-level records. Existing vocabulary and expression topics are broad skill coverage only and must not be treated as proof of appendix coverage.',
    sourceRefs: ['kr-ncic-2022-english-appendix4'],
    sourceLocator: {
      sourceId: 'kr-ncic-2022-english-appendix4',
      attachmentNo: '10003794',
      sha256: englishPdfSha256,
      pdfPages: [297, 306],
      printedPages: [291, 300],
      section: '[별표 4] 의사소통에 필요한 언어 형식'
    },
    standardKeys: [
      '[4영01-05]', '[4영02-04]', '[4영02-05]', '[4영02-06]', '[4영02-07]', '[4영02-08]',
      '[6영01-03]', '[6영02-02]', '[6영02-04]', '[6영02-05]', '[6영02-06]', '[6영02-07]', '[6영02-08]'
    ].map((code) => `${curriculumId}:${code}`),
    broadSkillTopicCount: microTopics.filter((topic) =>
      ['vocabulary', 'speaking', 'writing', 'interaction'].includes(topic.assessmentSkill)
    ).length,
    itemMappedLanguageFormCount: 0,
    coverageStatus: 'broad-skill-topics-present-form-items-unmapped'
  },
  {
    id: 'gap-assessment-calibration',
    status: 'needs-review',
    note: 'Assessment prompts are EFL classroom-ready drafts and need teacher review for grade-level load and Korean classroom timing.'
  },
  {
    id: 'gap-dependency-review',
    status: 'needs-review',
    note: 'Dependency suggestions encode conservative code-order, grade-progression, and receptive-to-expressive links; expert review is still required before hard graph merge.'
  },
  {
    id: 'gap-media-edtech-examples',
    status: 'needs-follow-up',
    note: 'Media and digital-tool micro-topics should later be aligned with allowed classroom tools and privacy constraints.'
  },
  {
    id: 'gap-culture-localization',
    status: 'needs-review',
    note: 'Culture topics intentionally avoid US/UK defaults; local Korean classroom examples still need a reviewed example bank.'
  }
];

const artifact = {
  $schema: 'https://raw.githubusercontent.com/DECK6/korean-elementary-learning-map/main/schema/kr-english-efl-workstream.schema.json',
  dataset: 'Korean Elementary Learning Map English EFL workstream',
  taxonomyVersion: 'kr-full-depth-v0.4-workstream',
  locale: 'ko-KR',
  country: 'KR',
  subject,
  subjectKorean,
  curriculumId,
  status: 'subject-workstream',
  verificationStatus: 'official-source-checked',
  createdAt: '2026-07-09',
  sourceBasis: 'Official NCIC [별책14] English curriculum PDF was downloaded and checked for elementary achievement-standard code inventory. Micro-topics are source-derived EFL decompositions for Korean elementary learners.',
  textPolicy: {
    standardTextIncluded: false,
    topicTextPolicy: 'Topic titles, summaries, evidence, and assessment prompts are newly authored source-derived paraphrases.',
    licensingStatus: 'Official curriculum source cited through NCIC; do not bulk-copy official standard text into merged data without project license review.',
    licenseCaution: 'Keep sourceRefs and evidence locators when integrating.'
  },
  counts: {
    sources: sources.length,
    standards: standards.length,
    microTopics: microTopics.length,
    standardMappings: standardMappings.length,
    dependencySuggestions: dependencySuggestions.length,
    clusters: clusters.length,
    coverageGaps: coverageGaps.length
  },
  sources,
  standards: standards.map(({ focuses, ...standard }) => standard),
  microTopics,
  standardMappings,
  dependencySuggestions,
  clusters,
  coverageGaps
};

mkdirSync(resolve(ROOT, 'data', 'kr', 'workstreams'), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(repairWorkstreamContent(artifact), null, 2)}\n`);
console.log(`Wrote ${OUT}`);
console.log(JSON.stringify(artifact.counts, null, 2));
