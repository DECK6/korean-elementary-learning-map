# Conceptual model

## Model boundary

P0 separates the reusable semantic contract (**TBox**) from records converted from the current Korean dataset (**ABox**). The source JSON remains authoritative during this phase; the model describes how a later RDF conversion must preserve meaning without manufacturing stronger claims.

```text
TBox (P0 contract)                      ABox (later conversion)
DatasetRelease, Curriculum              kr-full-depth-v0.4 release
Subject, GradeBand, LearningDomain      Korean Language, grades 1–2, Reading
AchievementStandard, LearningTopic      [2국02-01], kr.mt.* topic records
PrerequisiteAssertion                   each reviewed dependency plus qualifiers
StandardTopicAlignment                  each topic-standard mapping plus qualifiers
Source*, VerificationRecord             source IDs, locators, hashes, review states
CoverageGap                             the 43 retained gap records
```

P0 defines neither an OWL file nor instance triples. A later conversion is conformant only if it can round-trip the source identifiers and all qualified assertion fields.

## Core structural model

A `DatasetRelease` publishes one or more `Curriculum` records and their `LearningTopic` and `LearningCluster` records. A curriculum governs `AchievementStandard` records and is organized through `Subject`, `GradeBand`, and `LearningDomain` resources. A topic:

- has exactly one current subject, grade band, and learning domain in the source profile;
- aligns to one or more achievement standards;
- has one or more `EvidenceCriterion` records and one or more `AssessmentPrompt` records;
- belongs to one or more clusters under the current coverage policy;
- may participate in reviewed prerequisite recommendations.

The cardinalities in P0 are **dataset-profile constraints**, not claims that every educational ontology in every jurisdiction must use the same structure.

## TBox and ABox mapping

| Source JSON | P0 class or relation | Conversion note |
| --- | --- | --- |
| top-level release fields | `DatasetRelease` | Keep version, counts, status, text policy, rights posture, and format phase separate |
| `curricula[]` | `Curriculum` | Preserve source IDs, version, jurisdiction, school level, and source basis |
| `standards[]` | `AchievementStandard` | Mint from the stable composite `key`; never substitute official wording for repository summaries |
| topic `type` | `LearningTopicType` SKOS concept | Preserve original uppercase value and normalized concept mapping |
| `topics[]` | `LearningTopic` | Keep source identifiers, labels, age hints, evidence, prompts, and provenance |
| topic `evidence[]` | `EvidenceCriterion` | One criterion resource per array item |
| topic `assessmentPrompt` | `AssessmentPrompt` | One prompt resource in the current source profile |
| topic `standards[]` | `StandardTopicAlignment` + `alignedToStandard` | The n-ary record is authoritative; the direct edge is a navigation projection |
| `dependencies[]` | `PrerequisiteAssertion` + `directRequires` | Preserve `strength`, `reason`, `basis`, and `source` |
| `clusters[]` | `LearningCluster` + `hasClusterMember` | Current topics must have at least one membership; multiple memberships are allowed |
| source entries and topic locators | `SourceDocument`, `SourceLocator` | Preserve URLs, attachment IDs, hashes, pages, sections, and codes where present |
| verification fields | `VerificationRecord` | State what was checked and retain the limitation notes |
| `coverageGaps[]` | `CoverageGap` | Preserve all 43 records; null severity normalizes to `unspecified` without erasing the null source value |

## Qualified prerequisite pattern

The source dependency is not merely a pair of topics. It is a reviewed educational recommendation carrying context:

```text
dependent topic --hasPrerequisiteAssertion--> PrerequisiteAssertion
PrerequisiteAssertion --dependentTopic------> dependent topic
PrerequisiteAssertion --prerequisiteTopic---> prerequisite topic
PrerequisiteAssertion --prerequisiteStrength-> required | recommended
PrerequisiteAssertion --prerequisiteReason---> localized explanation
PrerequisiteAssertion --assertionBasis-------> method/workstream
PrerequisiteAssertion --assertionSource------> retained source reference

dependent topic --directRequires-------------> prerequisite topic
prerequisite topic --unlocks-----------------> dependent topic   (derived)
dependent topic --indirectRequires-----------> upstream topic     (derived, path >= 2)
```

