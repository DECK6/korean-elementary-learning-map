# 변경 기록

이 저장소는 한국 초등 학습지도 데이터셋의 변경 사항을 기록합니다.

## [0.5.0] — 2026-09-05

**K-12 공통 계약 v1** (`docs/plans/2026-09-05-k12-relation-vocabulary-spec.md`, 중등 저장소와 공유) 구현, **인용 고시 판 재핀**, **주제 콘텐츠 오버레이** 도입, **성취기준 요약 재서술**, 중등 저장소와 공유하는 **K-12 코어 TBox** 도입. 데이터 릴리스는 `kr-full-depth-v0.5`, 온톨로지는 `0.4.0`입니다.

> 주제 ID·IRI는 통합교과 즐거운 생활을 제외하고 그대로입니다. 즐거운 생활은 2026-1 일부개정으로 영역 체계와 성취기준 의미가 함께 바뀌어, 48개 주제 ID와 4개 클러스터 ID가 바뀌었습니다(아래 "인용 고시 판 재핀" 참조). 온톨로지 TBox·통제 어휘 IRI는 재배정하지 않았습니다.

### 관계 2층 분리

- 선수 관계를 근거의 성격에 따라 두 파일로 나눴습니다.
  - `data/kr/dependencies.json` — **official 층 416건**. 내용 체계표 학년(군) 진행과 성취기준 해설 명시 지목만 담고, 전건이 `basisKind: official-source`, `relationKind: required-prerequisite`, `reviewStatus: internal-reviewed`, `sourceLocator.printedPage`(인쇄 쪽수)를 갖습니다.
  - `data/kr/dependencies.candidate.json` — **pedagogical-candidate 층 1,875건**. workstream 제안을 전부 이관했고(official 승격 2건, official 순서와 모순돼 제거 1건), 전건이 `relationKind: recommended-before`, `reviewStatus: candidate`입니다.
- 공통 어휘 `layer`, `relationKind`, `basisKind`, `scope`, `reviewStatus`, `sourceRefs`, `sourceLocator`, 결정적 `id`(`kr.dep.` + sha256 앞 20자)를 추가하고, 초등 원값 `strength: hard|soft`와 자유 문자열 `basis`는 그대로 보존했습니다.
- 기존 12종 `basis` 문자열은 `basisKind`로 사상했습니다 — `official-code-order` 179, `decomposition-order` 590, `repository-authored` 1,106.
- 과목별 공식 근거는 `scripts/lib/official-relation-specs/<subject>.mjs`에 코드 쌍으로 기록하고, 빌더가 각 성취기준의 `facetKey: concept` 주제(없으면 정렬상 첫 주제)로 전개합니다.

### 11개 교과 official 관계 채굴

- 공식 문서의 문장이 **순서를 진술한 것만** official로 올렸습니다. 근거는 두 갈래입니다 — 내용 체계표의 학년(군) 진행(C계열) **316건**, 성취기준 해설의 명시 지목(D계열) **100건**. 합계 **416건**.
- 교과별 코드 쌍(계 = C + D) — 수학 108(99+9), 국어 83(79+4), 체육 75(43+32), 통합교과 27(0+27), 사회 26(24+2), 과학 24(19+5), 음악 23(13+10), 미술 18(15+3), 영어(EFL) 18(18+0), 도덕 11(6+5), 실과(기술·가정)/정보 3(0+3).
- 방향이 없는 나열형 서술("~와 관련된다", "~와 연계된다"), 병행·동시 학습 제안, 수업 방법 제안, 교과 간 연계는 official로 올리지 않고 후보 층에 두거나 미채택으로 남겼습니다. 교과별 채택·미채택 근거와 한계는 `docs/reviews/`의 교과별 검토 문서에 있습니다.
- **R3-D 통합교과 즐거운 생활 연계 채굴** — 즐거운 생활 절의 '연계' 서술에서 후보 21건을 뽑아, 방향이 분명한 **16건을 채택**하고 5건은 방향 미판정으로 보류했습니다. 통합교과 D계열이 11 → **27**로, official 층 전체가 400 → **416**으로 늘었습니다.

### 주제 공통 필드

