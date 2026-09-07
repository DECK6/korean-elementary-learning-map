#!/usr/bin/env python3
"""P2 standards-engine validation gate for the ontology release."""

from __future__ import annotations

import argparse
import hashlib
import json
import platform
import re
import sys
from collections import Counter, defaultdict, deque
from importlib import metadata
from pathlib import Path
from typing import Any

try:
    import owlrl
    import pyshacl
    import rdflib
    from owlrl import DeductiveClosure, OWLRL_Semantics
    from pyshacl import validate
    from rdflib import BNode, Graph, Literal, Namespace, URIRef
    from rdflib.compare import to_isomorphic
    from rdflib.namespace import DCTERMS, OWL, RDF, RDFS, SH, SKOS, XSD
except ModuleNotFoundError as error:
    missing = error.name or str(error)
    raise SystemExit(
        f"Missing ontology dependency {missing!r}. Run "
        ".venv-ontology/bin/python -m pip install -r requirements-ontology.txt"
    ) from error


ROOT = Path(__file__).resolve().parents[1]
REPORT_PATH = ROOT / "dist" / "ontology" / "validation-report.json"

LM = Namespace("https://dexa.art/learnmap/ontology#")
CORE = Namespace("https://dexa.art/learnmap/ontology/k12-core#")
LMV = Namespace("https://dexa.art/learnmap/vocab/#/")
INSTANCE_NAMESPACE = "https://dexa.art/learnmap/#/"
ONTOLOGY_NAMESPACE = "https://dexa.art/learnmap/ontology#"
VOCABULARY_NAMESPACE = "https://dexa.art/learnmap/vocab/#/"
CORE_NAMESPACE = "https://dexa.art/learnmap/ontology/k12-core#"

REQUIRED_VERSIONS = {
    "rdflib": "7.1.4",
    "pyshacl": "0.30.1",
    "owlrl": "7.1.4",
}

PARSED_INPUTS = {
    "ontology/learning-map.ttl": "turtle",
    "ontology/k12-core.ttl": "turtle",
    "ontology/shapes.ttl": "turtle",
    "ontology/metadata.ttl": "turtle",
    "dist/ontology/learning-map.ttl": "turtle",
    "dist/ontology/learning-map.jsonld": "json-ld",
}

ROUND_TRIP_SOURCE_FILES = [
    "data/kr/dependencies.json",
    "data/kr/dependencies.candidate.json",
    "data/kr/curriculum-standards.json",
]


def _load_relation_layer_counts() -> tuple[int, int]:
    official = json.loads((ROOT / "data" / "kr" / "dependencies.json").read_text(encoding="utf-8"))
    candidate = json.loads(
        (ROOT / "data" / "kr" / "dependencies.candidate.json").read_text(encoding="utf-8")
    )
    return len(official["dependencies"]), len(candidate["dependencies"])


def _indirect_official_closure() -> int:
    official = json.loads((ROOT / "data" / "kr" / "dependencies.json").read_text(encoding="utf-8"))
    adjacency: dict[str, set[str]] = defaultdict(set)
    for edge in official["dependencies"]:
        adjacency[edge["topicId"]].add(edge["prerequisiteId"])
        adjacency.setdefault(edge["prerequisiteId"], set())
    total = 0
    for dependent, direct in adjacency.items():
        reachable: set[str] = set()
        pending = deque(direct)
        while pending:
            current = pending.pop()
            if current in reachable:
                continue
            reachable.add(current)
            pending.extend(adjacency.get(current, set()))
        total += len({node for node in reachable if node != dependent and node not in direct})
    return total


def _load_dataset_counts() -> dict[str, int]:
    """Dataset record counts read straight from the published KR files.

    The exporter must emit exactly one graph resource per record, so these are
    derived rather than pinned; only the structural constants below are fixed.
    """
    standards = json.loads(
        (ROOT / "data" / "kr" / "curriculum-standards.json").read_text(encoding="utf-8")
    )
    topics = json.loads((ROOT / "data" / "kr" / "topics.json").read_text(encoding="utf-8"))
    clusters = json.loads((ROOT / "data" / "kr" / "clusters.json").read_text(encoding="utf-8"))
    return {
        "curricula": len(standards["curricula"]),
        "standards": standards["standardCount"],
        "sources": len(standards["sources"]),
        "standardMappings": len(standards["standardMappings"]),
        "coverageGaps": len(standards["coverageGaps"]),
        "topics": len(topics["topics"]),
        "clusters": len(clusters["clusters"]),
        "evidenceCriteria": sum(len(topic.get("evidence") or []) for topic in topics["topics"]),
        "contentSourceLocators": sum(1 for topic in topics["topics"] if topic.get("contentSourceLocator")),
    }


OFFICIAL_RELATION_COUNT, CANDIDATE_RELATION_COUNT = _load_relation_layer_counts()
ASSERTION_COUNT = OFFICIAL_RELATION_COUNT + CANDIDATE_RELATION_COUNT
DATASET_COUNTS = _load_dataset_counts()
# Source locators and verification records that do not belong to a prerequisite
# assertion. Every official relation adds one locator and one verification
# record; every candidate relation adds one verification record; every
# source-grounded draft adds one content source locator.
BASE_SOURCE_LOCATORS = 1424
BASE_VERIFICATION_RECORDS = 4560

EXPECTED_SOURCE_COUNTS = {
    "curricula": DATASET_COUNTS["curricula"],
    "standards": DATASET_COUNTS["standards"],
    "topics": DATASET_COUNTS["topics"],
    "dependencies": OFFICIAL_RELATION_COUNT,
    "candidateDependencies": CANDIDATE_RELATION_COUNT,
    "clusters": DATASET_COUNTS["clusters"],
    "standardMappings": DATASET_COUNTS["standardMappings"],
    "coverageGaps": DATASET_COUNTS["coverageGaps"],
}

EXPECTED_GRAPH_RESOURCES = {
    "AchievementStandard": DATASET_COUNTS["standards"],
    "AssessmentPrompt": DATASET_COUNTS["topics"],
    "CoverageGap": DATASET_COUNTS["coverageGaps"],
    "Curriculum": DATASET_COUNTS["curricula"],
    "DatasetRelease": 1,
    "EvidenceCriterion": DATASET_COUNTS["evidenceCriteria"],
    "GradeBand": 5,
    "LearningCluster": DATASET_COUNTS["clusters"],
    "LearningDomain": 79,
    "LearningTopic": DATASET_COUNTS["topics"],
    "PrerequisiteAssertion": ASSERTION_COUNT,
    "SourceDocument": DATASET_COUNTS["sources"],
    "SourceLocator": BASE_SOURCE_LOCATORS + OFFICIAL_RELATION_COUNT + DATASET_COUNTS["contentSourceLocators"],
    "StandardTopicAlignment": DATASET_COUNTS["standardMappings"],
    "Subject": 12,
    "VerificationRecord": BASE_VERIFICATION_RECORDS + ASSERTION_COUNT,
}

