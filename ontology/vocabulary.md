# Ontology P0 vocabulary

This document preserves the human-readable P0 vocabulary foundation. The machine-readable registry is [`controlled-vocabulary.json`](controlled-vocabulary.json), the current JSON dataset remains the authoritative ABox input, and the executable P3 OWL/SHACL release is defined by [`learning-map.ttl`](learning-map.ttl), [`shapes.ttl`](shapes.ttl), and [`metadata.ttl`](metadata.ttl).

## Reading the contract

- **Direction** is written from subject to object. Reversing an arrow changes its meaning unless an inverse is explicitly named.
- **Cardinality** is a P0 dataset-profile requirement, not a universal claim about every curriculum model.
- **Asserted** means a later conversion may materialize the relation from source data. **Derived-only** means it must be produced by a declared rule and not presented as a source assertion.
- A convenient binary edge does not replace its qualifier-preserving n-ary assertion.
- Every class has a non-example to make its boundary testable. Property non-examples and prohibited interpretations follow the tables.

## Classes

| Class | Definition | Non-example |
| --- | --- | --- |
| `DatasetRelease` | Versioned publication boundary grouping learning-map resources, release state, coverage gaps, and rights metadata. | A Git commit by itself. |
| `Curriculum` | Named and versioned educational programme applying to a stated jurisdiction and school level. | One achievement standard. |
| `GradeBand` | Controlled grouping of school grades used as the intended learning span. | A learner's exact age. |
| `Subject` | Curriculum-recognized field of study such as Korean Language, Mathematics, or Science. | A learning topic. |
| `LearningDomain` | Organizing area within a subject or curriculum, such as Reading or Number and Operations. | A subject label. |
| `AchievementStandard` | Source-anchored curriculum expectation identified by an official or repository-maintained code. | A generated micro-topic. |
| `LearningTopic` | Repository-authored, teachable unit aligned to one or more achievement standards. | Official achievement-standard wording. |
| `LearningCluster` | Navigational grouping containing one or more topics under a documented coverage policy. | An inferred prerequisite chain. |
| `EvidenceCriterion` | Learner-observable condition used to judge whether a topic has been demonstrated. | Source provenance or a teacher activity with no learner evidence. |
| `AssessmentPrompt` | Prompt or task that elicits evidence relevant to a learning topic. | A scoring result. |
| `SourceDocument` | Document or repository artifact cited for curriculum identity, codes, mappings, or provenance. | An unsupported search result or an unrecorded permission. |
| `SourceLocator` | Structured location inside or alongside a source, including page, section, attachment, hash, or code anchors. | A bare source URL with no item-level location. |
| `VerificationRecord` | Dated or status-bearing record of what was checked, by which method, and with what limitations. | An unqualified claim of official approval. |
| `CoverageGap` | Explicit source-data completeness, calibration, reconciliation, or review gap. | Missing RDF in P0 or a source-rights clearance. |
| `PrerequisiteAssertion` | N-ary record qualifying a model-relative direct prerequisite suggestion with strength, reason, basis, source, and review state. | A universal learning-order law or a derived multi-hop prerequisite. |
| `StandardTopicAlignment` | N-ary record preserving how a topic relates to a standard: kind, confidence, note, basis, and source. | An unqualified identifier join. |

## Object properties

