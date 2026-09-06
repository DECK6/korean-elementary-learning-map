import Ajv2020 from 'ajv/dist/2020.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  CONTENT_KINDS,
  OVERLAY_SCHEMA_FILE,
  SUBJECT_SLUGS,
  analyzeOverlay,
  applyContentOverlay,
  contentOverlayDirectory,
  indexOverlayEntries,
  parseOverlaySlug,
  readContentOverlays,
  standardsByKeyFrom,
  subjectSlug,
} from '../scripts/lib/kr-content-overlay.mjs';
import { isAuthoredObservableEvidence, isLearnerObservableEvidence } from '../scripts/lib/kr-content-quality.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const KR_DATA = resolve(ROOT, 'data', 'kr');
const FIXTURE_DIR = resolve(ROOT, 'tests', 'fixtures', 'content-overlay');
const readData = (name) => JSON.parse(readFileSync(resolve(KR_DATA, name), 'utf8'));

const overlays = readContentOverlays(FIXTURE_DIR);
const topics = readData('topics.json').topics;
const topicsById = new Map(topics.map((topic) => [topic.id, topic]));
const standardsByKey = standardsByKeyFrom(readData('curriculum-standards.json'));

const analyze = (overlay) => analyzeOverlay({ label: `content/${overlay.file}`, overlay, topicsById, standardsByKey });
const clone = (overlay) => ({ ...overlay, document: JSON.parse(JSON.stringify(overlay.document)) });
const onlyEntry = (overlay) => Object.values(overlay.document.entries)[0];
const matched = (errors, needle) => errors.some((error) => error.includes(needle));

test('overlay files are named by the subject key and grade band', () => {
  assert.equal(subjectSlug('수학'), 'math');
  assert.equal(subjectSlug('실과(기술·가정)/정보'), 'practical-arts');
  assert.equal(subjectSlug('영어'), 'english-efl');
  assert.equal(subjectSlug('알 수 없는 교과'), null);
  assert.deepEqual(parseOverlaySlug('math-1-2'), { subject: 'math', gradeBand: '1-2' });
  assert.deepEqual(parseOverlaySlug('english-efl-5-6'), { subject: 'english-efl', gradeBand: '5-6' });
  assert.deepEqual(parseOverlaySlug('math'), { subject: null, gradeBand: null });
  assert.equal(SUBJECT_SLUGS.length, 11);
});

test('the fixture overlay validates against the published schema', () => {
  const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });
  const validate = ajv.compile(JSON.parse(readFileSync(resolve(ROOT, 'schema', OVERLAY_SCHEMA_FILE), 'utf8')));
  assert.equal(overlays.length, 1);
  assert.equal(validate(overlays[0].document), true, JSON.stringify(validate.errors));
  const { entries, errors } = indexOverlayEntries(overlays);
  assert.deepEqual(errors, []);
  assert.equal(entries.size, 1);
});

test('the fixture overlay passes every content check', () => {
  const { errors, stats } = analyze(overlays[0]);
  assert.deepEqual(errors, []);
  assert.deepEqual(stats, {
    entries: 1,
    evidence: 2,
    assessmentPrompt: 1,
    misconceptions: 2,
    verbatim: 0,
    duplicates: 0,
  });
});

test('an overlay entry merges into the generated topic', () => {
  const [topicId, hit] = [...indexOverlayEntries(overlays).entries][0];
  const topic = {
    id: topicId,
    evidence: ['템플릿 증거 1', '템플릿 증거 2'],
    assessmentPrompt: '템플릿 프롬프트',
    contentKind: 'mechanical-derivative',
  };
  assert.equal(applyContentOverlay(topic, hit), true);
  assert.equal(topic.contentKind, 'source-grounded-draft');
  assert.deepEqual(topic.evidence, hit.entry.evidence);
  assert.equal(topic.assessmentPrompt, hit.entry.assessmentPrompt);
  assert.deepEqual(topic.misconceptions, hit.entry.misconceptions);
  assert.deepEqual(topic.contentSourceLocator, hit.entry.sourceLocator);
});

test('a topic without an overlay entry stays mechanical', () => {
  const topic = { id: 'kr.mt.math.example', evidence: ['템플릿 증거'], assessmentPrompt: '템플릿 프롬프트' };
  assert.equal(applyContentOverlay(topic, undefined), false);
  assert.equal(topic.contentKind, 'mechanical-derivative');
  assert.equal(topic.contentSourceLocator, undefined);
});

test('content checks reject dangling topic ids', () => {
  const overlay = clone(overlays[0]);
  overlay.document.entries['kr.mt.math.does-not-exist'] = onlyEntry(overlay);
  assert.ok(matched(analyze(overlay).errors, 'dangling topic id'));
});

test('content checks reject a misfiled subject or grade band', () => {
  const misfiledSubject = { ...clone(overlays[0]), subject: 'korean' };
  assert.ok(matched(analyze(misfiledSubject).errors, 'is filed under korean-1-2'));
  const misfiledBand = { ...clone(overlays[0]), gradeBand: '5-6' };
  assert.ok(matched(analyze(misfiledBand).errors, 'is filed under math-5-6'));
});