EXPECTED_RELATIONS = {
    "alignedToStandard": DATASET_COUNTS["standardMappings"],
    "directRequires": OFFICIAL_RELATION_COUNT,
    "indirectRequires": _indirect_official_closure(),
    "unlocks": OFFICIAL_RELATION_COUNT,
}

OFFICIAL_LAYER = URIRef(f"{VOCABULARY_NAMESPACE}RelationLayer/official")

ALLOWED_GRADE_BANDS = {"1-2", "3-4", "5-6", "3-6", "1-6"}
RIGHTS_CLEARED = URIRef(f"{VOCABULARY_NAMESPACE}RightsStatus/cleared")


CARDINALITY_PROFILE: dict[str, dict[URIRef, tuple[int, int | None]]] = {
    "DatasetRelease": {
        LM.identifier: (1, 1),
        LM.rightsStatus: (1, 1),
        LM.officialTextIncluded: (1, 1),
        LM.hasCurriculum: (1, None),
        LM.containsTopic: (1, None),
        LM.hasCluster: (1, None),
        LM.reportsCoverageGap: (1, None),
        LM.hasVerificationRecord: (1, 1),
    },
    "Curriculum": {
        LM.identifier: (1, 1),
        LM.hasSubject: (1, 1),
        LM.hasGradeBand: (1, 1),
        LM.hasAchievementStandard: (1, None),
        LM.officialTextIncluded: (1, 1),
        LM.hasVerificationRecord: (1, 1),
    },
    "GradeBand": {
        LM.identifier: (1, 1),
        LM.preferredLabel: (1, None),
    },
    "Subject": {
        LM.identifier: (1, 1),
        LM.preferredLabel: (1, None),
    },
    "LearningDomain": {
        LM.identifier: (1, 1),
        LM.preferredLabel: (1, None),
        LM.hasSubject: (1, 1),
    },
    "AchievementStandard": {
        LM.identifier: (1, 1),
        LM.hasSubject: (1, 1),
        LM.hasGradeBand: (1, 1),
        LM.hasLearningDomain: (1, 1),
        LM.officialTextIncluded: (1, 1),
        LM.hasVerificationRecord: (1, 1),
    },
    "LearningTopic": {
        LM.identifier: (1, 1),
        LM.preferredLabel: (1, None),
        LM.hasSubject: (1, 1),
        LM.hasGradeBand: (1, 1),
        LM.hasLearningDomain: (1, 1),
        LM.topicType: (1, 1),
        LM.decompositionKind: (1, 1),
        LM.facetKey: (1, 1),
        CORE.facetKey: (1, 1),
        CORE.topicRole: (1, 1),
        CORE.contentKind: (1, 1),
        LM.standardKey: (1, 1),
        LM.sourceStandardCode: (1, 1),
        LM.hasEvidenceCriterion: (1, None),
        LM.hasAssessmentPrompt: (1, None),
        LM.hasStandardTopicAlignment: (1, None),
        LM.officialTextIncluded: (1, 1),
        LM.hasVerificationRecord: (1, 1),
    },
    "LearningCluster": {
        LM.identifier: (1, 1),
        LM.preferredLabel: (1, None),
        LM.hasSubject: (1, 1),
        LM.hasGradeBand: (1, 1),
        LM.hasLearningDomain: (1, 1),
        LM.hasClusterMember: (1, None),
    },
    "EvidenceCriterion": {
        LM.identifier: (1, 1),
        LM.criterionText: (1, None),
    },
    "AssessmentPrompt": {
        LM.identifier: (1, 1),
        LM.promptText: (1, None),
    },
    "PrerequisiteAssertion": {
        LM.identifier: (1, 1),
        LM.relationIdentifier: (1, 1),
        LM.dependentTopic: (1, 1),
        LM.prerequisiteTopic: (1, 1),
        LM.prerequisiteStrength: (1, 1),
        LM.prerequisiteReason: (1, None),
        LM.legacyPrerequisiteStrength: (1, 1),
        LM.assertionLayer: (1, 1),
        LM.relationKind: (1, 1),
        LM.basisKind: (1, 1),
        LM.scope: (1, 1),
        LM.reviewStatus: (1, 1),
        LM.assertionBasis: (1, 1),
        LM.assertionSource: (1, 1),
        LM.hasVerificationRecord: (1, 1),
    },
    "StandardTopicAlignment": {
        LM.identifier: (1, 1),
        LM.alignmentTopic: (1, 1),
        LM.alignmentStandard: (1, 1),
        LM.alignmentKind: (1, 1),
        LM.confidence: (1, 1),
        LM.sourceAlignmentRelationship: (1, 1),
        LM.sourceConfidenceValue: (1, 1),
        LM.confidenceDefaulted: (1, 1),
        LM.verificationStatusDefaulted: (1, 1),
        LM.assertionBasis: (1, 1),
        LM.assertionSource: (1, 1),
        LM.hasVerificationRecord: (1, 1),
    },
    "SourceDocument": {
        LM.identifier: (1, 1),
        LM.preferredLabel: (1, None),
        LM.sourceType: (1, 1),
        LM.rightsStatus: (1, 1),
        LM.officialTextIncluded: (1, 1),
        LM.hasVerificationRecord: (1, 1),
    },
    "SourceLocator": {
        LM.identifier: (1, 1),
        LM.locatorValue: (1, None),
    },
    "VerificationRecord": {
        LM.identifier: (1, 1),
        LM.verificationStatus: (1, 1),
    },
    "CoverageGap": {
        LM.identifier: (1, 1),
        LM.gapCategory: (1, 1),
        LM.gapSeverity: (1, 1),
        LM.gapStatus: (1, 1),
        LM.sourceGapSeverityPresent: (1, 1),
        LM.gapDescription: (1, None),
    },
}

