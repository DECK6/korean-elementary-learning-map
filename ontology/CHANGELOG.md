# Ontology changelog

This changelog covers the ontology contract independently from the dataset/package changelog at the repository root.

## [0.4.0] — 2026-09-05

### Added

- **K-12 관계 계약 v1** 한정자: `lm:assertionLayer`, `lm:relationKind`, `lm:basisKind`, `lm:scope`, `lm:reviewStatus`, `lm:relationIdentifier`를 `lm:PrerequisiteAssertion`에 추가했습니다.
- 주제 공통 필드 `lm:decompositionKind`, `lm:facetKey`, `lm:standardKey`와 초등·중등이 공유하는 facet SKOS scheme `https://dexa.art/learnmap/vocab/facet/` 8종을 추가했습니다.
- 관계 통제 어휘 scheme 6종(`RelationLayer`, `RelationKind`, `BasisKind`, `RelationScope`, `ReviewStatus`, `DecompositionKind`)을 추가했습니다.
- 커버리지 갭 정규화용 `lm:gapStatus`, `lm:sourceGapSeverity`, `lm:sourceGapStatus`를 추가했습니다.
- **K-12 코어 모듈** `ontology/k12-core.ttl`을 추가했습니다. 온톨로지 IRI는 `https://dexa.art/learnmap/ontology/k12-core`, versionIRI는 `…/1.0.0`이며, 초등·중등 두 저장소가 바이트 동일 사본을 보관하고 `tests/k12-core-sync.test.mjs`가 파일 헤더의 `# k12-core-sync-sha256:` 기준 해시로 동기화를 검사합니다. 저장소 TBox는 `owl:imports <https://dexa.art/learnmap/ontology/k12-core>`를 선언하고 로컬 사본에서 읽습니다.
- 코어 정합 축은 세 가지입니다. 클래스 10종은 `owl:equivalentClass`(`lm:AchievementStandard` ↔ `core:AchievementStandard` 등), 관계 한정자와 `lm:facetKey`는 `owl:equivalentProperty`(`lm:assertionLayer` ↔ `core:layerConcept` 등), 통제 어휘 개념은 `skos:exactMatch`(facet 8종, RelationLayer 2종, RelationKind 2종, BasisKind 5종, RelationScope 4종, ReviewStatus 2종)로 잇습니다. **`lm:` IRI는 하나도 재발급하지 않았습니다.**
- 콘텐츠 오버레이 어휘 `core:contentKind`, `core:misconception`, `core:contentSourceLocator`, `core:locatorKind`와 개념 스킴 `core:ContentKindScheme`(`content-mechanical-derivative`, `content-source-grounded-draft`), `core:LocatorKindScheme`을 추가했습니다.
- SHACL에 코어 콘텐츠 shape를 추가했습니다 — `core:contentKind` 값은 스킴 2종으로 제한되고, `content-source-grounded-draft` 주제는 `core:contentSourceLocator`를 정확히 하나 가져야 합니다. 적대 fixture `ontology/fixtures/adversarial/missing-content-locator.ttl`이 이 제약을 검사합니다(적대 fixture 9 → 10).
- STAS(성취기준·성취수준 조회 서비스) 레코드용 로케이터 종류 `core:locator-stas-record`와 그 필드 `core:stasEndpoint`, `core:stasRecordId`, `core:collectedAt`, `core:fileSha256`을 코어 TBox에 두고, `core:SourceLocatorKindShape`가 이 네 값을 모두 요구하도록 했습니다. **이 릴리스의 데이터는 STAS 로케이터를 하나도 배출하지 않습니다** — 2026-09-05 출처 판정에 따라 STAS 본문은 재수록하지 않고 "어디서 읽었는지"만 기록할 수 있으므로, 어휘와 shape만 미리 고정해 뒤따르는 릴리스에서 계약을 바꾸지 않게 했습니다.
- 역량 질문 `cq-17-content-kinds.rq`(콘텐츠 종류별 주제 수)와 `cq-18-k12-core-vocabulary.rq`(코어 어휘 교차 질의 — 중등 저장소 SCQ 21과 질의문이 동일)를 추가해 총 18개입니다.

### Changed

- 통합교과 ABox가 국가교육위원회 고시 제2026-1호 일부개정 [별책 15] 단일 판으로 바뀌었습니다. **`[2즐01-01]`~`[2즐03-04]` 12개 성취기준 코드는 IRI 문자열은 같으나 가리키는 성취기준이 교체된 "의미 재배정"입니다.** `[2즐04-01]`~`[2즐04-04]`(주제 IRI 12개 포함)는 고시에서 폐지되어 ABox에서 제거했고 대체 IRI가 없습니다. 즐거운 생활 영역 개편으로 주제 IRI 48개와 클러스터 IRI 4개가 새 IRI 3개로 바뀌었습니다.
- `lm:directRequires`·`lm:unlocks`·`lm:indirectRequires`는 이제 **official 층에서만** 물질화합니다. `pedagogical-candidate` 층은 `lm:PrerequisiteAssertion`으로만 나타나며 이진 관계를 만들지 않습니다.
- SHACL: official 층 단정에는 `lm:hasSourceLocator`가 필수이고, 후보 층 단정에 `lm:directRequires` 간선이 있으면 위반입니다.
- `lm:gapSeverity`는 `high|medium|low|intentional` 4종으로 좁혔고, 원값은 `lm:sourceGapSeverity`에 보존합니다.
- 커버리지 갭의 자유 문자열 `lm:status`를 `lm:gapStatus`(5종 통제 어휘)로 교체했습니다.
- `lm:standardKey`가 주제 정렬 목록의 첫 항목에서 **파생된 편의 필드**이며 `lm:hasStandardTopicAlignment`가 권위 목록임을 TBox 주석과 통제 어휘(`assertionPolicy: derived`)에 명시했습니다. 속성 IRI·카디널리티는 그대로입니다.

