const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;

const KOREAN_FACING_FIELDS = [
  'name',
  'title',
  'titleKorean',
  'description',
  'summary',
  'assessmentPrompt',
  'generationBasis',
];

const JOSA_PLACEHOLDER = /(?:을\/를|이\/가|이\(가\)|을\(를\)|과\/와)/;
const KNOWN_MALFORMED = /(?:하기과|존중를|조건와)/;
const ENGLISH_FACET = /\b(?:concept|practice|reflection)\b/i;
const UNDEFINED_PLACEHOLDER = /\bundefined\b/i;
// Alternatives that name the repository pipeline itself; they are provenance in every path.
const PROVENANCE_SIGNAL_SHARED =
  'source-to-topic-decomposition|source link|mapped to|official (?:code|achievement|wording)|NCIC|PDF (?:text|attachment|lists)|workstream-authored|성취기준에서 분해|공식 (?:코드|문구|원문)';
// Strict pattern for machine-generated text, where a bare 출처/원문 only ever comes from a locator line.
const PROVENANCE_SIGNAL = new RegExp(`(?:${PROVENANCE_SIGNAL_SHARED}|출처|원문)`, 'i');
// Authored overlays teach source credibility ([4국02-05]) and media ethics ([4국06-03]), so there
// 출처/원문 are the learning content itself and count as provenance only next to locator vocabulary.
const AUTHORED_PROVENANCE_SIGNAL = new RegExp(
  `(?:${PROVENANCE_SIGNAL_SHARED}` +
    '|(?:출처|원문)[^\\n]{0,4}(?:locator|로케이터|재수록|sourceId|sourceRefs)' +
    '|(?:별책|고시 제|PDF|sourceId|sourceRefs)[^\\n]{0,16}(?:출처|원문)' +
    '|(?:출처|원문)[^\\n]{0,16}(?:별책|고시 제|PDF|sourceId|sourceRefs))',
  'i',
);
const OBSERVABLE_SIGNAL =
  /(?:설명|제시|구분|식별|선택|비교|연결|분류|수행|실행|적용|표현|제작|구성|기록|확인|찾|말하|읽|쓰|듣|연주|노래|움직|관찰|조사|분석|평가|점검|수정|개선|참여|보여|근거)/;

const FACETS = {
  concept: {
    label: '핵심 요소 이해',
    type: 'CONCEPTUAL',
    action: '핵심 요소를 찾아 서로 구분하고 생활·작품·활동 사례와 연결',
  },
  practice: {
    label: '수행과 적용',
    type: 'PROCEDURAL',
    action: '재료·도구·몸·소리를 알맞게 사용하여 계획한 활동을 수행',
  },
  reflection: {
    label: '성찰과 개선',
    type: 'META',
    action: '수행 결과를 기준에 따라 돌아보고 다음 시도의 개선점을 선택',
  },
};

const ARTS_PE_FOCUS = {
  미술: {
    체험: ['주변 시각 요소 관찰', '감각과 느낌의 시각적 연결', '생활 공간에서 미술 발견', '시각 문화와 환경의 관계 탐색'],
    표현: ['표현 주제와 아이디어 정하기', '재료와 용구의 특성 탐색', '조형 요소로 화면과 형태 구성', '제작 과정 점검과 수정'],
    감상: ['작품에서 보이는 특징 찾기', '느낌과 해석의 근거 말하기', '작품의 맥락과 쓰임 비교', '감상 의견을 나누고 존중하기'],
  },
  음악: {
    표현: ['노래의 가락과 리듬 표현', '악기로 박과 음색 표현', '소리 재료로 짧은 음악 만들기', '함께 연주하며 소리의 균형 맞추기'],
    감상: ['음악의 빠르기와 셈여림 듣기', '가락과 리듬의 특징 구별', '음악의 분위기와 쓰임 연결', '근거를 들어 감상 의견 나누기'],
    생활화: ['생활 속 음악 장면 찾기', '행사와 공동체 음악에 참여하기', '음악 감상 예절과 저작물 존중', '음악으로 감정과 관계 돌보기'],
  },
  체육: {
    건강: ['신체 변화와 건강 신호 살피기', '규칙적인 신체 활동 계획하기', '운동과 휴식의 균형 실천하기'],
    도전: ['움직임 목표와 성공 기준 정하기', '기본 움직임을 조절해 기록 향상하기', '도전 과정에서 끈기와 안전 지키기'],
    경쟁: ['게임 규칙과 역할 이해하기', '공간과 도구를 활용한 전략 적용하기', '협력과 공정한 경기 태도 실천하기'],
    표현: ['몸 움직임의 요소 탐색하기', '느낌과 생각을 움직임으로 구성하기', '함께 표현하고 감상 의견 나누기'],
    안전: ['활동 공간과 위험 요소 점검하기', '준비운동과 보호 장비 적용하기', '사고 상황에 대처하고 도움 요청하기'],
  },
};