OBJECT_PROPERTY_PROFILE: dict[URIRef, tuple[set[str], str]] = {
    LM.hasCurriculum: ({"DatasetRelease"}, "Curriculum"),
    LM.hasSubject: (
        {"Curriculum", "LearningDomain", "AchievementStandard", "LearningTopic", "LearningCluster", "CoverageGap"},
        "Subject",
    ),
    LM.hasGradeBand: ({"Curriculum", "AchievementStandard", "LearningTopic", "LearningCluster"}, "GradeBand"),
    LM.hasLearningDomain: ({"AchievementStandard", "LearningTopic", "LearningCluster"}, "LearningDomain"),
    LM.hasAchievementStandard: ({"Curriculum"}, "AchievementStandard"),
    LM.containsTopic: ({"DatasetRelease"}, "LearningTopic"),
    LM.hasCluster: ({"DatasetRelease"}, "LearningCluster"),
    LM.hasClusterMember: ({"LearningCluster"}, "LearningTopic"),
    CORE.collapseInto: ({"LearningTopic"}, "LearningTopic"),
    LM.alignedToStandard: ({"LearningTopic"}, "AchievementStandard"),
    LM.hasStandardTopicAlignment: ({"LearningTopic"}, "StandardTopicAlignment"),
    LM.alignmentTopic: ({"StandardTopicAlignment"}, "LearningTopic"),
    LM.alignmentStandard: ({"StandardTopicAlignment"}, "AchievementStandard"),
    LM.hasEvidenceCriterion: ({"LearningTopic"}, "EvidenceCriterion"),
    LM.hasAssessmentPrompt: ({"LearningTopic"}, "AssessmentPrompt"),
    LM.directRequires: ({"LearningTopic"}, "LearningTopic"),
    LM.indirectRequires: ({"LearningTopic"}, "LearningTopic"),
    LM.unlocks: ({"LearningTopic"}, "LearningTopic"),
    LM.hasPrerequisiteAssertion: ({"LearningTopic"}, "PrerequisiteAssertion"),
    LM.dependentTopic: ({"PrerequisiteAssertion"}, "LearningTopic"),
    LM.prerequisiteTopic: ({"PrerequisiteAssertion"}, "LearningTopic"),
    LM.documentedBy: (
        {
            "Curriculum",
            "AchievementStandard",
            "LearningTopic",
            "SourceLocator",
            "VerificationRecord",
            "CoverageGap",
            "PrerequisiteAssertion",
            "StandardTopicAlignment",
        },
        "SourceDocument",
    ),
    LM.hasSourceLocator: (
        {"SourceDocument", "AchievementStandard", "LearningTopic", "CoverageGap", "PrerequisiteAssertion"},
        "SourceLocator",
    ),
    LM.hasVerificationRecord: (
        {"DatasetRelease", "Curriculum", "SourceDocument", "AchievementStandard", "LearningTopic", "PrerequisiteAssertion", "StandardTopicAlignment"},
        "VerificationRecord",
    ),
    LM.reportsCoverageGap: ({"DatasetRelease"}, "CoverageGap"),
}

CONTROLLED_CONCEPT_PROPERTIES = {
    LM.topicType,
    LM.prerequisiteStrength,
    LM.alignmentKind,
    LM.verificationStatus,
    LM.rightsStatus,
    LM.gapCategory,
    LM.gapSeverity,
    LM.assertionLayer,
    LM.relationKind,
    LM.basisKind,
    LM.scope,
    LM.reviewStatus,
    LM.decompositionKind,
}

# The shared K-12 facet scheme lives outside the repo-local vocab/#/ namespace.
FACET_NAMESPACE = "https://dexa.art/learnmap/vocab/facet/"
FACET_CONCEPT_PROPERTIES = {LM.facetKey}
# Core-namespace projections shared with the secondary map.
CORE_CONCEPT_PROPERTIES = {
    CORE.facetKey,
    CORE.topicRole,
    CORE.contentKind,
    CORE.layerConcept,
    CORE.locatorKind,
}


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def read_text(relative_path: str) -> str:
    return (ROOT / relative_path).read_text(encoding="utf-8")


def read_json(relative_path: str) -> Any:
    return json.loads(read_text(relative_path))


def file_hash(relative_path: str) -> str:
    return sha256_bytes((ROOT / relative_path).read_bytes())


def sorted_json(data: Any) -> str:
    return json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def package_version(name: str, module: Any) -> str:
    return getattr(module, "__version__", None) or metadata.version(name)


def tool_versions() -> dict[str, str]:
    versions = {
        "python": platform.python_version(),
        "rdflib": package_version("rdflib", rdflib),
        "pyshacl": package_version("pyshacl", pyshacl),
        "owlrl": package_version("owlrl", owlrl),
    }
    mismatches = [
        f"{name} expected {expected}, found {versions.get(name)}"
        for name, expected in REQUIRED_VERSIONS.items()
        if versions.get(name) != expected
    ]
    if mismatches:
        raise RuntimeError("; ".join(mismatches))
    return versions


def parse_graph(relative_path: str, rdf_format: str) -> Graph:
    graph = Graph()
    graph.parse(str(ROOT / relative_path), format=rdf_format)
    return graph


def merge_graphs(*graphs: Graph) -> Graph:
    merged = Graph()
    for graph in graphs:
        for triple in graph:
            merged.add(triple)
    return merged


def term_key(term: Any) -> str:
    if term is None:
        return ""
    if isinstance(term, URIRef):
        return str(term)
    if isinstance(term, BNode):
        return f"_:{term}"
    if isinstance(term, Literal):
        lexical = str(term)
        if term.language:
            return f'"{lexical}"@{term.language}'
        if term.datatype:
            return f'"{lexical}"^^{term.datatype}'
        return lexical
    return str(term)


def literal_string(graph: Graph, subject: URIRef, predicate: URIRef) -> str | None:
    value = graph.value(subject, predicate)
    return None if value is None else str(value)


def one_object(graph: Graph, subject: URIRef, predicate: URIRef) -> URIRef | Literal | None:
    return graph.value(subject, predicate)


def node_types(graph: Graph) -> dict[URIRef, set[str]]:
    mapping: dict[URIRef, set[str]] = defaultdict(set)
    for subject, _, obj in graph.triples((None, RDF.type, None)):
        if isinstance(subject, URIRef) and isinstance(obj, URIRef) and str(obj).startswith(str(LM)):
            mapping[subject].add(str(obj).removeprefix(str(LM)))
    return mapping


def relation_pairs(graph: Graph, predicate: URIRef) -> set[tuple[str, str]]:
    return {
        (str(subject), str(obj))
        for subject, _, obj in graph.triples((None, predicate, None))
        if isinstance(subject, URIRef) and isinstance(obj, URIRef)
    }


def relation_hash(pairs: set[tuple[str, str]]) -> str:
    lines = [f"{left}\t{right}" for left, right in sorted(pairs)]
    return hashlib.sha256(("\n".join(lines) + "\n").encode("utf-8")).hexdigest()


def result_rows(query_result: Any) -> list[dict[str, str]]:
    variables = [str(var) for var in query_result.vars]
    rows = []
    for row in query_result:
        rows.append({name: term_key(row[index]) for index, name in enumerate(variables)})
    return sorted(rows, key=lambda item: json.dumps(item, sort_keys=True))


def rows_hash(rows: list[dict[str, str]]) -> str:
    return sha256_bytes(sorted_json(rows).encode("utf-8"))


def load_expected_query_assertions() -> dict[str, Any]:
    return read_json("ontology/queries/expected.json")


