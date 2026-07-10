import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { repairWorkstreamContent } from '../scripts/lib/kr-content-quality.mjs';
import { OFFICIAL_SUBJECT_SPECS } from '../scripts/lib/kr-official-subject-inventories.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const readWorkstream = (name) =>
  JSON.parse(readFileSync(resolve(ROOT, 'data', 'kr', 'workstreams', name), 'utf8'));

function assertSubjectInventory(artifact, spec) {
  const expectedCodes = spec.standards.map((standard) => standard.code).sort();
  const standards = artifact.standards.filter((standard) => standard.sourceRefs.includes(spec.sourceId));
  assert.deepEqual(standards.map((standard) => standard.code).sort(), expectedCodes);
  for (const standard of standards) {
    const inventory = spec.standards.find((candidate) => candidate.code === standard.code);
    assert.equal(standard.summary, inventory.focus);
    assert.equal(standard.verificationStatus, 'official-source-checked');
    assert.equal(standard.sourceId, spec.sourceId);
    assert.deepEqual(standard.sourceRefs, [spec.sourceId]);
    assert.equal(standard.sourceLocator.sourceId, spec.sourceId);
    assert.equal(standard.sourceLocator.attachmentNo, spec.attachmentNo);
    assert.equal(standard.sourceLocator.sha256, spec.sha256);
    assert.equal(standard.sourceLocator.pdfPage, inventory.pdfPage);
    assert.equal(standard.sourceTextIncluded, false);
  }
}

test('official subject inventory snapshots have exact reviewed counts and unique codes', () => {
  const counts = { social: 49, art: 26, music: 26, physicalEducation: 49 };
  for (const [key, spec] of Object.entries(OFFICIAL_SUBJECT_SPECS)) {
    assert.equal(spec.standards.length, counts[key]);
    assert.equal(new Set(spec.standards.map((standard) => standard.code)).size, counts[key]);
    assert.match(spec.sha256, /^[a-f0-9]{64}$/);
    assert.ok(spec.standards.every((standard) => Number.isInteger(standard.pdfPage)));
  }
});

test('social workstream exactly follows the 49-code Annex 7 inventory with item-level locators', () => {
  const artifact = readWorkstream('social.json');
  assert.equal(artifact.standardCount, 49);
  assert.equal(artifact.microTopicCount, 147);
  assertSubjectInventory(artifact, OFFICIAL_SUBJECT_SPECS.social);
});

test('arts/PE workstream uses only official 3-4 and 5-6 code families and preserves reviewed records', () => {
  const artifact = readWorkstream('arts-pe.json');
  assert.equal(artifact.standardCount, 101);
  assert.equal(artifact.microTopicCount, 303);
  assertSubjectInventory(artifact, OFFICIAL_SUBJECT_SPECS.art);
  assertSubjectInventory(artifact, OFFICIAL_SUBJECT_SPECS.music);
  assertSubjectInventory(artifact, OFFICIAL_SUBJECT_SPECS.physicalEducation);
  assert.equal(artifact.standards.some((standard) => /^\[2(미|음|체)/.test(standard.code)), false);
  assert.deepEqual(repairWorkstreamContent(artifact).standards, artifact.standards);
});

test('social and arts/PE learner fields preserve each standard focus without undefined placeholders', () => {
  for (const file of ['social.json', 'arts-pe.json']) {
    const artifact = readWorkstream(file);
    const standardByKey = new Map(artifact.standards.map((standard) => [standard.key, standard]));

    for (const topic of artifact.microTopics) {
      const standard = standardByKey.get(topic.standards[0]);
      assert.ok(standard, `${file}: missing standard for ${topic.id}`);
      const learnerFacingText = [topic.description, ...topic.evidence, topic.assessmentPrompt].join('\n');
      assert.doesNotMatch(learnerFacingText, /\bundefined\b/, `${file}: ${topic.id}`);
      assert.ok(learnerFacingText.includes(standard.summary), `${file}: ${topic.id} lost ${standard.summary}`);
    }

    assert.equal(
      new Set(artifact.microTopics.map((topic) => topic.assessmentPrompt)).size,
      artifact.microTopics.length,
      `${file}: assessment prompts must remain topic-specific`,
    );
  }
});
