# Korean Curriculum Mapping Method

## Scope

This method governs staged mapping from Korea's 2022 revised elementary curriculum into Korean Elementary Learning Map records. The public curriculum documents are the governing source; the seed records provenance and verification status so staged work is honest about what has and has not been checked.

## General Record Rules

Each standard anchor should include:

- `key`: `<curriculum-id>:<achievement-standard-code>`.
- `code`: Korean achievement-standard code such as `[2국02-01]` or `[4영01-01]`.
- `gradeBand`: `1-2`, `3-4`, or `5-6`.
- `subject` / `subjectKorean`.
- `domain` / `domainKorean`.
- `summary`: concise original summary or source-derived paraphrase.
- `sourceRefs`: official public source references.
- Every source record must use `id`, `name`, `url`, `accessDate`, `usage`, and `sourceType`. A governing PDF record must retain its reviewed subject code, attachment number, SHA-256, byte size, and page count.
- `verificationStatus`: `official-source-checked`, `public-doc-derived`, or `needs-official-code-check`.
- `sourceBasis`: one-sentence explanation of how the anchor was derived.

Use `official-source-checked` only when the code belongs to the reviewed official attachment inventory, the record cites that direct PDF, and item-level locator evidence identifies the code. Use `needs-official-code-check` when the subject/domain shape is reliable but exact code verification is pending. Neither status grants reuse rights.

## Subject-specific Rules

### 국어

Do not treat Korean Language as English Language Arts translated into Korean. Model:

- Hangul decoding, syllable blocks, sound-letter correspondence.
- Korean vocabulary, sentence awareness, and grammar.
- Listening/speaking discourse routines in Korean classrooms.
- Reading fluency and meaning-making in Korean texts.
- Writing for Korean audiences and genres.
- Literature response and media literacy.

### 영어 / EFL

Elementary English is an EFL curriculum for Korean learners. Do not use native-speaker ELA assumptions. Model:

- Oral exposure before heavy print production.
- English sound recognition under Korean phonological transfer constraints.
- Classroom greetings, formulaic chunks, and simple interaction.
- Alphabet/phonics as foreign-language literacy.
- Listening and speaking confidence before extended reading/writing.
- Grade 5–6 information exchange, short reading, and short writing.

### 수학

Use Korean 2022 elementary sequencing and domains. Anchors should reflect:

- 수와 연산.
- 변화와 관계.
- 도형과 측정.
- 자료와 가능성.
- Grade-band progression from concrete representation to symbolic/general reasoning.

### 과학

Use Korean elementary science as inquiry plus domains. Anchors should reflect:

- Observation, classification, measurement, communication, and model use.
- 운동과 에너지.
- 물질.
- 생명.
- 지구와 우주.
- Investigation evidence rather than vocabulary memorization alone.

### 사회 / 역사 / 지리 / 시민성

Do not reuse US/UK history as the default. Korean social studies should begin from:

- Local community, maps, places, and regions of Korea.
- Changes in local life and Korean historical time.
- Korean geography and regional diversity.
- Democratic participation, public institutions, rights and responsibilities.
- Korean culture, economy, and civic life.

### 도덕

Model moral education around:

- Self-understanding and moral agency.
- Empathy, relationships, and respectful communication.
- Fairness, responsibility, community life.
- Peace, ecological responsibility, and coexistence.

### 실과 / 정보

Model practical arts as Korean elementary life-and-technology learning:

- Self-care, growth, family and household participation.
- Resource use and practical problem solving.
- Making, technology, and tool use.
- Digital/information problem solving at the elementary level.

### 통합교과

Model grades 1–2 integrated subjects as first-school-life anchors:

- 바른 생활: habits, routines, safe participation.
- 슬기로운 생활: inquiry into self, school, community, seasons.
- 즐거운 생활: expression, play, cooperation, arts-integrated experience.
- 건강한 생활: use only the nine current `[2건..]` codes and locations in the accessible 2026 amended Annex 15; do not backfill invented health codes into the base document.

## Mapping Rules

`standardMappings` connect achievement-standard anchors to micro-topics:

- `standardKey` must resolve to a standard.
- `microTopicId` must resolve to a micro-topic.
- `relationship` should be one of `introduces`, `supports`, `extends`, `assesses`.
- `confidence` should remain `seed` until a reviewer checks the mapping.
- `note` should explain why the mapping exists.

## Expansion Workflow

1. Source official curriculum PDF/NCIC record.
2. Extract subject/domain/grade-band/code inventory.
3. Create or update standards with provenance and verification status.
4. Decompose each standard into teachable micro-topics.
5. Review Korean subject fit; reject imported English/US/UK assumptions.
6. Keep dependency edges within a subject unless a separately reviewed policy explicitly replaces `crossSubjectEdges: "none"`; the integration builder must not synthesize cross-subject edges.
7. Run `npm run build` to regenerate the integrated files and `data/kr/manifest.json`.
8. Run `npm run validate` and `npm test` in this standalone Korean repository.

## Full-Depth v0.4 Integration

Subject workstream artifacts under `data/kr/workstreams/*.json` are merged by `npm run build:kr`. The builder writes full-depth repository-level files:

- `data/kr/curriculum-standards.json`
- `data/kr/topics.json`
- `data/kr/dependencies.json`
- `data/kr/clusters.json`
- `data/kr/manifest.json`

The integrated files preserve record-level provenance and verification status. The integration builder publishes only workstream-authored dependency suggestions whose endpoints resolve. It does not add deterministic padding or synthetic cross-subject edges.

## Expanded v0.3 Seed Validation

The v0.3 validator checks `curriculum-standards.seed.json`, `topics.seed.json`, `dependencies.seed.json`, `clusters.seed.json`, and `manifest.json` together. It verifies counts, standard keys, topic references, dependency endpoints, cluster topic lists, provenance fields, and SHA-256 checksums.

The current `npm run validate` target (also available as `npm run validate:kr`) validates the v0.4 full-depth files against Draft 2020-12 schemas; exact curriculum counts and code-inventory digests; direct PDF identities and fingerprints; per-standard status, source reference, and locator gates; DAG and no-cross-subject-edge rules; content-quality checks; and manifest checksums. The manifest also protects the historical seed and workstream artifacts. Live URL reachability remains a separate `npm run check:links` check.