def assert_query_expectations(name: str, rows: list[dict[str, str]], expected: dict[str, Any]) -> list[str]:
    errors = []
    if len(rows) != expected["rowCount"]:
        errors.append(f"{name}: expected {expected['rowCount']} rows, found {len(rows)}")

    for assertion in expected.get("nonNull", []):
        missing = sum(1 for row in rows if not row.get(assertion))
        if missing:
            errors.append(f"{name}: {assertion} missing in {missing} rows")

    for variable, expected_value in expected.get("allEqual", {}).items():
        bad = sorted({row.get(variable, "") for row in rows if row.get(variable, "") != expected_value})
        if bad:
            errors.append(f"{name}: {variable} has unexpected values {bad[:5]}")

    for variable, expected_sum in expected.get("sum", {}).items():
        total = 0
        for row in rows:
            try:
                total += int(str(row.get(variable, "0")).split("^^", 1)[0].strip('"'))
            except ValueError:
                errors.append(f"{name}: {variable} is not an integer literal in row {row}")
                break
        if total != expected_sum:
            errors.append(f"{name}: expected sum({variable}) {expected_sum}, found {total}")

    for group in expected.get("groups", []):
        matches = [
            row
            for row in rows
            if all(row.get(variable) == expected_value for variable, expected_value in group["match"].items())
        ]
        if len(matches) != 1:
            errors.append(f"{name}: expected one grouped row for {group['match']}, found {len(matches)}")
            continue
        count_value = matches[0].get(group["countVariable"], "")
        try:
            count = int(count_value.split("^^", 1)[0].strip('"'))
        except ValueError:
            errors.append(f"{name}: grouped count is not an integer literal for {group['match']}: {count_value}")
            continue
        if count != group["count"]:
            errors.append(f"{name}: expected {group['match']} count {group['count']}, found {count}")

    return errors


def execute_competency_queries(graph: Graph) -> dict[str, Any]:
    expected = load_expected_query_assertions()
    query_dir = ROOT / "ontology" / "queries"
    results = {}
    errors = []
    for path in sorted(query_dir.glob("*.rq")):
        name = path.name
        query_result = graph.query(path.read_text(encoding="utf-8"))
        rows = result_rows(query_result)
        query_report = {
            "rowCount": len(rows),
            "resultSha256": rows_hash(rows),
            "pass": True,
        }
        if name not in expected:
            query_report["pass"] = False
            errors.append(f"{name}: missing ontology/queries/expected.json entry")
        else:
            query_errors = assert_query_expectations(name, rows, expected[name])
            query_report["pass"] = len(query_errors) == 0
            if query_errors:
                query_report["errors"] = query_errors
                errors.extend(query_errors)
        results[name] = query_report

    missing = sorted(set(expected) - {path.name for path in query_dir.glob("*.rq")})
    for name in missing:
        errors.append(f"{name}: expected query file is missing")
    return {
        "pass": not errors,
        "queryCount": len(results),
        "results": results,
        "errors": errors,
    }


def shacl_results(report_graph: Graph) -> list[dict[str, str]]:
    results = []
    for result in report_graph.subjects(RDF.type, SH.ValidationResult):
        messages = sorted(term_key(message) for message in report_graph.objects(result, SH.resultMessage))
        entry = {
            "focusNode": term_key(report_graph.value(result, SH.focusNode)),
            "path": term_key(report_graph.value(result, SH.resultPath)),
            "sourceConstraintComponent": term_key(report_graph.value(result, SH.sourceConstraintComponent)),
            "sourceShape": term_key(report_graph.value(result, SH.sourceShape)),
            "value": term_key(report_graph.value(result, SH.value)),
            "message": " | ".join(messages),
        }
        results.append(entry)
    return sorted(results, key=lambda item: json.dumps(item, sort_keys=True))


def run_shacl(data_graph: Graph, shapes_graph: Graph, ontology_graph: Graph) -> dict[str, Any]:
    conforms, report_graph, report_text = validate(
        data_graph=data_graph,
        shacl_graph=shapes_graph,
        ont_graph=ontology_graph,
        advanced=True,
        abort_on_first=False,
        allow_infos=False,
        allow_warnings=False,
        inference="none",
        meta_shacl=False,
    )
    results = shacl_results(report_graph)
    return {
        "conforms": bool(conforms),
        "violationCount": len(results),
        "results": results,
        "reportTextSha256": sha256_bytes(str(report_text).encode("utf-8")),
    }


def parse_and_compare_generated_graphs(graphs: dict[str, Graph]) -> dict[str, Any]:
    turtle_graph = graphs["dist/ontology/learning-map.ttl"]
    jsonld_graph = graphs["dist/ontology/learning-map.jsonld"]
    turtle_iso = to_isomorphic(turtle_graph)
    jsonld_iso = to_isomorphic(jsonld_graph)
    isomorphic = turtle_iso == jsonld_iso
    return {
        "isomorphic": isomorphic,
        "turtleTripleCount": len(turtle_graph),
        "jsonldTripleCount": len(jsonld_graph),
        "turtleCanonicalHash": str(turtle_iso.internal_hash()),
        "jsonldCanonicalHash": str(jsonld_iso.internal_hash()),
        "pass": isomorphic and len(turtle_graph) == len(jsonld_graph),
    }


def graph_resource_counts(graph: Graph) -> dict[str, int]:
    counts = {}
    for class_name in sorted(CARDINALITY_PROFILE):
        counts[class_name] = len(set(graph.subjects(RDF.type, LM[class_name])))
    return {key: value for key, value in counts.items() if value > 0}


def relation_counts(graph: Graph) -> dict[str, dict[str, Any]]:
    relation_map = {
        "alignedToStandard": LM.alignedToStandard,
        "directRequires": LM.directRequires,
        "indirectRequires": LM.indirectRequires,
        "unlocks": LM.unlocks,
    }
    return {
        name: {
            "count": len(relation_pairs(graph, predicate)),
            "sha256": relation_hash(relation_pairs(graph, predicate)),
        }
        for name, predicate in relation_map.items()
    }


def validate_jsonld_resource_shape() -> dict[str, Any]:
    payload = read_json("dist/ontology/learning-map.jsonld")
    graph = payload.get("@graph", [])
    ids = [node.get("@id") for node in graph if isinstance(node, dict)]
    duplicate_ids = sorted(item for item, count in Counter(ids).items() if count > 1)
    node_ids = set(ids)
    dangling = set()
    forbidden_keys = set()
    forbidden_strings = set()

    def walk(value: Any, key_path: tuple[str, ...] = ()) -> None:
        if isinstance(value, dict):
            for key, child in value.items():
                if re.search(r"sourceUrl|sourceTextIncluded|officialText(?!Included)", key):
                    forbidden_keys.add(".".join((*key_path, key)))
                if key == "@id" and isinstance(child, str) and child.startswith(INSTANCE_NAMESPACE):
                    if child not in node_ids:
                        dangling.add(child)
                walk(child, (*key_path, key))
        elif isinstance(value, list):
            for index, child in enumerate(value):
                walk(child, (*key_path, str(index)))
        elif isinstance(value, str) and key_path and key_path[-1] != "@id":
            if "http://" in value or "https://" in value:
                forbidden_strings.add(".".join(key_path))

    walk(graph)
    return {
        "resourceCount": len(graph),
        "duplicateResourceIriCount": len(duplicate_ids),
        "danglingInstanceReferenceCount": len(dangling),
        "forbiddenKeyCount": len(forbidden_keys),
        "forbiddenUrlLiteralCount": len(forbidden_strings),
        "duplicates": duplicate_ids[:20],
        "dangling": sorted(dangling)[:20],
        "pass": not duplicate_ids and not dangling and not forbidden_keys and not forbidden_strings,
    }