const GRADE_STAGE = {
  '1-2': '기초',
  '3-4': '확장',
  '5-6': '심화',
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function lastPronouncedCharacter(text) {
  const chars = [...String(text)];
  for (let index = chars.length - 1; index >= 0; index -= 1) {
    if (/[가-힣A-Za-z0-9]/.test(chars[index])) return chars[index];
  }
  return '';
}

export function hasFinalConsonant(text) {
  const char = lastPronouncedCharacter(text);
  const code = char.codePointAt(0);
  if (code >= HANGUL_START && code <= HANGUL_END) return (code - HANGUL_START) % 28 !== 0;
  if (/\d/.test(char)) return new Set(['0', '1', '3', '6', '7', '8']).has(char);
  if (/[A-Za-z]/.test(char)) return new Set(['L', 'M', 'N', 'R']).has(char.toUpperCase());
  return false;
}

export function attachJosa(text, pair) {
  const choices = {
    '을/를': ['을', '를'],
    '이/가': ['이', '가'],
    '이(가)': ['이', '가'],
    '을(를)': ['을', '를'],
    '과/와': ['과', '와'],
  }[pair];
  if (!choices) throw new Error(`Unsupported Korean particle pair: ${pair}`);
  return `${text}${choices[hasFinalConsonant(text) ? 0 : 1]}`;
}

// `pdftotext` wrapped these words mid-token in the 초등 과학과 교육과정 annex, and the wrap survived
// into the hand-maintained science workstream `focus` text. This repository keeps no extracted source
// corpus to score merges against, so each repair is listed with the standard it was observed in and is
// anchored on hangul boundaries — ordinary text such as "가설 명확히" or "사용 액으로" stays untouched.
const PDF_WRAP_REPAIRS = [
  [/(?<![가-힣])설 명(?![가-힣])/g, '설명'], // [4과16-02]
  [/(?<![가-힣])달라 짐(?=[을이은])/g, '달라짐'], // [6과03-01]
  [/(?<![가-힣])진하 기(?=[를가는])/g, '진하기'], // [6과03-02]
  [/(?<![가-힣])관 련(?=되)/g, '관련'], // [6과04-02]
  [/(?<![가-힣])다 양한(?![가-힣])/g, '다양한'], // [6과08-03]
  [/(?<![가-힣])용 액(?=[으을의이])/g, '용액'], // [6과09-01]
];

export function resolveKoreanText(value) {
  if (typeof value !== 'string') return value;
  const patterns = [
    ['을(를)', /([가-힣A-Za-z0-9])을\(를\)/g],
    ['이(가)', /([가-힣A-Za-z0-9])이\(가\)/g],
    ['을/를', /([가-힣A-Za-z0-9])을\/를/g],
    ['이/가', /([가-힣A-Za-z0-9])이\/가/g],
    ['과/와', /([가-힣A-Za-z0-9])과\/와/g],
  ];
  let repaired = value;
  for (const [pair, pattern] of patterns) {
    repaired = repaired.replace(pattern, (_, char) => attachJosa(char, pair));
  }
  for (const [pattern, replacement] of PDF_WRAP_REPAIRS) {
    repaired = repaired.replace(pattern, replacement);
  }
  return repaired
    .replaceAll('하기과', '하기와')
    .replaceAll('존중를', '존중을')
    .replaceAll('조건와', '조건과')
    .replaceAll('실천 실천', '실천')
    .replaceAll('생활 생활', '생활');
}

function repairStrings(value) {
  if (typeof value === 'string') return resolveKoreanText(value);
  if (Array.isArray(value)) return value.map(repairStrings);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, repairStrings(item)]));
  }
  return value;
}

function textOfEvidence(item) {
  return typeof item === 'string' ? item : JSON.stringify(item);
}

// A statement that ends in a Korean present-tense action verb (…한다 / …ㄴ다 / …는다) describes
// an observable learner behaviour even when the verb is not in the curated stem list.
// Excludes cognitive-state verbs (안다, 이해한다, 인식한다 ...) that are not directly observable.
const NON_OBSERVABLE_ENDING = /(?:안다|이해한다|인식한다|느낀다|생각한다|여긴다|믿는다|알게\s*된다|이해하게\s*된다)\s*[.。]?\s*$/;