`directRequires` is a convenient asserted view of an accepted `PrerequisiteAssertion`. Its definition is **model-relative suggested direct prerequisite**. It is not a statement that the order is necessary for all learners, settings, or pedagogies.

Legacy values are normalized as follows while remaining round-trippable:

| Source value | Controlled concept | Meaning |
| --- | --- | --- |
| `hard` | `required` | The model recommends treating the prerequisite as required in its current learning path |
| `soft` | `recommended` | The model recommends the prerequisite but permits alternate sequencing |

Neither value changes the recommendation into an absolute fact.

### Inference rules and prohibitions

- Never declare `directRequires` as transitive.
- Derive `indirectRequires(A, C)` only when a reviewed path `A directRequires B ... directRequires C` has at least two edges.
- Do not also assert the same pair as indirect when it is already a direct edge solely because a longer alternate path exists; consumers should retain path provenance if they expose both views.
- Derive `unlocks(B, A)` from `directRequires(A, B)`.
- Cycles remain invalid under the current dataset policy, but acyclicity does not make the recommendations universal facts.

## Qualified standard-alignment pattern

An unqualified `alignedToStandard` edge cannot preserve why or how a topic contributes to a standard. P0 therefore makes `StandardTopicAlignment` authoritative:

```text
topic --hasStandardTopicAlignment--> StandardTopicAlignment
StandardTopicAlignment --alignmentTopic----> topic
StandardTopicAlignment --alignmentStandard-> achievement standard
StandardTopicAlignment --alignmentKind-----> introduces | supports | extends | assesses
StandardTopicAlignment --confidence--------> decimal 0..1
StandardTopicAlignment --note--------------> optional limitation or explanation
StandardTopicAlignment --assertionBasis----> conversion/mapping basis
StandardTopicAlignment --assertionSource---> source ID or repository path

topic --alignedToStandard------------------> achievement standard  (materialized view)
```

The current JSON provides topic-to-standard identifiers but not every P0 qualifier. A conversion must apply an explicit, versioned defaulting policy and mark defaulted values; it must not silently invent high confidence or a pedagogical role.

## Topic types

Current values (`CONCEPTUAL`, `LANGUAGE`, `META`, `PROCEDURAL`, and `REPRESENTATIONAL`) map to concepts in the `LearningTopicType` SKOS scheme. They are facets for navigation and analysis. P0 does not assert that they are exhaustive or mutually disjoint; a later evidence-backed release may allow multiple types per topic.

## Provenance, verification, and rights

`SourceDocument` identifies what was consulted. `SourceLocator` identifies where a claim was checked. `VerificationRecord` states the check and its limitations. None of these implies permission to reproduce the source.

Three metadata axes must remain independently queryable:

1. **Coverage gaps:** the 43 current records describe content, calibration, locator, reconciliation, or expert-review work.
2. **Ontology-format status:** P0 is `p0-model-only`; lack of RDF/OWL/SHACL is a release phase, not a source-data gap.
3. **Rights status:** `HOLD` records unresolved work-level KOGL and commercial-reuse permissions. This is not a coverage gap and must not be cleared by an ontology conversion.

`official-source-checked` means the bounded source identity/code/locator check described by the associated verification record. It does not mean official text is present, an educational authority approved the dataset, or rights are cleared.

## P0 acceptance boundary

P0 is satisfied when the vocabulary is unique and defined, the URI policy is stable, competency questions expose the intended queries, and all source semantics above are documented. Formal RDF, OWL axioms, SHACL shapes, conversion code, and fixture query execution belong to P1 or later.
