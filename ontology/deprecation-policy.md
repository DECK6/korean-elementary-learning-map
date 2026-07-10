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

## Review requirements

Every deprecation or replacement requires maintainer review and all seven formal gates. A term that changes curriculum interpretation also requires external domain review before the external-review status can move beyond `ongoing`.
