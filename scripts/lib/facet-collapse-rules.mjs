// Facet collapse rules (contract section 8). One achievement standard keeps every topic it
// decomposed into, but a topic a rule marks as auxiliary is one a tutor skips: the sibling named by
// `collapseInto` already carries the same content.
//
// Rules are authored, never inferred. A code appears here only because a writing report or a review
// document named it; `scripts/check-kr-content-quality.mjs` reports statistical candidates as
// warnings so a new rule is always a human decision.

export const COLLAPSE_REASONS = [
  'attitude-standard',
  'metacognitive-standard',
  'unit-relation-standard',
  'overlapping-facets',
  'process-standard',
];

/**
 * `auxiliaryFacetKeys` names the facets a tutor skips; `collapseIntoFacetKey` names the sibling it
 * shows instead, and defaults to the standard's anchor topic when omitted.
 * @type {{ code: string, auxiliaryFacetKeys: string[], reason: string, collapseIntoFacetKey?: string, note: string }[]}
 */
export const FACET_COLLAPSE_RULES = [
  // 수학 — R3-B1 보고: "[2수03-06]·[2수01-01]은 facet 3분할이 인위적".
  {
    code: '[2수01-01]',
    auxiliaryFacetKeys: ['application', 'representation'],
    reason: 'overlapping-facets',
    note: '“수를 세어 읽고 쓰기”가 한 동작이라 세기(application)·읽고 쓰기(representation)가 개념 주제와 같은 증거를 쓴다. R3-B1 집필 보고가 3분할을 인위적이라고 지목했다.',
  },
  {
    code: '[2수03-06]',
    auxiliaryFacetKeys: ['application', 'representation'],
    reason: 'overlapping-facets',
    note: '“견주어 알맞은 말로 구별하기”가 한 동작이라 직접 비교(application)·줄 세워 나타내기(representation)가 개념 주제와 같은 증거를 쓴다. R3-B1 집필 보고가 3분할을 인위적이라고 지목했다.',
  },
  // 수학 — R3-B2 보고: "측정 단위 관계 계열([4수03-16/18/21/22])은 application·representation facet가
  // 구조적으로 겹침". 같은 형태의 5~6학년 넓이·부피 단위 관계 성취기준도 함께 둔다.
  {
    code: '[4수03-16]',
    auxiliaryFacetKeys: ['representation'],
    collapseIntoFacetKey: 'application',
    reason: 'unit-relation-standard',
    note: '길이 단위 사이의 관계를 표기로 바꾸는 것이 성취기준의 전부라, 표현 주제가 적용 주제와 같은 단위 환산을 다시 쓴다(R3-B2 보고).',
  },
  {
    code: '[4수03-18]',
    auxiliaryFacetKeys: ['representation'],
    collapseIntoFacetKey: 'application',
    reason: 'unit-relation-standard',
    note: '들이 단위 사이의 관계를 표기로 바꾸는 것이 성취기준의 전부라, 표현 주제가 적용 주제와 같은 단위 환산을 다시 쓴다(R3-B2 보고).',
  },
  {
    code: '[4수03-21]',
    auxiliaryFacetKeys: ['representation'],
    collapseIntoFacetKey: 'application',
    reason: 'unit-relation-standard',
    note: '무게 단위 사이의 관계를 표기로 바꾸는 것이 성취기준의 전부라, 표현 주제가 적용 주제와 같은 단위 환산을 다시 쓴다(R3-B2 보고).',
  },
  {
    code: '[4수03-22]',
    auxiliaryFacetKeys: ['representation'],
    collapseIntoFacetKey: 'application',
    reason: 'unit-relation-standard',
    note: '톤과 킬로그램의 관계를 표기로 바꾸는 것이 성취기준의 전부라, 표현 주제가 적용 주제와 같은 단위 환산을 다시 쓴다(R3-B2 보고).',
  },
  {
    code: '[6수03-12]',
    auxiliaryFacetKeys: ['representation'],
    collapseIntoFacetKey: 'application',
    reason: 'unit-relation-standard',
    note: '넓이 단위 사이의 관계를 알고 알맞은 단위를 고르는 것이 성취기준의 전부라, 표현 주제가 적용 주제와 겹친다(R3-B2 계열).',
  },
  {
    code: '[6수03-18]',
    auxiliaryFacetKeys: ['representation'],
    collapseIntoFacetKey: 'application',
    reason: 'unit-relation-standard',
    note: '부피 단위 사이의 관계를 알고 알맞은 단위를 고르는 것이 성취기준의 전부라, 표현 주제가 적용 주제와 겹친다(R3-B2 계열).',
  },
  {
    code: '[4수03-19]',
    auxiliaryFacetKeys: ['representation'],
    collapseIntoFacetKey: 'application',
    reason: 'overlapping-facets',
    note: '들이의 덧셈·뺄셈에서 표현 주제가 같은 계산을 세로셈 표기로 옮겨 적을 뿐이라 적용 주제의 증거와 실질 동일하다(R3-B2 계열).',
  },
  {
    code: '[4수03-23]',
    auxiliaryFacetKeys: ['representation'],
    collapseIntoFacetKey: 'application',
    reason: 'overlapping-facets',
    note: '무게의 덧셈·뺄셈에서 표현 주제가 같은 계산을 세로셈 표기로 옮겨 적을 뿐이라 적용 주제의 증거와 실질 동일하다(R3-B2 계열).',
  },
  {
    code: '[6수03-14]',
    auxiliaryFacetKeys: ['representation'],
    reason: 'overlapping-facets',
    note: '도형을 자르고 붙여 넓이 구하는 방법을 보이는 표현 주제가 “왜 그렇게 구하는가”를 설명하는 개념 주제와 같은 조작을 쓴다(R3-B2 계열).',
  },
  {
    code: '[6수04-03]',
    auxiliaryFacetKeys: ['representation'],
    collapseIntoFacetKey: 'application',
    reason: 'process-standard',
    note: '한 성취기준이 탐구 문제 설정 → 자료 수집 → 그래프 표현 → 해석의 전 과정을 담아, 그래프 표현은 적용 주제가 수행하는 과정의 한 단계다(계약 8절 도입부).',
  },
  // 국어 — R5-B2 보고: "태도형 성취기준은 reflection facet과 본문 중복".
  // 태도·정의적 성취기준 10건은 성찰 주제가 성취기준 본문(흥미·태도)을 되풀이한다.
  {
    code: '[2국01-05]',
    auxiliaryFacetKeys: ['reflection'],
    reason: 'attitude-standard',
    note: '성취기준 본문이 듣기·말하기에 대한 흥미와 관심 자체라 성찰 주제가 본문을 되풀이한다(R5-B2 보고).',
  },
  {
    code: '[2국02-05]',
    auxiliaryFacetKeys: ['reflection'],
    reason: 'attitude-standard',
    note: '성취기준 본문이 즐겨 읽는 태도 자체라 성찰 주제가 본문을 되풀이한다(R5-B2 보고).',
  },
  {
    code: '[2국05-04]',
    auxiliaryFacetKeys: ['reflection'],
    reason: 'attitude-standard',
    note: '성취기준 본문이 시·노래·이야기에 대한 흥미 자체라 성찰 주제가 본문을 되풀이한다(R5-B2 보고).',
  },
  {
    code: '[4국02-06]',
    auxiliaryFacetKeys: ['reflection'],
    reason: 'attitude-standard',
    note: '성취기준 본문이 바람직한 읽기 습관과 자신감이라 성찰 주제가 본문을 되풀이한다(R5-B2 보고).',
  },
  {
    code: '[4국03-05]',
    auxiliaryFacetKeys: ['reflection'],
    reason: 'attitude-standard',
    note: '성취기준 본문이 쓰기 과정 점검과 자신감이라 성찰 주제가 본문을 되풀이한다(R5-B2 보고).',
  },
  {
    code: '[4국05-05]',
    auxiliaryFacetKeys: ['reflection'],
    reason: 'attitude-standard',
    note: '성취기준 본문이 작품을 즐기는 태도라 성찰 주제가 본문을 되풀이한다(R5-B2 보고).',
  },
  {
    code: '[6국02-05]',
    auxiliaryFacetKeys: ['reflection'],
    reason: 'attitude-standard',
    note: '성취기준 본문이 긍정적 읽기 동기와 적극적 참여라 성찰 주제가 본문을 되풀이한다(R5-B2 보고).',
  },
  {
    code: '[6국03-06]',
    auxiliaryFacetKeys: ['reflection'],
    reason: 'attitude-standard',
    note: '성취기준 본문이 글을 공유하는 적극적 쓰기 태도라 성찰 주제가 본문을 되풀이한다(R5-B2 보고).',
  },
  {
    code: '[6국05-06]',
    auxiliaryFacetKeys: ['reflection'],
    reason: 'attitude-standard',
    note: '성취기준 본문이 작품을 삶과 연관 지어 성찰하는 태도라 성찰 주제가 본문을 되풀이한다(R5-B2 보고).',
  },
  {
    code: '[6국06-04]',
    auxiliaryFacetKeys: ['reflection'],
    reason: 'attitude-standard',
    note: '성취기준 본문이 자신의 매체 이용 양상 성찰이라 성찰 주제가 본문을 되풀이한다(R5-B2 보고).',
  },
];