- 전 주제(1,956개)에 `decompositionKind: subject-facet`, 공통 facet 8종 중 하나인 `facetKey`, `standardKey`, `sourceStandardCode`를 채웠습니다(`sourceStandardCode` 969 → 1,956).
- `titleEnglish` 자리표시자("… micro-topic N") 171건과 null은 필드를 생략했습니다.
- `topics[].standardKey`는 `standards[0]`에서 파생된 **편의 필드**이며 권위 있는 정렬 목록은 `standards[]`임을 스키마·통제 어휘·TBox 주석에 명시했습니다. 두 값의 동등성은 `scripts/validate-kr.mjs`가 이미 강제합니다.

### 주제 콘텐츠 오버레이

- **오버레이 인프라** — `evidence`·`assessmentPrompt`의 기계 템플릿을 공식 출처 근거 문장으로 바꾸는 빌드 입력 `data/kr/content/<subject>-<gradeBand>.json`을 신설했습니다. 파일 형식은 중등 저장소와 동형이고, 초등만 `assessmentPrompt`가 문자열 하나입니다(중등은 `assessmentPrompts` 배열). 스키마는 `schema/kr-content-overlay.schema.json`, 병합 지점은 `scripts/build-kr-full-depth.mjs`의 최종 주제 레코드 생성 직후입니다.
- 주제 레코드에 `contentKind`(`mechanical-derivative` | `source-grounded-draft`), `misconceptions`, `contentSourceLocator`를 추가했습니다. `data/kr/manifest.json`은 오버레이 파일 수와 출처 기반 초안 주제 수를 `counts.contentOverlayFiles` 8 · `counts.sourceGroundedTopics` 1,017에 기록합니다.
- 작성자용 단일 파일 게이트 `scripts/dev/check-content-overlay.mjs`를 추가하고, `npm run check:content`가 출처 기반 초안 수·완전 중복 evidence/prompt 수·템플릿 비율을 함께 출력하도록 했습니다.
- **초등 수학 오버레이 3개** — 1~2학년 87 / 3~4학년 141 / 5~6학년 135, 합계 **363주제**를 `contentKind: source-grounded-draft`로 집필했습니다. 근거는 [별책 8] 수학과 교육과정의 성취기준·성취기준 해설·성취기준 적용 시 고려 사항·평가의 방향이며, 그중 74건(20.4% — 학년군별 27.6% / 9.9% / 26.7%)은 성취기준 해설 문단을 직접 근거로 삼습니다. 별책 원문과의 16자 연속 일치는 0건입니다.
- **초등 국어 오버레이 3개** — 1~2학년 92 / 3~4학년 120 / 5~6학년 136, 합계 **348주제**. 근거는 [별책 5] 국어과 교육과정의 성취기준 해설·적용 시 고려 사항(해설 근거 56~65%)이며 facet은 concept·procedure·communication·reflection(매체 영역은 representation)입니다.
- **초등 과학 오버레이 2개** — 3~4학년 153 / 5~6학년 153, 합계 **306주제**. 근거는 [별책 9] 과학과 교육과정(해설 근거 69~71%)이며 탐구 facet에는 안전 유의점을 명시했습니다.
- 출처 기반 초안 주제는 합계 **1,017개**(52.0%)이고 나머지 939개 주제는 `mechanical-derivative`로 남습니다. 오버레이 8개 파일 사이의 완전 중복은 0건입니다.
- **관찰 동사 검사 분리** — `scripts/lib/kr-content-quality.mjs`의 관찰 가능성 검사를 두 갈래로 나눴습니다. `isLearnerObservableEvidence`(strict)는 기계 생성 주제 수리용으로 원래 stem 목록을 그대로 쓰고, `isAuthoredObservableEvidence`(authored)는 집필 오버레이용으로 `-ㄴ다`/`-는다` 종결형을 종성으로 판정해 받아들이되 인지 동사(안다·이해한다·인식한다 등)는 제외합니다. 분리 후 기계 생성 주제 1,593건의 출력이 불변임을 확인했습니다.

### 성취기준 요약 교체

- `scripts/lib/kr-standard-summaries.mjs`를 신설하고, 2026-1 개정 **[별책 2]**(첨부 10004180, sha256 `f943dab8…`)의 성취기준 문장을 근거로 **293개 성취기준의 요약을 원문 비인용 재서술로 교체**했습니다.
  - 수학 121개는 "…소주제에 배치된 공식 성취기준 [코드]이다" 형태의 자리표시자여서 실질 요약이 없었습니다.
  - 나머지 172개(과학 102, 도덕 24, 실과(기술·가정)/정보 19, 영어 17, 통합교과 5, 체육 3, 국어 1, 미술 1)는 원문과 16자 이상 연속 일치하던 요약을 다시 썼습니다.
