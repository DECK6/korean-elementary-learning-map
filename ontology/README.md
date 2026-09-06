# Korean Elementary Curriculum Learning Ontology — P3

This directory is the governed source contract for the formal **Korean Elementary Curriculum Learning Ontology** `0.4.0` release. It publishes a static OWL/Turtle vocabulary, a local JSON-LD context, executable SHACL shapes, release metadata, competency-question SPARQL files, positive and adversarial fixtures, lifecycle policy, and a deterministic ABox export of the canonical Korean JSON dataset.

P3's formal status means the seven repository gates passed. External curriculum and classroom review remains ongoing. The ontology runs locally; it does **not** publish a public SPARQL endpoint, claim MOE/NCIC official status or rights clearance, diagnose learners, or turn prerequisite suggestions into universal learning-order facts.

## P3 scope

The canonical source snapshot is 11 curricula, 620 achievement standards, 1,956 topics, 2,275 reviewed prerequisite records (400 official + 1,875 pedagogical-candidate), 1,956 standard-topic alignments, 152 clusters, and 46 explicitly retained coverage gaps. The exporter maps that snapshot to 21,752 instance resources while preserving source identifiers, qualifiers, provenance limits, and rights status.

P3 incorporates the P2 standards gate and adds:

- an OWL/Turtle TBox implementing the P0 semantic contract;
- JSON-LD context, executable SHACL shapes, and static release metadata;
- deterministic JSON-LD and Turtle ABox serializations;
- stable assertion IRIs for `PrerequisiteAssertion` and `StandardTopicAlignment` records;
- simple `directRequires` and `alignedToStandard` navigation edges that agree with their qualified records;
- materialized `unlocks` inverse edges and `indirectRequires` non-direct paths;
- a reproducible validation report covering parser equivalence, full-data SHACL, bounded OWL-RL, custom graph invariants, competency queries, and adversarial fixtures;
- a deterministic manifest containing byte counts, SHA-256 checksums, source-record counts, and graph-resource counts.
- stable-series `owl:versionIRI` and `owl:priorVersion` semantics;
- an ontology-specific changelog, deprecation policy, replacement registry, and machine-readable term lifecycle status;
- generated reference documentation and a release-wide deterministic SHA-256 manifest;
- explicit automated-review, ongoing external-domain-review, non-official, no-diagnosis, and rights `cleared` metadata;
- GitHub Actions for six canonical Node gates and a seventh pinned Python standards gate in a temporary virtual environment.

## Artifacts

| File | Purpose |
| --- | --- |
| [`learning-map.ttl`](learning-map.ttl) | Static OWL/Turtle TBox and controlled concepts |
| [`k12-core.ttl`](k12-core.ttl) | K-12 core TBox shared byte-for-byte with `korean-secondary-learning-map`; imported by `learning-map.ttl` and loaded from this local copy |
| [`context.jsonld`](context.jsonld) | Local JSON-LD 1.1 context with IRI coercion |
| [`shapes.ttl`](shapes.ttl) | SHACL shapes executed by the pinned standards validator, including advanced SPARQL constraints |
| [`metadata.ttl`](metadata.ttl) | Version, format, provenance, and rights metadata |
| [`governance.md`](governance.md), [`CHANGELOG.md`](CHANGELOG.md), [`deprecation-policy.md`](deprecation-policy.md), [`replacements.json`](replacements.json), [`term-status.json`](term-status.json) | Version, review, deprecation/replacement, and lifecycle contract |
| [`controlled-vocabulary.json`](controlled-vocabulary.json) | P0 machine-checkable term registry retained as the semantic source contract |
| [`conceptual-model.md`](conceptual-model.md), [`vocabulary.md`](vocabulary.md), [`competency-questions.md`](competency-questions.md), [`uri-policy.md`](uri-policy.md) | P0 design documents preserved as the semantic foundation |
| [`queries/`](queries/) | Local competency-question SPARQL files with deterministic expected-result assertions |
| [`fixtures/`](fixtures/) | Canonical positive fixture plus adversarial SHACL fixtures |
| [`../dist/ontology/learning-map.jsonld`](../dist/ontology/learning-map.jsonld) | Deterministic P3 ABox in JSON-LD |
| [`../dist/ontology/learning-map.ttl`](../dist/ontology/learning-map.ttl) | Deterministic P3 ABox in Turtle |
| [`../dist/ontology/manifest.json`](../dist/ontology/manifest.json) | Deterministic checksums, byte sizes, and record/resource counts |
| [`../dist/ontology/validation-report.json`](../dist/ontology/validation-report.json) | Deterministic P2 validation report emitted by `scripts/validate-ontology.py` |
| [`../docs/ontology-reference.md`](../docs/ontology-reference.md) | Generated class, property, concept, and lifecycle reference |
| [`../dist/ontology/release-manifest.json`](../dist/ontology/release-manifest.json) | Release-wide deterministic bytes and SHA-256 hashes plus review/rights status |
| [`../docs/ontology-release-report.md`](../docs/ontology-release-report.md) | Exact seven-gate release evidence and interpretation limits |

