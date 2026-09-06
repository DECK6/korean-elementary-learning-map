#!/usr/bin/env node
import Ajv2020 from 'ajv/dist/2020.js';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CONTENT_KINDS,
  OVERLAY_SCHEMA_FILE,
  analyzeOverlay,
  contentOverlayDirectory,
  indexOverlayEntries,
  readContentOverlays,
} from './lib/kr-content-overlay.mjs';
import { contentQualityErrors } from './lib/kr-content-quality.mjs';
import {
  STANDARD_SUMMARY_KIND,
  STANDARD_SUMMARY_LENGTH,
  standardSummary,
} from './lib/kr-standard-summaries.mjs';
import {
  COVERAGE_GAP_SEVERITIES,
  COVERAGE_GAP_STATUSES,
  FACET_KEYS,
  RELATION_ENUMS,
  relationId,
} from './lib/relation-vocabulary.mjs';
import {
  OFFICIAL_INVENTORY_GATES,
  OFFICIAL_PDF_SOURCE_SNAPSHOTS,
  STALE_KR_SOURCE_IDS,
} from './lib/kr-source-provenance.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KR_SCHEMA = resolve(ROOT, 'schema');
const KR_DATA = process.env.KR_DATA_DIR ? resolve(process.env.KR_DATA_DIR) : resolve(ROOT, 'data', 'kr');
const load = (name) => JSON.parse(readFileSync(resolve(KR_DATA, name), 'utf8'));
const bytesOf = (name) => readFileSync(resolve(KR_DATA, name));

const MIN_TOPICS = 1500;
const TYPES = new Set(['CONCEPTUAL', 'PROCEDURAL', 'REPRESENTATIONAL', 'LANGUAGE', 'META']);
const REL = new Set(['introduces', 'supports', 'extends', 'assesses']);
const STR = new Set(['hard', 'soft']);
const FACETS = new Set(FACET_KEYS);
const SCOPES = new Set(RELATION_ENUMS.scope);
const OFFICIAL_REVIEW_STATUSES = new Set([
  'internal-reviewed',
  'subject-expert-reviewed',
  'classroom-reviewed',
]);
const CANDIDATE_BASIS_KINDS = new Set([
  'official-code-order',
  'decomposition-order',
  'repository-authored',
  'expert-authored',
]);
const VER = new Set(['official-source-checked', 'public-doc-derived', 'needs-official-code-check']);
const KR_CODE = /^\[[246][국수과사영도실바슬즐건미음체][0-9]{2}-[0-9]{2}\]$/;

const errors = [];
const check = (cond, msg) => {
  if (!cond) errors.push(msg);
};
const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;
const isMeaningfulString = (value) =>
  typeof value === 'string' &&
  value.trim().length >= 8 &&
  !/^(?:x|todo|tbd|n\/?a|none|null|-+)$/i.test(value.trim());
const meaningfulStringLeaves = (value) => {
  if (typeof value === 'string') return isMeaningfulString(value) ? 1 : 0;
  if (Array.isArray(value)) return value.reduce((count, item) => count + meaningfulStringLeaves(item), 0);
  if (value && typeof value === 'object') {
    return Object.values(value).reduce((count, item) => count + meaningfulStringLeaves(item), 0);
  }
  return 0;
};
const hasEvidence = (value) =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every((item) => meaningfulStringLeaves(item) > 0);
const hasVerificationEvidence = (record) =>
  meaningfulStringLeaves(record.sourceLocator) > 0 ||
  meaningfulStringLeaves(record.sourceSection) > 0 ||
  meaningfulStringLeaves(record.evidence) > 0 ||
  meaningfulStringLeaves(record.sourceEvidence) > 0 ||
  meaningfulStringLeaves(record.verificationNotes) > 0 ||
  meaningfulStringLeaves(record.verificationNote) > 0;
const hasTopicVerificationEvidence = (record) =>
  meaningfulStringLeaves(record.sourceLocator) > 0 ||
  meaningfulStringLeaves(record.sourceSection) > 0 ||
  meaningfulStringLeaves(record.provenanceEvidence) > 0 ||
  meaningfulStringLeaves(record.sourceEvidence) > 0 ||
  meaningfulStringLeaves(record.verificationNotes) > 0 ||
  meaningfulStringLeaves(record.verificationNote) > 0;
