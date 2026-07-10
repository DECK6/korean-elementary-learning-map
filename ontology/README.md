# Ontology P2

This directory is the **P2 validated ontology gate** for the Korean Elementary Learning Map. P2 publishes a static OWL/Turtle vocabulary, a local JSON-LD context, executable SHACL shapes, release metadata, competency-question SPARQL files, positive and adversarial fixtures, and a deterministic ABox export of the canonical Korean JSON dataset.

P2 runs locally. It does **not** publish a public SPARQL endpoint, does not claim official endorsement, and does not turn prerequisite suggestions into universal learning-order facts.

## P2 scope

The canonical source snapshot remains unchanged: 11 curricula, 620 achievement standards, 1,956 topics, 1,894 reviewed prerequisite records, 1,956 standard-topic alignments, 153 clusters, and 43 explicitly retained coverage gaps. The exporter maps that snapshot to 20,446 instance resources while preserving source identifiers, qualifiers, provenance limits, and rights status.

P2 adds:

- an OWL/Turtle TBox implementing the P0 semantic contract;
- JSON-LD context, executable SHACL shapes, and static release metadata;
- deterministic JSON-LD and Turtle ABox serializations;
- stable assertion IRIs for `PrerequisiteAssertion` and `StandardTopicAlignment` records;
- simple `directRequires` and `alignedToStandard` navigation edges that agree with their qualified records;
- materialized `unlocks` inverse edges and `indirectRequires` non-direct paths;
- a reproducible validation report covering parser equivalence, full-data SHACL, bounded OWL-RL, custom graph invariants, competency queries, and adversarial fixtures;
- a deterministic manifest containing byte counts, SHA-256 checksums, source-record counts, and graph-resource counts.

## Artifacts

| File | Purpose |
| --- | --- |
| [`learning-map.ttl`](learning-map.ttl) | Static OWL/Turtle TBox and controlled concepts |
| [`context.jsonld`](context.jsonld) | Local JSON-LD 1.1 context with IRI coercion |
| [`shapes.ttl`](shapes.ttl) | SHACL shapes executed by the P2 validator, including advanced SPARQL constraints |
| [`metadata.ttl`](metadata.ttl) | Version, format, provenance, and rights metadata |
| [`controlled-vocabulary.json`](controlled-vocabulary.json) | P0 machine-checkable term registry retained as the semantic source contract |
| [`conceptual-model.md`](conceptual-model.md), [`vocabulary.md`](vocabulary.md), [`competency-questions.md`](competency-questions.md), [`uri-policy.md`](uri-policy.md) | P0 design documents preserved as P2's semantic foundation |
| [`queries/`](queries/) | Local competency-question SPARQL files with deterministic expected-result assertions |
| [`fixtures/`](fixtures/) | Canonical positive fixture plus adversarial SHACL fixtures |
| [`../dist/ontology/learning-map.jsonld`](../dist/ontology/learning-map.jsonld) | Deterministic P2 ABox in JSON-LD |
| [`../dist/ontology/learning-map.ttl`](../dist/ontology/learning-map.ttl) | Deterministic P2 ABox in Turtle |
| [`../dist/ontology/manifest.json`](../dist/ontology/manifest.json) | Deterministic checksums, byte sizes, and record/resource counts |
| [`../dist/ontology/validation-report.json`](../dist/ontology/validation-report.json) | Deterministic P2 validation report emitted by `scripts/validate-ontology.py` |

## Build and reproducibility

The generated ontology files under `dist/ontology/` are deliberately tracked so a checkout contains the exact P2 release artifacts. They are also reproducible from tracked canonical inputs. The builder emits no wall-clock timestamp or machine-specific path, writes atomically, and sorts graph resources, predicates, values, and manifest keys.

```bash
npm run build:ontology
npm run check:ontology:artifacts
```

`build:ontology` rewrites all three generated files. `check:ontology:artifacts` regenerates them in memory and fails if any tracked artifact is missing or byte-stale. The manifest checksum entries cover the JSON-LD and Turtle payloads; freshness checking also compares the manifest itself byte-for-byte.

The P0 controlled-vocabulary validator and P1 contract tests remain separate:

```bash
npm run validate:ontology
node --test tests/ontology-p1.test.mjs
```

The P2 gate uses pinned Python dependencies in a local virtual environment:

```bash
npm run setup:ontology
npm run validate:ontology:p2
npm run test:ontology:p2
```

`validate:ontology:p2` parses `ontology/learning-map.ttl`, `ontology/shapes.ttl`, `ontology/metadata.ttl`, `dist/ontology/learning-map.ttl`, and `dist/ontology/learning-map.jsonld` with rdflib. It compares the generated Turtle and JSON-LD graphs for RDF isomorphism, runs full-data SHACL with advanced SPARQL constraints, runs a bounded OWL-RL check on the TBox plus the canonical positive fixture, checks graph invariants, executes all local competency queries, runs adversarial SHACL fixtures, and writes `dist/ontology/validation-report.json`.

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

| Dimension | P2 value | Meaning |
| --- | --- | --- |
| source-data coverage | 43 retained `CoverageGap` records | Known omissions, calibration work, reconciliation, or expert-review needs in the canonical dataset |
| ontology format | `0.2.0-p2` validated local gate | TBox, context, shapes, metadata, deterministic ABox, materialized derived relations, SHACL, bounded OWL-RL, local SPARQL queries, and fixtures exist |
| source rights | `HOLD` | Work-level KOGL or commercial-reuse permission is unresolved for cited Korean curriculum PDFs |

Official achievement-standard wording remains excluded. P1 preserves the repository's summaries, code anchors, provenance limits, and warnings in [`../PROVENANCE.md`](../PROVENANCE.md), [`../NOTICE.md`](../NOTICE.md), and [`../README.md`](../README.md).