- 전체 620개 성취기준에 `summaryKind: "source-grounded-paraphrase"`를 부여했습니다.
- `scripts/validate-kr.mjs`가 요약 종류·길이(12~60자)·요약표와 데이터의 일치를 강제합니다. `scripts/dev/check-standard-summary-verbatim.mjs`는 저장소 **밖**에 둔 원문 추출 텍스트를 인자로 받아 16자 연속 일치 0을 검사합니다(공식 원문은 저장소에 저장하지 않습니다).
- 주제 ID 1,956개는 전부 불변입니다.

### 온톨로지 0.4.0

- 선수 단정에 `lm:assertionLayer`, `lm:relationKind`, `lm:basisKind`, `lm:scope`, `lm:reviewStatus`, `lm:relationIdentifier` 한정자를 추가했습니다.
- `directRequires`·`unlocks`·`indirectRequires`는 **official 층에서만** 파생합니다(416 / 416 / 97). 후보 층은 `PrerequisiteAssertion`으로만 나타납니다.
- 초등·중등이 공유하는 facet SKOS scheme `https://dexa.art/learnmap/vocab/facet/` 8종과 관계 scheme 6종을 추가했습니다.
- 중등 저장소와 공유하는 **K-12 코어 TBox** `ontology/k12-core.ttl`을 신설했습니다(IRI `https://dexa.art/learnmap/ontology/k12-core`, versionIRI `…/1.0.0`). 두 저장소에 바이트 동일 사본을 두고 `tests/k12-core-sync.test.mjs`가 파일 헤더의 기준 해시로 동기화를 검사합니다. 기존 `lm:` IRI는 재발급하지 않고 `owl:imports`와 `owl:equivalentClass`·`owl:equivalentProperty`·`skos:exactMatch`로 코어에 연결합니다.
- ABox가 코어 어휘 `core:facetKey`·`core:contentKind`·`core:misconception`·`core:contentSourceLocator`·`core:layerConcept`를 함께 배출합니다. SHACL은 "`source-grounded-draft` 주제는 `contentSourceLocator`를 정확히 하나 가져야 한다"를 강제하고, 적대 fixture `missing-content-locator.ttl`로 확인합니다(적대 fixture 9 → 10).
- STAS 레코드 로케이터 종류(`core:locator-stas-record`와 `core:stasEndpoint`·`core:stasRecordId`·`core:collectedAt`·`core:fileSha256`)는 어휘와 shape에만 예약하고 데이터는 배출하지 않습니다.
- SPARQL 역량 질문에 `cq-16-relation-layers.rq`(관계 층별 건수), `cq-17-content-kinds.rq`(콘텐츠 종류별 주제 수 — `mechanical-derivative` 1,593 / `source-grounded-draft` 363), `cq-18-k12-core-vocabulary.rq`(코어 어휘 교차 질의, 중등 SCQ 21과 질의문 동일)를 추가했습니다(총 **18개**).
- R3-D의 official +16을 반영해 `ontology/queries/expected.json` 기대값을 갱신했습니다(cq-04 `directRequires` 416, cq-05 `indirectRequires` 97, cq-06 `unlocks` 416, cq-16 official 416 · 후보 1,875, cq-18 layer-official 416). 그래프는 인스턴스 리소스 **22,163**개와 검증 트리플 **248,548**개입니다. README, `docs/ontology-release-report.md`, `docs/kr-full-depth-integration-report.md`, `docs/kr-subject-redesign-notes.md`의 수치도 함께 맞췄습니다.

### 인용 고시 판 재핀 (통합교과 2026-1 · 음악 2024-3 · 실과 첨부 교체)

조사 근거: `docs/source-version-matrix.md`, `docs/source-version-diff-2026-09.md`.