| Property | Definition and direction | Domain → range | P0 cardinality | Characteristics |
| --- | --- | --- | --- | --- |
| `hasCurriculum` | Includes a curriculum in a dataset release. | `DatasetRelease` → `Curriculum` | release `1..*`; curriculum `1` release | asserted |
| `hasSubject` | Assigns a current subject. | `Curriculum\|AchievementStandard\|LearningTopic\|LearningCluster` → `Subject` | resource `1`; inverse `0..*` | asserted |
| `hasGradeBand` | Assigns a current grade band. | `Curriculum\|AchievementStandard\|LearningTopic\|LearningCluster` → `GradeBand` | resource `1`; inverse `0..*` | asserted |
| `hasLearningDomain` | Assigns a current learning domain. | `AchievementStandard\|LearningTopic\|LearningCluster` → `LearningDomain` | resource `1`; inverse `0..*` | asserted |
| `hasAchievementStandard` | Includes a standard in a curriculum. | `Curriculum` → `AchievementStandard` | curriculum `1..*`; standard `1` | asserted |
| `containsTopic` | Includes a topic in a release. | `DatasetRelease` → `LearningTopic` | release `1..*`; topic `1` release | asserted |
| `hasCluster` | Includes a cluster in a release. | `DatasetRelease` → `LearningCluster` | release `1..*`; cluster `1` release | asserted |
| `hasClusterMember` | Places a topic in a navigational cluster. | `LearningCluster` → `LearningTopic` | cluster `1..*`; current topic `1..*` clusters | asserted; multiple membership allowed |
| `alignedToStandard` | Convenient navigation projection from a qualified alignment. | `LearningTopic` → `AchievementStandard` | topic `1..*`; standard `0..*` | materialized view; not qualifier-complete |
| `hasStandardTopicAlignment` | Links a topic to its qualifier-preserving alignment record. | `LearningTopic` → `StandardTopicAlignment` | topic `1..*`; assertion `1` topic | asserted |
| `alignmentTopic` | Names the topic in a standard-topic alignment. | `StandardTopicAlignment` → `LearningTopic` | assertion exactly `1` | asserted |
| `alignmentStandard` | Names the standard in a standard-topic alignment. | `StandardTopicAlignment` → `AchievementStandard` | assertion exactly `1` | asserted |
| `hasEvidenceCriterion` | Links a topic to observable evidence criteria. | `LearningTopic` → `EvidenceCriterion` | topic `1..*`; criterion `1` topic | asserted |
| `hasAssessmentPrompt` | Links a topic to prompts that elicit evidence. | `LearningTopic` → `AssessmentPrompt` | topic `1..*`; prompt `1` topic | asserted |
| `directRequires` | Dependent topic → reviewed, model-relative suggested direct prerequisite. | `LearningTopic` → `LearningTopic` | `0..*` each direction | asserted; inverse `unlocks`; **not transitive** |
| `indirectRequires` | Dependent topic → upstream topic reached through at least two direct edges. | `LearningTopic` → `LearningTopic` | `0..*` each direction | derived-only; minimum path length `2`; not asserted as direct |
| `unlocks` | Prerequisite topic → dependent topic. | `LearningTopic` → `LearningTopic` | `0..*` each direction | derived-only inverse of `directRequires`; not transitive |
| `hasPrerequisiteAssertion` | Links a dependent topic to its qualifier-preserving prerequisite record. | `LearningTopic` → `PrerequisiteAssertion` | topic `0..*`; assertion `1` dependent | asserted |
| `dependentTopic` | Names the dependent topic in a prerequisite assertion. | `PrerequisiteAssertion` → `LearningTopic` | assertion exactly `1` | asserted |
| `prerequisiteTopic` | Names the suggested prerequisite topic in a prerequisite assertion. | `PrerequisiteAssertion` → `LearningTopic` | assertion exactly `1` | asserted |
| `documentedBy` | Associates a resource or assertion with a source supporting identity, provenance, or basis. | `Curriculum\|AchievementStandard\|LearningTopic\|PrerequisiteAssertion\|StandardTopicAlignment` → `SourceDocument` | resource `1..*`; source `0..*` | asserted; does not imply permission |
| `hasSourceLocator` | Associates a source-backed resource with a structured locator. | `SourceDocument\|AchievementStandard\|LearningTopic` → `SourceLocator` | resource `0..*`; locator `1` owner | asserted |
| `hasVerificationRecord` | Associates a resource or assertion with a bounded verification record. | `DatasetRelease\|SourceDocument\|AchievementStandard\|LearningTopic\|PrerequisiteAssertion\|StandardTopicAlignment` → `VerificationRecord` | resource `0..*`; record `1` owner | asserted; does not imply endorsement |
| `reportsCoverageGap` | Reports a retained source-data gap for a release. | `DatasetRelease` → `CoverageGap` | release `0..*`; gap `1` release | asserted; excludes format status and rights clearance |

### Object-property non-examples

- `A directRequires B` is not evidence that every learner in every context must learn B first.
- `A directRequires B` and `B directRequires C` do not permit publishing `A directRequires C`; the derived relation is `A indirectRequires C` with rule/path provenance.
- `alignedToStandard` alone is not a complete export of alignment semantics. Follow `hasStandardTopicAlignment` for role, confidence, note, basis, and source.
- `documentedBy` and `hasVerificationRecord` do not grant copyright permission, certify official wording, or imply Ministry/NCIC approval.
- `reportsCoverageGap` must not be used for the independent `p3-formal-release` format status or source-rights clearance.

## Datatype properties