// Korean present-tense action verbs end in `-ㄴ다` (vowel stems: 한다, 든다, 준다, 그린다 ...) or `-는다`
// (consonant stems: 넣는다, 긋는다 ...). Adjectives and dictionary forms (어렵다, 크다, 많다) do not,
// so checking the jongseong of the syllable before the final 다 separates observable actions from states.
function endsWithPresentActionVerb(text) {
  const match = /([가-힣])다\s*[.。]?\s*$/.exec(text.trim());
  if (!match) return false;
  const code = match[1].charCodeAt(0) - 0xac00;
  const jongseong = code % 28;
  return jongseong === 4 || match[1] === '는';
}

// Strict classifier used by the mechanical repair step so that template repair output stays stable.
export function isLearnerObservableEvidence(item) {
  return (
    typeof item === 'string' &&
    item.trim().length >= 8 &&
    OBSERVABLE_SIGNAL.test(item) &&
    !PROVENANCE_SIGNAL.test(item)
  );
}

// Broader classifier for human/agent-authored overlay evidence: accepts any present-tense action
// verb ending in addition to the curated stems, but still rejects cognitive-state endings.
export function isAuthoredObservableEvidence(item) {
  if (typeof item !== 'string' || item.trim().length < 8 || AUTHORED_PROVENANCE_SIGNAL.test(item)) return false;
  if (OBSERVABLE_SIGNAL.test(item)) return true;
  return endsWithPresentActionVerb(item) && !NON_OBSERVABLE_ENDING.test(item);
}

function typeLabel(type) {
  return {
    CONCEPTUAL: '핵심 개념',
    PROCEDURAL: '수행 절차',
    REPRESENTATIONAL: '표현과 근거',
    LANGUAGE: '언어 이해와 표현',
    META: '성찰과 개선',
  }[type] || '학습 내용';
}

export function masteryCriteriaForTopic(topic) {
  const name = resolveKoreanText(topic.name || topic.title || topic.titleKorean || topic.id);
  const domain = topic.domainKorean || topic.subjectKorean || '해당';
  const criteriaByType = {
    CONCEPTUAL: [
      `${attachJosa(name, '을/를')} 이루는 핵심 요소 두 가지 이상을 찾아 자신의 말로 설명한다.`,
      `${domain} 사례에서 ${attachJosa(name, '이/가')} 드러나는 장면을 선택하고 판단 근거를 제시한다.`,
    ],
    PROCEDURAL: [
      `${attachJosa(name, '을/를')} 수행하는 순서와 주의할 점을 말한 뒤 과제를 끝까지 실행한다.`,
      `수행 과정과 결과를 기록하고, ${name}의 다음 시도에서 바꿀 점을 한 가지 제시한다.`,
    ],
    REPRESENTATIONAL: [
      `${attachJosa(name, '을/를')} 말·글·표·그림·소리·움직임 중 알맞은 방식으로 표현한다.`,
      `자신의 표현물에서 ${domain} 내용과 근거가 드러나는 부분을 찾아 설명한다.`,
    ],
    LANGUAGE: [
      `${name} 과제에서 목표 소리·낱말·문장·의미 단서를 식별하고 이해한 내용을 보여 준다.`,
      `짧은 듣기·말하기·읽기·쓰기 활동에서 ${attachJosa(name, '을/를')} 알맞게 표현하고 결과를 확인한다.`,
    ],
    META: [
      `${name} 수행 뒤 미리 정한 기준으로 잘된 점과 보완할 점을 각각 한 가지 이상 말한다.`,
      `자신의 기록이나 결과물을 근거로 다음 연습에서 실행할 개선 방법을 선택해 제시한다.`,
    ],
  };
  return (criteriaByType[topic.type] || criteriaByType.CONCEPTUAL).map(resolveKoreanText);
}

