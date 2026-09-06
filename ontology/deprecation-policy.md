# Ontology deprecation and replacement policy

Released ontology and vocabulary IRIs are stable identifiers. A released IRI must not be silently reassigned to a different meaning, even when a better term is introduced later.

## Status values

- `active`: the term is valid for new data and documentation.
- `deprecated`: the term remains resolvable for compatibility but must not be used for new assertions.
- `tombstone`: the term is retained only to document a historical IRI after a breaking release.

P3 (`0.3.0-p3`) has no deprecated or tombstoned terms.

## Deprecation workflow

1. Keep the original term in the controlled vocabulary, TBox, generated reference, and release manifest inventory.
2. Add the term to `ontology/term-status.json` with `status`, `deprecatedIn`, and `replacement`.
3. Add the migration record to `ontology/replacements.json` with the old IRI, replacement IRI, rationale, compatibility impact, and review status.
4. Mark the old RDF term with `owl:deprecated true` and `dcterms:isReplacedBy`.
5. Document the change in `ontology/CHANGELOG.md`, including any competency-query, SHACL, OWL, data-export, and user-facing interpretation impact.

Generated exports may emit only the replacement term for new data after the deprecation release, but validators must keep accepting the deprecated term for at least one minor release unless a breaking release explicitly removes compatibility.

## Dataset (ABox) instance changes

This policy governs ontology and vocabulary IRIs. Dataset instance IRIs (standards, topics, clusters) follow the governing curriculum notice: when a notice deletes a code, reassigns a code to a different achievement standard, or restructures a subject's areas, the dataset must follow the notice rather than freeze a superseded reading.

Such changes are not recorded in `ontology/term-status.json` or `ontology/replacements.json` — both registries accept only terms defined in `ontology/controlled-vocabulary.json`. Record them instead in all of:

1. `ontology/CHANGELOG.md` under **Compatibility**, naming the affected codes and whether each is a deletion, a semantic reassignment, or an IRI move.
2. The repository `CHANGELOG.md` and `PROVENANCE.md` edition history.
3. A coverage gap in the affected workstream, with `status: resolved` and the superseded and current attachment numbers.

A semantic reassignment is the most dangerous case, because the identifier survives while its meaning does not. Never carry a reassigned code's prior summary, topics, or evidence forward.

## Review requirements

Every deprecation or replacement requires maintainer review and all seven formal gates. A term that changes curriculum interpretation also requires external domain review before the external-review status can move beyond `ongoing`.