const rulesByCode = new Map(FACET_COLLAPSE_RULES.map((rule) => [rule.code, rule]));

export function facetCollapseRuleFor(standardCode) {
  return rulesByCode.get(standardCode) ?? null;
}

// Fails the build rather than silently ignoring a typo in the rule table.
export function assertCollapseRulesWellFormed(rules = FACET_COLLAPSE_RULES) {
  const seen = new Set();
  for (const rule of rules) {
    if (seen.has(rule.code)) throw new Error(`facet collapse rules: duplicate code ${rule.code}`);
    seen.add(rule.code);
    if (!COLLAPSE_REASONS.includes(rule.reason)) {
      throw new Error(`facet collapse rules: ${rule.code} has unknown reason ${rule.reason}`);
    }
    if (!Array.isArray(rule.auxiliaryFacetKeys) || rule.auxiliaryFacetKeys.length === 0) {
      throw new Error(`facet collapse rules: ${rule.code} lists no auxiliary facet`);
    }
    if (rule.collapseIntoFacetKey && rule.auxiliaryFacetKeys.includes(rule.collapseIntoFacetKey)) {
      throw new Error(`facet collapse rules: ${rule.code} collapses into an auxiliary facet`);
    }
    if (typeof rule.note !== 'string' || rule.note.trim().length < 10) {
      throw new Error(`facet collapse rules: ${rule.code} needs a note explaining the rule`);
    }
  }
  return rules;
}