## Build and reproducibility

The generated ontology files under `dist/ontology/` and the generated reference are deliberately tracked so a checkout contains the exact P3 release artifacts. They are reproducible from tracked canonical inputs. The builders emit no wall-clock timestamp or machine-specific path, write atomically, and sort graph resources, predicates, values, terms, paths, and manifest keys.

```bash
npm run build:ontology
npm run check:ontology:artifacts
npm run build:ontology:release
npm run check:ontology:release
```

`build:ontology` rewrites all three generated files. `check:ontology:artifacts` regenerates them in memory and fails if any tracked artifact is missing or byte-stale. The manifest checksum entries cover the JSON-LD and Turtle payloads; freshness checking also compares the manifest itself byte-for-byte.

The P0 controlled-vocabulary validator and P1 contract tests remain separate:

```bash
npm run validate:ontology
node --test tests/ontology-p1.test.mjs
```

The retained P2 standards engine is P3 gate G7 and uses pinned Python dependencies in a local virtual environment:

```bash
npm run setup:ontology
npm run validate:ontology:p2
npm run test:ontology:p2
```

`validate:ontology:p2` parses `ontology/learning-map.ttl`, `ontology/k12-core.ttl`, `ontology/shapes.ttl`, `ontology/metadata.ttl`, `dist/ontology/learning-map.ttl`, and `dist/ontology/learning-map.jsonld` with rdflib. It compares the generated Turtle and JSON-LD graphs for RDF isomorphism, runs full-data SHACL with advanced SPARQL constraints, runs a bounded OWL-RL check on the TBox plus the canonical positive fixture, checks graph invariants, executes all local competency queries, runs adversarial SHACL fixtures, and writes `dist/ontology/validation-report.json`. GitHub Actions installs the same exact pins under `$RUNNER_TEMP` rather than relying on a profile-local environment.

## Semantic guardrails

1. `directRequires` is a reviewed, model-relative suggestion, not a universal learner-order law and not a transitive property. Its strength, reason, basis, source, and review state live in `PrerequisiteAssertion`.
2. `unlocks` is materialized only as the inverse of `directRequires`; `indirectRequires` is materialized only for non-direct paths of length two or more.
3. Legacy dependency values preserve `hard` and `soft` while mapping them to `required` and `recommended` concepts.
4. `alignedToStandard` is a navigation edge. `StandardTopicAlignment` remains the qualifier-preserving record for relationship, confidence, note, basis, and source.
5. Where source alignment confidence is absent, P1 uses the explicit `alignment-confidence-default-v1` marker and does not present the value as source-provided.
6. Learning-topic types remain non-disjoint SKOS concepts.
7. `official-source-checked` is a bounded verification status; it does not mean official wording is included, rights are cleared, or the dataset has official approval.

## Coverage, format, and rights

These remain separate release dimensions:

| Dimension | P3 value | Meaning |
| --- | --- | --- |
| source-data coverage | 46 retained `CoverageGap` records | Known omissions, calibration work, reconciliation, or expert-review needs in the canonical dataset |
| ontology format | `0.4.0` formal repository release | Governed TBox, context, shapes, metadata, deterministic ABox, derived relations, reference, manifests, CI, SHACL, bounded OWL-RL, queries, and fixtures exist |
| automated review | seven gates passed | Six canonical Node gates and one pinned Python standards gate passed |
| external domain review | ongoing | Formal repository status is not external curriculum, subject, pedagogy, or classroom approval |
| source rights | `cleared` | Cited Korean curriculum documents are state-published public materials openly available from their original sources |

Official achievement-standard wording remains excluded. P1 preserves the repository's summaries, code anchors, provenance limits, and warnings in [`../PROVENANCE.md`](../PROVENANCE.md), [`../NOTICE.md`](../NOTICE.md), and [`../README.md`](../README.md).

Generated RDF runtime artifacts also omit public official-source URLs; source evidence is represented with repository-local source identifiers, locators, hashes, rights status, and verification records.
