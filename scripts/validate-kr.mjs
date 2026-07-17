#!/usr/bin/env node
import Ajv2020 from 'ajv/dist/2020.js';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentQualityErrors } from './lib/kr-content-quality.mjs';
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
const clustersFile = load('clusters.json');
const manifest = load('manifest.json');

const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });
for (const [dataName, schemaName, data] of [
  ['curriculum-standards.json', 'kr-curriculum-standards.schema.json', standardsFile],
  ['topics.json', 'kr-topics.schema.json', topicsFile],
  ['dependencies.json', 'kr-dependencies.schema.json', depsFile],
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
check(clustersFile.clusterCount === clustersFile.clusters?.length, 'clusterCount mismatch');
check(topicsFile.topicCount >= MIN_TOPICS, `KR topic target missed: ${topicsFile.topicCount} < ${MIN_TOPICS}`);
check(depsFile.graphPolicy?.relation === 'prerequisite', 'dependency graph relation must be prerequisite');
check(depsFile.graphPolicy?.acyclic === true, 'dependency graph policy must require acyclic=true');
check(depsFile.graphPolicy?.edgeSelection === 'workstream-reviewed-only', 'dependency graph must use workstream-reviewed-only edges');
check(depsFile.graphPolicy?.crossSubjectEdges === 'none', 'dependency graph must declare crossSubjectEdges=none');
check(manifest.counts?.sources === standardsFile.sourceCount, 'manifest source count mismatch');
check(manifest.counts?.topics === topicsFile.topicCount, 'manifest topic count mismatch');
check(manifest.counts?.dependencies === depsFile.edgeCount, 'manifest dependency count mismatch');
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

const dependencyPairs = new Set();
for (const dep of depsFile.dependencies || []) {
  check(topicIds.has(dep.topicId), `dependency unknown topic ${dep.topicId}`);
  check(topicIds.has(dep.prerequisiteId), `dependency unknown prerequisite ${dep.prerequisiteId}`);
  check(dep.topicId !== dep.prerequisiteId, `self dependency ${dep.topicId}`);
  check(STR.has(dep.strength), `bad dependency strength ${dep.topicId}->${dep.prerequisiteId}`);
  check(isNonEmptyString(dep.reason), `dependency missing reason ${dep.topicId}->${dep.prerequisiteId}`);
  const topicSubject = topicsById.get(dep.topicId)?.subjectKorean;
  const prerequisiteSubject = topicsById.get(dep.prerequisiteId)?.subjectKorean;
  check(
    topicSubject === prerequisiteSubject,
    `synthetic cross-subject dependency forbidden ${dep.topicId} (${topicSubject}) -> ${dep.prerequisiteId} (${prerequisiteSubject})`,
  );
  const pair = `${dep.topicId}->${dep.prerequisiteId}`;
  if (dependencyPairs.has(pair)) errors.push(`duplicate dependency ${pair}`);
  dependencyPairs.add(pair);
}

const reciprocalPairs = [];
for (const pair of dependencyPairs) {
  const [topicId, prerequisiteId] = pair.split('->');
  const reverse = `${prerequisiteId}->${topicId}`;
  if (dependencyPairs.has(reverse) && pair.localeCompare(reverse) < 0) reciprocalPairs.push([topicId, prerequisiteId]);
}
check(
  reciprocalPairs.length === 0,
  `dependency graph has ${reciprocalPairs.length} reciprocal dependency pair(s)${reciprocalPairs[0] ? `; example ${reciprocalPairs[0].join(' <-> ')}` : ''}`,
);

const adjacency = new Map([...topicIds].map((id) => [id, []]));
for (const dep of depsFile.dependencies || []) {
  if (adjacency.has(dep.topicId) && adjacency.has(dep.prerequisiteId) && dep.topicId !== dep.prerequisiteId) {
    adjacency.get(dep.topicId).push(dep.prerequisiteId);
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
  `dependency graph must be a DAG; found ${cyclicSccs.length} cyclic prerequisite SCC(s)${cyclicSccs[0] ? `; example ${cyclicSccs[0].join(' -> ')}` : ''}`,
);

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
check(manifest.coverageNotes?.amendedAnnex15?.standards === 9, 'manifest amended Annex 15 coverage note mismatch');
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
  `✓ KR full-depth data valid - ${standardsFile.curricula.length} curricula, ${standardKeys.size} standards, ${topicIds.size} topics, ${depsFile.dependencies.length} dependencies, ${clustersFile.clusters.length} clusters. Checksums OK.`,
);
