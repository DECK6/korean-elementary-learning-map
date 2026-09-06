import { readFileSync, readdirSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import { isAuthoredObservableEvidence } from './kr-content-quality.mjs';

// 주제 콘텐츠 오버레이(개선계획 P3-2). 빌더·검증기·워커 게이트가 같은 규칙을 쓰도록 한 곳에 모은다.
// 파일 형식은 중등 저장소(scripts/lib/content-overlay.mjs)와 같고, 초등은 assessmentPrompt가
// 문자열 하나라는 점만 다르다.
export const CONTENT_KINDS = ['mechanical-derivative', 'source-grounded-draft'];
export const OVERLAY_MIN_LENGTHS = { evidence: 25, assessmentPrompt: 40, misconception: 15 };
export const OVERLAY_SCHEMA_FILE = 'kr-content-overlay.schema.json';
export const GRADE_BANDS = ['1-2', '3-4', '5-6'];

// 오버레이 파일 이름 규칙: `<subject>-<gradeBand>.json`. subject는 workstream 교과 키다.
const subjectSlugByKorean = {
  '과학': 'science',
  '국어': 'korean',
  '도덕': 'moral',
  '미술': 'art',
  '사회': 'social',
  '수학': 'math',
  '실과(기술·가정)/정보': 'practical-arts',
  '영어': 'english-efl',
  '음악': 'music',
  '체육': 'pe',
  '통합교과': 'integrated',
};

export const SUBJECT_SLUGS = [...new Set(Object.values(subjectSlugByKorean))].sort((a, b) => a.localeCompare(b, 'en'));

export function subjectSlug(subjectKorean) {
  return subjectSlugByKorean[(subjectKorean ?? '').trim()] ?? null;
}

export const contentOverlayDirectory = (dataDir) => resolve(dataDir, 'content');

/** Splits `math-1-2` into its subject key and grade band; an unparsable name yields nulls. */
export function parseOverlaySlug(slug) {
  const match = /^(.+)-(1-2|3-4|5-6)$/.exec(slug ?? '');
  if (!match) return { subject: null, gradeBand: null };
  return { subject: match[1], gradeBand: match[2] };
}

export function normalizeText(value) {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

/** Longest run shared with the official standard summary that authored content may reuse. */
export const VERBATIM_RUN_LIMIT = 15;

/** Collapses to letters and digits so spacing and punctuation cannot hide a reused sentence. */
function verbatimKey(value) {
  return normalizeText(value).normalize('NFC').replace(/[^0-9A-Za-z가-힣]/g, '');
}

/**
 * Longest contiguous character run the two strings share once punctuation and spacing are removed.
 * Stops as soon as the run exceeds `limit`, so the common case costs one pass.
 */
export function longestSharedRun(left, right, limit = VERBATIM_RUN_LIMIT) {
  const source = verbatimKey(left);
  const target = verbatimKey(right);
  let best = 0;
  let fragment = '';
  for (let start = 0; start < source.length; start += 1) {
    let end = start + best + 1;
    while (end <= source.length && target.includes(source.slice(start, end))) {
      best = end - start;
      fragment = source.slice(start, end);
      if (best > limit) return { length: best, fragment };
      end += 1;
    }
  }
  return { length: best, fragment };
}

export function overlayEntryStrings(entry) {
  return [
    ...(entry.evidence ?? []).map((text) => ({ field: 'evidence', text })),
    ...(entry.assessmentPrompt == null ? [] : [{ field: 'assessmentPrompt', text: entry.assessmentPrompt }]),
    ...(entry.misconceptions ?? []).map((text) => ({ field: 'misconceptions', text })),
  ];
}

const minLengthFor = {
  evidence: OVERLAY_MIN_LENGTHS.evidence,
  assessmentPrompt: OVERLAY_MIN_LENGTHS.assessmentPrompt,
  misconceptions: OVERLAY_MIN_LENGTHS.misconception,
};

/** Reads every overlay document under data/kr/content. A missing directory means zero overlays. */
export function readContentOverlays(directory) {
  let names = [];
  try {
    names = readdirSync(directory);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  return names
    .filter((name) => extname(name) === '.json')
    .sort((a, b) => a.localeCompare(b, 'en'))
    .map((name) => {
      const path = resolve(directory, name);
      const slug = basename(name, '.json');
      return {
        file: name,
        slug,
        path,
        ...parseOverlaySlug(slug),
        document: JSON.parse(readFileSync(path, 'utf8')),
      };
    });
}

/** Flattens overlay documents into one topicId -> entry index; a topic may be authored only once. */
export function indexOverlayEntries(overlays) {
  const entries = new Map();
  const errors = [];
  for (const overlay of overlays) {
    for (const [topicId, entry] of Object.entries(overlay.document.entries ?? {})) {
      if (entries.has(topicId)) {
        errors.push(`${overlay.file}: topic ${topicId} is already authored in ${entries.get(topicId).file}`);
        continue;
      }
      entries.set(topicId, { topicId, entry, file: overlay.file, slug: overlay.slug, document: overlay.document });
    }
  }
  return { entries, errors };
}

/** Merge point: an overlay replaces the mechanical evidence/prompt and records its provenance. */
export function applyContentOverlay(topic, hit) {
  if (!hit) {
    topic.contentKind = 'mechanical-derivative';
    return false;
  }
  topic.evidence = [...hit.entry.evidence];
  topic.assessmentPrompt = hit.entry.assessmentPrompt;
  topic.contentKind = 'source-grounded-draft';
  if (hit.entry.misconceptions?.length) topic.misconceptions = [...hit.entry.misconceptions];
  topic.contentSourceLocator = { ...hit.entry.sourceLocator };
  return true;
}

/**
 * Content checks shared by validate-kr.mjs and scripts/dev/check-content-overlay.mjs:
 * dangling ids, misfiled subject/grade band, minimum lengths, verbatim standard copies,
 * exact duplicates, and the elementary learner-observable evidence rule.
 */
export function analyzeOverlay({ label, overlay, topicsById, standardsByKey }) {
  const errors = [];
  const entries = Object.entries(overlay.document.entries ?? {});
  const seen = { evidence: new Map(), assessmentPrompt: new Map() };
  const stats = { entries: entries.length, evidence: 0, assessmentPrompt: 0, misconceptions: 0, verbatim: 0, duplicates: 0 };

  for (const [topicId, entry] of entries) {
    const where = `${label}/${topicId}`;
    const topic = topicsById.get(topicId);
    if (!topic) {
      errors.push(`${where}: dangling topic id`);
      continue;
    }
    const filed = `${subjectSlug(topic.subjectKorean) ?? 'unknown'}-${topic.gradeBand ?? 'unknown'}`;
    if (overlay.subject && overlay.gradeBand && filed !== `${overlay.subject}-${overlay.gradeBand}`) {
      errors.push(`${where}: topic belongs to ${filed} but is filed under ${overlay.subject}-${overlay.gradeBand}`);
    }
    const summaries = (topic.standards ?? [])
      .map((standardKey) => normalizeText(standardsByKey.get(standardKey)?.summary))
      .filter((summary) => summary.length >= 12);

    for (const { field, text } of overlayEntryStrings(entry)) {
      stats[field] += 1;
      const normalized = normalizeText(text);
      if (normalized.length < minLengthFor[field]) errors.push(`${where}: ${field} shorter than ${minLengthFor[field]} characters`);
      // The standard summary is now an authored paraphrase of the official sentence, so a long
      // shared run means the authored draft leaked the source wording back in.
      const reused = summaries
        .map((summary) => longestSharedRun(normalized, summary))
        .find((run) => run.length > VERBATIM_RUN_LIMIT);
      if (reused) {
        stats.verbatim += 1;
        errors.push(
          `${where}: ${field} shares a ${reused.length}-character run with the standard summary (${reused.fragment})`,
        );
      }
      // Elementary evidence must stay learner-observable; provenance belongs in provenanceEvidence.
      if (field === 'evidence' && !isAuthoredObservableEvidence(text)) {
        errors.push(`${where}: evidence is not learner-observable or reads as provenance`);
      }
      if (field === 'misconceptions') continue;
      const previous = seen[field].get(normalized);
      if (previous) {
        stats.duplicates += 1;
        errors.push(`${where}: ${field} duplicates ${previous} exactly`);
      } else seen[field].set(normalized, topicId);
    }
  }
  return { errors, stats };
}

/**
 * P3-2 지표: 완전 중복 문장, 템플릿 비율(성취기준 요약을 'X'로 치환한 뒤 남는 동일 문자열),
 * 출처 기반 초안 수. 오버레이가 0건이면 모든 주제가 mechanical-derivative로 집계된다.
 */
export function computeContentProvenanceMetrics(topics, summaryByStandardKey = new Map()) {
  const metrics = {
    topics: topics.length,
    sourceGroundedDraft: 0,
    mechanicalDerivative: 0,
    duplicateEvidence: 0,
    duplicateAssessmentPrompt: 0,
    templateRatio: 0,
    misconceptions: 0,
  };
  const errors = [];
  const seen = { evidence: new Map(), assessmentPrompt: new Map() };
  const counters = { evidence: 'duplicateEvidence', assessmentPrompt: 'duplicateAssessmentPrompt' };
  const shapes = new Set();
  let shapeTotal = 0;

  const templateShape = (topic, text) => {
    let shape = normalizeText(text);
    for (const standardKey of topic.standards ?? []) {
      const summary = summaryByStandardKey.get(standardKey);
      if (summary) shape = shape.split(summary).join('X');
    }
    return shape;
  };

  for (const topic of topics) {
    if (topic.contentKind === 'source-grounded-draft') metrics.sourceGroundedDraft += 1;
    else metrics.mechanicalDerivative += 1;
    metrics.misconceptions += topic.misconceptions?.length ?? 0;
    const byField = {
      evidence: (topic.evidence ?? []).filter((item) => typeof item === 'string'),
      assessmentPrompt: typeof topic.assessmentPrompt === 'string' ? [topic.assessmentPrompt] : [],
    };
    for (const [field, texts] of Object.entries(byField)) {
      for (const text of texts) {
        const normalized = normalizeText(text);
        const previous = seen[field].get(normalized);
        if (previous) {
          metrics[counters[field]] += 1;
          if (topic.contentKind === 'source-grounded-draft') {
            errors.push(`${topic.id}: source-grounded ${field} duplicates ${previous} exactly`);
          }
        } else seen[field].set(normalized, topic.id);
        shapes.add(templateShape(topic, text));
        shapeTotal += 1;
      }
    }
  }
  metrics.templateRatio = shapeTotal ? Number(((shapeTotal - shapes.size) / shapeTotal).toFixed(4)) : 0;
  return { metrics, errors };
}

export function summaryByStandardKey(standardsFile) {
  const summaries = new Map();
  for (const curriculum of standardsFile.curricula ?? []) {
    for (const standard of curriculum.standards ?? []) summaries.set(standard.key, normalizeText(standard.summary));
  }
  return summaries;
}

export function standardsByKeyFrom(standardsFile) {
  const standards = new Map();
  for (const curriculum of standardsFile.curricula ?? []) {
    for (const standard of curriculum.standards ?? []) standards.set(standard.key, standard);
  }
  return standards;
}
