# KR Full-Depth Integration Report

Generated from `data/kr/workstreams/*.json` by `npm run build`.

## Coverage

| Subject | Standards | Topics |
| --- | ---: | ---: |
| 국어 | 87 | 348 |
| 수학 | 121 | 363 |
| 과학 | 102 | 306 |
| 사회 | 49 | 147 |
| 영어 EFL | 40 | 120 |
| 도덕 | 24 | 120 |
| 실과(기술·가정)/정보 | 39 | 78 |
| 통합교과 | 57 | 171 |
| 미술 | 26 | 78 |
| 음악 | 26 | 78 |
| 체육 | 49 | 147 |
| **Total** | **620** | **1956** |

The integrated KR files meet the topic-depth target and publish only reviewed dependency suggestions:

- `data/kr/curriculum-standards.json`: 11 curricula, 620 achievement-standard anchors, 1956 standard-to-topic mappings, 16 normalized sources, and 46 documented coverage gaps.
- `data/kr/topics.json`: 1956 KR micro-topics. Every topic has `evidence[]`, `assessmentPrompt`, Korean subject metadata, grade-band context, and standard references.
- `data/kr/dependencies.json`: 416 official-source dependency edges; `data/kr/dependencies.candidate.json` carries the 1877 pedagogical-candidate edges. Each layer is a DAG, their union is a DAG, there are zero reciprocal pairs and no target-padding or deterministic integration-builder edges, and the `crossSubjectEdges: "none"` policy is explicit.
- `data/kr/clusters.json`: 152 clusters. Each cluster includes `summary` and `parentSummary` for parent-facing explanations.
- `data/kr/manifest.json`: SHA-256 and byte counts for every KR JSON data file except the manifest itself, including generated full files, seed files, and workstream artifacts.

Cluster coverage is explicitly `at-least-one`; multiple pedagogical memberships are allowed. Source records use normalized `id`, `name`, `url`, `accessDate`, `usage`, and `sourceType` fields. Governing PDF records also carry the reviewed subject code, attachment number, SHA-256, byte size, and page count. Offline validation checks schema conformance, URL syntax, repository-local file existence, exact per-curriculum code-inventory digests, direct source references, item-level locators, source fingerprints, and status consistency without making deterministic builds depend on the network.

## Source Posture

The integration preserves record-level verification status:

- `official-source-checked`: the achievement-standard code belongs to the reviewed official attachment inventory, cites the direct governing PDF, and retains item-level locator evidence. It does not mean that verbatim wording is shipped, that classroom content has been expert-approved, or that reuse rights are cleared.
- `public-doc-derived`: record is derived from the public curriculum source posture but remains less direct than line-level official verification.
- `needs-official-code-check`: candidate records are useful for graph depth but must be reconciled with exact official code/text before final canonical release.

Official standard text is not reproduced. Records store codes, source references, repository-authored or source-derived paraphrases, evidence notes, and assessment prompts. The cited Korean curriculum documents are state-published public materials openly available from their original sources; the KR layer records this cleared reuse status as documented in `PROVENANCE.md`.

## Subject Rules

- English remains Korean learner EFL: `subject` is `English as a Foreign Language`, and the KR validator rejects native ELA framing.
- Social studies is rebuilt from the 49 elementary codes in official Annex 7 and remains Korea-centered; validator checks for obvious US/UK default framing in social topic text.
- Art, music, and PE use the direct Annex 13, 12, and 11 inventories. Standalone grade 1–2 synthetic subject codes are excluded; relevant early arts and movement learning remains in integrated subjects.
- Integrated subjects include the nine current `[2건..]` Healthy Life standards from the accessible 2026 amended Annex 15, alongside the 48 base 바른 생활/슬기로운 생활/즐거운 생활 codes.
- Practical Arts/Informatics replaces the old seed posture with 39 official-source-grounded standards across five domains, including digital society and AI.

## Remaining Gaps

The merged file records 43 coverage gaps:

| Area | Gap Count |
| --- | ---: |
| 미술·음악·체육 | 3 |
| 영어 | 7 |
| 통합교과 | 4 |
| 국어 | 4 |
| 수학 | 5 |
| 도덕 | 7 |
| 실과(기술·가정)/정보 | 4 |
| 과학 | 6 |
| 사회 | 3 |

High-value follow-up work:

- Add teacher-reviewed rubrics and level descriptors beyond the current assessment prompts.
- Continue subject-expert review of workstream-authored dependency edges before promoting the candidate graph to canonical status.
- Build reviewed example banks for Korean local community, Korean history/civics/culture, and Korean classroom EFL contexts.
- Resolve work-level KOGL/permission and commercial-use terms before treating the KR layer as redistribution-ready.

## Validation

Required commands:

```sh
npm run build
npm test
npm run validate
npm run check:content
```

Optional live source-link check (kept separate from deterministic validation):

```sh
npm run check:links
```

Current green result:

```text
✓ KR full-depth data valid - 11 curricula, 620 standards, 1956 topics, 416 official + 1877 candidate relations, 152 clusters. Checksums OK.
✓ KR content quality gates passed.
```
