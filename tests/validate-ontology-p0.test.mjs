import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { validateControlledVocabulary } from '../scripts/validate-ontology-p0.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const VOCABULARY_PATH = resolve(ROOT, 'ontology', 'controlled-vocabulary.json');

function fixture() {
  return JSON.parse(readFileSync(VOCABULARY_PATH, 'utf8'));
}

test('ontology P0 controlled vocabulary is valid', () => {
  assert.deepEqual(validateControlledVocabulary(fixture()), []);
});

test('ontology P0 validator rejects duplicate terms and missing definitions', () => {
  const vocabulary = fixture();
  vocabulary.classes[1].term = vocabulary.classes[0].term;
  delete vocabulary.objectProperties[0].definition;

  const topicTypeScheme = vocabulary.conceptSchemes.find(
    (entry) => entry.term === 'LearningTopicType',
  );
  topicTypeScheme.concepts[1].term = topicTypeScheme.concepts[0].term;
  delete topicTypeScheme.concepts[0].definition;

  const errors = validateControlledVocabulary(vocabulary);
  assert.ok(errors.some((error) => error.includes(`duplicate term ${vocabulary.classes[0].term}`)));
  assert.ok(errors.some((error) => error.includes('objectProperties[0] missing definition')));
  assert.ok(errors.some((error) => error.includes('conceptSchemes[0].concepts[0] missing definition')));
  assert.ok(
    errors.some((error) =>
      error.includes(`duplicate term ${topicTypeScheme.concepts[0].term}`),
    ),
  );
});

test('ontology P0 validator requires the release core terms', () => {
  const vocabulary = fixture();
  vocabulary.classes = vocabulary.classes.filter((entry) => entry.term !== 'CoverageGap');
  vocabulary.objectProperties = vocabulary.objectProperties.filter(
    (entry) => entry.term !== 'directRequires',
  );

  const errors = validateControlledVocabulary(vocabulary);
  assert.ok(errors.includes('classes missing required term CoverageGap'));
  assert.ok(errors.includes('objectProperties missing required term directRequires'));
});

test('ontology P0 preserves prerequisite and topic-type semantic guardrails', () => {
  const vocabulary = fixture();
  const properties = new Map(vocabulary.objectProperties.map((entry) => [entry.term, entry]));
  const directRequires = properties.get('directRequires');
  const indirectRequires = properties.get('indirectRequires');
  const unlocks = properties.get('unlocks');

  assert.equal(directRequires.inverseOf, 'unlocks');
  assert.equal(directRequires.assertionPolicy, 'asserted');
  assert.equal(indirectRequires.assertionPolicy, 'derived-only');
  assert.equal(indirectRequires.minimumDirectPathLength, 2);
  assert.equal(unlocks.assertionPolicy, 'derived-only');
  assert.equal(unlocks.inverseOf, 'directRequires');

  const schemes = new Map(vocabulary.conceptSchemes.map((entry) => [entry.term, entry]));
  const topicTypes = schemes.get('LearningTopicType');
  assert.equal(topicTypes.modeling, 'skos:Concept');
  assert.equal(topicTypes.disjointnessAsserted, false);
  assert.ok(topicTypes.concepts.every((concept) => concept.term && concept.definition));

  const dependencyLevels = schemes.get('DependencyRequirementLevel');
  assert.deepEqual(dependencyLevels.legacyValueMap, {
    hard: 'required',
    soft: 'recommended',
  });
});

test('ontology P0 contract remains available within the P1 machine-readable release', () => {
  for (const filename of [
    'README.md',
    'competency-questions.md',
    'conceptual-model.md',
    'vocabulary.md',
    'uri-policy.md',
    'controlled-vocabulary.json',
  ]) {
    assert.equal(existsSync(resolve(ROOT, 'ontology', filename)), true, filename);
  }

  const rootReadme = readFileSync(resolve(ROOT, 'README.md'), 'utf8');
  assert.match(rootReadme, /P1 \/ machine-readable ontology/);
  assert.match(rootReadme, /P2 추론·질의 게이트는 아직 포함하지 않습니다/);
});
