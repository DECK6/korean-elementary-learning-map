# Ontology P3 release report

## Decision

The tracked `0.4.0` artifacts qualify for the formal label **Korean Elementary Curriculum Learning Ontology** after all seven release gates passed. The label describes this repository's independently built data, model, and validation pipeline. It is not an MOE, National Education Commission, or NCIC official ontology, and it does not support individual learner diagnosis.

## Release identity and status

| Field | Evidence |
| --- | --- |
| Stable ontology IRI | `https://dexa.art/learnmap/ontology` |
| Version IRI | `https://dexa.art/learnmap/ontology/0.4.0` |
| Prior version | `https://dexa.art/learnmap/ontology/0.3.0-p3` |
| Dataset release | `kr-full-depth-v0.5` |
| Automated review | PASS — seven gates below |
| External domain review | Ongoing |
| Official status | Independent, non-official |
| Learner diagnosis | Not supported |
| Official-source rights | `cleared`; state-published public government documents |
| Cited notice editions | Current NCIC editions; 통합교과 = 2026-1 [별책 15] (10004214), 음악 = 2024-3 [별책 12] (10003999), 실과 = [별책 10] (10004244). See `docs/source-version-matrix.md` |
| Official text | Excluded |

## Seven-gate evidence

The evidence below is local tracked-artifact verification. The repository also includes `.github/workflows/ontology-release.yml` to run the same gates in future GitHub Actions executions, but this report does not claim a CI run has completed.

Verification was run with Node `20.11.1`-compatible tooling and the local `.venv-ontology` environment using the exact pins in `requirements-ontology.txt`. The GitHub Actions workflow creates its pinned Python environment under `$RUNNER_TEMP`.

| Gate | Command(s) | Result |
| ---: | --- | --- |
| G1 | `npm run build` | PASS — 11 curricula, 620 standards, 1,956 topics, 416 official + 1,875 candidate relations, 152 clusters |
| G2 | `npm test` | PASS — 93/93 Node regression, relation-layer contract, ontology-governance, artifact, and CI-contract tests |
| G3 | `npm run validate` | PASS — schema, official inventory, source locator, DAG, reference, and data-manifest checks |
| G4 | `npm run check:content` | PASS — all reported final/workstream defect metrics were zero |
| G5 | `npm run validate:ontology` | PASS — complete controlled vocabulary and P3 release metadata |
| G6 | `npm run check:ontology:artifacts` and `npm run check:ontology:release` | PASS — tracked generated files were byte-current and all release-file SHA-256 values matched |
| G7 | local `.venv-ontology`: `scripts/validate-ontology.py` and `python -m unittest discover tests -p 'test_ontology_p2.py'` | PASS — Python `3.14.7`; rdflib `7.1.4`, pyshacl `0.30.1`, owlrl `7.1.4`; 5/5 Python tests; 0 full-data SHACL violations; bounded OWL-RL pass; 18/18 competency queries; 10/10 adversarial fixtures rejected as expected |

## Exact graph evidence

The deterministic graph contains 22,817 instance resources and 256,786 locally verified triples in each isomorphic JSON-LD and Turtle serialization. Snapshot counts are 11 curricula, 620 standards, 1,956 topics, 2,291 prerequisite assertions (416 official, 1,875 pedagogical-candidate), 1,956 standard-topic alignments, 152 clusters, and 46 retained coverage gaps. Only the official layer materializes binary prerequisite views: 416 `directRequires`, 416 `unlocks`, 97 `indirectRequires`, and 1,956 `alignedToStandard` pairs. The bounded OWL-RL check expanded 1,160 input triples to a 3,398-triple closure with no explicit contradiction or unsatisfiable named class.

## What 0.4.0 adds over 0.3.0-p3

- **Two-layer relations.** Prerequisite assertions carry `lm:assertionLayer`, `lm:relationKind`, `lm:basisKind`, `lm:scope`, and `lm:reviewStatus`. Only the official layer materializes `directRequires`, `unlocks`, and `indirectRequires`; the pedagogical-candidate layer exists as `PrerequisiteAssertion` records only.
- **Official relations mined across all eleven subjects.** 416 official edges, each backed by a content-system grade progression or an explicit sentence in an achievement-standard commentary, with a printed-page locator.
- **Re-pinned notice editions.** 통합교과 follows the 2026-1 partial revision ([별책 15], attachment 10004214) as a single edition; 음악 and 실과 follow their current attachments. Twelve 즐거운 생활 codes keep their identifier while the achievement standard behind it was replaced, which is recorded in `ontology/CHANGELOG.md` under Compatibility.
- **Topic content overlay.** Topics carry `core:contentKind`; 363 mathematics topics are authored `source-grounded-draft` records with `core:misconception` literals and a `core:contentSourceLocator`, and SHACL rejects a draft without that locator.
- **Achievement-standard summaries are authored paraphrases.** All 620 standards carry `summaryKind: source-grounded-paraphrase`. The repository stores no official standard sentence; the longest run any summary shares with the governing text is 15 characters, checked at authoring time by `scripts/dev/check-standard-summary-verbatim.mjs` against an extracted text file kept outside the repository.
- **Shared K-12 core TBox.** `ontology/k12-core.ttl` is imported by the repository TBox and kept byte-identical with `korean-secondary-learning-map`. No `lm:` IRI was reminted; the two vocabularies are joined by `owl:equivalentClass`, `owl:equivalentProperty`, and `skos:exactMatch`. Competency query `cq-18-k12-core-vocabulary.rq` is byte-identical to the secondary repository's `scq-21-k12-core-vocabulary.rq`.

The exact byte sizes and SHA-256 values for every ontology source, query, fixture, generated reference, ABox serialization, core manifest, validation report, and this report are recorded in `dist/ontology/release-manifest.json`. The manifest is generated without wall-clock or machine-path input, avoids self-hash recursion by excluding itself from the file inventory, and is checked byte-for-byte by G6.

## Provenance and limits

The learning-graph approach was inspired by `withmarbleapp/os-taxonomy` / Marble Skill Taxonomy. The Korean curriculum records, subject model, 620-standard mapping, 1,956 topics, 416 official and 1,875 candidate edges, ontology conversion, generators, validators, and audit evidence were built independently. The release is not a Marble translation or official derivative.

Coverage, format validation, review, and rights are separate axes. Passing the formal gates does not by itself determine the official-source rights status, imply official endorsement, convert suggested prerequisite relations into universal learning laws, or authorize learner diagnosis.

Generated RDF runtime artifacts exclude official source text and public official-source URLs. They retain repository-local source identifiers, source locators, hashes, rights status, and verification records.
