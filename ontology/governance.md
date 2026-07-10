# Ontology governance and term lifecycle

## Release authority and scope

The repository maintainers govern the **Korean Elementary Curriculum Learning Ontology** series at `https://dexa.art/learnmap/ontology`. A formal release means the seven automated gates documented in `docs/ontology-release-report.md` passed for the tracked artifacts. It does not mean that the Ministry of Education (MOE), National Education Commission, or National Curriculum Information Center (NCIC) approved the model.

Automated review, external domain review, source-data coverage, and source rights are independent states. The P3 automated gate is passed; curriculum, subject, pedagogy, and classroom review remains ongoing; 43 source-data coverage gaps remain explicit; and official-source reuse rights remain `HOLD`. The ontology models curriculum records and suggested relationships. It must not be used to diagnose an individual learner.

## Version semantics

- The stable ontology IRI is `https://dexa.art/learnmap/ontology`.
- Each release has an immutable `owl:versionIRI`. P3 uses `https://dexa.art/learnmap/ontology/0.3.0-p3`.
- `owl:priorVersion` names the immediately preceding published contract. P3 points to `0.2.0-p2`.
- Patch changes clarify text or repair serialization without changing meaning. Minor changes add backward-compatible terms or constraints. A semantic reversal, incompatible domain/range change, or removal requires a major version or a new term.
- Dataset release identifiers, currently `kr-full-depth-v0.4`, are versioned independently from the ontology contract.

## Deprecation and replacement policy

Released term IRIs are never silently reassigned. A term that should no longer be used follows this sequence:

1. Add an entry to `ontology/term-status.json` with `status: deprecated`, the first `deprecatedIn` version, and a `replacement` IRI or term.
2. Add the migration record to `ontology/replacements.json` with the old IRI, replacement IRI, rationale, compatibility impact, and review status.
3. Keep the original term in the TBox and generated reference. Mark it with `owl:deprecated true` and `dcterms:isReplacedBy` in RDF.
4. Add migration guidance and the compatibility impact to `ontology/CHANGELOG.md`.
5. Keep reading the deprecated term for at least one minor release. Generated exports write the replacement only unless a documented compatibility profile says otherwise.
6. Never reuse the old IRI for a different meaning. Removal from the active vocabulary requires a breaking release, while the old IRI remains a tombstone in release history.

The normative policy is `ontology/deprecation-policy.md`. P3 has no deprecated terms. `term-status.json` therefore uses `active` as the default and an empty `deprecatedTerms` list, and `replacements.json` has an empty `entries` list.

## Change and review workflow

Every proposed change must state its competency-question impact, SHACL/OWL impact, migration impact, source and rights impact, and whether the change alters learner-facing interpretation. Maintainer review plus all seven automated gates is required for a formal artifact update. Changes that alter curriculum meaning also require external domain review before that review axis can move from `ongoing` to a stronger status.

The generated `docs/ontology-reference.md` and `dist/ontology/release-manifest.json` must never be hand-edited. Regenerate them with `npm run build:ontology:release` and verify byte freshness with `npm run check:ontology:release`.