export function assessmentPromptForTopic(topic) {
  const name = resolveKoreanText(topic.name || topic.title || topic.titleKorean || topic.id);
  const skill = typeLabel(topic.type);
  const prompts = {
    CONCEPTUAL: `${name}의 ${attachJosa(skill, '을/를')} 사례와 연결해 설명하고, 선택한 사례가 알맞은지 근거 두 가지로 판단하게 한다.`,
    PROCEDURAL: `${attachJosa(name, '을/를')} 계획한 순서대로 수행하게 하고, 과정 기록·결과물·개선점으로 ${skill}를 확인한다.`,
    REPRESENTATIONAL: `${attachJosa(name, '을/를')} 알맞은 표현 방식으로 나타내게 하고, 표현물에서 내용과 근거를 짚어 설명하게 한다.`,
    LANGUAGE: `${name}에 맞는 짧은 듣기·말하기·읽기·쓰기 과업을 제시하고, 목표 의미를 이해하거나 표현한 증거를 기록한다.`,
    META: `${name} 수행 결과를 기준에 따라 스스로 점검하게 하고, 기록을 근거로 다음 시도의 개선 방법을 제시하게 한다.`,
  };
  return resolveKoreanText(prompts[topic.type] || prompts.CONCEPTUAL);
}

function artsPeFocus(standard) {
  const choices = ARTS_PE_FOCUS[standard.subjectKorean]?.[standard.domainKorean];
  if (!choices) return null;
  const match = standard.code?.match(/-(\d{2})\]$/);
  const index = Number(match?.[1] || 1) - 1;
  return choices[index] || `${standard.domainKorean} 학습 초점 ${index + 1}`;
}

function hasReviewedOfficialLocator(standard) {
  const locator = standard.sourceLocator;
  return (
    standard.verificationStatus === 'official-source-checked' &&
    locator &&
    typeof locator === 'object' &&
    typeof locator.sourceId === 'string' &&
    typeof locator.attachmentNo === 'string' &&
    typeof locator.sha256 === 'string' &&
    Number.isInteger(locator.pdfPage)
  );
}

function repairArtsPeStandards(standards) {
  const focusByKey = new Map();
  for (const standard of standards) {
    if (!ARTS_PE_FOCUS[standard.subjectKorean]) continue;
    // The legacy arts/PE workstream used synthetic code families and needed a
    // conservative candidate rewrite.  Official-source reconciled records
    // carry an item-level locator and must never be downgraded or rewritten by
    // this compatibility repair.
    if (hasReviewedOfficialLocator(standard)) continue;
    const focus = artsPeFocus(standard);
    if (!focus) continue;
    const stage = GRADE_STAGE[standard.gradeBand] || standard.gradeBand;
    standard.summary = `${standard.gradeBand}학년군 ${standard.domainKorean} ${stage} 후보 초점: ${focus}. 공식 성취기준 코드와 문구를 대조하기 전의 로컬 설계 항목이다.`;
    standard.candidateTopicFocus = focus;
    standard.verificationStatus = 'needs-official-code-check';
    const candidateNote = 'Candidate topic focus is locally authored for differentiation and does not assert official curriculum wording.';
    const sourceBasis = String(standard.sourceBasis || '').split(candidateNote).join('').replace(/\s+/g, ' ').trim();
    standard.sourceBasis = `${sourceBasis} ${candidateNote}`.trim();
    focusByKey.set(standard.key, focus);
  }
  return focusByKey;
}

function repairArtsPeTopics(topics, standardByKey, focusByKey) {
  for (const topic of topics) {
    if (!ARTS_PE_FOCUS[topic.subjectKorean]) continue;
    const standardKey = topic.standards?.[0];
    const standard = standardByKey.get(standardKey);
    const focus = focusByKey.get(standardKey);
    if (!standard || !focus) continue;
    const facetKey = topic.id.split('.').at(-1);
    const facet = FACETS[facetKey] || FACETS.concept;
    const stage = GRADE_STAGE[topic.gradeBand] || topic.gradeBand;
    const name = `${topic.gradeBand}학년군 ${focus} — ${facet.label}`;
    topic.name = name;
    topic.title = name;
    topic.titleKorean = name;
    topic.type = facet.type;
    topic.description = `${topic.subjectKorean} ${topic.domainKorean} 영역의 ${stage} 후보 초점인 ${attachJosa(focus, '을/를')} ${facet.action}하는 학습 주제이다. 공식 성취기준 문구로 검증된 항목이 아니다.`;
    topic.summary = `${standard.code} 후보 앵커를 ${focus}의 ${facet.label} 학습으로 구체화한 로컬 마이크로토픽.`;
    topic.assessmentPrompt = assessmentPromptForTopic(topic);
    topic.verificationStatus = 'needs-official-code-check';
    topic.generationBasis = `${standard.code} 후보 앵커에 ${topic.subjectKorean} ${topic.domainKorean} 분야의 ${focus} 초점을 부여해 서로 구별되는 학습 주제로 생성했다. 공식 코드·문구 확인은 별도 과제로 남긴다.`;
    topic.sourceStandardCode = standard.code;
  }
}