def validate_profile(graph: Graph, tbox_graph: Graph) -> dict[str, Any]:
    errors = []
    types = node_types(graph)
    tbox_concepts = set(tbox_graph.subjects(RDF.type, SKOS.Concept))

    for class_name, properties in CARDINALITY_PROFILE.items():
        for subject in sorted(graph.subjects(RDF.type, LM[class_name]), key=term_key):
            for predicate, (minimum, maximum) in properties.items():
                values = list(graph.objects(subject, predicate))
                if len(values) < minimum:
                    errors.append(f"{term_key(subject)} {term_key(predicate)} minCount {minimum}, found {len(values)}")
                if maximum is not None and len(values) > maximum:
                    errors.append(f"{term_key(subject)} {term_key(predicate)} maxCount {maximum}, found {len(values)}")

    for predicate, (domain_classes, range_class) in OBJECT_PROPERTY_PROFILE.items():
        for subject, _, obj in graph.triples((None, predicate, None)):
            subject_classes = types.get(subject, set())
            if not subject_classes.intersection(domain_classes):
                errors.append(
                    f"{term_key(predicate)} domain mismatch on {term_key(subject)}: {sorted(subject_classes)}"
                )
            if not isinstance(obj, URIRef) or range_class not in types.get(obj, set()):
                errors.append(f"{term_key(predicate)} range mismatch on {term_key(subject)} -> {term_key(obj)}")

    for predicate in CONTROLLED_CONCEPT_PROPERTIES:
        for subject, _, obj in graph.triples((None, predicate, None)):
            if not isinstance(obj, URIRef) or not str(obj).startswith(VOCABULARY_NAMESPACE) or obj not in tbox_concepts:
                errors.append(f"{term_key(predicate)} controlled concept mismatch on {term_key(subject)} -> {term_key(obj)}")

    for predicate in FACET_CONCEPT_PROPERTIES:
        for subject, _, obj in graph.triples((None, predicate, None)):
            if not isinstance(obj, URIRef) or not str(obj).startswith(FACET_NAMESPACE) or obj not in tbox_concepts:
                errors.append(f"{term_key(predicate)} facet concept mismatch on {term_key(subject)} -> {term_key(obj)}")

    for predicate in CORE_CONCEPT_PROPERTIES:
        for subject, _, obj in graph.triples((None, predicate, None)):
            if not isinstance(obj, URIRef) or not str(obj).startswith(CORE_NAMESPACE) or obj not in tbox_concepts:
                errors.append(f"{term_key(predicate)} core concept mismatch on {term_key(subject)} -> {term_key(obj)}")

    return {
        "pass": not errors,
        "errorCount": len(errors),
        "errors": sorted(errors)[:50],
    }


def validate_grade_bands(graph: Graph) -> dict[str, Any]:
    errors = []
    grade_ids = {
        str(graph.value(subject, LM.identifier))
        for subject in graph.subjects(RDF.type, LM.GradeBand)
        if graph.value(subject, LM.identifier) is not None
    }
    if grade_ids != ALLOWED_GRADE_BANDS:
        errors.append(f"GradeBand identifiers expected {sorted(ALLOWED_GRADE_BANDS)}, found {sorted(grade_ids)}")

    for curriculum in sorted(graph.subjects(RDF.type, LM.Curriculum), key=term_key):
        standards = list(graph.objects(curriculum, LM.hasAchievementStandard))
        grades = []
        for standard in standards:
            band = graph.value(graph.value(standard, LM.hasGradeBand), LM.identifier)
            if band is None:
                continue
            for value in str(band).split("-"):
                if value.isdigit():
                    grades.append(int(value))
        actual = graph.value(graph.value(curriculum, LM.hasGradeBand), LM.identifier)
        expected = f"{min(grades)}-{max(grades)}" if grades else None
        if expected != str(actual):
            errors.append(f"{term_key(curriculum)} synthesized grade band expected {expected}, found {actual}")

    return {
        "pass": not errors,
        "allowedIdentifiers": sorted(ALLOWED_GRADE_BANDS),
        "gradeBandCount": len(grade_ids),
        "errors": errors,
    }


def validate_source_rights(graph: Graph) -> dict[str, Any]:
    errors = []
    for subject in sorted(graph.subjects(RDF.type, LM.DatasetRelease), key=term_key):
        if graph.value(subject, LM.rightsStatus) != RIGHTS_CLEARED:
            errors.append(f"{term_key(subject)} rightsStatus is not cleared")
        if graph.value(subject, LM.officialTextIncluded).toPython() is not False:
            errors.append(f"{term_key(subject)} officialTextIncluded is not false")
    for subject in sorted(graph.subjects(RDF.type, LM.SourceDocument), key=term_key):
        if graph.value(subject, LM.rightsStatus) != RIGHTS_CLEARED:
            errors.append(f"{term_key(subject)} rightsStatus is not cleared")
        official = graph.value(subject, LM.officialTextIncluded)
        if official is None or official.toPython() is not False:
            errors.append(f"{term_key(subject)} officialTextIncluded is not false")
        if (subject, LM.sourceUrl, None) in graph:
            errors.append(f"{term_key(subject)} leaked lm:sourceUrl")
    for class_name in ["Curriculum", "AchievementStandard", "LearningTopic"]:
        for subject in sorted(graph.subjects(RDF.type, LM[class_name]), key=term_key):
            official = graph.value(subject, LM.officialTextIncluded)
            if official is None or official.toPython() is not False:
                errors.append(f"{term_key(subject)} officialTextIncluded is not false")
    return {
        "pass": not errors,
        "rightsClearedResources": len(set(graph.subjects(LM.rightsStatus, RIGHTS_CLEARED))),
        "officialTextIncludedTrueCount": sum(
            1 for _ in graph.subjects(LM.officialTextIncluded, Literal(True, datatype=XSD.boolean))
        ),
        "errors": errors[:50],
    }


def direct_cycle_nodes(adjacency: dict[str, set[str]]) -> set[str]:
    visiting: set[str] = set()
    visited: set[str] = set()
    cyclic: set[str] = set()

    def visit(node: str, stack: tuple[str, ...]) -> None:
        if node in visiting:
            if node in stack:
                cyclic.update(stack[stack.index(node) :])
            return
        if node in visited:
            return
        visiting.add(node)
        for target in adjacency.get(node, set()):
            visit(target, (*stack, node))
        visiting.remove(node)
        visited.add(node)

    for node in sorted(adjacency):
        visit(node, ())
    return cyclic