### Compatibility

- **TBox**: 클래스·속성·개념 IRI를 제거하거나 재배정하지 않았습니다. `ontology/term-status.json`과 `ontology/replacements.json`은 계속 비어 있습니다. 두 레지스트리는 `ontology/controlled-vocabulary.json`에 정의된 용어(클래스·속성·개념)만 등록할 수 있으므로, 아래 ABox 인스턴스 변경은 그곳이 아니라 이 변경 기록과 저장소 `CHANGELOG.md`·`PROVENANCE.md`, 그리고 커버리지 갭 `gap.kr.integrated.2026-1-repin`에 기록합니다.
- **ABox(데이터 인스턴스)**: 통합교과 재핀으로 세 종류의 비호환 변경이 있습니다. `ontology/deprecation-policy.md`의 비재배정 원칙은 릴리스된 온톨로지·어휘 IRI에 적용되며, 여기서 바뀐 것은 고시 자체가 코드를 재배정한 데이터 인스턴스입니다.
  1. **의미 재배정** — `[2즐01-01]`~`[2즐03-04]` 12개 성취기준. IRI는 그대로이나 가리키는 고시 성취기준이 교체되었습니다. 이전 릴리스의 해석을 재사용하면 안 됩니다.
  2. **폐지** — `[2즐04-01]`~`[2즐04-04]` 성취기준 4개와 그 주제 12개. 고시에서 삭제되어 대체 IRI가 없습니다.
  3. **IRI 이동** — 즐거운 생활 영역이 삶의 질문 4개에서 체험·표현·감상 3개로 개편되어 주제 IRI 48개, 클러스터 IRI 4개(→ 신규 3개)가 바뀌었습니다.
- 데이터 릴리스는 `kr-full-depth-v0.4` → `kr-full-depth-v0.5`로 올라갑니다. 릴리스 문자열이 바뀌므로 릴리스 파생 레코드 IRI(`pa-…`, `sta-…`, `vr-…`, `loc-…`)는 재계산됩니다.
- **K-12 코어 모듈 도입은 추가만 하는 변경입니다.** `core:` 용어는 새 네임스페이스에 있고 기존 `lm:` 용어와 등가 공리로 이어질 뿐이므로, `lm:`만 소비하던 질의는 그대로 동작합니다. 코어를 함께 읽는 소비자는 `owl:imports` 대상을 로컬 사본 `ontology/k12-core.ttl`로 해석해야 하며(네트워크 조회 없음), 코어 사본이 바뀌면 **두 저장소의 헤더 해시를 함께** 갱신해야 합니다.
- 이 릴리스에서 폐기(deprecate)한 **어휘 용어**는 없습니다.

## [0.3.0-p3] — 2026-07-10

### Added

- Formal **Korean Elementary Curriculum Learning Ontology** release label after seven automated gates.
- Stable-series `owl:versionIRI` / `owl:priorVersion` semantics linking P3 to `0.2.0-p2`.
- Governance, deprecation policy, replacement registry, and term-status policy.
- Generated term reference and a deterministic release manifest covering release artifacts, validation evidence, byte sizes, and SHA-256 hashes.
- Explicit automated-review, ongoing external-domain-review, non-official, no-learner-diagnosis, and rights `HOLD` metadata.
- GitHub Actions coverage for canonical Node gates and pinned Python RDF/SHACL/OWL/SPARQL validation in a temporary virtual environment.

### Compatibility

- No P2 class, property, concept, or instance IRI was removed or reassigned.
- The dataset release remains `kr-full-depth-v0.4`; graph resource and relation counts are unchanged.
- No terms are deprecated in this release.
- `ontology/replacements.json` is intentionally empty for P3 and is checked by the release generator.

## [0.2.0-p2] — 2026-07-10

- Added deterministic JSON-LD and Turtle ABox exports, materialized inverse/indirect relations, SHACL Advanced constraints, bounded OWL-RL checks, competency queries, adversarial fixtures, and the pinned Python standards-validation report.

## [0.1.0-p1] — 2026-07-10

- Added the static OWL/Turtle TBox, local JSON-LD context, SHACL contract, metadata, stable instance IRIs, and qualifier-preserving assertions.

## [0.1.0-p0] — 2026-07-10

- Established the conceptual model, controlled vocabulary, URI policy, semantic guardrails, and competency-question contract.
