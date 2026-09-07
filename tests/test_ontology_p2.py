import hashlib
import json
import subprocess
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REPORT_PATH = ROOT / "dist" / "ontology" / "validation-report.json"
VALIDATOR = ROOT / "scripts" / "validate-ontology.py"

EXPECTED_TOOLS = {
    "rdflib": "7.1.4",
    "pyshacl": "0.30.1",
    "owlrl": "7.1.4",
}



def _relation_layer_counts():
    official = json.loads((ROOT / "data" / "kr" / "dependencies.json").read_text(encoding="utf-8"))
    candidate = json.loads(
        (ROOT / "data" / "kr" / "dependencies.candidate.json").read_text(encoding="utf-8")
    )
    return len(official["dependencies"]), len(candidate["dependencies"])


def _dataset_counts():
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


OFFICIAL_RELATION_COUNT, CANDIDATE_RELATION_COUNT = _relation_layer_counts()
ASSERTION_COUNT = OFFICIAL_RELATION_COUNT + CANDIDATE_RELATION_COUNT
DATASET_COUNTS = _dataset_counts()
# Source locators and verification records that do not belong to a prerequisite
# assertion; every official relation adds one of each, every candidate relation
# adds one verification record, and every source-grounded draft adds one
# content source locator.
BASE_SOURCE_LOCATORS = 1424
BASE_VERIFICATION_RECORDS = 4560

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
    # Only the official layer materializes directRequires / unlocks.
    "directRequires": OFFICIAL_RELATION_COUNT,
    "unlocks": OFFICIAL_RELATION_COUNT,
}

EXPECTED_ADVERSARIAL = {
    "direct-cycle.ttl",
    "direct-self-loop.ttl",
    "duplicate-prerequisite-assertion.ttl",
    "invalid-grade-band.ttl",
    "missing-inverse.ttl",
    "missing-qualifier.ttl",
    "missing-required-cardinality.ttl",
    "missing-content-locator.ttl",
    "qualifier-edge-mismatch.ttl",
    "source-status-incoherence.ttl",
}


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_report():
    return json.loads(REPORT_PATH.read_text(encoding="utf-8"))


def report_is_fresh(report):
    hashes = report.get("inputHashes", {})
    if not hashes:
        return False
    for relative_path, expected_hash in hashes.items():
        path = ROOT / relative_path
        if not path.exists() or sha256(path) != expected_hash:
            return False
    return True


class OntologyP2ReportTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if REPORT_PATH.exists():
            report = load_report()
            if report.get("overallPass") is True and report_is_fresh(report):
                cls.report = report
                return

        completed = subprocess.run(
            [sys.executable, str(VALIDATOR)],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )
        if completed.returncode != 0:
            raise AssertionError(
                "ontology P2 validator failed\n"
                f"stdout:\n{completed.stdout}\n"
                f"stderr:\n{completed.stderr}"
            )
        cls.report = load_report()

    def test_tool_versions_and_overall_pass(self):
        self.assertTrue(self.report["overallPass"])
        for name, version in EXPECTED_TOOLS.items():
            self.assertEqual(self.report["toolVersions"][name], version)
        self.assertTrue(report_is_fresh(self.report))

    def test_full_data_shacl_and_reasoner(self):
        self.assertTrue(self.report["shacl"]["conforms"])
        self.assertEqual(self.report["shacl"]["violationCount"], 0)
        self.assertTrue(self.report["reasoner"]["pass"])
        self.assertEqual(self.report["reasoner"]["unsatisfiableNamedClassCount"], 0)
        self.assertEqual(self.report["reasoner"]["explicitContradictionCount"], 0)

    def test_counts_and_materialized_relations(self):
        self.assertEqual(self.report["counts"]["graphResources"], EXPECTED_GRAPH_RESOURCES)
        self.assertEqual(
            self.report["counts"]["totalGraphResources"],
            sum(EXPECTED_GRAPH_RESOURCES.values()),
        )
        for relation, count in EXPECTED_RELATIONS.items():
            self.assertEqual(self.report["counts"]["relations"][relation]["count"], count)
            self.assertEqual(self.report["integrity"]["relations"]["counts"][relation], count)
        relation_checks = self.report["integrity"]["relations"]
        self.assertEqual(relation_checks["selfEdgeCount"], 0)
        self.assertEqual(relation_checks["cycleNodeCount"], 0)
        self.assertEqual(relation_checks["unlockInverseMissingCount"], 0)
        self.assertEqual(relation_checks["indirectMissingCount"], 0)
        self.assertFalse(relation_checks["directRequiresDeclaredTransitive"])

    def test_competency_queries_have_expected_results(self):
        queries = self.report["competencyQueries"]
        self.assertTrue(queries["pass"])
        self.assertEqual(queries["queryCount"], 19)
        self.assertEqual(
            queries["results"]["cq-04-direct-prerequisites.rq"]["rowCount"],
            OFFICIAL_RELATION_COUNT,
        )
        self.assertEqual(
            queries["results"]["cq-06-unlocks.rq"]["rowCount"], OFFICIAL_RELATION_COUNT
        )
        # Every source document plus the dataset release itself must carry a rights status.
        self.assertEqual(
            queries["results"]["cq-12-rights-hold.rq"]["rowCount"],
            DATASET_COUNTS["sources"] + 1,
        )
        # Contract section 8: one anchor per standard, and every auxiliary topic names a sibling.
        self.assertEqual(queries["results"]["cq-19-topic-roles.rq"]["rowCount"], 3)
        self.assertEqual(
            queries["results"]["cq-14-alignment-round-trip.rq"]["rowCount"],
            DATASET_COUNTS["standardMappings"],
        )
        self.assertEqual(
            queries["results"]["cq-15-prerequisite-round-trip.rq"]["rowCount"], ASSERTION_COUNT
        )
        self.assertEqual(queries["results"]["cq-16-relation-layers.rq"]["rowCount"], 4)
        # Every topic carries exactly one content kind; all 1,956 are authored drafts since the
        # R6 overlays landed, so the query returns the single source-grounded-draft row.
        self.assertEqual(queries["results"]["cq-17-content-kinds.rq"]["rowCount"], 1)
        # The core-vocabulary query text is shared with the secondary repository.
        self.assertGreater(queries["results"]["cq-18-k12-core-vocabulary.rq"]["rowCount"], 0)

    def test_fixtures_and_round_trips(self):
        fixtures = self.report["fixtures"]
        self.assertTrue(fixtures["pass"])
        self.assertTrue(fixtures["canonicalPositive"]["conforms"])
        self.assertEqual(fixtures["canonicalPositive"]["violationCount"], 0)
        self.assertEqual(set(fixtures["adversarial"]), EXPECTED_ADVERSARIAL)
        for name, result in fixtures["adversarial"].items():
            self.assertFalse(result["conforms"], name)
            self.assertGreater(result["violationCount"], 0, name)
            self.assertTrue(result["pass"], name)

        round_trips = self.report["integrity"]["qualifiedRoundTrips"]
        self.assertTrue(round_trips["directRequiresAgreement"])
        self.assertTrue(round_trips["alignedToStandardAgreement"])
        self.assertTrue(round_trips["prerequisiteQualifierRoundTrip"])
        self.assertTrue(round_trips["alignmentQualifierRoundTrip"])


if __name__ == "__main__":
    unittest.main()