test('content checks reject a long run shared with the official standard summary', () => {
  const overlay = clone(overlays[0]);
  const [topicId, entry] = Object.entries(overlay.document.entries)[0];
  const summary = standardsByKey.get(topicsById.get(topicId).standards[0]).summary;
  entry.evidence = [`학습자가 ${summary} 내용을 활동으로 보여 준다.`, entry.evidence[1]];
  const { errors, stats } = analyze(overlay);
  assert.equal(stats.verbatim, 1);
  assert.ok(matched(errors, 'character run with the standard summary'));
});

test('content checks allow a short run shared with the official standard summary', () => {
  const overlay = clone(overlays[0]);
  const [topicId, entry] = Object.entries(overlay.document.entries)[0];
  const summary = standardsByKey.get(topicsById.get(topicId).standards[0]).summary;
  entry.evidence = [`학습자가 ${summary.slice(0, 8)}을 활동으로 골라 보여 준다.`, entry.evidence[1]];
  assert.equal(analyze(overlay).stats.verbatim, 0);
});

test('content checks reject strings below the authoring minimum length', () => {
  const overlay = clone(overlays[0]);
  const entry = onlyEntry(overlay);
  entry.evidence = ['짧은 증거를 적는다.', '또 다른 짧은 증거를 적는다.'];
  entry.assessmentPrompt = '너무 짧은 평가 프롬프트를 적는다.';
  entry.misconceptions = ['짧은 오답'];
  const errors = analyze(overlay).errors;
  assert.ok(matched(errors, 'evidence shorter than 25 characters'));
  assert.ok(matched(errors, 'assessmentPrompt shorter than 40 characters'));
  assert.ok(matched(errors, 'misconceptions shorter than 15 characters'));
});

test('content checks reject provenance sentences in place of learner-observable evidence', () => {
  const overlay = clone(overlays[0]);
  const entry = onlyEntry(overlay);
  entry.evidence = [
    '이 주제는 공식 성취기준에서 분해했으며 원문은 재수록하지 않는다고 기록한다.',
    entry.evidence[1],
  ];
  assert.ok(matched(analyze(overlay).errors, 'evidence is not learner-observable'));
});

test('authored evidence may teach source credibility while the repair path keeps the strict rule', () => {
  const learningContent = [
    '글에 적힌 출처를 찾아 믿을 만한지 두 가지 근거로 판단해 말한다.',
    '가져온 자료의 원문을 어디서 얻었는지 밝혀 적고 친구에게 설명한다.',
  ];
  for (const item of learningContent) {
    assert.equal(isAuthoredObservableEvidence(item), true, item);
    assert.equal(isLearnerObservableEvidence(item), false, item);
  }
  const provenanceMeta = [
    '이 주제의 출처 locator는 별책5 인쇄 20쪽을 가리킨다고 기록한다.',
    '원문 재수록 없이 별책5에서 분해했다고 적어 둔다.',
    '별책5 인쇄 20쪽 원문을 그대로 옮겨 적는다.',
  ];
  for (const item of provenanceMeta) {
    assert.equal(isAuthoredObservableEvidence(item), false, item);
  }
  const overlay = clone(overlays[0]);
  onlyEntry(overlay).evidence = learningContent;
  assert.ok(!matched(analyze(overlay).errors, 'evidence is not learner-observable'));
});

test('content checks reject exact duplicates inside one overlay file', () => {
  const overlay = clone(overlays[0]);
  const [topicId, entry] = Object.entries(overlay.document.entries)[0];
  const topic = topicsById.get(topicId);
  const sibling = topics.find(
    (candidate) =>
      candidate.id !== topicId &&
      candidate.subjectKorean === topic.subjectKorean &&
      candidate.gradeBand === topic.gradeBand,
  );
  overlay.document.entries[sibling.id] = JSON.parse(JSON.stringify(entry));
  const { errors, stats } = analyze(overlay);
  assert.ok(stats.duplicates > 0);
  assert.ok(matched(errors, 'duplicates'));
});

test('the same topic may not be authored in two overlay files', () => {
  const duplicate = clone(overlays[0]);
  duplicate.file = 'math-3-4.json';
  const { errors } = indexOverlayEntries([overlays[0], duplicate]);
  assert.equal(errors.length, 1);
  assert.ok(errors[0].includes('already authored in'));
});

test('built topics carry content provenance', () => {
  const unknown = topics.filter((topic) => !CONTENT_KINDS.includes(topic.contentKind));
  assert.deepEqual(unknown, []);
  const drafts = topics.filter((topic) => topic.contentKind === 'source-grounded-draft');
  for (const topic of drafts) assert.ok(topic.contentSourceLocator?.sourceId);
  const authored = readContentOverlays(contentOverlayDirectory(KR_DATA)).flatMap((overlay) =>
    Object.keys(overlay.document.entries ?? {}),
  );
  assert.equal(drafts.length, authored.length);
});
