# Korean Elementary Learning Map Redesign Plan

## Purpose

Korean Elementary Learning Map(한국 초등 학습지도)은 **Marble Skill Taxonomy**의 그래프 데이터 패턴을 바탕으로, 대한민국 2022 개정 초등 교육과정에 맞게 다시 설계한 Korea-first 학습 그래프다. 기존 영어권 분류체계를 번역한 것이 아니며, 교과 구조·학년군·영역·예시·선수 관계를 한국 초등학교 맥락에서 구성한다.

이 프로젝트는 교육부·국가교육위원회·NCIC의 공식 간행물 또는 승인 제품이 아니다.

## Current v0.4 Scope

현재 통합 workstream 후보는 다음 범위를 가진다.

| Curriculum id | 한국 교과 | Standards | Topics |
| --- | --- | ---: | ---: |
| `kr-2022-elem-korean` | 국어 | 87 | 348 |
| `kr-2022-elem-math` | 수학 | 121 | 363 |
| `kr-2022-elem-science` | 과학 | 102 | 306 |
| `kr-2022-elem-social-studies` | 사회 | 49 | 147 |
| `kr-2022-elem-english-efl` | 영어(EFL) | 40 | 120 |
| `kr-2022-elem-moral` | 도덕 | 24 | 120 |
| `kr-2022-elem-practical-arts` | 실과(기술·가정)/정보 | 39 | 78 |
| `kr-2022-elem-integrated` | 통합교과 | 57 | 171 |
| `kr-2022-elem-art` | 미술 | 26 | 78 |
| `kr-2022-elem-music` | 음악 | 26 | 78 |
| `kr-2022-elem-physical-education` | 체육 | 49 | 147 |
| **합계** |  | **620** | **1,956** |

추가로 선수 관계 1,894개와 클러스터 153개를 수록한다.

## Design Principles

- 국어는 한글 문해, 한국어 담화·문법·문학·매체를 중심으로 구성한다.
- 영어는 한국 학습자를 위한 EFL로 모델링하고 native ELA 전제를 사용하지 않는다.
- 사회는 한국의 지역·지리·역사·민주 시민 맥락을 기본값으로 삼는다.
- 도덕, 실과/정보, 통합교과를 독립적인 한국 교육과정 구조로 보존한다.
- 미술·음악·체육은 공식 3–6학년 성취기준을 따르고 1–2학년의 합성 독립 코드를 만들지 않는다.
- 선수 관계는 workstream에서 제안된 검토 가능한 교과 내부 간선만 통합하며 합성 교과 간 간선을 만들지 않는다.

## Source Posture

주요 공식 출처는 교육부 고시·교과별 별책과 NCIC 배포 자료다.

- NCIC: https://ncic.re.kr/
- NCIC 국내 교육과정 자료: https://ncic.re.kr/inv/org/list.do
- NCIC 저작권 정책: https://ncic.re.kr/mbr/policy.do
- 교육부: https://www.moe.go.kr/

공식 성취기준 원문은 대량 재수록하지 않는다. 각 소스와 성취기준은 직접 URL, 접근일, 첨부 번호, SHA-256, 페이지와 검증 상태를 기록한다. `official-source-checked`는 코드와 위치 검토 상태이지 공식 승인이나 재사용 허락이 아니다.

공식 PDF의 저작물 단위 공공누리(KOGL) 및 상업적 이용 조건은 확인되지 않았으므로 재배포·상업적 이용은 **HOLD**다. 자세한 내용은 `PROVENANCE.md`를 따른다.

## Deliverables

- `data/kr/curriculum-standards.json`
- `data/kr/topics.json`
- `data/kr/dependencies.json`
- `data/kr/clusters.json`
- `data/kr/manifest.json`
- `data/kr/workstreams/*.json`
- `data/kr/*.seed.json`
- `schema/kr-*.schema.json`
- KR 빌드·검증·품질 점검 스크립트와 테스트

## Remaining Work

- 교과 전문가와 현장 교사의 주제 분해·평가 문항 검토
- 선수 관계의 교육학적 검토 및 승격 기준 수립
- 한국 지역·역사·시민성·교실 EFL 예시 은행 구축
- 공식 PDF별 공공누리/상업 재사용 조건 확인
