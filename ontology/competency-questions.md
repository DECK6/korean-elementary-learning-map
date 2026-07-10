# Competency questions

These questions are the acceptance contract for a later RDF/SHACL conversion. P0 defines **fixture intent**, not an RDF fixture implementation. Suggested fixture names use the `fixture:` prefix only for explanation and are not production identifiers.

| ID | Testable question | Expected fixture intent |
| --- | --- | --- |
| CQ-01 | Which achievement standards belong to a curriculum for a given subject, grade band, and learning domain? | `fixture:curriculum` contains standards in two domains; filtering by `fixture:subject`, `fixture:grade-1-2`, and `fixture:domain-reading` returns only the reading standard. |
| CQ-02 | Which learning topics align to a selected achievement standard, and what role does each alignment play? | Two `StandardTopicAlignment` records point to one standard with different `alignmentKind` values; the result keeps each kind rather than returning only an unqualified pair. |
| CQ-03 | Which evidence criteria and assessment prompts can elicit observable evidence for a topic? | `fixture:topic-apply` has two evidence criteria and one assessment prompt; provenance text is not returned as learner evidence. |
| CQ-04 | What reviewed direct prerequisites are suggested for a topic, with strength, reason, basis, and source? | A `PrerequisiteAssertion` connects `fixture:topic-apply` to `fixture:topic-understand`; all five qualifiers are present, and `hard` round-trips while normalizing to `required`. |
| CQ-05 | Which prerequisites are indirect rather than direct, and through what minimum path length? | `topic-c directRequires topic-b` and `topic-b directRequires topic-a`; querying `topic-c` derives `indirectRequires topic-a` with path length 2 and does not assert it as a direct edge. |
| CQ-06 | Which topics does a prerequisite unlock? | From `topic-b directRequires topic-a`, the fixture derives `topic-a unlocks topic-b`; no separate source assertion is required. |
| CQ-07 | Can a consumer distinguish a required recommendation from a recommended one without treating either as a universal law? | Two prerequisite assertions use normalized `required` and `recommended` concepts, retain legacy `hard`/`soft`, and share the model-relative recommendation note. |
| CQ-08 | Which clusters contain a topic, and does every topic satisfy the current at-least-one membership policy? | One topic belongs to two clusters and another to one; the conformance query finds no zero-membership topic and preserves multiple memberships. |
| CQ-09 | What source document and precise locator support a standard or topic? | A standard resolves to a source document plus attachment number, SHA-256, PDF page, printed page, section, and standard code where the fixture supplies them. |
| CQ-10 | What exactly was verified, and what does the verification status not claim? | A verification record with `official-source-checked` returns its method and limitation note; it does not imply official approval, verbatim text inclusion, or cleared rights. |
| CQ-11 | How many source-data coverage gaps are retained, and how are they categorized? | Release fixture reports 43 `CoverageGap` resources. A separate ontology-format field reports `p0-model-only`; it is not counted as gap 44. |
| CQ-12 | Is the source-rights HOLD independently discoverable from coverage and format status? | Release and source-document metadata return `RightsStatus/hold` and the unresolved-work-rights basis; the query does not return it as a `CoverageGap`. |
| CQ-13 | Which topic-type facets describe a topic, and are they asserted as disjoint? | Topic types resolve to `LearningTopicType` SKOS concepts. The fixture and schema contain no disjointness axiom, so overlap remains possible. |
| CQ-14 | Can a standard-topic alignment preserve `introduces`, `supports`, `extends`, or `assesses`, confidence, note, basis, and source through a round trip? | Four qualified alignment fixtures cover all roles; JSON -> RDF -> JSON comparison retains every qualifier and flags any defaulted value. |
| CQ-15 | Can prerequisite qualifiers survive RDF conversion even when a convenient `directRequires` edge is materialized? | The round-trip fixture reconstructs the original dependent ID, prerequisite ID, legacy strength, reason, basis, and source from `PrerequisiteAssertion`; flattening to the edge alone fails the test. |

## Query-result guardrails

- A query may use `directRequires` or `alignedToStandard` for navigation, but an export must follow the corresponding n-ary record before claiming qualifier completeness.
- Derived relations must be labeled derived and must retain enough path or rule provenance to reproduce the result.
- Counts are snapshot assertions. A later release may change them only with an explicit release-version update and source-data audit.
- No competency question may infer official wording, official endorsement, or reuse permission from source or verification metadata.