def indirect_closure(adjacency: dict[str, set[str]]) -> set[tuple[str, str]]:
    expected = set()
    for dependent, direct in adjacency.items():
        reachable = set()
        pending = deque(direct)
        while pending:
            current = pending.pop()
            if current in reachable:
                continue
            reachable.add(current)
            pending.extend(adjacency.get(current, set()))
        for prerequisite in reachable:
            if prerequisite != dependent and prerequisite not in direct:
                expected.add((dependent, prerequisite))
    return expected


def validate_relations(graph: Graph, tbox_graph: Graph) -> dict[str, Any]:
    direct = relation_pairs(graph, LM.directRequires)
    unlocks = relation_pairs(graph, LM.unlocks)
    indirect = relation_pairs(graph, LM.indirectRequires)
    aligned = relation_pairs(graph, LM.alignedToStandard)
    adjacency: dict[str, set[str]] = defaultdict(set)
    for dependent, prerequisite in direct:
        adjacency[dependent].add(prerequisite)
        adjacency.setdefault(prerequisite, set())

    expected_unlocks = {(prerequisite, dependent) for dependent, prerequisite in direct}
    expected_indirect = indirect_closure(adjacency)
    self_edges = sorted(pair for pair in direct if pair[0] == pair[1])
    cycle_nodes = direct_cycle_nodes(adjacency)
    direct_is_transitive = (LM.directRequires, RDF.type, OWL.TransitiveProperty) in tbox_graph

    errors = []
    for relation_name, expected_count in EXPECTED_RELATIONS.items():
        actual = {"directRequires": direct, "unlocks": unlocks, "indirectRequires": indirect, "alignedToStandard": aligned}[
            relation_name
        ]
        if len(actual) != expected_count:
            errors.append(f"{relation_name} expected {expected_count}, found {len(actual)}")
    if unlocks != expected_unlocks:
        errors.append(
            f"unlocks inverse mismatch: missing {len(expected_unlocks - unlocks)}, extra {len(unlocks - expected_unlocks)}"
        )
    if indirect != expected_indirect:
        errors.append(
            "indirectRequires closure mismatch: "
            f"missing {len(expected_indirect - indirect)}, extra {len(indirect - expected_indirect)}"
        )
    if self_edges:
        errors.append(f"directRequires self edge count {len(self_edges)}")
    if cycle_nodes:
        errors.append(f"directRequires cycle node count {len(cycle_nodes)}")
    if direct_is_transitive:
        errors.append("directRequires is declared owl:TransitiveProperty")
    direct_indirect_overlap = direct.intersection(indirect)
    if direct_indirect_overlap:
        errors.append(f"directRequires/indirectRequires overlap count {len(direct_indirect_overlap)}")

    return {
        "pass": not errors,
        "counts": {
            "alignedToStandard": len(aligned),
            "directRequires": len(direct),
            "indirectRequires": len(indirect),
            "unlocks": len(unlocks),
        },
        "hashes": {
            "alignedToStandard": relation_hash(aligned),
            "directRequires": relation_hash(direct),
            "indirectRequires": relation_hash(indirect),
            "unlocks": relation_hash(unlocks),
        },
        "selfEdgeCount": len(self_edges),
        "cycleNodeCount": len(cycle_nodes),
        "duplicateDirectPairCount": 0,
        "directRequiresDeclaredTransitive": direct_is_transitive,
        "directIndirectOverlapCount": len(direct_indirect_overlap),
        "unlockInverseMissingCount": len(expected_unlocks - unlocks),
        "unlockInverseExtraCount": len(unlocks - expected_unlocks),
        "indirectMissingCount": len(expected_indirect - indirect),
        "indirectExtraCount": len(indirect - expected_indirect),
        "errors": errors,
    }


def source_topic_iri(topic_id: str) -> str:
    from urllib.parse import quote

    return f"{INSTANCE_NAMESPACE}topic/{quote(topic_id, safe='')}"


def source_standard_iri(standard_key: str) -> str:
    from urllib.parse import quote

    return f"{INSTANCE_NAMESPACE}standard/{quote(standard_key, safe='')}"