function repairPracticalArtsTopics(topics, standardByKey) {
  for (const topic of topics) {
    if (topic.subjectKorean !== '실과(기술·가정)/정보') continue;
    const standard = standardByKey.get(topic.standards?.[0]);
    if (!standard) continue;
    const title = standard.titleKorean;
    // Contract section 9: the type must agree with the facet the id suffix declares. The generator
    // cycled all five types over the `.concept` topics, mislabelling 29 of them; ids and titles stay.
    if (topic.id.endsWith('.concept')) topic.type = 'CONCEPTUAL';
    else if (topic.id.endsWith('.practice')) topic.type = 'PROCEDURAL';
    if (topic.id.endsWith('.concept')) {
      const focus = Array.isArray(standard.focus) ? standard.focus.join(', ') : standard.focus;
      topic.description = `${standard.domainKorean} 영역에서 ${attachJosa(focus, '을/를')} 중심으로 ${standard.summary}`;
      topic.assessmentPrompt = `${attachJosa(title, '과/와')} 관련된 핵심 개념을 생활 사례 하나와 연결하여 설명하고, 판단 근거를 두 가지 제시한다.`;
    } else if (topic.id.endsWith('.practice')) {
      topic.assessmentPrompt = `${attachJosa(title, '을/를')} 실제 생활 과제로 적용한 결과물을 만들거나 실행한 뒤, 과정 증거와 개선점을 함께 제출한다.`;
    }
  }
}

function repairMoralTopics(topics) {
  for (const topic of topics) {
    if (topic.subjectKorean !== '도덕' || !topic.id.endsWith('.concept')) continue;
    const focus = String(topic.name || '').replace(/ 가치 개념$/, '');
    topic.assessmentPrompt = `${attachJosa(focus, '과/와')} 관련된 짧은 상황을 제시하고, 학생이 핵심 가치와 판단 기준을 자신의 말로 설명하게 하라.`;
  }
}

function normalizeTopic(topic) {
  topic.name ||= topic.title || topic.titleKorean || topic.summary || topic.id;
  topic.title ||= topic.name;
  topic.titleKorean ||= topic.name;
  if (typeof topic.assessmentPrompt === 'string') {
    topic.assessmentPrompt = topic.assessmentPrompt.replaceAll('{{name}}', topic.name);
  }

  const priorEvidence = Array.isArray(topic.evidence) ? topic.evidence : [];
  const mastery = priorEvidence.filter(isLearnerObservableEvidence);
  const supporting = priorEvidence.filter((item) => !isLearnerObservableEvidence(item));
  if (supporting.length) {
    topic.provenanceEvidence = [
      ...(Array.isArray(topic.provenanceEvidence) ? topic.provenanceEvidence : []),
      ...supporting,
    ];
  }
  const generated = masteryCriteriaForTopic(topic);
  for (const criterion of generated) {
    if (mastery.length >= 2) break;
    if (!mastery.includes(criterion)) mastery.push(criterion);
  }
  topic.evidence = mastery;
  Object.assign(topic, repairStrings(topic));
  return topic;
}

export function repairTopicRecords(inputTopics) {
  const topics = inputTopics.map((topic) => normalizeTopic(topic));
  const promptGroups = new Map();
  for (const topic of topics) {
    for (const standardKey of topic.standards || []) {
      const key = `${standardKey}\u0000${topic.assessmentPrompt}`;
      if (!promptGroups.has(key)) promptGroups.set(key, []);
      promptGroups.get(key).push(topic);
    }
  }
  for (const group of promptGroups.values()) {
    if (group.length < 2) continue;
    for (const topic of group) topic.assessmentPrompt = assessmentPromptForTopic(topic);
  }
  return topics.map((topic) => repairStrings(topic));
}

export function repairWorkstreamContent(inputArtifact) {
  const artifact = clone(inputArtifact);
  const standards = artifact.standards || [];
  const standardByKey = new Map(standards.map((standard) => [standard.key, standard]));
  const focusByKey = repairArtsPeStandards(standards);
  repairArtsPeTopics(artifact.microTopics || [], standardByKey, focusByKey);
  repairPracticalArtsTopics(artifact.microTopics || [], standardByKey);
  repairMoralTopics(artifact.microTopics || []);
  artifact.microTopics = repairTopicRecords(artifact.microTopics || []);
  return repairStrings(artifact);
}

