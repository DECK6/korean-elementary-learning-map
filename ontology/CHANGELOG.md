# Ontology changelog

This changelog covers the ontology contract independently from the dataset/package changelog at the repository root.

## [0.3.0-p3] — 2026-07-10

### Added

- Formal **Korean Elementary Curriculum Learning Ontology** release label after seven automated gates.
- Stable-series `owl:versionIRI` / `owl:priorVersion` semantics linking P3 to `0.2.0-p2`.
- Governance, deprecation, replacement, and term-status policy.
- Generated term reference and a deterministic release manifest covering release artifacts, validation evidence, byte sizes, and SHA-256 hashes.
- Explicit automated-review, ongoing external-domain-review, non-official, no-learner-diagnosis, and rights `HOLD` metadata.
- GitHub Actions coverage for canonical Node gates and pinned Python RDF/SHACL/OWL/SPARQL validation in a temporary virtual environment.

### Compatibility

- No P2 class, property, concept, or instance IRI was removed or reassigned.
- The dataset release remains `kr-full-depth-v0.4`; graph resource and relation counts are unchanged.
- No terms are deprecated in this release.

## [0.2.0-p2] — 2026-07-10

- Added deterministic JSON-LD and Turtle ABox exports, materialized inverse/indirect relations, SHACL Advanced constraints, bounded OWL-RL checks, competency queries, adversarial fixtures, and the pinned Python standards-validation report.

## [0.1.0-p1] — 2026-07-10

- Added the static OWL/Turtle TBox, local JSON-LD context, SHACL contract, metadata, stable instance IRIs, and qualifier-preserving assertions.

## [0.1.0-p0] — 2026-07-10

- Established the conceptual model, controlled vocabulary, URI policy, semantic guardrails, and competency-question contract.
