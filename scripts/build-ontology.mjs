import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const INSTANCE_NAMESPACE = 'https://dexa.art/learnmap/#/';
const VOCABULARY_NAMESPACE = 'https://dexa.art/learnmap/vocab/#/';
const ONTOLOGY_NAMESPACE = 'https://dexa.art/learnmap/ontology#';
const ALIGNMENT_CONFIDENCE_DEFAULT = '0.5';
const ALIGNMENT_CONFIDENCE_DEFAULT_POLICY = 'alignment-confidence-default-v1';

const STATIC_ONTOLOGY_FILES = [
  'ontology/learning-map.ttl',
  'ontology/context.jsonld',
  'ontology/shapes.ttl',
  'ontology/metadata.ttl',
];

const INSTANCE_KINDS = new Set([
  'release',
  'curriculum',
  'grade-band',
  'subject',
  'domain',
  'standard',
  'topic',
  'cluster',
  'evidence',
  'assessment-prompt',
  'prerequisite-assertion',
  'standard-topic-alignment',
  'source',
  'source-locator',
  'verification',
  'coverage-gap',
]);

export function mintInstanceIri(kind, sourceId) {
  if (!INSTANCE_KINDS.has(kind)) {
    throw new Error(`unsupported resource kind: ${kind}`);
  }
  if (typeof sourceId !== 'string' || sourceId.length === 0) {
    throw new Error('sourceId must be a non-empty string');
  }
  return `${INSTANCE_NAMESPACE}${kind}/${encodeURIComponent(sourceId)}`;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

export function stableRecordId(family, identity) {
  if (!/^[a-z][a-z0-9-]*$/.test(family)) {
    throw new Error(`invalid record family: ${family}`);
  }
  const digest = createHash('sha256')
    .update(JSON.stringify(canonicalize(identity)))
    .digest('hex')
    .slice(0, 24);
  return `${family}-${digest}`;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function byJsonIdentity(left, right) {
  return JSON.stringify(canonicalize(left)).localeCompare(JSON.stringify(canonicalize(right)));
}

export async function loadStaticOntologyArtifacts({ rootDir }) {
  return Object.fromEntries(
    await Promise.all(
      STATIC_ONTOLOGY_FILES.map(async (relativePath) => [
        relativePath,
        await readFile(resolve(rootDir, relativePath), 'utf8'),
      ]),
    ),
  );
}

async function loadCanonicalData(rootDir) {
  const dataDir = resolve(rootDir, 'data', 'kr');
  const [topics, dependencies, standards, clusters, manifest] = await Promise.all([
    readJson(resolve(dataDir, 'topics.json')),
    readJson(resolve(dataDir, 'dependencies.json')),
    readJson(resolve(dataDir, 'curriculum-standards.json')),
    readJson(resolve(dataDir, 'clusters.json')),
    readJson(resolve(dataDir, 'manifest.json')),
  ]);
  return { topics, dependencies, standards, clusters, manifest };
}

function conceptIri(scheme, term) {
  return `${VOCABULARY_NAMESPACE}${scheme}/${term}`;
}

function iri(id) {
  return { '@id': id };
}

function ko(value) {
  return { '@value': value, '@language': 'ko' };
}

function en(value) {
  return { '@value': value, '@language': 'en' };
}

function typed(value, type) {
  return { '@value': String(value), '@type': type };
}

function setIfPresent(node, property, value) {
  if (value === undefined || value === null || value === '') return;
  node[property] = value;
}

function setKoIfPresent(node, property, value) {
  if (typeof value === 'string' && value.trim()) node[property] = ko(value);
}

function setEnIfPresent(node, property, value) {
  if (typeof value === 'string' && value.trim()) node[property] = en(value);
}

function addIri(node, property, target) {
  node[property] ??= [];
  node[property].push(iri(target));
}

function addUniqueIri(node, property, target) {
  node[property] ??= [];
  if (!node[property].some((value) => value['@id'] === target)) node[property].push(iri(target));
}

function addLiteral(node, property, value) {
  if (value === undefined || value === null || value === '') return;
  node[property] ??= [];
  node[property].push(value);
}

function sourceIri(sourceId) {
  return mintInstanceIri('source', sourceId);
}

function subjectId(record) {
  return stableRecordId('subject', {
    subject: record.subject,
    subjectKorean: record.subjectKorean,
  });
}

function subjectIri(record) {
  return mintInstanceIri('subject', subjectId(record));
}

function gradeBandIri(gradeBand) {
  return mintInstanceIri('grade-band', gradeBand);
}

function domainId(record) {
  return stableRecordId('domain', {
    subject: record.subject,
    subjectKorean: record.subjectKorean,
    domain: record.domain,
    domainKorean: record.domainKorean ?? null,
  });
}

function domainIri(record) {
  return mintInstanceIri('domain', domainId(record));
}

function internalSourceReferences(sourceRefs = []) {
  return [...new Set(sourceRefs)].sort().map((sourceId) => sourceIri(sourceId));
}

function addSourceReferences(node, sourceRefs = []) {
  const references = internalSourceReferences(sourceRefs);
  if (references.length === 0) return;
  node['lm:documentedBy'] = references.map(iri);
  node['dcterms:source'] = references.map(iri);
  node['prov:wasDerivedFrom'] = references.map(iri);
}

function normalizeTopicType(type) {
  return String(type).toLowerCase();
}

function normalizeRequirementLevel(strength) {
  return strength === 'hard' ? 'required' : 'recommended';
}

function normalizeGapSeverity(gap) {
  if (gap.severity) return gap.severity;
  if (gap.status && /review|needs/i.test(gap.status)) return 'review-needed';
  return 'unspecified';
}

function normalizeGapCategory(gap) {
  const text = [gap.id, gap.status, gap.note, gap.description, gap.coverageStatus]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (gap.sourceLocator || text.includes('source-located') || text.includes('locator')) {
    return 'source-locator';
  }
  if (text.includes('official') || text.includes('text') || text.includes('wording')) {
    return 'source-text-policy';
  }
  if (text.includes('assessment') || text.includes('calibration')) {
    return 'assessment-calibration';
  }
  if (text.includes('dependency')) {
    return 'dependency-review';
  }
  if (text.includes('reconciliation')) {
    return 'source-reconciliation';
  }
  if (text.includes('review')) {
    return 'expert-review';
  }
  return 'content-coverage';
}

function sourceLocatorIdentity(owner, locator) {
  return {
    owner,
    locator: canonicalize(locator),
  };
}

function createVerificationRecord({ owner, status, basis, note, sourceRefs = [] }) {
  const identity = {
    owner,
    status,
    basis: basis ?? null,
    note: note ?? null,
    sourceRefs: [...sourceRefs].sort(),
  };
  const id = stableRecordId('vr', identity);
  const node = {
    '@id': mintInstanceIri('verification', id),
    '@type': 'lm:VerificationRecord',
    'lm:identifier': id,
    'lm:verificationStatus': iri(conceptIri('VerificationStatus', status)),
  };
  setKoIfPresent(node, 'lm:summary', basis);
  setKoIfPresent(node, 'lm:note', note);
  addSourceReferences(node, sourceRefs);
  return node;
}

function createSourceLocator({ owner, locator, sourceRefs = [] }) {
  const normalizedLocator =
    typeof locator === 'string'
      ? { value: locator }
      : Object.fromEntries(
          Object.entries(locator ?? {})
            .filter(([key, value]) => !/url|path/i.test(key) && value !== undefined && value !== null)
            .sort(([left], [right]) => left.localeCompare(right)),
        );
  const sourceIds = [];
  if (normalizedLocator.sourceId) sourceIds.push(normalizedLocator.sourceId);
  sourceIds.push(...sourceRefs);
  const id = stableRecordId('loc', sourceLocatorIdentity(owner, normalizedLocator));
  const node = {
    '@id': mintInstanceIri('source-locator', id),
    '@type': 'lm:SourceLocator',
    'lm:identifier': id,
  };

  const locatorValues = Object.entries(normalizedLocator)
    .filter(([key]) => key !== 'sourceId')
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join('..') : value}`);
  if (locatorValues.length > 0) node['lm:locatorValue'] = locatorValues.sort();
  if (normalizedLocator.sha256) node['lm:sourceHash'] = normalizedLocator.sha256;
  addSourceReferences(node, sourceIds);
  return node;
}

function pushNode(map, node) {
  if (map.has(node['@id'])) throw new Error(`duplicate ontology resource: ${node['@id']}`);
  map.set(node['@id'], node);
  return node;
}

function sortNodeValues(node) {
  for (const [property, value] of Object.entries(node)) {
    if (!Array.isArray(value)) continue;
    node[property] = [...value].sort(byJsonIdentity);
  }
}

function sortedGraph(nodes) {
  for (const node of nodes) sortNodeValues(node);
  return [...nodes].sort((left, right) => left['@id'].localeCompare(right['@id']));
}

function sortedWithDuplicateOrdinals(records, identityOf) {
  const sorted = records
    .map((record) => ({ record, key: JSON.stringify(canonicalize(identityOf(record))) }))
    .sort((left, right) => left.key.localeCompare(right.key));
  const occurrences = new Map();
  return sorted.map(({ record, key }) => {
    const duplicateOrdinal = occurrences.get(key) ?? 0;
    occurrences.set(key, duplicateOrdinal + 1);
    return { record, duplicateOrdinal };
  });
}

function createConceptNodes(data, nodes) {
  const subjects = new Map();
  const gradeBands = new Set();
  const domains = new Map();
  const records = [
    ...data.topics.topics,
    ...data.clusters.clusters,
    ...data.standards.coverageGaps,
    ...data.standards.curricula,
    ...data.standards.curricula.flatMap((curriculum) => curriculum.standards),
  ];

  for (const record of records) {
    if (record.subject && record.subjectKorean) {
      const id = subjectId(record);
      subjects.set(id, { id, record });
    }
    if (record.gradeBand) gradeBands.add(record.gradeBand);
    if (record.subject && record.domain) {
      const id = domainId(record);
      domains.set(id, { id, record });
    }
  }

  for (const { id, record } of [...subjects.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  )) {
    const node = pushNode(nodes, {
      '@id': mintInstanceIri('subject', id),
      '@type': 'lm:Subject',
      'lm:identifier': id,
      'lm:preferredLabel': ko(record.subjectKorean),
    });
    setEnIfPresent(node, 'lm:labelEnglish', record.subject);
  }

  for (const gradeBand of [...gradeBands].sort()) {
    pushNode(nodes, {
      '@id': gradeBandIri(gradeBand),
      '@type': 'lm:GradeBand',
      'lm:identifier': gradeBand,
      'lm:preferredLabel': ko(`${gradeBand}학년군`),
      'lm:labelEnglish': en(`Grades ${gradeBand}`),
    });
  }

  for (const { id, record } of [...domains.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  )) {
    const node = pushNode(nodes, {
      '@id': mintInstanceIri('domain', id),
      '@type': 'lm:LearningDomain',
      'lm:identifier': id,
      'lm:hasSubject': iri(subjectIri(record)),
    });
    setKoIfPresent(node, 'lm:preferredLabel', record.domainKorean ?? record.domain);
    setEnIfPresent(node, 'lm:labelEnglish', record.domain);
  }
}

function createSourceDocuments(data, nodes, verificationNodes) {
  for (const source of [...data.standards.sources].sort((left, right) =>
    left.id.localeCompare(right.id),
  )) {
    const node = pushNode(nodes, {
      '@id': sourceIri(source.id),
      '@type': 'lm:SourceDocument',
      'lm:identifier': source.id,
      'lm:preferredLabel': ko(source.name),
      'lm:sourceType': source.sourceType,
      'lm:rightsStatus': iri(conceptIri('RightsStatus', 'hold')),
      'lm:officialTextIncluded': false,
      'dcterms:source': iri(sourceIri(source.id)),
      'prov:wasDerivedFrom': iri(sourceIri(source.id)),
    });
    setIfPresent(node, 'lm:accessDate', source.accessDate);
    setIfPresent(node, 'lm:publisher', source.publisher);
    setIfPresent(node, 'lm:sourceHash', source.sha256);
    setIfPresent(node, 'lm:attachmentNo', source.attachmentNo);
    setIfPresent(node, 'lm:pdfPages', source.pdfPages);
    setIfPresent(node, 'lm:subjectCode', source.subjectCode);
    setKoIfPresent(node, 'lm:summary', source.usage);

    const verification = createVerificationRecord({
      owner: { type: 'SourceDocument', id: source.id },
      status: 'public-doc-derived',
      basis: source.usage,
      sourceRefs: [source.id],
    });
    pushNode(verificationNodes, verification);
    node['lm:hasVerificationRecord'] = iri(verification['@id']);
  }
}

function createCurriculaAndStandards(data, nodes, verificationNodes, locatorNodes) {
  for (const curriculum of [...data.standards.curricula].sort((left, right) =>
    left.id.localeCompare(right.id),
  )) {
    const curriculumNode = pushNode(nodes, {
      '@id': mintInstanceIri('curriculum', curriculum.id),
      '@type': 'lm:Curriculum',
      'lm:identifier': curriculum.id,
      'lm:preferredLabel': ko(curriculum.name ?? curriculum.subjectKorean),
      'lm:version': curriculum.version,
      'lm:schoolLevel': curriculum.schoolLevel,
      'lm:officialTextIncluded': curriculum.textIncluded === false ? false : Boolean(curriculum.textIncluded),
      'lm:hasSubject': iri(subjectIri(curriculum)),
      'lm:hasAchievementStandard': curriculum.standards
        .map((standard) => iri(mintInstanceIri('standard', standard.key)))
        .sort(byJsonIdentity),
    });
    setEnIfPresent(curriculumNode, 'lm:labelEnglish', curriculum.subject);
    setKoIfPresent(curriculumNode, 'lm:summary', curriculum.sourceBasis);
    addSourceReferences(curriculumNode, curriculum.sourceIds ?? []);

    const curriculumVerification = createVerificationRecord({
      owner: { type: 'Curriculum', id: curriculum.id },
      status: curriculum.verificationStatus,
      basis: curriculum.sourceBasis,
      sourceRefs: curriculum.sourceIds ?? [],
    });
    pushNode(verificationNodes, curriculumVerification);
    curriculumNode['lm:hasVerificationRecord'] = iri(curriculumVerification['@id']);

    for (const standard of [...curriculum.standards].sort((left, right) =>
      left.key.localeCompare(right.key),
    )) {
      const standardNode = pushNode(nodes, {
        '@id': mintInstanceIri('standard', standard.key),
        '@type': 'lm:AchievementStandard',
        'lm:identifier': standard.key,
        'lm:preferredLabel': ko(standard.summary),
        'lm:summary': ko(standard.summary),
        'lm:standardCode': standard.code,
        'lm:officialTextIncluded': false,
        'lm:hasSubject': iri(subjectIri(standard)),
        'lm:hasGradeBand': iri(gradeBandIri(standard.gradeBand)),
      });
      if (standard.domain) standardNode['lm:hasLearningDomain'] = iri(domainIri(standard));
      setKoIfPresent(standardNode, 'lm:sourceSection', standard.sourceSection);
      setKoIfPresent(standardNode, 'lm:sourceBasis', standard.sourceBasis);
      setKoIfPresent(standardNode, 'lm:verificationNotes', standard.verificationNotes);
      setIfPresent(standardNode, 'lm:workstream', standard.workstreamFile);
      addSourceReferences(standardNode, standard.sourceRefs ?? []);

      if (standard.sourceLocator) {
        const locator = createSourceLocator({
          owner: { type: 'AchievementStandard', id: standard.key },
          locator: standard.sourceLocator,
          sourceRefs: standard.sourceRefs ?? [],
        });
        pushNode(locatorNodes, locator);
        standardNode['lm:hasSourceLocator'] = iri(locator['@id']);
      }

      const standardVerification = createVerificationRecord({
        owner: { type: 'AchievementStandard', id: standard.key },
        status: standard.verificationStatus,
        basis: standard.sourceBasis,
        note: standard.verificationNotes,
        sourceRefs: standard.sourceRefs ?? [],
      });
      pushNode(verificationNodes, standardVerification);
      standardNode['lm:hasVerificationRecord'] = iri(standardVerification['@id']);
    }
  }
}

function createTopicResources(data, nodes, verificationNodes, locatorNodes) {
  const topicNodes = new Map();
  for (const topic of [...data.topics.topics].sort((left, right) => left.id.localeCompare(right.id))) {
    const evidenceNodes = [];
    const evidenceIdentity = (criterionText) => ({
      owner: { type: 'LearningTopic', id: topic.id },
      criterionText,
    });
    for (const { record: criterionText, duplicateOrdinal } of sortedWithDuplicateOrdinals(
      topic.evidence,
      evidenceIdentity,
    )) {
      const id = stableRecordId('evidence', {
        ...evidenceIdentity(criterionText),
        duplicateOrdinal,
      });
      evidenceNodes.push(
        pushNode(nodes, {
          '@id': mintInstanceIri('evidence', id),
          '@type': 'lm:EvidenceCriterion',
          'lm:identifier': id,
          'lm:criterionText': ko(criterionText),
        }),
      );
    }

    const promptId = stableRecordId('prompt', {
      owner: { type: 'LearningTopic', id: topic.id },
      promptText: topic.assessmentPrompt,
    });
    const promptNode = pushNode(nodes, {
      '@id': mintInstanceIri('assessment-prompt', promptId),
      '@type': 'lm:AssessmentPrompt',
      'lm:identifier': promptId,
      'lm:promptText': ko(topic.assessmentPrompt),
    });

    const topicNode = pushNode(nodes, {
      '@id': mintInstanceIri('topic', topic.id),
      '@type': 'lm:LearningTopic',
      'lm:identifier': topic.id,
      'lm:preferredLabel': ko(topic.titleKorean ?? topic.name),
      'lm:description': ko(topic.description),
      'lm:ageRangeStart': topic.ageRangeStart,
      'lm:ageRangeEnd': topic.ageRangeEnd,
      'lm:officialTextIncluded': false,
      'lm:topicType': iri(conceptIri('LearningTopicType', normalizeTopicType(topic.type))),
      'lm:hasSubject': iri(subjectIri(topic)),
      'lm:hasGradeBand': iri(gradeBandIri(topic.gradeBand)),
      'lm:hasLearningDomain': iri(domainIri(topic)),
      'lm:hasEvidenceCriterion': evidenceNodes.map((node) => iri(node['@id'])).sort(byJsonIdentity),
      'lm:hasAssessmentPrompt': [iri(promptNode['@id'])],
    });
    setKoIfPresent(topicNode, 'lm:summary', topic.summary);
    setEnIfPresent(topicNode, 'lm:titleEnglish', topic.titleEnglish);
    setKoIfPresent(topicNode, 'lm:generationBasis', topic.generationBasis);
    setIfPresent(topicNode, 'lm:sourceStandardCode', topic.sourceStandardCode);
    setIfPresent(topicNode, 'lm:workstream', topic.workstreamFile);
    addSourceReferences(topicNode, topic.sourceRefs ?? []);

    if (topic.sourceLocator) {
      const locator = createSourceLocator({
        owner: { type: 'LearningTopic', id: topic.id },
        locator: topic.sourceLocator,
        sourceRefs: topic.sourceRefs ?? [],
      });
      pushNode(locatorNodes, locator);
      topicNode['lm:hasSourceLocator'] = iri(locator['@id']);
    }

    const verification = createVerificationRecord({
      owner: { type: 'LearningTopic', id: topic.id },
      status: topic.verificationStatus,
      basis: topic.generationBasis,
      sourceRefs: topic.sourceRefs ?? [],
    });
    pushNode(verificationNodes, verification);
    topicNode['lm:hasVerificationRecord'] = iri(verification['@id']);
    topicNodes.set(topic.id, topicNode);
  }
  return topicNodes;
}

function createClusters(data, nodes) {
  for (const cluster of [...data.clusters.clusters].sort((left, right) =>
    left.id.localeCompare(right.id),
  )) {
    const node = pushNode(nodes, {
      '@id': mintInstanceIri('cluster', cluster.id),
      '@type': 'lm:LearningCluster',
      'lm:identifier': cluster.id,
      'lm:preferredLabel': ko(cluster.titleKorean ?? cluster.title ?? cluster.name),
      'lm:summary': ko(cluster.summary),
      'lm:hasSubject': iri(subjectIri(cluster)),
      'lm:hasGradeBand': iri(gradeBandIri(cluster.gradeBand)),
      'lm:hasLearningDomain': iri(domainIri(cluster)),
      'lm:hasClusterMember': [...cluster.topics]
        .sort()
        .map((topicId) => iri(mintInstanceIri('topic', topicId))),
    });
    setKoIfPresent(node, 'lm:parentSummary', cluster.parentSummary);
    setEnIfPresent(node, 'lm:titleEnglish', cluster.titleEnglish);
    setIfPresent(node, 'lm:workstream', cluster.workstreamFile);
  }
}

function createCoverageGaps(data, nodes, locatorNodes) {
  for (const gap of [...data.standards.coverageGaps].sort((left, right) =>
    (left.id ?? '').localeCompare(right.id ?? ''),
  )) {
    const gapId =
      gap.id ??
      stableRecordId('gap', {
        workstreamFile: gap.workstreamFile,
        description: gap.description,
      });
    const node = pushNode(nodes, {
      '@id': mintInstanceIri('coverage-gap', gapId),
      '@type': 'lm:CoverageGap',
      'lm:identifier': gapId,
      'lm:gapDescription': ko(gap.description),
      'lm:gapCategory': iri(conceptIri('CoverageGapCategory', normalizeGapCategory(gap))),
      'lm:gapSeverity': iri(conceptIri('GapSeverity', normalizeGapSeverity(gap))),
      'lm:sourceGapSeverityPresent': Boolean(gap.severity),
    });
    setKoIfPresent(node, 'lm:note', gap.note);
    setIfPresent(node, 'lm:status', gap.status);
    setIfPresent(node, 'lm:workstream', gap.workstreamFile);
    if (gap.subject && gap.subjectKorean) node['lm:hasSubject'] = iri(subjectIri(gap));
    addSourceReferences(node, gap.sourceRefs ?? []);
    if (gap.sourceLocator) {
      const locator = createSourceLocator({
        owner: { type: 'CoverageGap', id: gapId },
        locator: gap.sourceLocator,
        sourceRefs: gap.sourceRefs ?? [],
      });
      pushNode(locatorNodes, locator);
      node['lm:hasSourceLocator'] = iri(locator['@id']);
    }
  }
}

function buildQualifiedAssertionGraph(data, topicNodes, nodes, verificationNodes) {
  const release = data.topics.taxonomyVersion;

  const dependencyIdentity = (edge) => ({
    release,
    dependentTopic: edge.topicId,
    prerequisiteTopic: edge.prerequisiteId,
    strength: edge.strength,
    basis: edge.basis,
    source: edge.source,
  });
  for (const { record: edge, duplicateOrdinal } of sortedWithDuplicateOrdinals(
    data.dependencies.dependencies,
    dependencyIdentity,
  )) {
    const id = stableRecordId('pa', {
      ...dependencyIdentity(edge),
      duplicateOrdinal,
    });
    const assertionIri = mintInstanceIri('prerequisite-assertion', id);
    const dependentIri = mintInstanceIri('topic', edge.topicId);
    const prerequisiteIri = mintInstanceIri('topic', edge.prerequisiteId);
    const normalizedStrength = normalizeRequirementLevel(edge.strength);
    const node = pushNode(nodes, {
      '@id': assertionIri,
      '@type': 'lm:PrerequisiteAssertion',
      'lm:identifier': id,
      'lm:dependentTopic': iri(dependentIri),
      'lm:prerequisiteTopic': iri(prerequisiteIri),
      'lm:prerequisiteStrength': iri(
        conceptIri('DependencyRequirementLevel', normalizedStrength),
      ),
      'lm:legacyPrerequisiteStrength': edge.strength,
      'lm:prerequisiteReason': ko(edge.reason),
      'lm:assertionBasis': edge.basis,
      'lm:assertionSource': edge.source,
    });
    const verification = createVerificationRecord({
      owner: { type: 'PrerequisiteAssertion', id },
      status: 'workstream-reviewed',
      basis: edge.basis,
      note: edge.reason,
    });
    pushNode(verificationNodes, verification);
    node['lm:hasVerificationRecord'] = iri(verification['@id']);

    const topicNode = topicNodes.get(edge.topicId);
    addIri(topicNode, 'lm:hasPrerequisiteAssertion', assertionIri);
    addIri(topicNode, 'lm:directRequires', prerequisiteIri);
  }

  const alignmentIdentity = (mapping) => ({
    release,
    topic: mapping.microTopicId,
    standard: mapping.standardKey,
    alignmentKind: mapping.relationship,
    basis: mapping.workstreamFile,
    source: 'data/kr/curriculum-standards.json#standardMappings',
  });
  for (const { record: mapping, duplicateOrdinal } of sortedWithDuplicateOrdinals(
    data.standards.standardMappings,
    alignmentIdentity,
  )) {
    const id = stableRecordId('sta', {
      ...alignmentIdentity(mapping),
      duplicateOrdinal,
    });
    const alignmentIri = mintInstanceIri('standard-topic-alignment', id);
    const topicIri = mintInstanceIri('topic', mapping.microTopicId);
    const standardIri = mintInstanceIri('standard', mapping.standardKey);
    const numericConfidence =
      typeof mapping.confidence === 'number' || /^\d+(\.\d+)?$/.test(String(mapping.confidence ?? ''));
    const node = {
      '@id': alignmentIri,
      '@type': 'lm:StandardTopicAlignment',
      'lm:identifier': id,
      'lm:alignmentTopic': iri(topicIri),
      'lm:alignmentStandard': iri(standardIri),
      'lm:alignmentKind': iri(conceptIri('AlignmentKind', mapping.relationship)),
      'lm:sourceConfidenceValue': mapping.confidence,
      'lm:assertionBasis': mapping.workstreamFile,
      'lm:assertionSource': 'data/kr/curriculum-standards.json#standardMappings',
    };
    if (numericConfidence) {
      node['lm:confidence'] = typed(mapping.confidence, 'xsd:decimal');
      node['lm:confidenceDefaulted'] = false;
    } else {
      node['lm:confidence'] = typed(ALIGNMENT_CONFIDENCE_DEFAULT, 'xsd:decimal');
      node['lm:confidenceDefaulted'] = true;
      node['lm:defaultingPolicy'] = ALIGNMENT_CONFIDENCE_DEFAULT_POLICY;
    }
    const note = mapping.note ?? mapping.rationale;
    if (note) node['lm:note'] = ko(note);
    pushNode(nodes, node);

    const verification = createVerificationRecord({
      owner: { type: 'StandardTopicAlignment', id },
      status: mapping.verificationStatus ?? 'workstream-reviewed',
      basis: mapping.workstreamFile,
      note,
    });
    pushNode(verificationNodes, verification);
    node['lm:hasVerificationRecord'] = iri(verification['@id']);

    const topicNode = topicNodes.get(mapping.microTopicId);
    addIri(topicNode, 'lm:hasStandardTopicAlignment', alignmentIri);
    addIri(topicNode, 'lm:alignedToStandard', standardIri);
  }

  for (const node of topicNodes.values()) {
    for (const property of [
      'lm:hasPrerequisiteAssertion',
      'lm:directRequires',
      'lm:hasStandardTopicAlignment',
      'lm:alignedToStandard',
    ]) {
      node[property]?.sort((left, right) => left['@id'].localeCompare(right['@id']));
    }
  }
}

function createDatasetRelease(data, nodes, verificationNodes) {
  const releaseId = data.standards.taxonomyVersion;
  const release = pushNode(nodes, {
    '@id': mintInstanceIri('release', releaseId),
    '@type': 'lm:DatasetRelease',
    'lm:identifier': releaseId,
    'lm:preferredLabel': ko(data.standards.dataset),
    'lm:summary': ko(data.standards.sourceBasis),
    'lm:rightsStatus': iri(conceptIri('RightsStatus', 'hold')),
    'lm:officialTextIncluded': false,
    'lm:hasCurriculum': data.standards.curricula
      .map((curriculum) => iri(mintInstanceIri('curriculum', curriculum.id)))
      .sort(byJsonIdentity),
    'lm:containsTopic': data.topics.topics
      .map((topic) => iri(mintInstanceIri('topic', topic.id)))
      .sort(byJsonIdentity),
    'lm:hasCluster': data.clusters.clusters
      .map((cluster) => iri(mintInstanceIri('cluster', cluster.id)))
      .sort(byJsonIdentity),
    'lm:reportsCoverageGap': data.standards.coverageGaps
      .map((gap) =>
        iri(
          mintInstanceIri(
            'coverage-gap',
            gap.id ??
              stableRecordId('gap', {
                workstreamFile: gap.workstreamFile,
                description: gap.description,
              }),
          ),
        ),
      )
      .sort(byJsonIdentity),
  });
  setIfPresent(release, 'lm:status', data.standards.status);
  setIfPresent(release, 'lm:locale', data.standards.locale);
  setIfPresent(release, 'lm:country', data.standards.country);
  setIfPresent(release, 'lm:generatedAt', data.standards.generatedAt);

  const verification = createVerificationRecord({
    owner: { type: 'DatasetRelease', id: releaseId },
    status: data.standards.verificationStatus,
    basis: data.standards.sourceBasis,
    sourceRefs: data.standards.sources.map((source) => source.id),
  });
  pushNode(verificationNodes, verification);
  release['lm:hasVerificationRecord'] = iri(verification['@id']);
}

function buildFullGraph(data) {
  const resourceNodes = new Map();
  const verificationNodes = new Map();
  const locatorNodes = new Map();

  createConceptNodes(data, resourceNodes);
  createSourceDocuments(data, resourceNodes, verificationNodes);
  createCurriculaAndStandards(data, resourceNodes, verificationNodes, locatorNodes);
  const topicNodes = createTopicResources(data, resourceNodes, verificationNodes, locatorNodes);
  createClusters(data, resourceNodes);
  createCoverageGaps(data, resourceNodes, locatorNodes);
  buildQualifiedAssertionGraph(data, topicNodes, resourceNodes, verificationNodes);
  createDatasetRelease(data, resourceNodes, verificationNodes);

  return sortedGraph([
    ...resourceNodes.values(),
    ...locatorNodes.values(),
    ...verificationNodes.values(),
  ]);
}

function graphResourceCounts(graph) {
  const counts = {};
  for (const node of graph) {
    const type = node['@type']?.replace(/^lm:/, '');
    counts[type] = (counts[type] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function escapeTurtleString(value) {
  return JSON.stringify(String(value));
}

function turtleIri(value) {
  return `<${value}>`;
}

function turtlePredicate(property) {
  if (/^[a-z][a-z0-9-]*:[A-Za-z_][A-Za-z0-9_-]*$/.test(property)) return property;
  return turtleIri(property);
}

function turtleValue(value) {
  if (value && typeof value === 'object') {
    if (value['@id']) return turtleIri(value['@id']);
    if (Object.hasOwn(value, '@value')) {
      const literal = escapeTurtleString(value['@value']);
      if (value['@language']) return `${literal}@${value['@language']}`;
      if (value['@type']) return `${literal}^^${value['@type']}`;
      return literal;
    }
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : `"${value}"^^xsd:decimal`;
  return escapeTurtleString(value);
}

function turtleObjectList(value) {
  const values = Array.isArray(value) ? value : [value];
  return values.map(turtleValue).sort().join(', ');
}

function serializeNodeToTurtle(node) {
  const predicates = [];
  predicates.push(['a', node['@type']]);
  predicates.push(['lm:identifier', node['lm:identifier']]);
  for (const property of Object.keys(node).sort()) {
    if (property === '@id' || property === '@type' || property === 'lm:identifier') continue;
    predicates.push([turtlePredicate(property), node[property]]);
  }
  return `${turtleIri(node['@id'])}\n${predicates
    .map(([predicate, value], index) => {
      const terminator = index === predicates.length - 1 ? ' .' : ' ;';
      const object =
        predicate === 'a' && typeof value === 'string' && value.startsWith('lm:')
          ? value
          : turtleObjectList(value);
      return `  ${predicate} ${object}${terminator}`;
    })
    .join('\n')}`;
}

function serializeGraphToTurtle(graph) {
  const prefixes = [
    '@prefix lm: <https://dexa.art/learnmap/ontology#> .',
    '@prefix dcterms: <http://purl.org/dc/terms/> .',
    '@prefix prov: <http://www.w3.org/ns/prov#> .',
    '@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .',
  ];
  return `${prefixes.join('\n')}\n\n${graph.map(serializeNodeToTurtle).join('\n\n')}\n`;
}

export async function buildOntologyArtifacts({ rootDir }) {
  const staticFiles = await loadStaticOntologyArtifacts({ rootDir });
  const data = await loadCanonicalData(rootDir);
  const graph = buildFullGraph(data);
  const jsonld = {
    '@context': {
      lm: ONTOLOGY_NAMESPACE,
      lmv: VOCABULARY_NAMESPACE,
      dcterms: 'http://purl.org/dc/terms/',
      prov: 'http://www.w3.org/ns/prov#',
      xsd: 'http://www.w3.org/2001/XMLSchema#',
    },
    '@graph': graph,
  };
  const jsonldText = `${JSON.stringify(canonicalize(jsonld), null, 2)}\n`;
  const turtleText = serializeGraphToTurtle(graph);
  return {
    counts: {
      sourceRecords: {
        curricula: data.standards.curricula.length,
        standards: data.standards.curricula.reduce(
          (count, curriculum) => count + curriculum.standards.length,
          0,
        ),
        topics: data.topics.topics.length,
        dependencies: data.dependencies.dependencies.length,
        clusters: data.clusters.clusters.length,
        standardMappings: data.standards.standardMappings.length,
        coverageGaps: data.standards.coverageGaps.length,
      },
      graphResources: graphResourceCounts(graph),
    },
    files: {
      ...staticFiles,
      'dist/ontology/learning-map.jsonld': jsonldText,
      'dist/ontology/learning-map.ttl': turtleText,
    },
  };
}

async function writeFileAtomically(path, contents) {
  const digest = createHash('sha256').update(contents).digest('hex').slice(0, 16);
  const temporaryPath = `${path}.${process.pid}.${digest}.tmp`;
  await writeFile(temporaryPath, contents, 'utf8');
  await rename(temporaryPath, path);
}

export async function writeOntologyArtifacts({ rootDir }) {
  const artifacts = await buildOntologyArtifacts({ rootDir });
  const distDir = resolve(rootDir, 'dist', 'ontology');
  await mkdir(distDir, { recursive: true });
  for (const relativePath of [
    'dist/ontology/learning-map.jsonld',
    'dist/ontology/learning-map.ttl',
  ]) {
    await writeFileAtomically(resolve(rootDir, relativePath), artifacts.files[relativePath]);
  }
  return artifacts;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  await writeOntologyArtifacts({ rootDir });
}
