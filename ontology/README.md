# Ontology P0

This directory is the **P0 semantic-model release** for the Korean Elementary Learning Map. It defines an ontology-oriented knowledge graph contract around the current JSON dataset. It is **not yet a formal OWL ontology, RDF conversion, SHACL release, or public SPARQL endpoint**.

## P0 scope

P0 fixes the meaning and boundaries that a later serialization must preserve:

- curriculum structure: curriculum, grade band, subject, learning domain, achievement standard, topic, and cluster;
- learning evidence: evidence criteria and assessment prompts;
- reviewed prerequisite recommendations, including the distinction between direct and indirect dependencies;
- qualifier-preserving prerequisite and standard-alignment assertions;
- source documents, structured locators, verification records, coverage gaps, and rights posture;
- stable URI minting rules and controlled concepts.

The current source snapshot remains the canonical ABox input: 11 curricula, 620 achievement standards, 1,956 topics, 1,894 reviewed prerequisite edges, 153 clusters, and 43 explicitly retained coverage gaps. P0 does not rewrite those JSON files.

## Artifacts

| File | Purpose |
| --- | --- |
| [`conceptual-model.md`](conceptual-model.md) | TBox/ABox boundary, relation patterns, inference limits, and release metadata |
| [`vocabulary.md`](vocabulary.md) | Human-readable classes and property contract, including non-examples and cardinalities |
| [`controlled-vocabulary.json`](controlled-vocabulary.json) | Machine-checkable term registry and controlled concept schemes |
| [`competency-questions.md`](competency-questions.md) | Testable questions that later RDF fixtures and queries must answer |
| [`uri-policy.md`](uri-policy.md) | GitHub Pages-safe term, instance, and concept identifier rules |

Run the P0 check with:

```bash
npm run validate:ontology
```

## Semantic guardrails

1. `directRequires` means a **reviewed, model-relative suggestion**, not a universal truth about how every learner must progress. Its qualifiers live in `PrerequisiteAssertion`.
2. `directRequires` is never transitive. `indirectRequires` is derived only from paths of at least two direct edges. `unlocks` is the derived inverse navigation view.
3. Legacy dependency values map `hard` to `required` and `soft` to `recommended`; the original values remain available for lossless conversion.
4. `alignedToStandard` is a convenient edge only. `StandardTopicAlignment` must preserve `introduces`, `supports`, `extends`, or `assesses`, plus confidence, note, basis, and source.
5. Learning-topic types are SKOS concepts. P0 asserts no disjointness between conceptual, language, meta, procedural, and representational facets.
6. `official-source-checked` describes a bounded verification action. It does not mean official text is included, rights are cleared, or the dataset is officially approved.

## Gaps, format status, and rights

These are three separate release dimensions:

| Dimension | P0 value | Meaning |
| --- | --- | --- |
| source-data coverage | 43 retained `CoverageGap` records | Known omissions, calibration work, reconciliation, or expert review needs in the current dataset |
| ontology format | `p0-model-only` | RDF/OWL/SHACL artifacts have not been released yet; this is a phase status, not one of the 43 gaps |
| source rights | `HOLD` | Work-level KOGL or commercial-reuse permission is unresolved for cited Korean curriculum PDFs |

Official achievement-standard wording remains excluded. P0 preserves the repository's original summaries, code anchors, provenance, verification limits, and the warnings in [`../PROVENANCE.md`](../PROVENANCE.md), [`../NOTICE.md`](../NOTICE.md), and [`../README.md`](../README.md).

## Explicit non-goals

- declaring educational prerequisites as universal laws;
- publishing the direct prerequisite edge as `owl:TransitiveProperty`;
- flattening n-ary qualifiers into unqualified RDF edges;
- treating topic facets as mutually exclusive classes without evidence;
- inventing missing official wording, permissions, or verification;
- claiming that the current P0 documentation is a formal ontology release.
