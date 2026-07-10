# Ontology P0 URI policy

## Status and goal

This policy reserves stable identifiers for a later RDF conversion while keeping the current GitHub Pages deployment dereferenceable. P0 defines URI shapes only: it does not mint RDF resources, change source JSON identifiers, or promise that every reserved path already serves a representation.

## Namespace families

| Purpose | Stable root | P0 use |
| --- | --- | --- |
| ontology terms | `https://dexa.art/learnmap/ontology#` | Classes and properties, for example `https://dexa.art/learnmap/ontology#LearningTopic` |
| instance-path reservation | `https://dexa.art/learnmap/id/` | Reserved for a future deployment that generates a real page/file or rewrite for every minted path; do not mint these paths in P0 |
| current instance IRIs | `https://dexa.art/learnmap/#/` | GitHub Pages-safe fragment IRIs, for example `https://dexa.art/learnmap/#/topic/kr.mt.example` |
| controlled vocabulary | `https://dexa.art/learnmap/vocab/` | Reserved vocabulary landing root; concept IRIs use fragment routes under this root |

The ontology namespace deliberately uses `ontology#`, rather than arbitrary `/ontology/<term>` paths, so one dereferenceable ontology document can describe all terms. Current instance IRIs likewise use the existing `/learnmap/` page plus fragments. A raw `https://dexa.art/learnmap/id/...` identifier would 404 on GitHub Pages unless a matching file or rewrite were generated, so P0 reserves but does not issue that form.

## Term and concept IRIs

Ontology terms append the exact registry term after `#`:

```text
https://dexa.art/learnmap/ontology#Curriculum
https://dexa.art/learnmap/ontology#directRequires
https://dexa.art/learnmap/ontology#prerequisiteStrength
```

Controlled concepts use the scheme and concept term in a fragment route rooted at `/vocab/`:

```text
https://dexa.art/learnmap/vocab/#/LearningTopicType/conceptual
https://dexa.art/learnmap/vocab/#/DependencyRequirementLevel/required
https://dexa.art/learnmap/vocab/#/AlignmentKind/supports
```

P1 publication must provide a `/learnmap/vocab/` landing document before advertising those IRIs as dereferenceable. Concept terms and scheme names are case-sensitive and come only from [`controlled-vocabulary.json`](controlled-vocabulary.json).

## Instance IRI shapes

The first fragment segment is a resource kind; the remaining value is a percent-encoded stable source identifier.

| Class | Fragment shape |
| --- | --- |
| `DatasetRelease` | `#/release/<dataset-version>` |
| `Curriculum` | `#/curriculum/<curriculum-id>` |
| `GradeBand` | `#/grade-band/<grade-band-id>` |
| `Subject` | `#/subject/<subject-id>` |
| `LearningDomain` | `#/domain/<domain-id>` |
| `AchievementStandard` | `#/standard/<stable-composite-key>` |
| `LearningTopic` | `#/topic/<topic-id>` |
| `LearningCluster` | `#/cluster/<cluster-id>` |
| `EvidenceCriterion` | `#/evidence/<topic-id>/<criterion-id-or-index>` |
| `AssessmentPrompt` | `#/assessment-prompt/<topic-id>/<prompt-id-or-index>` |
| `PrerequisiteAssertion` | `#/prerequisite-assertion/<assertion-id>` |
| `StandardTopicAlignment` | `#/standard-topic-alignment/<alignment-id>` |
| `SourceDocument` | `#/source/<source-id>` |
| `SourceLocator` | `#/source-locator/<locator-id>` |
| `VerificationRecord` | `#/verification/<record-id>` |
| `CoverageGap` | `#/coverage-gap/<gap-id>` |

Examples:

```text
https://dexa.art/learnmap/#/curriculum/kr-2022-elem-korean
https://dexa.art/learnmap/#/standard/kr-2022-elem-korean%3A%5B2%EA%B5%AD02-01%5D
https://dexa.art/learnmap/#/topic/kr.mt.example
```

The examples show URI strings, not P0 ABox assertions.

## Stable identifier rules

1. Use an existing source `id`, curriculum `id`, standard composite `key`, topic `id`, or cluster `id` as the lexical basis. Do not replace it with a label or array position.
2. Encode each identifier as one UTF-8 RFC 3986 path component. Preserve case, punctuation, Hangul, and the source identifier before percent-encoding; do not transliterate or silently lowercase it.
3. Never include learner data, access tokens, signed query parameters, local filesystem paths, source wording, or mutable labels in an IRI.
4. A label change does not change an IRI. If a source ID is corrected, publish an explicit replacement mapping and keep the old IRI as a tombstone or redirect; do not silently reuse it.
5. Resource-kind segments are singular lowercase kebab-case and are fixed by this policy.
6. Every generated resource retains its original identifier as `identifier`, enabling URI-to-source round trips.

## Identifiers for n-ary and embedded records

Current dependency edges, evidence strings, prompts, locators, and standard-topic joins do not all have source IDs. P1 must assign deterministic IDs without discarding qualifiers:

- `PrerequisiteAssertion`: hash a canonical tuple of release version, dependent topic ID, prerequisite topic ID, legacy strength, basis, source, and a stable duplicate ordinal when truly duplicate records exist.
- `StandardTopicAlignment`: hash a canonical tuple of release version, topic ID, standard key, alignment kind, basis, source, and a stable duplicate ordinal.
- evidence, prompt, locator, and verification records: prefer a future explicit source ID; otherwise use the stable owner ID plus an ordinal from a canonicalized, versioned source array.

Use lowercase SHA-256 hex and prefix the first 24 hex characters with the resource family, such as `pa-`, `sta-`, `ev-`, or `vr-`. The canonicalization algorithm and input fields must be versioned in the converter. Never hash only the convenient binary pair when qualifiers distinguish two assertions.

## Direct, indirect, and inverse identity

`directRequires` and `alignedToStandard` may be materialized from their n-ary assertion resources for navigation. They do not get separate assertion-resource IRIs. `indirectRequires` and `unlocks` are derived views and must carry rule or path provenance in any result that presents them as evidence.

In particular:

- do not mint an `indirectRequires` source assertion from a one-edge path;
- do not declare `directRequires` transitive;
- do not let a derived inverse replace the source-oriented `PrerequisiteAssertion`;
- do not let `alignedToStandard` erase role, confidence, note, basis, or source.

## Versioning and dereference behavior

- Vocabulary IRIs remain stable across compatible releases; definitions may be clarified but cannot be silently reversed. A breaking semantic change receives a new term.
- Dataset instances are identified by stable source identity, while release membership and values carry the dataset version. Do not put mutable labels in the identifier.
- Before switching from fragment IRIs to `/id/` paths, the site build must generate or rewrite every advertised identifier and must publish permanent redirects or equivalence mappings. Until that gate passes, fragment IRIs are canonical.
- HTTP responses and future RDF representations must preserve the independent source-data coverage, ontology-format, and rights states. Dereferencing a source does not imply reuse permission.

## P0 acceptance checks

P0 accepts this policy when namespace strings match `controlled-vocabulary.json`, examples follow the encoding rule, and no released identifier depends on an ungenerated `/id/...` path. Automated URI minting, redirect tests, content negotiation, RDF serialization, and link checking belong to P1 or later.