const gradeBandForCode = (code) => ({ 2: '1-2', 4: '3-4', 6: '5-6' })[String(code || '').match(/^\[([246])/)?.[1]];
const hasItemLevelSourceLocator = (record, expectedSourceId, sourceSnapshot = {}) => {
  const sourceLocator = record.sourceLocator;
  if (sourceLocator && typeof sourceLocator === 'object' && !Array.isArray(sourceLocator)) {
    const locatorCode = sourceLocator.code || sourceLocator.standardCode;
    return (
      sourceLocator.sourceId === expectedSourceId &&
      sourceLocator.attachmentNo === sourceSnapshot.attachmentNo &&
      sourceLocator.sha256 === sourceSnapshot.sha256 &&
      Number.isInteger(sourceLocator.pdfPage) &&
      locatorCode === record.code
    );
  }

  const evidenceObjects = [
    ...(Array.isArray(record.evidence) ? record.evidence : []),
    ...(Array.isArray(record.sourceEvidence) ? record.sourceEvidence : []),
  ].filter((item) => item && typeof item === 'object' && !Array.isArray(item));
  if (
    evidenceObjects.some((item) => {
      if (item.sourceId !== expectedSourceId || !isMeaningfulString(item.locator)) return false;
      return JSON.stringify(item).includes(record.code) && /(?:pdf|line|section|쪽|페이지)/i.test(item.locator);
    })
  ) {
    return true;
  }

  // Legacy Korean and base integrated records retain a source section plus
  // source-specific text rather than structured locator objects. All three
  // anchors are required so code-only evidence cannot pass as item evidence.
  const legacyText = JSON.stringify([
    record.sourceLocator,
    record.sourceSection,
    record.evidence,
    record.sourceEvidence,
  ]);
  return (
    isMeaningfulString(record.sourceSection) &&
    legacyText.includes(record.code) &&
    (legacyText.includes(sourceSnapshot.attachmentNo || '__missing_attachment__') ||
      /NCIC PDF \[별책\d+\]/.test(String(record.sourceLocator || '')))
  );
};

function listKrJsonFiles(directory = KR_DATA, prefix = '') {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const relativeName = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...listKrJsonFiles(resolve(directory, entry.name), relativeName));
    else if (entry.isFile() && entry.name.endsWith('.json') && relativeName !== 'manifest.json') files.push(relativeName);
  }
  return files.sort();
}

const standardsFile = load('curriculum-standards.json');
const topicsFile = load('topics.json');
const depsFile = load('dependencies.json');
const candidateDepsFile = load('dependencies.candidate.json');
const clustersFile = load('clusters.json');
const manifest = load('manifest.json');

const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });
for (const [dataName, schemaName, data] of [
  ['curriculum-standards.json', 'kr-curriculum-standards.schema.json', standardsFile],
  ['topics.json', 'kr-topics.schema.json', topicsFile],
  ['dependencies.json', 'kr-dependencies.schema.json', depsFile],
  ['dependencies.candidate.json', 'kr-dependencies-candidate.schema.json', candidateDepsFile],
  ['clusters.json', 'kr-clusters.schema.json', clustersFile],
]) {
  const schema = JSON.parse(readFileSync(resolve(KR_SCHEMA, schemaName), 'utf8'));
  const validateSchema = ajv.compile(schema);
  if (!validateSchema(data)) {
    for (const error of validateSchema.errors || []) {
      errors.push(
        `JSON Schema ${dataName}${error.instancePath || '/'} ${error.message}${error.params ? ` (${JSON.stringify(error.params)})` : ''}`,
      );
    }
  }
}

check(standardsFile.locale === 'ko-KR', 'curriculum-standards locale must be ko-KR');
check(standardsFile.country === 'KR', 'curriculum-standards country must be KR');
check(standardsFile.textPolicy?.standardTextIncluded === false, 'standardTextIncluded must be false');
check(VER.has(standardsFile.verificationStatus), `bad top verificationStatus ${standardsFile.verificationStatus}`);
check(standardsFile.sourceCount === standardsFile.sources?.length, 'sourceCount mismatch');
check(standardsFile.curriculumCount === standardsFile.curricula?.length, 'curriculumCount mismatch');
check(topicsFile.topicCount === topicsFile.topics?.length, 'topicCount mismatch');
check(depsFile.edgeCount === depsFile.dependencies?.length, 'edgeCount mismatch');
check(
  candidateDepsFile.edgeCount === candidateDepsFile.dependencies?.length,
  'candidate edgeCount mismatch',
);
check(clustersFile.clusterCount === clustersFile.clusters?.length, 'clusterCount mismatch');
check(topicsFile.topicCount >= MIN_TOPICS, `KR topic target missed: ${topicsFile.topicCount} < ${MIN_TOPICS}`);
check(depsFile.graphPolicy?.relation === 'prerequisite', 'dependency graph relation must be prerequisite');
check(depsFile.graphPolicy?.acyclic === true, 'dependency graph policy must require acyclic=true');
check(
  depsFile.graphPolicy?.edgeSelection === 'official-source-only',
  'official dependency graph must use official-source-only edges',
);
check(depsFile.graphPolicy?.crossSubjectEdges === 'none', 'dependency graph must declare crossSubjectEdges=none');
check(depsFile.layer === 'official', 'dependencies.json must declare layer=official');
check(
  candidateDepsFile.layer === 'pedagogical-candidate',
  'dependencies.candidate.json must declare layer=pedagogical-candidate',
);
check(
  candidateDepsFile.graphPolicy?.edgeSelection === 'pedagogical-candidate-only',
  'candidate dependency graph must use pedagogical-candidate-only edges',
);
check(
  candidateDepsFile.graphPolicy?.crossSubjectEdges === 'none',
  'candidate dependency graph must declare crossSubjectEdges=none',
);
check(
  depsFile.graphPolicy?.layers?.official?.edgeCount === depsFile.edgeCount,
  'official layer policy edgeCount mismatch',
);
check(
  depsFile.graphPolicy?.layers?.['pedagogical-candidate']?.edgeCount === candidateDepsFile.edgeCount,
  'candidate layer policy edgeCount mismatch',
);
check(manifest.counts?.sources === standardsFile.sourceCount, 'manifest source count mismatch');
check(manifest.counts?.topics === topicsFile.topicCount, 'manifest topic count mismatch');
check(manifest.counts?.dependencies === depsFile.edgeCount, 'manifest dependency count mismatch');
check(
  manifest.counts?.candidateDependencies === candidateDepsFile.edgeCount,
  'manifest candidate dependency count mismatch',
);
check(
  manifest.relationLayers?.official?.edgeCount === depsFile.edgeCount,
  'manifest official relation layer count mismatch',
);
check(
  manifest.relationLayers?.['pedagogical-candidate']?.edgeCount === candidateDepsFile.edgeCount,
  'manifest candidate relation layer count mismatch',
);
check(manifest.counts?.clusters === clustersFile.clusterCount, 'manifest cluster count mismatch');
check(manifest.counts?.curricula === standardsFile.curriculumCount, 'manifest curriculum count mismatch');
check(manifest.counts?.standards === standardsFile.standardCount, 'manifest standard count mismatch');

