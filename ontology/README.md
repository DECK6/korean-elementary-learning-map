# Ontology P1

This directory is the **P1 machine-readable ontology release** for the Korean Elementary Learning Map. P1 publishes a static OWL/Turtle vocabulary, a local JSON-LD context, SHACL shapes, release metadata, and a deterministic ABox export of the canonical Korean JSON dataset.

P1 does **not** claim the P2 reasoning and query gates. The repository does not yet run a standards-compliant RDF parser, SHACL engine, OWL reasoner, or competency-question SPARQL suite, and it does not publish a public SPARQL endpoint. The checked-in shapes are the constraint contract that P2 will execute.

## P1 scope

The canonical source snapshot remains unchanged: 11 curricula, 620 achievement standards, 1,956 topics, 1,894 reviewed prerequisite records, 1,956 standard-topic alignments, 153 clusters, and 43 explicitly retained coverage gaps. The exporter maps that snapshot to 20,444 instance resources while preserving source identifiers, qualifiers, provenance limits, and rights status.

P1 adds:

- an OWL/Turtle TBox implementing the P0 semantic contract;
- JSON-LD context, SHACL shapes, and static release metadata;
- deterministic JSON-LD and Turtle ABox serializations;
- stable assertion IRIs for `PrerequisiteAssertion` and `StandardTopicAlignment` records;
- simple `directRequires` and `alignedToStandard` navigation edges that agree with their qualified records;
- a deterministic manifest containing byte counts, SHA-256 checksums, source-record counts, and graph-resource counts.

## Artifacts

| File | Purpose |
| --- | --- |
| [`learning-map.ttl`](learning-map.ttl) | Static OWL/Turtle TBox and controlled concepts |
| [`context.jsonld`](context.jsonld) | Local JSON-LD 1.1 context with IRI coercion |
| [`shapes.ttl`](shapes.ttl) | SHACL constraint contract for a future P2 engine gate |
| [`metadata.ttl`](metadata.ttl) | Version, format, provenance, and rights metadata |
| [`controlled-vocabulary.json`](controlled-vocabulary.json) | P0 machine-checkable term registry retained as the semantic source contract |
| [`conceptual-model.md`](conceptual-model.md), [`vocabulary.md`](vocabulary.md), [`competency-questions.md`](competency-questions.md), [`uri-policy.md`](uri-policy.md) | P0 design documents preserved as P1's semantic foundation |
| [`../dist/ontology/learning-map.jsonld`](../dist/ontology/learning-map.jsonld) | Deterministic P1 ABox in JSON-LD |
| [`../dist/ontology/learning-map.ttl`](../dist/ontology/learning-map.ttl) | Deterministic P1 ABox in Turtle |
| [`../dist/ontology/manifest.json`](../dist/ontology/manifest.json) | Deterministic checksums, byte sizes, and record/resource counts |

## Build and reproducibility

The three files under `dist/ontology/` are deliberately tracked so a checkout contains the exact P1 release artifacts. They are also fully reproducible from tracked canonical inputs. The builder emits no wall-clock timestamp or machine-specific path, writes atomically, and sorts graph resources, predicates, values, and manifest keys.

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

## Semantic guardrails

1. `directRequires` is a reviewed, model-relative suggestion, not a universal learner-order law and not a transitive property. Its strength, reason, basis, source, and review state live in `PrerequisiteAssertion`.
2. P1 does not materialize `indirectRequires` closure or `unlocks` inverse triples. Those reasoned views belong to P2.
3. Legacy dependency values preserve `hard` and `soft` while mapping them to `required` and `recommended` concepts.
4. `alignedToStandard` is a navigation edge. `StandardTopicAlignment` remains the qualifier-preserving record for relationship, confidence, note, basis, and source.
5. Where source alignment confidence is absent, P1 uses the explicit `alignment-confidence-default-v1` marker and does not present the value as source-provided.
6. Learning-topic types remain non-disjoint SKOS concepts.
7. `official-source-checked` is a bounded verification status; it does not mean official wording is included, rights are cleared, or the dataset has official approval.

## Coverage, format, and rights

These remain separate release dimensions:

| Dimension | P1 value | Meaning |
| --- | --- | --- |
| source-data coverage | 43 retained `CoverageGap` records | Known omissions, calibration work, reconciliation, or expert-review needs in the canonical dataset |
| ontology format | `0.1.0-p1` machine-readable static release | TBox, context, shapes, metadata, and deterministic ABox exist; P2 reasoner/query execution does not |
| source rights | `HOLD` | Work-level KOGL or commercial-reuse permission is unresolved for cited Korean curriculum PDFs |

Official achievement-standard wording remains excluded. P1 preserves the repository's summaries, code anchors, provenance limits, and warnings in [`../PROVENANCE.md`](../PROVENANCE.md), [`../NOTICE.md`](../NOTICE.md), and [`../README.md`](../README.md).
