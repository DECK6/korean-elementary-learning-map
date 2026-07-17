# 한국 초등 교육과정 학습 온톨로지

**Korean Elementary Curriculum Learning Ontology**는 대한민국 **2022 개정 초등 교육과정**을 대상으로 독립 구축한 한국어 학습 그래프 데이터·모델·검증 파이프라인의 공식 저장소 릴리스 명칭입니다. 성취기준 코드, 세부 학습 주제, 모델 상대적인 선수 추천, 영역별 클러스터를 연결해 수업·학습 설계와 탐색에 활용할 수 있도록 합니다.

> [!IMPORTANT]
> 이 프로젝트는 [`withmarbleapp/os-taxonomy`](https://github.com/withmarbleapp/os-taxonomy)의 **Marble Skill Taxonomy**가 보여 준 학습 그래프 접근에서 영감을 받았습니다. 한국 교육과정 레코드, 교과 모델, 620개 성취기준 매핑, 1,956개 주제, 1,894개 간선, 온톨로지 변환, 생성기, 검증기와 감사 기록은 독립적으로 구축했습니다. Marble의 번역본이나 공식 파생 프로젝트가 아니며, 교육부·국가교육위원회·국가교육과정정보센터(NCIC)의 공식 온톨로지·간행물·승인 제품도 아닙니다. 이 모델은 개별 학습자를 진단하지 않습니다.

저장소: https://github.com/DECK6/korean-elementary-learning-map

학부모용 탐색 화면: https://dexa.art/learnmap/

## 현재 범위

현재 `kr-full-depth-v0.4` 후보 데이터에는 다음이 포함됩니다.

| 항목 | 수량 |
| --- | ---: |
| 교육과정 영역(curricula) | **11** |
| 성취기준 앵커 | **620** |
| 세부 학습 주제 | **1,956** |
| 선수 관계 | **1,894** |
| 클러스터 | **153** |

대상 교과·영역은 국어, 수학, 과학, 사회, 영어(EFL), 도덕, 실과(기술·가정)/정보, 통합교과, 미술, 음악, 체육입니다. 선수 관계 그래프는 DAG이며, 현재 정책상 교과 간 합성 연결을 만들지 않습니다.

## 공식 온톨로지 릴리스

현재 상태는 **P3 / Korean Elementary Curriculum Learning Ontology `0.3.0-p3` formal release**입니다. 이 명칭은 아래 일곱 자동 게이트가 모두 통과한 저장소 모델과 산출물을 가리킵니다. 외부 교과·교육과정·수업 전문가 검토는 계속 진행 중이며, 공식 승인이나 권리 허가를 뜻하지 않습니다. `owl:priorVersion`은 `0.2.0-p2`를 가리키고, 데이터 릴리스 `kr-full-depth-v0.4`는 온톨로지 버전과 독립적으로 유지됩니다.

P3 릴리스는 다음을 제공합니다.

- 직접 선수 추천 `directRequires`, 다단계 파생 관계 `indirectRequires`, 파생 역관계 `unlocks`를 구분합니다. 직접 관계는 모든 학습자에게 적용되는 보편 법칙이나 전이 속성이 아닙니다.
- `hard`/`soft`는 원값을 보존하면서 모델 내부의 `required`/`recommended` 추천 강도로 정규화합니다.
- 선수 관계와 성취기준-주제 정렬은 각각 `PrerequisiteAssertion`, `StandardTopicAlignment`로 강도·이유·근거·출처·정렬 역할·신뢰도 같은 한정자를 보존합니다.
- 11개 교육과정, 620개 성취기준, 1,956개 주제, 1,894개 선수 주장, 1,956개 성취기준 정렬, 153개 클러스터, 43개 커버리지 갭을 포함해 총 20,446개 인스턴스 리소스와 검증된 249,461개 RDF 트리플을 내보냅니다.
- `unlocks` 1,894개는 `directRequires`의 정확한 역관계로 물질화하고, `indirectRequires` 53,656개는 길이 2 이상의 비직접 경로로만 물질화합니다.
- OWL/Turtle TBox, 로컬 JSON-LD 컨텍스트, SHACL Advanced 제약, SPARQL 역량 질문 15개, 양성 fixture와 적대 fixture 9개를 제공합니다.
- 결정적으로 생성한 JSON-LD·Turtle ABox와 코어 개수·관계 해시는 [`dist/ontology/manifest.json`](dist/ontology/manifest.json)에 기록합니다.
- 전체 공개 온톨로지 파일의 바이트 수·SHA-256, 자동 검토 상태, 외부 검토 상태, 권리 상태는 [`dist/ontology/release-manifest.json`](dist/ontology/release-manifest.json)에 분리해 기록합니다.
- 표준 RDF 파서, SHACL Advanced SPARQL 제약, bounded OWL-RL 확인, SPARQL 역량 질문, 적대 fixture 결과를 [`dist/ontology/validation-report.json`](dist/ontology/validation-report.json)에 결정적으로 기록합니다.
- [`ontology/governance.md`](ontology/governance.md), [`ontology/deprecation-policy.md`](ontology/deprecation-policy.md), [`ontology/replacements.json`](ontology/replacements.json), [`ontology/CHANGELOG.md`](ontology/CHANGELOG.md)는 버전·폐기·대체 정책과 변경 이력을 정의하며, [`docs/ontology-reference.md`](docs/ontology-reference.md)는 통제 어휘에서 자동 생성됩니다.
- 43개 데이터 커버리지 갭, P3 형식/자동 검토 상태, 진행 중인 외부 검토, 공식 출처 권리 상태 `공개 공식 자료(cleared)`를 서로 다른 메타데이터 축으로 유지합니다.

이 저장소는 공개 SPARQL 엔드포인트를 제공하지 않습니다. [`ontology/queries/`](ontology/queries/)의 질의는 로컬 검증 게이트에서 실행되는 역량 질문이며, 선수 관계는 이 릴리스 모델의 추천 구조이지 보편적인 학습 순서 주장이 아닙니다.

### 릴리스 산출물

| 경로 | 내용 |
| --- | --- |
| [`ontology/learning-map.ttl`](ontology/learning-map.ttl) | 정적 OWL/Turtle TBox와 통제 개념 |
| [`ontology/context.jsonld`](ontology/context.jsonld), [`ontology/shapes.ttl`](ontology/shapes.ttl), [`ontology/metadata.ttl`](ontology/metadata.ttl) | JSON-LD 컨텍스트, 실행 SHACL, 버전·검토·권리 메타데이터 |
| [`dist/ontology/learning-map.jsonld`](dist/ontology/learning-map.jsonld), [`dist/ontology/learning-map.ttl`](dist/ontology/learning-map.ttl) | 20,446개 인스턴스 리소스의 결정적 ABox |
| [`docs/ontology-reference.md`](docs/ontology-reference.md) | 클래스·속성·개념·수명주기 자동 생성 참조문서 |
| [`docs/ontology-release-report.md`](docs/ontology-release-report.md) | 일곱 게이트의 명령·도구·개수·한계 증거 |
| [`dist/ontology/release-manifest.json`](dist/ontology/release-manifest.json) | 전체 릴리스 파일의 결정적 바이트 수와 SHA-256 |

## 데이터 파일

모든 데이터는 UTF-8 JSON이며, 한국 데이터 경로인 `data/kr/`을 유지합니다.

| 경로 | 내용 |
| --- | --- |
| [`data/kr/curriculum-standards.json`](data/kr/curriculum-standards.json) | 11개 교육과정, 620개 성취기준 코드 앵커, 출처·매핑·검증 상태 |
| [`data/kr/topics.json`](data/kr/topics.json) | 1,956개 세부 학습 주제와 관찰 가능한 증거·평가 질문 |
| [`data/kr/dependencies.json`](data/kr/dependencies.json) | 1,894개 선수 관계와 근거 |
| [`data/kr/clusters.json`](data/kr/clusters.json) | 153개 학습 클러스터와 학부모용 요약 |
| [`data/kr/manifest.json`](data/kr/manifest.json) | 개수, 정책, 파일별 바이트 수와 SHA-256 |
| [`data/kr/workstreams/`](data/kr/workstreams/) | 교과별 생성·통합 입력 산출물 |
| `data/kr/*.seed.json` | 이전 단계의 후보 시드 기록 |
| [`schema/`](schema/) | 최종 KR 데이터용 JSON Schema 4종 |

출처·매핑 방법은 [`PROVENANCE.md`](PROVENANCE.md), [`docs/kr-curriculum-mapping-method.md`](docs/kr-curriculum-mapping-method.md), [`docs/kr-full-depth-integration-report.md`](docs/kr-full-depth-integration-report.md)를 참고하세요.

## 사용 예

```js
import topicsFile from './data/kr/topics.json' with { type: 'json' };
import dependenciesFile from './data/kr/dependencies.json' with { type: 'json' };

const byId = new Map(topicsFile.topics.map((topic) => [topic.id, topic]));
const prerequisitesOf = (topicId) =>
  dependenciesFile.dependencies
    .filter((edge) => edge.topicId === topicId)
    .map((edge) => ({
      topic: byId.get(edge.prerequisiteId),
      strength: edge.strength,
      reason: edge.reason,
    }));
```

## 설치·빌드·검증

Node.js와 npm이 필요합니다.

```bash
npm ci
npm run build
npm run build:ontology
npm test
npm run validate
npm run validate:ontology
npm run check:ontology:artifacts
npm run check:ontology:release
npm run check:content
```

공식 릴리스 판정은 여섯 Node 게이트와 한 Python 표준 게이트로 구성됩니다.

| 게이트 | 검증 |
| ---: | --- |
| G1 | `npm run build` — 정규 데이터 재생성 |
| G2 | `npm test` — Node 회귀·온톨로지 거버넌스 테스트 |
| G3 | `npm run validate` — 스키마·인벤토리·출처·DAG·데이터 해시 |
| G4 | `npm run check:content` — 최종/workstream 콘텐츠 품질 |
| G5 | `npm run validate:ontology` — 통제 어휘·P3 메타데이터 계약 |
| G6 | `npm run check:ontology:artifacts`와 `npm run check:ontology:release` — 결정성·파일 해시 |
| G7 | 고정 Python 도구의 RDF 파싱·SHACL·OWL-RL·SPARQL·fixture 검증 |

Node 게이트는 한 명령으로 실행할 수 있습니다.

```bash
npm run verify:formal:node
```

G7은 프로젝트 로컬 Python 가상환경과 고정 버전의 RDF 도구를 사용합니다. 전역 설치는 필요하지 않습니다. GitHub Actions에서는 `$RUNNER_TEMP` 아래 임시 가상환경을 만들고 같은 핀을 사용합니다.

```bash
npm run setup:ontology
npm run validate:ontology:p2
npm run test:ontology:p2
```

전체 일곱 게이트는 다음 별칭으로 실행합니다.

```bash
npm run verify:formal
```

공식 출처 URL의 실시간 접근 상태는 네트워크 환경에 따라 달라질 수 있으므로 별도로 확인합니다.

```bash
npm run check:links
```

KR 별칭(`build:kr`, `test:kr`, `validate:kr`, `check:kr:content`, `check:kr:links`)도 유지됩니다.

## 데이터 해석 시 주의

- `official-source-checked`는 성취기준 **코드와 출처 위치**를 검토했다는 뜻입니다. 공식 문구를 수록했다거나 수업 내용이 전문가 승인을 받았다는 뜻이 아닙니다.
- 공식 성취기준 원문은 대량 재수록하지 않습니다. 데이터에는 코드, 출처 위치, 저장소 작성 요약·주제·증거·평가 질문이 들어 있습니다.
- 생성된 RDF 런타임 산출물에는 공식 성취기준 원문과 공개 공식 출처 URL을 넣지 않습니다.
- 현재 데이터는 통합 workstream 후보입니다. 교과 전문가·교실 현장 검토가 더 필요합니다.
- 이 저장소는 교육부 또는 NCIC의 승인·후원·공식 지위를 주장하지 않으며, 개별 학습자의 수준·장애·치료 필요 등을 진단하지 않습니다.

## 출처와 라이선스

이 저장소는 DECK(github.com/DECK6)이 공개된 대한민국 국가 교육과정 정보를 바탕으로 독립 구축한 원저작물이며, [`LICENSE`](LICENSE)의 **MIT 라이선스**로 배포합니다. Marble Skill Taxonomy는 학습 그래프 접근의 영감을 준 프로젝트로, 그 데이터베이스나 저작 콘텐츠를 복제·개작하지 않았습니다.

- 저작자·영감 표시와 비승인 고지: [`NOTICE.md`](NOTICE.md)
- 세부 출처와 권리 상태: [`PROVENANCE.md`](PROVENANCE.md)

### 한국 공식 자료 재사용 — 공개 공식 자료(cleared)

교육부·국가교육위원회 고시와 별책, NCIC가 배포하는 공식 교육과정 문서는 국가가 공표한 공개 자료로, 누구나 원 출처(교육부·NCIC)에서 이용할 수 있습니다. 따라서 이 저장소는 해당 공식 출처의 권리 상태를 **공개 공식 자료(cleared)**로 기록합니다. 저장소의 **MIT 라이선스**는 저장소가 직접 저작한 산출물(빌드 스크립트, 검증기, 데이터셋, 온톨로지 변환 등)에 적용되며, 인용한 공식 문서 자체는 원 출처의 공공저작물 이용 조건을 따릅니다. 사용 시 원 출처 표시를 유지하세요. 이는 법률 자문이 아닙니다.

업스트림 표시 문구와 한국 공식 자료별 출처 의무는 [`NOTICE.md`](NOTICE.md)와 [`PROVENANCE.md`](PROVENANCE.md)에 있습니다.
