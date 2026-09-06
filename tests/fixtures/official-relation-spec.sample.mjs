// Test-only official relation spec. Injected into the expander so the official
// layer can be exercised independently of scripts/lib/official-relation-specs/.
export default {
  subject: 'math',
  subjectKorean: '수학',
  sourceId: 'kr-ncic-math-pdf-2022',
  specFile: 'official-relation-spec.sample.mjs',
  contentSystemRequired: [
    ['[2수01-01]', '[4수01-01]', '수와 연산', 13, '네 자리 이하의 수 → 다섯 자리 이상의 수'],
  ],
  commentaryRequired: [['[4수02-01]', '[6수02-01]', 17, '도형의 구성 요소를 바탕으로 입체도형을 다룬다.']],
  expansionRules:
    '내용 요소가 여러 성취기준에 걸칠 때는 해당 영역·학년군의 성취기준 코드로 나열하고, 각 코드는 facetKey concept 주제로 전개한다.',
};