function normalized(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function duplicateGroups(values) {
  const groups = new Map();
  for (const [key, id] of values) {
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(id);
  }
  return [...groups.values()].filter((group) => group.length > 1);
}

export function computeContentQualityMetrics(topics) {
  let unresolvedJosa = 0;
  let knownMalformed = 0;
  let englishFacetLabels = 0;
  let undefinedPlaceholders = 0;
  let evidenceBelowTwo = 0;
  let nonObservableEvidence = 0;
  for (const topic of topics) {
    const koreanText = [
      ...KOREAN_FACING_FIELDS.map((field) => topic[field]),
      ...(topic.evidence || []),
    ]
      .filter((value) => typeof value === 'string')
      .join('\n');
    unresolvedJosa += [...koreanText.matchAll(/을\/를|이\/가|이\(가\)|을\(를\)|과\/와/g)].length;
    knownMalformed += [...koreanText.matchAll(/하기과|존중를|조건와/g)].length;
    englishFacetLabels += [...koreanText.matchAll(/\b(?:concept|practice|reflection)\b/gi)].length;
    undefinedPlaceholders += [...koreanText.matchAll(/\bundefined\b/gi)].length;
    if (!Array.isArray(topic.evidence) || topic.evidence.length < 2) evidenceBelowTwo += 1;
    const observable = topic.contentKind === 'source-grounded-draft' ? isAuthoredObservableEvidence : isLearnerObservableEvidence;
    nonObservableEvidence += (topic.evidence || []).filter((item) => !observable(item)).length;
  }

  const semanticGroups = duplicateGroups(
    topics.map((topic) => [
      `${normalized(topic.name)}\u0000${normalized(topic.titleKorean || topic.title)}\u0000${normalized(topic.description)}`,
      topic.id,
    ]),
  );
  const promptGroups = duplicateGroups(
    topics.flatMap((topic) =>
      (topic.standards || []).map((standardKey) => [
        `${standardKey}\u0000${normalized(topic.assessmentPrompt)}`,
        topic.id,
      ]),
    ),
  );

  return {
    topics: topics.length,
    unresolvedJosa,
    knownMalformed,
    englishFacetLabels,
    undefinedPlaceholders,
    semanticDuplicateGroups: semanticGroups.length,
    semanticDuplicateRecords: semanticGroups.reduce((count, group) => count + group.length, 0),
    evidenceBelowTwo,
    nonObservableEvidence,
    withinStandardDuplicatePromptGroups: promptGroups.length,
    withinStandardDuplicatePromptRecords: promptGroups.reduce((count, group) => count + group.length, 0),
  };
}

export function contentQualityErrors(topics) {
  const metrics = computeContentQualityMetrics(topics);
  const errors = [];
  if (metrics.unresolvedJosa) errors.push(`Korean-facing fields contain ${metrics.unresolvedJosa} unresolved josa placeholder(s)`);
  if (metrics.knownMalformed) errors.push(`Korean-facing fields contain ${metrics.knownMalformed} known malformed josa form(s)`);
  if (metrics.englishFacetLabels) errors.push(`Korean-facing fields contain ${metrics.englishFacetLabels} English facet label(s)`);
  if (metrics.undefinedPlaceholders) {
    errors.push(`Korean-facing fields contain ${metrics.undefinedPlaceholders} undefined placeholder(s)`);
  }
  if (metrics.semanticDuplicateGroups) {
    errors.push(
      `topics contain ${metrics.semanticDuplicateGroups} exact semantic duplicate group(s) covering ${metrics.semanticDuplicateRecords} records`,
    );
  }
  if (metrics.evidenceBelowTwo) errors.push(`${metrics.evidenceBelowTwo} topic(s) have fewer than two mastery criteria`);
  if (metrics.nonObservableEvidence) errors.push(`topic evidence contains ${metrics.nonObservableEvidence} non-observable or provenance-only item(s)`);
  if (metrics.withinStandardDuplicatePromptGroups) {
    errors.push(
      `standards contain ${metrics.withinStandardDuplicatePromptGroups} exact duplicate assessment-prompt group(s) covering ${metrics.withinStandardDuplicatePromptRecords} records`,
    );
  }
  return errors;
}

export const CONTENT_QUALITY_PATTERNS = {
  JOSA_PLACEHOLDER,
  KNOWN_MALFORMED,
  ENGLISH_FACET,
  UNDEFINED_PLACEHOLDER,
  PROVENANCE_SIGNAL,
  AUTHORED_PROVENANCE_SIGNAL,
};