- **통합교과를 2026-1판 단일 기준으로 재작성**했습니다. 이전 인벤토리는 2022-33호 [별책 15]의 48개 코드와 2026-1판 건강한 생활 9개를 섞은 하이브리드여서, 코드 수(57)만으로는 드러나지 않는 세 가지 오류가 있었습니다.
  - 삭제: `[2즐04-01]`~`[2즐04-04]` — 2026-1 일부개정으로 폐지된 코드가 남아 있었습니다.
  - 신설: `[2즐02-05]`, `[2즐02-06]`, `[2즐03-05]`, `[2즐03-06]`.
  - **의미 재배정**: `[2즐01-01]`~`[2즐03-04]` 12개 코드는 코드 문자열은 그대로이나 가리키는 성취기준이 완전히 교체되었습니다(예: `[2즐01-01]` 놀이·안전 → 소리 탐색). 요약·주제·증거·평가 질문·클러스터를 2026판 의미로 다시 생성했습니다.
  - 즐거운 생활 영역이 삶의 질문 4개에서 **체험·표현·감상 3개**로 개편되어, 주제 ID의 영역 구간과 클러스터 ID가 함께 바뀌었습니다(`joyful-life.{who,where,now,doing}` → `joyful-life.{experience,expression,appreciation}`). 클러스터는 153 → **152**개입니다.
  - 통합교과 57개 성취기준 전부가 이제 구조화된 `sourceLocator`(첨부번호·SHA-256·PDF 쪽·인쇄 쪽·코드)를 갖습니다. 이전에는 건강한 생활 9개만 가지고 있었습니다.
  - 출처를 `kr-ncic-2026-1-annex15-pdf`(첨부 10004214) 하나로 통일하고, `kr-moe-2022-33-annex15-pdf`와 `kr-ncic-2022-elem-integrated-attachment`는 별칭 치환 대상으로 폐기했습니다. `codeInventorySha256`을 `9fa9b32b…`로 재계산했습니다.
  - 교차검증 출처로 **[별책 2] 초등학교 교육과정 2026-1판**(첨부 10004180, sha256 `f943dab8…`)을 추가했습니다. 초등 620개 코드를 한 문서에 담고 있어 교과별 별책 대조를 독립적으로 확인합니다.
- **음악을 2024-3호 [별책 12]로 재핀**했습니다(첨부 10003561 → **10003999**, sha256 `db2d03b4…` → `54af8340…`). 「국가유산기본법」 체계 전환에 따라 `[4음02-05]`·`[6음02-05]` 요약의 「문화유산」을 「국가유산」으로 바꿨습니다. 코드 26개와 PDF 쪽 배치는 두 판이 동일합니다.
- **실과 첨부를 교체**했습니다(10003781 → **10004244**, sha256 `842077c7…` → `8eaa773f…`). NCIC 초등(2022.12) 실과 행이 제공하는 파일이 바뀐 것으로, 코드 39개·영역·쪽 배치는 동일합니다. `[6실04-06]`은 재게시본에서 종결 어미만 다르며(`…한다.` → `…하다.`) 저장소 요약은 원문을 인용하지 않는 재서술이라 변경하지 않았습니다. 성취기준 39건의 근거 로케이터를 추출 라인 번호 대신 PDF 쪽·인쇄 쪽 기준으로 다시 적었습니다.
- **커버리지 갭 정리** — 종결 3건, 신규 종결 2건, 신규 정책 1건.
  - `gap.kr.korean.2026-amendment-reconciliation` → `resolved` (국어는 2026-1호 개정 대상이 아님)
  - `math-gap-2026-amendment-scope` → `resolved` (수학도 개정 대상이 아님)
  - `gap-2026-amendment-subject-delta` → `resolved` (실과도 개정 대상이 아님)
  - `gap.kr.practical-arts.attachment-replacement-10004244` 신규 → `resolved`
  - `gap.kr.integrated.2026-1-repin` 신규 → `resolved`
  - `gap.kr.integrated.2026-1-enforcement-date` 신규 → `intentional`
- **판본 정책 명시** — 데이터셋은 "현행 고시본"을 따릅니다. 2026-1호 별책15의 초등 1·2학년 시행일은 2028-03-01이므로, 통합교과 성취기준 57건에 `effectiveFrom: 2028-03-01`을 달고 `curriculum-standards.json`의 `textPolicy.sourceEditionPolicy`·`textPolicy.effectiveFrom`과 `manifest.json`의 `sourcePosture.effectiveFrom`에 기록했습니다. 시행판(2022-33호)을 별도 인벤토리로 병존시키지는 않습니다.
- **official 관계 2건 추가** — 통합교과 사양 모듈의 `sourceId`를 근거 문서와 같은 `kr-ncic-2026-1-annex15-pdf`로 맞추고, 즐거운 생활 의미 불일치로 보류했던 `[2즐01-03] → [2건03-01]`, `[2즐02-06] → [2건03-02]`를 채택했습니다(official 398 → 400). 검토 문서 `docs/reviews/2026-09-05-integrated-official-relations-review.md` 9절에 갱신 내역과 남은 채굴 후보를 실었습니다(문서의 23건은 집계 오기이고 실제 유효 후보는 21건 — 위 "11개 교과 official 관계 채굴"의 R3-D 항목에서 처리했습니다).
- **개수 하드코딩 제거** — Node·Python 검증기와 테스트의 주제·클러스터·갭·출처·정렬 개수를 데이터 파일에서 파생하도록 바꿨습니다. 구조 상수(`LearningDomain`, `Subject`, `GradeBand`, 관계 외 로케이터·검증 레코드 기준값)만 고정값으로 남습니다.