| Property | Definition | Domain | Datatype | P0 cardinality |
| --- | --- | --- | --- | --- |
| `identifier` | Stable source or repository identifier. | release, curriculum, standard, topic, cluster, source, gap, qualified assertions | `xsd:string` | exactly `1` |
| `preferredLabel` | Preferred human-readable label in a declared language. | curriculum, grade band, subject, domain, standard, topic, cluster | `rdf:langString` | `1..*` across languages |
| `summary` | Repository-authored concise description that does not silently reproduce official text. | standard, topic, cluster | `rdf:langString` | `0..*` across languages |
| `topicType` | Learning-topic facet represented by a `LearningTopicType` concept IRI. | topic | `xsd:anyURI` | exactly `1` in current source profile |
| `ageRangeStart` | Inclusive lower age hint; not a grade-band replacement. | topic | `xsd:integer` | `0..1` |
| `ageRangeEnd` | Inclusive upper age hint; not a mastery threshold. | topic | `xsd:integer` | `0..1` |
| `criterionText` | Learner-observable evidence statement. | evidence criterion | `rdf:langString` | exactly `1` per language |
| `promptText` | Prompt wording intended to elicit evidence. | assessment prompt | `rdf:langString` | exactly `1` per language |
| `prerequisiteStrength` | Normalized `required` or `recommended` concept IRI. | prerequisite assertion | `xsd:anyURI` | exactly `1` |
| `prerequisiteReason` | Localized explanation for the recommendation. | prerequisite assertion | `rdf:langString` | `1..*` across languages |
| `assertionBasis` | Method or workstream basis for a qualified assertion. | prerequisite assertion, standard-topic alignment | `xsd:string` | exactly `1` |
| `assertionSource` | Retained source ID or repository path supporting the assertion. | prerequisite assertion, standard-topic alignment | `xsd:string` | `1..*` |
| `alignmentKind` | `introduces`, `supports`, `extends`, or `assesses` concept IRI. | standard-topic alignment | `xsd:anyURI` | exactly `1` |
| `confidence` | Explicit mapping confidence in the closed interval `0..1`. | standard-topic alignment | `xsd:decimal` | exactly `1`; defaulting must be marked |
| `note` | Optional human-readable qualification or limitation. | prerequisite assertion, standard-topic alignment, verification record | `rdf:langString` | `0..*` across languages |
| `sourceUrl` | Retrieval URL without a permanence or permission claim. | source document | `xsd:anyURI` | `0..*` |
| `sourceHash` | Content hash identifying a checked source artifact. | source document, source locator | `xsd:string` | `0..1` per algorithm |
| `locatorValue` | Page, printed page, attachment, section, or code value. | source locator | `xsd:string` | `1..*` |
| `verificationStatus` | Controlled bounded-review status. | verification record | `xsd:anyURI` | exactly `1` |
| `rightsStatus` | Controlled reuse and redistribution posture. | release, source document | `xsd:anyURI` | exactly `1` |
| `officialTextIncluded` | Whether official source wording is included. | release, standard, topic | `xsd:boolean` | exactly `1` |
| `gapCategory` | Controlled source-data coverage or review category. | coverage gap | `xsd:anyURI` | exactly `1` |
| `gapSeverity` | Controlled urgency or intentionality. | coverage gap | `xsd:anyURI` | `0..1`; null may normalize to `unspecified` with source null retained |
| `gapDescription` | Localized account of what is missing, intentional, or awaiting review. | coverage gap | `rdf:langString` | `1..*` across languages |

## Controlled concept schemes

All values are `skos:Concept` candidates, not OWL classes. Their definitions and uniqueness are enforced by `npm run validate:ontology`.

### `LearningTopicType`

| Concept | Meaning |
| --- | --- |
| `conceptual` | Concepts, relationships, categories, or explanatory understanding. |
| `language` | Comprehension or production through spoken, written, signed, or multimodal language. |
| `meta` | Reflection, strategy selection, self-monitoring, or evaluation of learning. |
| `procedural` | An ordered method, performance routine, or repeatable action. |
| `representational` | Interpretation or construction of diagrams, symbols, models, or notation. |

These facets are neither exhaustive nor disjoint. The source uppercase values round-trip through the map in `controlled-vocabulary.json`.

### `DependencyRequirementLevel`

| Source value | Concept | Meaning |
| --- | --- | --- |
| `hard` | `required` | Required within the released model's recommended path, not universally required for all learners. |
| `soft` | `recommended` | Recommended within the released model while alternate sequencing remains possible. |

The source value must remain recoverable after normalization.

### `AlignmentKind`

- `introduces`: establishes an initial entry point;
- `supports`: contributes practice or understanding;
- `extends`: develops the standard beyond its initial scope;
- `assesses`: elicits or evaluates evidence relevant to the standard.

### Coverage, verification, and rights schemes

- `CoverageGapCategory`: `source-text-policy`, `source-locator`, `content-coverage`, `expert-review`, `assessment-calibration`, `dependency-review`, `source-reconciliation`.
- `GapSeverity`: `high`, `medium`, `low`, `review-needed`, `intentional`, `unspecified`.
- `VerificationStatus`: `official-source-checked`, `public-doc-derived`, `workstream-reviewed`, `verification-review-needed`, `not-checked`. A source `review-needed` value normalizes to `verification-review-needed` to keep term identifiers globally unique.
- `RightsStatus`: `hold`, `cleared`, `unknown`. Current source-level `CLEARED` and `public-government-document` normalize to `cleared` without erasing the source value.

Coverage, format phase, and rights remain separate axes: the release has 43 retained coverage gaps, ontology format status `p3-formal-release`, and source rights status `cleared` (state-published public government documents).

## Qualifier-preserving release rule

For both `PrerequisiteAssertion` and `StandardTopicAlignment`, a later RDF exporter must emit stable assertion identity and every available qualifier. A consumer may materialize `directRequires` and `alignedToStandard` for navigation, but round-trip acceptance is evaluated from the n-ary assertion records. An exporter that can reconstruct only the binary pair is non-conformant.