def validate_qualified_round_trips(graph: Graph) -> dict[str, Any]:
    dependencies = (
        read_json("data/kr/dependencies.json")["dependencies"]
        + read_json("data/kr/dependencies.candidate.json")["dependencies"]
    )
    standards = read_json("data/kr/curriculum-standards.json")
    standard_mappings = standards["standardMappings"]
    direct = relation_pairs(graph, LM.directRequires)
    aligned = relation_pairs(graph, LM.alignedToStandard)

    prerequisite_pairs = Counter()
    official_pairs = Counter()
    prerequisite_records = Counter()
    for assertion in graph.subjects(RDF.type, LM.PrerequisiteAssertion):
        dependent = graph.value(assertion, LM.dependentTopic)
        prerequisite = graph.value(assertion, LM.prerequisiteTopic)
        strength = graph.value(assertion, LM.prerequisiteStrength)
        layer = graph.value(assertion, LM.assertionLayer)
        prerequisite_pairs[(str(dependent), str(prerequisite))] += 1
        if layer == OFFICIAL_LAYER:
            official_pairs[(str(dependent), str(prerequisite))] += 1
        prerequisite_records[
            (
                str(dependent),
                str(prerequisite),
                str(strength),
                literal_string(graph, assertion, LM.legacyPrerequisiteStrength),
                literal_string(graph, assertion, LM.prerequisiteReason),
                literal_string(graph, assertion, LM.assertionBasis),
                literal_string(graph, assertion, LM.assertionSource),
                str(layer),
                str(graph.value(assertion, LM.relationKind)),
                str(graph.value(assertion, LM.basisKind)),
                str(graph.value(assertion, LM.scope)),
                str(graph.value(assertion, LM.reviewStatus)),
                literal_string(graph, assertion, LM.relationIdentifier),
            )
        ] += 1

    expected_prerequisite_records = Counter()
    for edge in dependencies:
        normalized = "required" if edge["strength"] == "hard" else "recommended"
        expected_prerequisite_records[
            (
                source_topic_iri(edge["topicId"]),
                source_topic_iri(edge["prerequisiteId"]),
                f"{VOCABULARY_NAMESPACE}DependencyRequirementLevel/{normalized}",
                edge["strength"],
                edge["reason"],
                edge["basis"],
                edge["source"],
                f"{VOCABULARY_NAMESPACE}RelationLayer/{edge['layer']}",
                f"{VOCABULARY_NAMESPACE}RelationKind/{edge['relationKind']}",
                f"{VOCABULARY_NAMESPACE}BasisKind/{edge['basisKind']}",
                f"{VOCABULARY_NAMESPACE}RelationScope/{edge['scope']}",
                f"{VOCABULARY_NAMESPACE}ReviewStatus/{edge['reviewStatus']}",
                edge["id"],
            )
        ] += 1

    alignment_pairs = Counter()
    alignment_records = Counter()
    for alignment in graph.subjects(RDF.type, LM.StandardTopicAlignment):
        topic = graph.value(alignment, LM.alignmentTopic)
        standard = graph.value(alignment, LM.alignmentStandard)
        alignment_pairs[(str(topic), str(standard))] += 1
        alignment_records[
            (
                str(topic),
                str(standard),
                str(graph.value(alignment, LM.alignmentKind)),
                literal_string(graph, alignment, LM.sourceAlignmentRelationship),
                literal_string(graph, alignment, LM.sourceConfidenceValue),
                literal_string(graph, alignment, LM.sourceAlignmentNote),
                literal_string(graph, alignment, LM.sourceAlignmentRationale),
                str(graph.value(alignment, LM.confidence)),
                graph.value(alignment, LM.confidenceDefaulted).toPython(),
                literal_string(graph, alignment, LM.defaultingPolicy),
                literal_string(graph, alignment, LM.sourceVerificationStatus),
                graph.value(alignment, LM.verificationStatusDefaulted).toPython(),
                literal_string(graph, alignment, LM.assertionBasis),
                literal_string(graph, alignment, LM.assertionSource),
            )
        ] += 1

    expected_alignment_records = Counter()
    for mapping in standard_mappings:
        source_confidence = str(mapping.get("confidence"))
        numeric_confidence = bool(re.match(r"^\d+(\.\d+)?$", source_confidence))
        confidence = source_confidence if numeric_confidence else "0.5"
        defaulted = not numeric_confidence
        source_status = mapping.get("verificationStatus")
        expected_alignment_records[
            (
                source_topic_iri(mapping["microTopicId"]),
                source_standard_iri(mapping["standardKey"]),
                f"{VOCABULARY_NAMESPACE}AlignmentKind/{mapping['relationship']}",
                mapping["relationship"],
                source_confidence,
                mapping.get("note"),
                mapping.get("rationale"),
                confidence,
                defaulted,
                None if not defaulted else "alignment-confidence-default-v1",
                source_status,
                not bool(source_status),
                mapping["workstreamFile"],
                "data/kr/curriculum-standards.json#standardMappings",
            )
        ] += 1

    prerequisite_pair_set = set(official_pairs)
    alignment_pair_set = set(alignment_pairs)
    duplicate_prerequisites = sum(count - 1 for count in prerequisite_pairs.values() if count > 1)
    duplicate_alignments = sum(count - 1 for count in alignment_pairs.values() if count > 1)
    errors = []
    if direct != prerequisite_pair_set:
        errors.append(
            f"directRequires/official PrerequisiteAssertion mismatch missing {len(direct - prerequisite_pair_set)}, "
            f"extra {len(prerequisite_pair_set - direct)}"
        )
    if aligned != alignment_pair_set:
        errors.append(
            f"alignedToStandard/StandardTopicAlignment mismatch missing {len(aligned - alignment_pair_set)}, "
            f"extra {len(alignment_pair_set - aligned)}"
        )
    if duplicate_prerequisites:
        errors.append(f"duplicate PrerequisiteAssertion pairs {duplicate_prerequisites}")
    if duplicate_alignments:
        errors.append(f"duplicate StandardTopicAlignment pairs {duplicate_alignments}")
    if prerequisite_records != expected_prerequisite_records:
        errors.append(
            "PrerequisiteAssertion qualifier round-trip mismatch "
            f"missing {sum((expected_prerequisite_records - prerequisite_records).values())}, "
            f"extra {sum((prerequisite_records - expected_prerequisite_records).values())}"
        )
    if alignment_records != expected_alignment_records:
        errors.append(
            "StandardTopicAlignment qualifier round-trip mismatch "
            f"missing {sum((expected_alignment_records - alignment_records).values())}, "
            f"extra {sum((alignment_records - expected_alignment_records).values())}"
        )

    return {
        "pass": not errors,
        "directRequiresAgreement": direct == prerequisite_pair_set,
        "alignedToStandardAgreement": aligned == alignment_pair_set,
        "prerequisiteAssertionCount": sum(prerequisite_pairs.values()),
        "standardTopicAlignmentCount": sum(alignment_pairs.values()),
        "duplicatePrerequisitePairs": duplicate_prerequisites,
        "duplicateAlignmentPairs": duplicate_alignments,
        "prerequisiteQualifierRoundTrip": prerequisite_records == expected_prerequisite_records,
        "alignmentQualifierRoundTrip": alignment_records == expected_alignment_records,
        "errors": errors,
    }


def load_fixture_graph(relative_path: str | None = None) -> Graph:
    graph = Graph()
    graph.parse(str(ROOT / "ontology" / "fixtures" / "canonical-positive.ttl"), format="turtle")
    if relative_path is not None:
        graph.parse(str(ROOT / "ontology" / "fixtures" / "adversarial" / relative_path), format="turtle")
    return graph


def run_fixture_suite(shapes_graph: Graph, ontology_graph: Graph) -> dict[str, Any]:
    positive_graph = load_fixture_graph()
    positive = run_shacl(positive_graph, shapes_graph, ontology_graph)
    expected = read_json("ontology/fixtures/adversarial/expected.json")
    adversarial_results = {}
    errors = []
    if positive["conforms"] is not True or positive["violationCount"] != 0:
        errors.append("canonical-positive.ttl must conform with zero violations")

    for path in sorted((ROOT / "ontology" / "fixtures" / "adversarial").glob("*.ttl")):
        name = path.name
        graph = load_fixture_graph(name)
        result = run_shacl(graph, shapes_graph, ontology_graph)
        messages = "\n".join(item["message"] for item in result["results"])
        paths = "\n".join(item["path"] for item in result["results"])
        expected_entry = expected.get(name, {})
        fragments = expected_entry.get("expectedFragments", [])
        fragment_hits = {fragment: (fragment in messages or fragment in paths) for fragment in fragments}
        case_pass = result["conforms"] is False and result["violationCount"] > 0 and all(fragment_hits.values())
        adversarial_results[name] = {
            "conforms": result["conforms"],
            "violationCount": result["violationCount"],
            "expectedFragments": fragments,
            "fragmentHits": fragment_hits,
            "pass": case_pass,
        }
        if not case_pass:
            errors.append(f"{name}: adversarial fixture did not fail with expected fragments")

    return {
        "pass": not errors,
        "canonicalPositive": {
            "conforms": positive["conforms"],
            "violationCount": positive["violationCount"],
            "tripleCount": len(positive_graph),
        },
        "adversarial": adversarial_results,
        "errors": errors,
    }


