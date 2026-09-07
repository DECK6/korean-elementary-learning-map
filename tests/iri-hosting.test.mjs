import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  RDF,
  classifyTerm,
  collectSiteIris,
  iriToHostedPath,
  iris,
  literal,
  pathExists,
  resolveIriCoverage,
  scanTurtle,
} from '../scripts/lib/iri-hosting.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('IRIs map to GitHub Pages paths the way the site serves them', () => {
  assert.equal(iriToHostedPath('https://dexa.art/learnmap/ontology#LearningTopic'), 'learnmap/ontology/index.html');
  assert.equal(iriToHostedPath('https://dexa.art/learnmap/ontology'), 'learnmap/ontology/index.html');
  assert.equal(iriToHostedPath('https://dexa.art/learnmap/ontology/0.4.0'), 'learnmap/ontology/0.4.0/index.html');
  assert.equal(iriToHostedPath('https://dexa.art/learnmap/ontology/k12-core.ttl'), 'learnmap/ontology/k12-core.ttl');
  assert.equal(iriToHostedPath('https://dexa.art/learnmap/vocab/#/AlignmentKind/supports'), 'learnmap/vocab/index.html');
  assert.equal(iriToHostedPath('https://dexa.art/learnmap/vocab/facet/concept'), 'learnmap/vocab/facet/concept/index.html');
  assert.equal(iriToHostedPath('https://dexa.art/learnmap/#/topic/kr.mt.x'), 'learnmap/index.html');
  assert.equal(iriToHostedPath('http://www.w3.org/2002/07/owl#Class'), null);
});

test('the Turtle scanner reads the TBox and k12-core files completely', async () => {
  const vocabulary = JSON.parse(await readFile(path.join(ROOT, 'ontology', 'controlled-vocabulary.json'), 'utf8'));
  const tbox = scanTurtle(await readFile(path.join(ROOT, 'ontology', 'learning-map.ttl'), 'utf8'));
  const kinds = {};
  for (const term of tbox.terms) kinds[classifyTerm(term)] = (kinds[classifyTerm(term)] ?? 0) + 1;
  assert.equal(kinds.class, vocabulary.classes.length);
  // Concept-valued registry "datatype" properties are modelled as object properties in the TBox, so
  // only the combined property count is comparable to the registry.
  assert.ok(kinds.objectProperty + kinds.datatypeProperty >= 90, `scanner found ${kinds.objectProperty + kinds.datatypeProperty} properties`);
  const topic = tbox.terms.find((term) => term.iri === 'https://dexa.art/learnmap/ontology#LearningTopic');
  assert.equal(literal(topic, RDF.label, 'en'), 'Learning topic');
  assert.match(literal(topic, RDF.comment, 'en'), /teachable unit/);

  const core = scanTurtle(await readFile(path.join(ROOT, 'ontology', 'k12-core.ttl'), 'utf8'));
  const facets = core.terms.filter((term) => classifyTerm(term) === 'concept' && iris(term, RDF.inScheme).some((scheme) => scheme.endsWith('#FacetScheme')));
  assert.equal(facets.length, 8);
  assert.equal(literal(facets.find((term) => literal(term, RDF.notation) === 'concept'), RDF.prefLabel, 'ko'), '개념');
});

test('coverage resolution distinguishes hosted, assumed and unhosted IRIs', () => {
  const coverage = resolveIriCoverage(new Set([
    'https://dexa.art/learnmap/ontology#A',
    'https://dexa.art/learnmap/#/topic/x',
    'https://dexa.art/learnmap/id/x',
    'https://dexa.art/learnmap/missing/thing',
  ]), { hostedPaths: ['learnmap/ontology/index.html'], assumedPaths: ['learnmap/index.html'], ignoredPrefixes: ['https://dexa.art/learnmap/id/'] });
  assert.deepEqual(coverage.covered.map((entry) => entry.coveredBy), ['assumed', 'hosted']);
  assert.deepEqual(coverage.uncovered.map((entry) => entry.path), ['learnmap/missing/thing/index.html']);
  assert.deepEqual([...collectSiteIris('<https://dexa.art/learnmap/ontology#A> , "https://dexa.art/learnmap/vocab/#/S/t".')], ['https://dexa.art/learnmap/ontology#A', 'https://dexa.art/learnmap/vocab/#/S/t']);
});

test('the sibling repository carries the same iri-hosting module', async () => {
  const sibling = path.join(ROOT, '..', 'korean-secondary-learning-map', 'scripts', 'lib', 'iri-hosting.mjs');
  if (!(await pathExists(sibling))) return;
  const [ours, theirs] = await Promise.all([readFile(path.join(ROOT, 'scripts', 'lib', 'iri-hosting.mjs')), readFile(sibling)]);
  assert.ok(ours.equals(theirs), 'scripts/lib/iri-hosting.mjs differs between the elementary and secondary repositories');
});
