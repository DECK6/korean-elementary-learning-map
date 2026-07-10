# Ontology P3 release report

## Decision

The tracked `0.3.0-p3` artifacts qualify for the formal label **Korean Elementary Curriculum Learning Ontology** after all seven release gates passed. The label describes this repository's independently built data, model, and validation pipeline. It is not an MOE, National Education Commission, or NCIC official ontology, and it does not support individual learner diagnosis.

## Release identity and status

| Field | Evidence |
| --- | --- |
| Stable ontology IRI | `https://dexa.art/learnmap/ontology` |
| Version IRI | `https://dexa.art/learnmap/ontology/0.3.0-p3` |
| Prior version | `https://dexa.art/learnmap/ontology/0.2.0-p2` |
| Dataset release | `kr-full-depth-v0.4` |
| Automated review | PASS — seven gates below |
| External domain review | Ongoing |
| Official status | Independent, non-official |
| Learner diagnosis | Not supported |
| Official-source rights | `HOLD`; no permission grant |
| Official text | Excluded |

## Seven-gate evidence

The evidence below is local tracked-artifact verification. The repository also includes `.github/workflows/ontology-release.yml` to run the same gates in future GitHub Actions executions, but this report does not claim a CI run has completed.

Verification was run with Node `20.11.1`-compatible tooling and the local `.venv-ontology` environment using the exact pins in `requirements-ontology.txt`. The GitHub Actions workflow creates its pinned Python environment under `$RUNNER_TEMP`.

| Gate | Command(s) | Result |
| ---: | --- | --- |
| G1 | `npm run build` | PASS — 11 curricula, 620 standards, 1,956 topics, 1,894 dependencies, 153 clusters |
| G2 | `npm test` | PASS — 62/62 Node regression, ontology-governance, artifact, and CI-contract tests |
| G3 | `npm run validate` | PASS — schema, official inventory, source locator, DAG, reference, and data-manifest checks |
| G4 | `npm run check:content` | PASS — all reported final/workstream defect metrics were zero |
| G5 | `npm run validate:ontology` | PASS — complete controlled vocabulary and P3 release metadata |
| G6 | `npm run check:ontology:artifacts` and `npm run check:ontology:release` | PASS — tracked generated files were byte-current and all release-file SHA-256 values matched |
| G7 | local `.venv-ontology`: `scripts/validate-ontology.py` and `python -m unittest discover tests -p 'test_ontology_p2.py'` | PASS — Python `3.14.3`; rdflib `7.1.4`, pyshacl `0.30.1`, owlrl `7.1.4`; 5/5 Python tests; 0 full-data SHACL violations; bounded OWL-RL pass; 15/15 competency queries; 9/9 adversarial fixtures rejected as expected |

## Exact graph evidence

The deterministic graph contains 20,446 instance resources and 249,461 locally verified triples in each isomorphic JSON-LD and Turtle serialization. Snapshot counts are 11 curricula, 620 standards, 1,956 topics, 1,894 prerequisite assertions, 1,956 standard-topic alignments, 153 clusters, and 43 retained coverage gaps. Materialized relations contain 1,894 `directRequires`, 1,894 `unlocks`, 53,656 `indirectRequires`, and 1,956 `alignedToStandard` pairs. The bounded OWL-RL check expanded 926 input triples to a 2,910-triple closure with no explicit contradiction or unsatisfiable named class.

The exact byte sizes and SHA-256 values for every ontology source, query, fixture, generated reference, ABox serialization, core manifest, validation report, and this report are recorded in `dist/ontology/release-manifest.json`. The manifest is generated without wall-clock or machine-path input, avoids self-hash recursion by excluding itself from the file inventory, and is checked byte-for-byte by G6.

## Provenance and limits

The learning-graph approach was inspired by `withmarbleapp/os-taxonomy` / Marble Skill Taxonomy. The Korean curriculum records, subject model, 620-standard mapping, 1,956 topics, 1,894 edges, ontology conversion, generators, validators, and audit evidence were built independently. The release is not a Marble translation or official derivative.

Coverage, format validation, review, and rights are separate axes. Passing the formal gates does not clear the work-level official-source rights `HOLD`, imply official endorsement, convert suggested prerequisite relations into universal learning laws, or authorize learner diagnosis.

Generated RDF runtime artifacts exclude official source text and public official-source URLs. They retain repository-local source identifiers, source locators, hashes, rights status, and verification records.