def run_reasoner(tbox_graph: Graph) -> dict[str, Any]:
    fixture = load_fixture_graph()
    graph = merge_graphs(tbox_graph, fixture)
    before = len(graph)
    DeductiveClosure(OWLRL_Semantics, axiomatic_triples=False, datatype_axioms=True).expand(graph)
    after = len(graph)

    unsat_named_classes = sorted(
        term_key(subject)
        for subject in graph.subjects(RDFS.subClassOf, OWL.Nothing)
        if isinstance(subject, URIRef) and str(subject).startswith(ONTOLOGY_NAMESPACE)
    )
    equivalent_nothing = sorted(
        term_key(subject)
        for subject in graph.subjects(OWL.equivalentClass, OWL.Nothing)
        if isinstance(subject, URIRef) and str(subject).startswith(ONTOLOGY_NAMESPACE)
    )
    impossible_individuals = sorted(
        term_key(subject)
        for subject in graph.subjects(RDF.type, OWL.Nothing)
        if isinstance(subject, URIRef)
    )
    disjoint_violations = []
    for left, _, right in graph.triples((None, OWL.disjointWith, None)):
        for individual in set(graph.subjects(RDF.type, left)).intersection(graph.subjects(RDF.type, right)):
            disjoint_violations.append(f"{term_key(individual)} typed as disjoint {term_key(left)} and {term_key(right)}")

    errors = unsat_named_classes + equivalent_nothing + impossible_individuals + sorted(disjoint_violations)
    return {
        "pass": not errors,
        "profile": "OWL-RL bounded TBox plus canonical-positive fixture",
        "inputTripleCount": before,
        "closureTripleCount": after,
        "inferredTripleCount": after - before,
        "unsatisfiableNamedClassCount": len(unsat_named_classes) + len(equivalent_nothing),
        "explicitContradictionCount": len(impossible_individuals) + len(disjoint_violations),
        "errors": errors[:50],
    }


def build_input_hashes() -> dict[str, str]:
    paths = set(PARSED_INPUTS)
    paths.update(ROUND_TRIP_SOURCE_FILES)
    paths.add("ontology/queries/expected.json")
    paths.add("ontology/fixtures/canonical-positive.ttl")
    paths.add("ontology/fixtures/adversarial/expected.json")
    paths.update(str(path.relative_to(ROOT)) for path in (ROOT / "ontology" / "queries").glob("*.rq"))
    paths.update(str(path.relative_to(ROOT)) for path in (ROOT / "ontology" / "fixtures" / "adversarial").glob("*.ttl"))
    return {path: file_hash(path) for path in sorted(paths)}


def validate_ontology() -> dict[str, Any]:
    versions = tool_versions()
    graphs = {path: parse_graph(path, rdf_format) for path, rdf_format in PARSED_INPUTS.items()}
    tbox_graph = merge_graphs(graphs["ontology/learning-map.ttl"], graphs["ontology/k12-core.ttl"])
    shapes_graph = graphs["ontology/shapes.ttl"]
    data_graph = graphs["dist/ontology/learning-map.ttl"]
    ontology_graph = tbox_graph

    graph_equivalence = parse_and_compare_generated_graphs(graphs)
    full_shacl = run_shacl(data_graph, shapes_graph, ontology_graph)
    reasoner = run_reasoner(tbox_graph)
    queries = execute_competency_queries(data_graph)
    fixtures = run_fixture_suite(shapes_graph, ontology_graph)
    jsonld_resources = validate_jsonld_resource_shape()
    profile = validate_profile(data_graph, tbox_graph)
    grade_bands = validate_grade_bands(data_graph)
    source_rights = validate_source_rights(data_graph)
    relations = validate_relations(data_graph, tbox_graph)
    qualified = validate_qualified_round_trips(data_graph)

    resource_counts = graph_resource_counts(data_graph)
    relation_summary = relation_counts(data_graph)
    count_errors = []
    if resource_counts != EXPECTED_GRAPH_RESOURCES:
        count_errors.append(f"graphResources mismatch: {resource_counts}")
    for name, expected_count in EXPECTED_RELATIONS.items():
        if relation_summary[name]["count"] != expected_count:
            count_errors.append(f"{name} expected {expected_count}, found {relation_summary[name]['count']}")
    manifest = read_json("dist/ontology/manifest.json")
    if manifest.get("sourceRecords") != EXPECTED_SOURCE_COUNTS:
        count_errors.append("manifest sourceRecords changed")
    if manifest.get("graphResources") != EXPECTED_GRAPH_RESOURCES:
        count_errors.append("manifest graphResources changed")

    checks = {
        "graphEquivalence": graph_equivalence["pass"],
        "fullDataShacl": full_shacl["conforms"] and full_shacl["violationCount"] == 0,
        "reasoner": reasoner["pass"],
        "competencyQueries": queries["pass"],
        "fixtures": fixtures["pass"],
        "jsonldResources": jsonld_resources["pass"],
        "profile": profile["pass"],
        "gradeBands": grade_bands["pass"],
        "sourceRights": source_rights["pass"],
        "relations": relations["pass"],
        "qualifiedRoundTrips": qualified["pass"],
        "counts": not count_errors,
    }

    report = {
        "overallPass": all(checks.values()),
        "checks": checks,
        "toolVersions": versions,
        "inputHashes": build_input_hashes(),
        "graphs": {
            "parsedTripleCounts": {path: len(graph) for path, graph in sorted(graphs.items())},
            "generatedEquivalence": graph_equivalence,
        },
        "counts": {
            "sourceRecords": manifest.get("sourceRecords"),
            "graphResources": resource_counts,
            "totalGraphResources": sum(resource_counts.values()),
            "relations": relation_summary,
            "errors": count_errors,
        },
        "shacl": full_shacl,
        "reasoner": reasoner,
        "competencyQueries": queries,
        "fixtures": fixtures,
        "integrity": {
            "jsonldResources": jsonld_resources,
            "profile": profile,
            "gradeBands": grade_bands,
            "sourceRights": source_rights,
            "relations": relations,
            "qualifiedRoundTrips": qualified,
        },
    }
    return report


def write_report(report: dict[str, Any], report_path: Path) -> None:
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(sorted_json(report), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate ontology P2 RDF, SHACL, OWL-RL, and SPARQL gates.")
    parser.add_argument("--report", default=str(REPORT_PATH), help="Validation report output path.")
    args = parser.parse_args()

    try:
        report = validate_ontology()
    except Exception as error:
        failure = {
            "overallPass": False,
            "error": str(error),
            "toolVersions": {
                "python": platform.python_version(),
            },
        }
        write_report(failure, Path(args.report))
        print(f"Ontology P2 validation failed before completion: {error}", file=sys.stderr)
        return 1

    write_report(report, Path(args.report))
    print(
        "Ontology P2 validation "
        f"{'passed' if report['overallPass'] else 'failed'}; report written to {Path(args.report)}"
    )
    return 0 if report["overallPass"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