const sourceIds = new Set();
const sourcesById = new Map();
for (const source of standardsFile.sources || []) {
  check(isNonEmptyString(source.id), 'source missing id');
  check(isNonEmptyString(source.name), `source ${source.id} missing name`);
  check(isNonEmptyString(source.url), `source ${source.id} missing url`);
  check(isNonEmptyString(source.accessDate), `source ${source.id} missing accessDate`);
  check(isNonEmptyString(source.usage), `source ${source.id} missing usage`);
  check(isNonEmptyString(source.sourceType), `source ${source.id} missing sourceType`);
  check(!STALE_KR_SOURCE_IDS.has(source.id), `stale KR source alias remains ${source.id}`);
  check(!/\/bbs\/eduNotice2022\//i.test(source.url || ''), `dead NCIC notice URL remains ${source.id}: ${source.url}`);
  if (sourceIds.has(source.id)) errors.push(`duplicate source id ${source.id}`);
  sourceIds.add(source.id);
  sourcesById.set(source.id, source);

  if (!isNonEmptyString(source.url)) continue;
  if (/^https?:\/\//i.test(source.url)) {
    try {
      const parsed = new URL(source.url);
      check(['http:', 'https:'].includes(parsed.protocol) && Boolean(parsed.hostname), `source URL invalid ${source.id}: ${source.url}`);
    } catch {
      errors.push(`source URL invalid ${source.id}: ${source.url}`);
    }
  } else {
    const localRef = source.url.startsWith('file:') ? source.url.slice('file:'.length) : source.url;
    const localPath = resolve(ROOT, localRef);
    const repoRelativePath = relative(ROOT, localPath);
    check(
      !isAbsolute(localRef) &&
        !/^[a-z][a-z0-9+.-]*:/i.test(localRef) &&
        !/\s/.test(localRef) &&
        repoRelativePath !== '..' &&
        !repoRelativePath.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`),
      `source URL/path invalid ${source.id}: ${source.url}`,
    );
    check(existsSync(localPath), `local source path missing ${source.id}: ${source.url}`);
  }
}
const standardKeys = new Set();
const standardsByKey = new Map();
const subjectByEnglish = new Map();
const subjectByKorean = new Map();
const curriculaById = new Map();
let standardCount = 0;

for (const curriculum of standardsFile.curricula || []) {
  curriculaById.set(curriculum.id, curriculum);
  check(curriculum.id === curriculum.slug, `curriculum slug mismatch ${curriculum.id}`);
  check(curriculum.country === 'KR', `curriculum country mismatch ${curriculum.id}`);
  check(curriculum.textIncluded === false, `curriculum textIncluded false required ${curriculum.id}`);
  check(curriculum.standardCount === curriculum.standards?.length, `standardCount mismatch ${curriculum.id}`);
  check(VER.has(curriculum.verificationStatus), `bad curriculum verification ${curriculum.id}`);
  subjectByEnglish.set(curriculum.subject, curriculum.subjectKorean);
  subjectByKorean.set(curriculum.subjectKorean, curriculum.subject);

  for (const standard of curriculum.standards || []) {
    standardCount += 1;
    check(standard.key === `${curriculum.id}:${standard.code}`, `standard key mismatch ${standard.key}`);
    check(KR_CODE.test(standard.code), `bad KR code ${standard.code}`);
    check(
      standard.gradeBand === gradeBandForCode(standard.code),
      `standard gradeBand mismatch ${standard.key}: ${standard.gradeBand} != ${gradeBandForCode(standard.code)}`,
    );
    check(standard.sourceTextIncluded === false, `sourceTextIncluded false required ${standard.key}`);
    check(standard.officialTextIncluded !== true, `officialTextIncluded true not allowed ${standard.key}`);
    check(VER.has(standard.verificationStatus), `bad standard verification ${standard.key}`);
    check(isNonEmptyString(standard.sourceBasis), `missing sourceBasis ${standard.key}`);
    check(isNonEmptyString(standard.summary), `missing summary ${standard.key}`);
    // Summaries are release data: an authored, non-quoting paraphrase of the official sentence.
    // The paraphrase table is the single source, so a hand edit to a workstream cannot drift.
    check(
      standard.summaryKind === STANDARD_SUMMARY_KIND,
      `standard summaryKind must be ${STANDARD_SUMMARY_KIND} ${standard.key}`,
    );
    const summaryLength = (standard.summary ?? '').trim().length;
    check(
      summaryLength >= STANDARD_SUMMARY_LENGTH.min && summaryLength <= STANDARD_SUMMARY_LENGTH.max,
      `standard summary length ${summaryLength} outside ${STANDARD_SUMMARY_LENGTH.min}-${STANDARD_SUMMARY_LENGTH.max} ${standard.key}`,
    );
    check(
      standard.summary === standardSummary(standard.code, standard.summary),
      `standard summary does not match the authored paraphrase table ${standard.key}`,
    );
    check(
      !/재수록하지 않|표준 본문|성취기준 \[/.test(standard.summary ?? ''),
      `standard summary is a placeholder rather than a paraphrase ${standard.key}`,
    );
    check(Array.isArray(standard.sourceRefs) && standard.sourceRefs.length > 0, `missing sourceRefs ${standard.key}`);
    for (const ref of standard.sourceRefs || []) check(sourceIds.has(ref), `unknown sourceRef ${ref}`);
    if (standard.verificationStatus === 'official-source-checked') {
      check(hasVerificationEvidence(standard), `official-source-checked standard missing verification evidence ${standard.key}`);
    }
    if (standardKeys.has(standard.key)) errors.push(`duplicate standard key ${standard.key}`);
    standardKeys.add(standard.key);
    standardsByKey.set(standard.key, standard);
  }
}

check(standardsFile.standardCount === standardCount, `standardCount ${standardsFile.standardCount} != ${standardCount}`);

for (const [curriculumId, gate] of Object.entries(OFFICIAL_INVENTORY_GATES)) {
  const curriculum = curriculaById.get(curriculumId);
  check(Boolean(curriculum), `official inventory gate missing curriculum ${curriculumId}`);
  if (!curriculum) continue;
  check(
    curriculum.standardCount === gate.standardCount,
    `official inventory count mismatch ${curriculumId}: ${curriculum.standardCount} != ${gate.standardCount}`,
  );
  const inventoryDigest = createHash('sha256')
    .update((curriculum.standards || []).map((standard) => standard.code).sort().join('\n'))
    .digest('hex');
  check(
    inventoryDigest === gate.codeInventorySha256,
    `official inventory code digest mismatch ${curriculumId}: ${inventoryDigest} != ${gate.codeInventorySha256}`,
  );
  for (const group of gate.sourceGroups) {
    const source = sourcesById.get(group.sourceId);
    check(Boolean(source), `official inventory source missing ${curriculumId}: ${group.sourceId}`);
    if (source) {
      check(source.sourceType === 'official-pdf', `official inventory source must be official-pdf ${group.sourceId}`);
      check(/\/inv\/org\/download\.do/i.test(source.url), `official inventory source must use direct NCIC download ${group.sourceId}`);
      check(isNonEmptyString(source.attachmentNo), `official inventory source missing attachmentNo ${group.sourceId}`);
      for (const [field, expected] of Object.entries(OFFICIAL_PDF_SOURCE_SNAPSHOTS[group.sourceId] || {})) {
        check(
          source[field] === expected,
          `official source fingerprint mismatch ${group.sourceId}.${field}: ${JSON.stringify(source[field])} != ${JSON.stringify(expected)}`,
        );
      }
    }
    const matchingStandards = (curriculum.standards || []).filter((standard) =>
      group.matches ? group.matches(standard) : true,
    );
    check(
      matchingStandards.length === group.standardCount,
      `official source group count mismatch ${curriculumId}:${group.sourceId}: ${matchingStandards.length} != ${group.standardCount}`,
    );
    for (const standard of matchingStandards) {
      check(
        standard.verificationStatus === 'official-source-checked',
        `official inventory standard status mismatch ${standard.key}`,
      );
      check(
        standard.sourceRefs?.includes(group.sourceId),
        `official inventory direct source missing ${standard.key}: ${group.sourceId}`,
      );
      check(
        hasItemLevelSourceLocator(standard, group.sourceId, OFFICIAL_PDF_SOURCE_SNAPSHOTS[group.sourceId]),
        `official inventory structured source locator missing ${standard.key}`,
      );
    }
  }
}

const topicIds = new Set();
const topicsById = new Map();
for (const topic of topicsFile.topics || []) {
  check(topic.id?.startsWith('kr.mt.'), `bad topic id ${topic.id}`);
  check(TYPES.has(topic.type), `bad topic type ${topic.id}: ${topic.type}`);
  check(isNonEmptyString(topic.subject), `topic missing subject ${topic.id}`);
  check(subjectByEnglish.get(topic.subject) === topic.subjectKorean, `topic subject mismatch ${topic.id}`);
  check(isNonEmptyString(topic.name) || isNonEmptyString(topic.title), `topic missing name/title ${topic.id}`);
  check(isMeaningfulString(topic.description), `topic description is empty or placeholder-quality ${topic.id}`);
  check(hasEvidence(topic.evidence), `topic missing evidence ${topic.id}`);
  check(isMeaningfulString(topic.assessmentPrompt), `topic assessmentPrompt is empty or placeholder-quality ${topic.id}`);
  check(!topic.assessmentPrompt?.includes('{{'), `topic prompt still has template token ${topic.id}`);
  check(Array.isArray(topic.standards) && topic.standards.length > 0, `topic missing standards ${topic.id}`);
  for (const key of topic.standards || []) {
    check(standardKeys.has(key), `topic ${topic.id} unknown standard ${key}`);
    const standard = standardsByKey.get(key);
    if (standard) {
      check(topic.gradeBand === standard.gradeBand, `topic/standard gradeBand mismatch ${topic.id}: ${topic.gradeBand} != ${standard.gradeBand}`);
    }
  }
  check(Number.isInteger(topic.ageRangeStart), `topic missing integer ageRangeStart ${topic.id}`);
  check(Number.isInteger(topic.ageRangeEnd), `topic missing integer ageRangeEnd ${topic.id}`);
  check(topic.ageRangeStart <= topic.ageRangeEnd, `topic age range reversed ${topic.id}: ${topic.ageRangeStart}-${topic.ageRangeEnd}`);
  check(VER.has(topic.verificationStatus), `bad or missing topic verificationStatus ${topic.id}`);
  check(topic.decompositionKind === 'subject-facet', `topic decompositionKind must be subject-facet ${topic.id}`);
  check(FACETS.has(topic.facetKey), `topic facetKey outside the common eight ${topic.id}: ${topic.facetKey}`);
  check(topic.standardKey === topic.standards?.[0], `topic standardKey must equal standards[0] ${topic.id}`);
  check(isNonEmptyString(topic.sourceStandardCode), `topic missing sourceStandardCode ${topic.id}`);
  check(
    !('titleEnglish' in topic) ||
      (isNonEmptyString(topic.titleEnglish) && !/micro-topic \d+/i.test(topic.titleEnglish)),
    `topic titleEnglish placeholder or null must be omitted ${topic.id}`,
  );
  check(CONTENT_KINDS.includes(topic.contentKind), `topic missing or unknown contentKind ${topic.id}: ${topic.contentKind}`);
  check(isMeaningfulString(topic.generationBasis), `topic missing generationBasis ${topic.id}`);
  check(Array.isArray(topic.sourceRefs) && topic.sourceRefs.length > 0, `topic missing sourceRefs ${topic.id}`);
  for (const ref of topic.sourceRefs || []) check(sourceIds.has(ref), `topic ${topic.id} unknown sourceRef ${ref}`);
  if (topic.verificationStatus === 'official-source-checked') {
    check(hasTopicVerificationEvidence(topic), `official-source-checked topic missing verification evidence ${topic.id}`);
  }
  if (topic.subjectKorean === '영어') {
    check(topic.subject === 'English as a Foreign Language', `English topic must be EFL, not ELA: ${topic.id}`);
  }
  if (topic.subjectKorean === '사회') {
    const haystack = `${topic.description} ${topic.summary || ''} ${JSON.stringify(topic.evidence)}`;
    check(!/\b(Common Core|US state|United States|UK national)\b/i.test(haystack), `social topic has non-KR default framing ${topic.id}`);
  }
  if (topicIds.has(topic.id)) errors.push(`duplicate topic id ${topic.id}`);
  topicIds.add(topic.id);
  topicsById.set(topic.id, topic);
}

check(standardsFile.microTopicCount === topicIds.size, `microTopicCount ${standardsFile.microTopicCount} != ${topicIds.size}`);
for (const error of contentQualityErrors(topicsFile.topics || [])) errors.push(`content quality: ${error}`);

// 주제 콘텐츠 오버레이(P3-2): 스키마·출처 참조·dangling·원문 복사·중복과 함께
// "오버레이가 빌드 산출물에 반영되었는지"까지 본다.
const contentOverlays = readContentOverlays(contentOverlayDirectory(KR_DATA));
const validateOverlaySchema = ajv.compile(
  JSON.parse(readFileSync(resolve(KR_SCHEMA, OVERLAY_SCHEMA_FILE), 'utf8')),
);
for (const overlay of contentOverlays) {
  const label = `content/${overlay.file}`;
  if (!validateOverlaySchema(overlay.document)) {
    for (const error of validateOverlaySchema.errors || []) {
      errors.push(`JSON Schema ${label}${error.instancePath || '/'} ${error.message}`);
    }
  }
  check(
    Boolean(overlay.subject) && Boolean(overlay.gradeBand),
    `${label}: overlay file must be named <subject>-<gradeBand>.json`,
  );
  for (const ref of overlay.document.sourceRefs || []) check(sourceIds.has(ref), `${label}: unknown sourceRef ${ref}`);
  for (const [topicId, entry] of Object.entries(overlay.document.entries || {})) {
    const sourceId = entry.sourceLocator?.sourceId;
    check(!sourceId || sourceIds.has(sourceId), `${label}/${topicId}: unknown sourceLocator.sourceId ${sourceId}`);
  }
  errors.push(...analyzeOverlay({ label, overlay, topicsById, standardsByKey }).errors);
}
const { entries: contentOverlayEntries, errors: contentOverlayIndexErrors } = indexOverlayEntries(contentOverlays);
for (const message of contentOverlayIndexErrors) errors.push(`content: ${message}`);
// The built topics must already carry the overlay: run `npm run build` after authoring.
for (const [topicId, hit] of contentOverlayEntries) {
  const topic = topicsById.get(topicId);
  if (!topic) continue;
  const merged =
    topic.contentKind === 'source-grounded-draft' &&
    JSON.stringify(topic.evidence) === JSON.stringify(hit.entry.evidence) &&
    topic.assessmentPrompt === hit.entry.assessmentPrompt;
  check(merged, `topic ${topicId}: content overlay ${hit.file} is not merged into the build output`);
}
let sourceGroundedTopics = 0;
for (const topic of topicsById.values()) {
  if (topic.contentKind !== 'source-grounded-draft') continue;
  sourceGroundedTopics += 1;
  check(contentOverlayEntries.has(topic.id), `topic ${topic.id}: source-grounded-draft without a content overlay entry`);
}
check(
  manifest.counts?.contentOverlayFiles === contentOverlays.length,
  `manifest content overlay file count mismatch: ${manifest.counts?.contentOverlayFiles} != ${contentOverlays.length}`,
);
check(
  manifest.counts?.sourceGroundedTopics === sourceGroundedTopics,
  `manifest source-grounded topic count mismatch: ${manifest.counts?.sourceGroundedTopics} != ${sourceGroundedTopics}`,
);

const mappingPairs = new Set();
for (const mapping of standardsFile.standardMappings || []) {
  check(standardKeys.has(mapping.standardKey), `mapping unknown standard ${mapping.standardKey}`);
  check(topicIds.has(mapping.microTopicId), `mapping unknown topic ${mapping.microTopicId}`);
  check(REL.has(mapping.relationship), `bad mapping relationship ${mapping.standardKey}->${mapping.microTopicId}`);
  const pair = `${mapping.standardKey}->${mapping.microTopicId}`;
  const mappedTopic = (topicsFile.topics || []).find((topic) => topic.id === mapping.microTopicId);
  check(mappedTopic?.standards?.includes(mapping.standardKey), `mapping is not declared by topic ${pair}`);
  if (mappingPairs.has(pair)) errors.push(`duplicate mapping ${pair}`);
  mappingPairs.add(pair);
}
check(standardsFile.mappingCount === mappingPairs.size, `mappingCount ${standardsFile.mappingCount} != ${mappingPairs.size}`);
for (const topic of topicsFile.topics || []) {
  for (const standardKey of topic.standards || []) {
    check(mappingPairs.has(`${standardKey}->${topic.id}`), `topic missing standard mapping ${standardKey}->${topic.id}`);
  }
}
for (const standardKey of standardKeys) {
  check(
    [...mappingPairs].some((pair) => pair.startsWith(`${standardKey}->`)),
    `standard has no mapped topics ${standardKey}`,
  );
}

const relationLayers = [
  { name: 'official', file: 'dependencies.json', edges: depsFile.dependencies || [] },
  {
    name: 'pedagogical-candidate',
    file: 'dependencies.candidate.json',
    edges: candidateDepsFile.dependencies || [],
  },
];

function checkAcyclic(label, edges) {
  const adjacency = new Map([...topicIds].map((id) => [id, []]));
  for (const edge of edges) {
    if (adjacency.has(edge.topicId) && adjacency.has(edge.prerequisiteId) && edge.topicId !== edge.prerequisiteId) {
      adjacency.get(edge.topicId).push(edge.prerequisiteId);
    }
  }

  let nextIndex = 0;
  const indices = new Map();
  const lowLinks = new Map();
  const stack = [];
  const onStack = new Set();
  const cyclicSccs = [];

  function visitScc(topicId) {
    indices.set(topicId, nextIndex);
    lowLinks.set(topicId, nextIndex);
    nextIndex += 1;
    stack.push(topicId);
    onStack.add(topicId);

    for (const prerequisiteId of adjacency.get(topicId) || []) {
      if (!indices.has(prerequisiteId)) {
        visitScc(prerequisiteId);
        lowLinks.set(topicId, Math.min(lowLinks.get(topicId), lowLinks.get(prerequisiteId)));
      } else if (onStack.has(prerequisiteId)) {
        lowLinks.set(topicId, Math.min(lowLinks.get(topicId), indices.get(prerequisiteId)));
      }
    }

    if (lowLinks.get(topicId) !== indices.get(topicId)) return;
    const component = [];
    let member;
    do {
      member = stack.pop();
      onStack.delete(member);
      component.push(member);
    } while (member !== topicId);
    if (component.length > 1) cyclicSccs.push(component.sort());
  }

  for (const topicId of topicIds) if (!indices.has(topicId)) visitScc(topicId);
  check(
    cyclicSccs.length === 0,
    `${label} graph must be a DAG; found ${cyclicSccs.length} cyclic prerequisite SCC(s)${cyclicSccs[0] ? `; example ${cyclicSccs[0].join(' -> ')}` : ''}`,
  );
}

const relationIds = new Set();
const unionPairs = new Set();
for (const layer of relationLayers) {
  const layerPairs = new Set();
  for (const dep of layer.edges) {
    const label = `${layer.file} ${dep.topicId}->${dep.prerequisiteId}`;
    check(topicIds.has(dep.topicId), `dependency unknown topic ${dep.topicId} (${layer.file})`);
    check(topicIds.has(dep.prerequisiteId), `dependency unknown prerequisite ${dep.prerequisiteId} (${layer.file})`);
    check(dep.topicId !== dep.prerequisiteId, `self dependency ${dep.topicId} (${layer.file})`);
    check(STR.has(dep.strength), `bad dependency strength ${label}`);
    check(isNonEmptyString(dep.reason), `dependency missing reason ${label}`);
    check(dep.layer === layer.name, `dependency layer must match its file ${label}: ${dep.layer}`);
    check(SCOPES.has(dep.scope), `dependency scope outside vocabulary ${label}: ${dep.scope}`);
    check(
      dep.id === relationId(dep.topicId, dep.prerequisiteId),
      `dependency id is not the contract hash ${label}`,
    );
    check(Array.isArray(dep.sourceRefs) && dep.sourceRefs.length > 0, `dependency missing sourceRefs ${label}`);
    for (const ref of dep.sourceRefs || []) check(sourceIds.has(ref), `dependency unknown sourceRef ${ref} (${label})`);
    if (relationIds.has(dep.id)) errors.push(`duplicate relation id ${dep.id}`);
    relationIds.add(dep.id);

    if (layer.name === 'official') {
      check(dep.relationKind === 'required-prerequisite', `official relationKind must be required-prerequisite ${label}`);
      check(dep.basisKind === 'official-source', `official basisKind must be official-source ${label}`);
      check(OFFICIAL_REVIEW_STATUSES.has(dep.reviewStatus), `official reviewStatus too weak ${label}`);
      check(
        Number.isInteger(dep.sourceLocator?.printedPage),
        `official relation must carry sourceLocator.printedPage ${label}`,
      );
      check(
        sourceIds.has(dep.sourceLocator?.sourceId),
        `official relation locator points at an unknown source ${label}`,
      );
    } else {
      check(dep.relationKind === 'recommended-before', `candidate relationKind must be recommended-before ${label}`);
      check(CANDIDATE_BASIS_KINDS.has(dep.basisKind), `candidate basisKind not allowed ${label}: ${dep.basisKind}`);
      check(dep.basisKind !== 'official-source', `candidate layer must not claim official-source ${label}`);
      check(dep.reviewStatus === 'candidate', `candidate reviewStatus must be candidate ${label}`);
    }

    const topicSubject = topicsById.get(dep.topicId)?.subjectKorean;
    const prerequisiteSubject = topicsById.get(dep.prerequisiteId)?.subjectKorean;
    check(
      topicSubject === prerequisiteSubject,
      `synthetic cross-subject dependency forbidden ${dep.topicId} (${topicSubject}) -> ${dep.prerequisiteId} (${prerequisiteSubject})`,
    );

    const pair = `${dep.topicId}->${dep.prerequisiteId}`;
    if (layerPairs.has(pair)) errors.push(`duplicate dependency ${pair} (${layer.file})`);
    layerPairs.add(pair);
    if (unionPairs.has(pair)) errors.push(`relation ${pair} appears in both layers`);
    unionPairs.add(pair);
  }

  const reciprocalPairs = [];
  for (const pair of layerPairs) {
    const [topicId, prerequisiteId] = pair.split('->');
    const reverse = `${prerequisiteId}->${topicId}`;
    if (layerPairs.has(reverse) && pair.localeCompare(reverse) < 0) reciprocalPairs.push([topicId, prerequisiteId]);
  }
  check(
    reciprocalPairs.length === 0,
    `${layer.file} has ${reciprocalPairs.length} reciprocal dependency pair(s)${reciprocalPairs[0] ? `; example ${reciprocalPairs[0].join(' <-> ')}` : ''}`,
  );

  checkAcyclic(layer.file, layer.edges);
}

checkAcyclic('official + candidate union', relationLayers.flatMap((layer) => layer.edges));

for (const gap of standardsFile.coverageGaps || []) {
  check(
    COVERAGE_GAP_SEVERITIES.includes(gap.severity),
    `coverage gap severity outside vocabulary ${gap.id || gap.description}: ${gap.severity}`,
  );
  check(
    COVERAGE_GAP_STATUSES.includes(gap.status),
    `coverage gap status outside vocabulary ${gap.id || gap.description}: ${gap.status}`,
  );
}

check(clustersFile.coveragePolicy?.membership === 'at-least-one', 'cluster coverage policy must be at-least-one');
check(clustersFile.coveragePolicy?.minimumMembership === 1, 'cluster coverage policy minimumMembership must be 1');
const clusterMemberships = new Map([...topicIds].map((id) => [id, []]));
for (const cluster of clustersFile.clusters || []) {
  check(subjectByEnglish.get(cluster.subject) === cluster.subjectKorean, `cluster subject mismatch ${cluster.id}`);
  check(cluster.topicCount === cluster.topics?.length, `cluster topicCount mismatch ${cluster.id}`);
  check(isNonEmptyString(cluster.summary), `cluster missing summary ${cluster.id}`);
  check(isNonEmptyString(cluster.parentSummary), `cluster missing parentSummary ${cluster.id}`);
  const clusterTopicIds = new Set();
  for (const id of cluster.topics || []) {
    check(topicIds.has(id), `cluster unknown topic ${id}`);
    if (clusterTopicIds.has(id)) errors.push(`cluster duplicate topic ${cluster.id}: ${id}`);
    clusterTopicIds.add(id);
    if (clusterMemberships.has(id)) clusterMemberships.get(id).push(cluster.id);
    const topic = (topicsFile.topics || []).find((candidate) => candidate.id === id);
    check(topic?.subject === cluster.subject, `cluster/topic subject mismatch ${cluster.id}: ${id}`);
  }
}
for (const [topicId, memberships] of clusterMemberships) {
  check(memberships.length >= 1, `topic missing cluster membership ${topicId}`);
  if (clustersFile.coveragePolicy?.allowMultiple === false) {
    check(memberships.length === 1, `topic has multiple cluster memberships under single-membership policy ${topicId}`);
  }
}

const actualKrJsonFiles = new Set(listKrJsonFiles());
const manifestKrJsonFiles = new Set(Object.keys(manifest.files || {}));
for (const name of actualKrJsonFiles) check(manifestKrJsonFiles.has(name), `manifest missing file entry ${name}`);
for (const name of manifestKrJsonFiles) check(actualKrJsonFiles.has(name), `manifest references missing file ${name}`);

for (const [name, meta] of Object.entries(manifest.files || {})) {
  const bytes = bytesOf(name);
  const hash = createHash('sha256').update(bytes).digest('hex');
  check(bytes.length === meta.bytes, `manifest bytes mismatch ${name}`);
  check(hash === meta.sha256, `manifest checksum mismatch ${name}`);
}

check(manifest.coverageNotes?.social?.standards === 49, 'manifest Korea-first social coverage note mismatch');
check(manifest.coverageNotes?.englishEfl?.standards === 40, 'manifest Korean EFL coverage note mismatch');
check(manifest.coverageNotes?.artsAndPhysicalEducation?.standards === 101, 'manifest arts/PE coverage note mismatch');
check(manifest.coverageNotes?.amendedAnnex15?.standards === 57, 'manifest amended Annex 15 coverage note mismatch');
check(manifest.coverageNotes?.amendedAnnex15?.healthStandards === 9, 'manifest 건강한 생활 coverage note mismatch');
check(manifest.coverageNotes?.amendedAnnex15?.joyfulStandards === 16, 'manifest 즐거운 생활 coverage note mismatch');
check(
  Array.isArray(manifest.sourcePosture?.effectiveFrom) && manifest.sourcePosture.effectiveFrom.length > 0,
  'manifest must record the cited-edition enforcement dates',
);
check(
  manifest.sourcePosture?.workLevelReuseStatus?.startsWith('CLEARED'),
  'manifest must record the cleared public-government-document reuse posture',
);

if (errors.length) {
  console.error(`✗ ${errors.length} KR problem(s):`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(
  `✓ KR full-depth data valid - ${standardsFile.curricula.length} curricula, ${standardKeys.size} standards, ${topicIds.size} topics, ` +
    `${depsFile.dependencies.length} official + ${candidateDepsFile.dependencies.length} candidate relations, ` +
    `${clustersFile.clusters.length} clusters. Checksums OK.`,
);
