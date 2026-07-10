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

EXPECTED_GRAPH_RESOURCES = {
    "AchievementStandard": 620,
    "AssessmentPrompt": 1956,
    "CoverageGap": 43,
    "Curriculum": 11,
    "DatasetRelease": 1,
    "EvidenceCriterion": 4056,
    "GradeBand": 5,
    "LearningCluster": 153,
    "LearningDomain": 79,
    "LearningTopic": 1956,
    "PrerequisiteAssertion": 1894,
    "SourceDocument": 17,
    "SourceLocator": 1232,
    "StandardTopicAlignment": 1956,
    "Subject": 12,
    "VerificationRecord": 6455,
}

EXPECTED_RELATIONS = {
    "alignedToStandard": 1956,
    "directRequires": 1894,
    "indirectRequires": 53656,
    "unlocks": 1894,
}

EXPECTED_ADVERSARIAL = {
    "direct-cycle.ttl",
    "direct-self-loop.ttl",
    "duplicate-prerequisite-assertion.ttl",
    "invalid-grade-band.ttl",
    "missing-inverse.ttl",
    "missing-qualifier.ttl",
    "missing-required-cardinality.ttl",
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
        self.assertEqual(self.report["counts"]["totalGraphResources"], 20446)
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
        self.assertEqual(queries["queryCount"], 15)
        self.assertEqual(queries["results"]["cq-05-indirect-prerequisites.rq"]["rowCount"], 53656)
        self.assertEqual(queries["results"]["cq-11-coverage-gaps.rq"]["rowCount"], 19)
        self.assertEqual(queries["results"]["cq-12-rights-hold.rq"]["rowCount"], 18)
        self.assertEqual(queries["results"]["cq-14-alignment-round-trip.rq"]["rowCount"], 1956)
        self.assertEqual(queries["results"]["cq-15-prerequisite-round-trip.rq"]["rowCount"], 1894)

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