### 위생·메타데이터

- 커버리지 갭의 `severity`를 `high|medium|low|intentional`, `status`를 `open|needs-review|resolved|intentional|out-of-scope`로 정규화하고 원값을 `severitySource`·`statusSource`에 보존했습니다(재핀 뒤 46건).
- `package.json` version `0.5.0`, license `MIT`. 11개 교육과정 레코드의 `license` 문구를 MIT·공개 공식 자료(cleared) 기준으로 바꿨습니다.
- `schema/kr-dependencies-candidate.schema.json`과 `schema/kr-content-overlay.schema.json`을 추가하고 official 프로필·주제·성취기준 스키마를 갱신했습니다(총 6종).

## [0.4.1] — 2026-07-17

### 라이선스·권리

- 저장소 전체를 **MIT 라이선스**로 재라이선스했습니다. 원저작자는 DECK(github.com/DECK6)이며, 공개된 국가 교육과정 정보를 바탕으로 독립 구축한 원저작물입니다.
- Marble Skill Taxonomy는 학습 그래프 접근의 영감을 준 프로젝트로 표시를 유지하되, 데이터베이스·콘텐츠 복제가 없어 ODbL/CC BY-SA 패키지 라이선스(LICENSE-CONTENT 포함)를 제거했습니다.
- 공식 교육과정 문서는 국가가 공표한 공개 자료이므로 권리 상태를 `HOLD`에서 `cleared`(공개 공식 자료)로 전환했습니다. 온톨로지 메타데이터·통제 어휘·검증 질의·매니페스트·문서를 일괄 갱신했고, 일곱 자동 게이트를 재통과했습니다.

## [0.4.0] — 2026-07-10

독립 로컬 저장소의 최초 릴리스입니다.

### 포함

- 대한민국 2022 개정 초등 교육과정 중심의 11개 교육과정 영역
- 성취기준 앵커 620개와 성취기준↔주제 매핑 1,956개
- 세부 학습 주제 1,956개
- 교과 내부의 검토 가능한 선수 관계 1,894개(DAG)
- 학부모용 요약이 있는 클러스터 153개
- 교과별 workstream, 이전 단계 seed, KR JSON Schema 4종
- 빌드·검증·콘텐츠 품질·출처 링크 점검 스크립트와 3개 테스트 파일

### 독립 저장소화 및 리브랜딩

- Marble Skill Taxonomy의 학습 그래프 접근에서 영감을 받아 독립 구축한 한국 구현만 새 저장소로 분리
- 새 프로젝트명 **한국 초등 학습지도 / Korean Elementary Learning Map** 적용
- 패키지명과 스키마 식별자를 `korean-elementary-learning-map`으로 변경
- 재사용·개작한 업스트림 구조 요소에 대한 표시와 ODbL 1.0 / CC BY-SA 4.0 의무 보존
- 한국 교육과정 레코드, 교과 모델, 성취기준 매핑, 주제, 간선, 생성기, 검증기와 감사를 독립 구축했음을 명시
- Marble의 번역본이나 공식 파생 프로젝트가 아니며, 교육부·국가교육위원회·NCIC의 공식 간행물이 아님을 명시

### 제외

- 루트의 일반/비한국 데이터 파일
- 비한국 JSON Schema
- 미디어 파일
- 업스트림의 일반 README, CITATION, CHANGELOG, PROVENANCE 및 기존 감사 보고서
- 업스트림의 일반 `scripts/validate.mjs`

### 권리 주의

한국 교육부/NCIC 공식 PDF의 저작물 단위 공공누리(KOGL) 및 상업적 재사용 조건은 확인되지 않아 HOLD를 유지합니다. 자세한 내용은 `PROVENANCE.md`를 참고하세요.
