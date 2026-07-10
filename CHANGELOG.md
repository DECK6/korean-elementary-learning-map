# 변경 기록

이 저장소는 한국 초등 학습지도 데이터셋의 변경 사항을 기록합니다.

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

- `withmarbleapp/os-taxonomy`의 전체 다중 교육과정 저장소에서 한국 구현만 추출
- 새 프로젝트명 **한국 초등 학습지도 / Korean Elementary Learning Map** 적용
- 패키지명과 스키마 식별자를 `korean-elementary-learning-map`으로 변경
- 업스트림 표시와 ODbL 1.0 / CC BY-SA 4.0 의무 보존
- 한국 2022 개정 교육과정에 맞춘 Korea-first 파생 그래프이며 공식 교육부/NCIC 간행물이나 번역 전용 포크가 아님을 명시

### 제외

- 루트의 일반/비한국 데이터 파일
- 비한국 JSON Schema
- 미디어 파일
- 업스트림의 일반 README, CITATION, CHANGELOG, PROVENANCE 및 기존 감사 보고서
- 업스트림의 일반 `scripts/validate.mjs`

### 권리 주의

한국 교육부/NCIC 공식 PDF의 저작물 단위 공공누리(KOGL) 및 상업적 재사용 조건은 확인되지 않아 HOLD를 유지합니다. 자세한 내용은 `PROVENANCE.md`를 참고하세요.
