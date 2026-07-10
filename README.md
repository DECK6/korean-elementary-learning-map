# 한국 초등 학습지도

**Korean Elementary Learning Map**은 대한민국 **2022 개정 초등 교육과정**에 맞춰 구성한 한국어 학습 그래프 데이터셋입니다. 성취기준 코드, 세부 학습 주제, 선수 관계, 영역별 클러스터를 연결해 수업·학습 설계와 탐색에 활용할 수 있도록 합니다.

> [!IMPORTANT]
> 이 프로젝트는 [`withmarbleapp/os-taxonomy`](https://github.com/withmarbleapp/os-taxonomy)의 **Marble Skill Taxonomy**가 보여 준 학습 그래프 접근에서 영감을 받았습니다. 한국 교육과정 레코드, 교과 모델, 620개 성취기준 매핑, 1,956개 주제, 1,894개 간선, 생성기, 검증기와 감사 기록은 독립적으로 구축했습니다. Marble의 번역본이나 공식 파생 프로젝트가 아니며, 교육부·국가교육위원회·국가교육과정정보센터(NCIC)의 공식 간행물도 아닙니다.

저장소: https://github.com/DECK6/korean-elementary-learning-map

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

## 온톨로지 상태

현재 상태는 **P1 / machine-readable ontology(기계 판독형 온톨로지)**입니다. [`ontology/`](ontology/)에 OWL/Turtle TBox, JSON-LD 컨텍스트, SHACL 제약 계약, 릴리스 메타데이터를 두고, 정규 한국어 JSON 데이터에서 결정적으로 생성한 JSON-LD·Turtle ABox를 [`dist/ontology/`](dist/ontology/)에 추적합니다.

P1은 다음을 제공합니다.

- 직접 선수 추천 `directRequires`, 다단계 파생 관계 `indirectRequires`, 파생 역관계 `unlocks`를 구분합니다. 직접 관계는 모든 학습자에게 적용되는 보편 법칙이나 전이 속성이 아닙니다.
- `hard`/`soft`는 원값을 보존하면서 모델 내부의 `required`/`recommended` 추천 강도로 정규화합니다.
- 선수 관계와 성취기준-주제 정렬은 각각 `PrerequisiteAssertion`, `StandardTopicAlignment`로 강도·이유·근거·출처·정렬 역할·신뢰도 같은 한정자를 보존합니다.
- 11개 교육과정, 620개 성취기준, 1,956개 주제, 1,894개 선수 주장, 1,956개 성취기준 정렬, 153개 클러스터, 43개 커버리지 갭을 포함해 총 20,444개 인스턴스 리소스를 내보냅니다.
- 생성 산출물의 바이트 수·SHA-256·레코드/리소스 개수를 [`dist/ontology/manifest.json`](dist/ontology/manifest.json)에 고정하고, 재생성 결과와 추적 파일의 바이트 일치를 검사합니다.
- 43개 데이터 커버리지 갭, P1 형식 상태, 공식 출처 권리 `HOLD`를 서로 다른 메타데이터 축으로 유지합니다.

P2 추론·질의 게이트는 아직 포함하지 않습니다. 현재 SHACL 파일은 제약 계약이며, 표준 RDF 파서·SHACL 엔진·OWL 추론기·SPARQL 역량 질문 실행과 `unlocks`/`indirectRequires` 물질화는 다음 단계입니다. 시작점과 정확한 P1/P2 경계는 [`ontology/README.md`](ontology/README.md)를 참고하세요.

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
npm run check:content
```

공식 출처 URL의 실시간 접근 상태는 네트워크 환경에 따라 달라질 수 있으므로 별도로 확인합니다.

```bash
npm run check:links
```

KR 별칭(`build:kr`, `test:kr`, `validate:kr`, `check:kr:content`, `check:kr:links`)도 유지됩니다.

## 데이터 해석 시 주의

- `official-source-checked`는 성취기준 **코드와 출처 위치**를 검토했다는 뜻입니다. 공식 문구를 수록했다거나 수업 내용이 전문가 승인을 받았다는 뜻이 아닙니다.
- 공식 성취기준 원문은 대량 재수록하지 않습니다. 데이터에는 코드, 출처 위치, 저장소 작성 요약·주제·증거·평가 질문이 들어 있습니다.
- 현재 데이터는 통합 workstream 후보입니다. 교과 전문가·교실 현장 검토가 더 필요합니다.
- 이 저장소는 교육부 또는 NCIC의 승인·후원·공식 지위를 주장하지 않습니다.

## 출처와 라이선스

한국 데이터셋은 독립적으로 구축했습니다. Marble에서 재사용하거나 개작한 구조 요소가 있는 범위에 한해 다음 업스트림 표시와 라이선스 의무를 보존합니다.

- 재사용·개작한 데이터베이스 구조 요소: [`LICENSE`](LICENSE)의 **ODbL 1.0**(표시 및 동일조건변경허락 포함)
- 재사용한 업스트림 저작 콘텐츠와 그 개작물: [`LICENSE-CONTENT`](LICENSE-CONTENT)의 **CC BY-SA 4.0**(표시 및 동일조건변경허락 포함)
- 업스트림 표시와 프로젝트 관계 고지: [`NOTICE.md`](NOTICE.md)
- 세부 출처와 권리 상태: [`PROVENANCE.md`](PROVENANCE.md)

### 한국 공식 자료 재사용 HOLD

교육부/NCIC 공식 PDF에 대해서는 개별 저작물의 공공누리(KOGL) 표시, 상업적 이용 허용 또는 이에 준하는 허락 증거가 이 저장소에 기록되어 있지 않습니다. 따라서 **공식 PDF 및 그 출처에 의존한 기록의 일반 재배포·상업적 이용은 HOLD**입니다. 패키지 수준의 ODbL/CC BY-SA가 해당 공식 자료의 권리를 대신 부여하지 않습니다. 사용 전 개별 저작물의 조건을 확인하거나 필요한 허락을 받으세요. 이는 법률 자문이 아닙니다.

업스트림 표시 문구와 한국 공식 자료별 출처 의무는 [`NOTICE.md`](NOTICE.md)와 [`PROVENANCE.md`](PROVENANCE.md)에 있습니다.
