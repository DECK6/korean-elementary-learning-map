#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentQualityErrors, repairWorkstreamContent } from './lib/kr-content-quality.mjs';
import { OFFICIAL_SUBJECT_SPECS } from './lib/kr-official-subject-inventories.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORKSTREAM_DIR = resolve(ROOT, 'data', 'kr', 'workstreams');
const GENERATED_AT = '2026-07-10T00:00:00+09:00';
const ACCESS_DATE = '2026-07-10';

const SUBJECT_META = {
  social: { slug: 'social', codeToken: '사' },
  art: { slug: 'art', codeToken: '미' },
  music: { slug: 'music', codeToken: '음' },
  physicalEducation: { slug: 'physical-education', codeToken: '체' },
};

const DOMAIN_ENGLISH = {
  미적체험: 'Aesthetic Experience',
  표현: 'Expression',
  감상: 'Appreciation',
  연주: 'Performance',
  창작: 'Creation',
  운동: 'Exercise',
  스포츠: 'Sport',
};

const FACETS = {
  social: [
    {
      key: 'concept',
      label: '핵심 개념 이해',
      type: 'CONCEPTUAL',
      description: (standard) =>
        `${standard.unitName} 맥락에서 ${standard.focus}에 필요한 핵심 개념과 관계를 사례로 이해하는 사회과 세부 주제이다.`,
      evidence: (standard) => [
        `${standard.focus}의 핵심 대상과 관계를 두 가지 이상 찾아 자신의 말로 설명한다.`,
        `${standard.unitName} 사례에서 배운 개념이 드러나는 장면을 선택하고 판단 근거를 제시한다.`,
      ],
      prompt: (standard) =>
        `${standard.focus}의 핵심 개념을 한국의 지역·역사·시민 생활 사례와 연결해 설명하고, 선택한 사례가 알맞은지 근거로 판단하게 한다.`,
    },
    {
      key: 'evidence',
      label: '자료 탐구와 해석',
      type: 'REPRESENTATIONAL',
      description: (standard) =>
        `${standard.focus}에 관련된 지도·사진·연표·표·기록 등 사회과 자료를 비교하고 해석하는 세부 주제이다.`,
      evidence: (standard) => [
        `${standard.focus}에 관련된 서로 다른 자료 두 가지를 비교하여 공통점과 차이점을 설명한다.`,
        `자료가 만들어진 시기와 목적을 구분하고, 자료에서 확인한 내용을 근거와 함께 제시한다.`,
      ],
      prompt: (standard) =>
        `${standard.focus}에 관련된 자료 두 가지를 비교·분석하고, 자료가 보여 주는 사실과 자신의 해석을 구분해 설명하게 한다.`,
    },
    {
      key: 'inquiry',
      label: '탐구와 참여',
      type: 'PROCEDURAL',
      description: (standard) =>
        `${standard.focus}을/를 조사 질문, 자료 수집, 토의, 설명 또는 제안으로 확장하는 사회과 탐구 주제이다.`,
      evidence: (standard) => [
        `${standard.focus}에 대한 조사 질문을 만들고 알맞은 자료를 찾아 조사 과정을 기록한다.`,
        `조사 결과를 근거와 함께 설명하고 학교나 지역사회에서 실행할 제안을 한 가지 제시한다.`,
      ],
      prompt: (standard) =>
        `${standard.focus}에 대한 질문을 세우고 자료를 조사한 뒤, 한국 사회 맥락에 맞는 설명이나 참여 제안을 근거와 함께 제시하게 한다.`,
    },
  ],
  art: [
    {
      key: 'understand', label: '관찰과 이해', type: 'CONCEPTUAL',
      description: (standard) => `${standard.focus}에서 대상·이미지·조형 요소의 특징을 관찰하고 의미를 연결하는 미술 세부 주제이다.`,
      evidence: (standard) => [`${standard.focus}에서 보이는 특징과 조형 요소를 두 가지 이상 찾아 설명한다.`, `관찰한 특징이 느낌이나 의미와 어떻게 연결되는지 작품 사례로 제시한다.`],
      prompt: (standard) => `${standard.focus}에 필요한 시각적 특징을 관찰하고, 작품이나 생활 속 이미지에서 찾은 근거로 의미를 설명하게 한다.`,
    },
    {
      key: 'make', label: '재료와 방법 적용', type: 'PROCEDURAL',
      description: (standard) => `${standard.focus}을/를 재료·용구·매체와 제작 순서에 맞게 직접 시도하는 미술 수행 주제이다.`,
      evidence: (standard) => [`${standard.focus}에 알맞은 재료와 용구를 선택하고 안전하게 사용하여 표현 과정을 수행한다.`, `표현 의도에 맞게 조형 요소와 제작 방법을 적용하여 결과물을 완성한다.`],
      prompt: (standard) => `${standard.focus}에 알맞은 재료·용구·매체를 선택해 작품을 제작하고, 선택한 방법이 표현 의도에 맞는지 결과물로 보여 주게 한다.`,
    },
    {
      key: 'reflect', label: '설명과 개선', type: 'META',
      description: (standard) => `${standard.focus}의 과정과 결과를 감상 기준으로 설명하고 다음 표현의 개선점을 찾는 미술 성찰 주제이다.`,
      evidence: (standard) => [`${standard.focus} 활동의 과정과 결과에서 잘된 점과 보완할 점을 각각 찾아 설명한다.`, `자신과 다른 사람의 표현 관점을 존중하며 다음 제작에서 적용할 개선 방법을 제시한다.`],
      prompt: (standard) => `${standard.focus}의 과정과 결과를 감상하고, 작품의 특징·표현 의도·개선점을 근거와 함께 설명하게 한다.`,
    },
  ],
  music: [
    {
      key: 'listen', label: '듣기와 음악 요소 이해', type: 'CONCEPTUAL',
      description: (standard) => `${standard.focus}에서 가락·리듬·셈여림·음색 등 음악 요소와 쓰임을 듣고 구분하는 음악 세부 주제이다.`,
      evidence: (standard) => [`${standard.focus}에 관련된 소리나 음악을 듣고 음악 요소 두 가지 이상을 식별하여 설명한다.`, `들은 음악의 특징을 분위기·쓰임·문화적 맥락 중 알맞은 항목과 연결해 말한다.`],
      prompt: (standard) => `${standard.focus}에 관련된 음악을 듣고 핵심 음악 요소를 구분한 뒤, 들은 근거로 특징과 쓰임을 설명하게 한다.`,
    },
    {
      key: 'perform', label: '연주와 창작 수행', type: 'PROCEDURAL',
      description: (standard) => `${standard.focus}을/를 목소리·악기·신체·디지털 매체 중 알맞은 방법으로 연주하거나 창작하는 음악 수행 주제이다.`,
      evidence: (standard) => [`${standard.focus}에 알맞은 소리 재료와 표현 방법을 선택하여 연주나 창작 과정을 수행한다.`, `음악 요소를 적용해 혼자 또는 함께 표현하고 연주·창작 결과를 기록한다.`],
      prompt: (standard) => `${standard.focus}에 알맞은 연주 또는 창작 방법을 선택해 음악으로 표현하고, 적용한 음악 요소를 결과와 함께 설명하게 한다.`,
    },
    {
      key: 'reflect', label: '나눔과 성찰', type: 'META',
      description: (standard) => `${standard.focus}의 연주·감상·창작 경험을 나누고 음악적 선택과 협력 과정을 개선하는 음악 성찰 주제이다.`,
      evidence: (standard) => [`${standard.focus} 활동에서 들린 변화와 자신의 음악적 선택을 구체적으로 설명한다.`, `함께한 음악 활동을 존중하며 다음 연주·감상·창작에서 개선할 점을 제시한다.`],
      prompt: (standard) => `${standard.focus} 활동의 음악적 특징과 자신의 선택을 설명하고, 다음 음악 활동에서 실행할 개선 방법을 기록하게 한다.`,
    },
  ],
  physicalEducation: [
    {
      key: 'understand', label: '움직임 원리와 안전 이해', type: 'CONCEPTUAL',
      description: (standard) => `${standard.focus}에 필요한 움직임 원리·규칙·건강·안전 조건을 사례로 이해하는 체육 세부 주제이다.`,
      evidence: (standard) => [`${standard.focus}에 필요한 움직임 원리나 규칙을 두 가지 이상 찾아 설명한다.`, `활동 장면에서 건강·안전 조건을 식별하고 알맞은 대처 방법을 제시한다.`],
      prompt: (standard) => `${standard.focus}에 필요한 움직임 원리와 안전 조건을 실제 활동 장면에서 찾아 설명하고, 알맞은 판단 근거를 제시하게 한다.`,
    },
    {
      key: 'perform', label: '기술 수행과 적용', type: 'PROCEDURAL',
      description: (standard) => `${standard.focus}을/를 신체 수준과 환경에 맞게 계획하고 기본 기능·전략·표현 방법으로 수행하는 체육 실천 주제이다.`,
      evidence: (standard) => [`${standard.focus}의 목표와 성공 기준을 정하고 자신의 수준에 맞는 방법으로 안전하게 수행한다.`, `기본 기능·전략·표현 방법을 활동 상황에 적용하고 수행 결과를 기록한다.`],
      prompt: (standard) => `${standard.focus}을/를 자신의 수준과 활동 조건에 맞게 수행하고, 적용한 기능·전략·표현 방법을 과정 기록으로 보여 주게 한다.`,
    },
    {
      key: 'reflect', label: '참여와 성찰', type: 'META',
      description: (standard) => `${standard.focus}의 참여 태도·협력·도전·안전 실천을 돌아보고 다음 활동을 개선하는 체육 성찰 주제이다.`,
      evidence: (standard) => [`${standard.focus} 활동에서 협력·공정·도전·안전 중 실천한 태도를 사례로 설명한다.`, `수행 기록을 점검하여 잘된 점과 다음 활동에서 개선할 방법을 제시한다.`],
      prompt: (standard) => `${standard.focus} 활동의 수행 결과와 참여 태도를 기준에 따라 평가하고, 다음 시도에서 실행할 개선 방법을 제시하게 한다.`,
    },
  ],
};

function codeParts(code) {
  const match = code.match(/^\[([46])(사|미|음|체)(\d{2})-(\d{2})\]$/);
  if (!match) throw new Error(`Unsupported official code ${code}`);
  return { grade: match[1], subjectToken: match[2], area: match[3], number: match[4] };
}

function gradeBand(code) {
  return codeParts(code).grade === '4' ? '3-4' : '5-6';
}

function ageRange(code) {
  return codeParts(code).grade === '4' ? [8, 10] : [10, 12];
}

function topicCode(code) {
  const parts = codeParts(code);
  const token = { 사: 'sa', 미: 'mi', 음: 'eum', 체: 'che' }[parts.subjectToken];
  return `${parts.grade}${token}${parts.area}${parts.number}`;
}

function domainEnglish(specKey, standard) {
  if (specKey === 'social') return `Social Studies Unit ${standard.unitNumber}`;
  return DOMAIN_ENGLISH[standard.unitName.replaceAll(' ', '')] || standard.unitName;
}

function sourceRecord(spec) {
  return {
    id: spec.sourceId,
    name: spec.title,
    sourceType: 'official-pdf',
    publisher: '교육부',
    via: 'NCIC 국가교육과정정보센터',
    url: spec.url,
    accessDate: ACCESS_DATE,
    usage: `Official ${spec.subjectKorean} subject PDF used to verify the elementary achievement-standard code inventory and PDF page placement; official wording is not reproduced.`,
    subjectCode: spec.subjectCode,
    attachmentName: spec.fileName,
    attachmentNo: spec.attachmentNo,
    sha256: spec.sha256,
    fileSizeBytes: spec.bytes,
    pdfPages: spec.pages,
  };
}

function locator(spec, standard) {
  return {
    sourceId: spec.sourceId,
    attachmentNo: spec.attachmentNo,
    sha256: spec.sha256,
    pdfPage: standard.pdfPage,
    pageLabel: `PDF p.${standard.pdfPage}`,
    section: standard.unitName,
    standardCode: standard.code,
  };
}

function buildStandard(specKey, standard) {
  const spec = OFFICIAL_SUBJECT_SPECS[specKey];
  const reviewedLocator = locator(spec, standard);
  return {
    key: `${spec.curriculumId}:${standard.code}`,
    code: standard.code,
    gradeBand: gradeBand(standard.code),
    subject: spec.subject,
    subjectKorean: spec.subjectKorean,
    domain: domainEnglish(specKey, standard),
    domainKorean: standard.unitName,
    unitNumber: standard.unitNumber,
    summary: standard.focus,
    sourceTextIncluded: false,
    sourceId: spec.sourceId,
    sourceRefs: [spec.sourceId],
    sourceAttachmentNo: spec.attachmentNo,
    sourceSha256: spec.sha256,
    sourcePage: standard.pdfPage,
    sourceSection: `${standard.unitName} · PDF p.${standard.pdfPage}`,
    sourceLocator: reviewedLocator,
    verificationStatus: 'official-source-checked',
    sourceBasis: `Achievement-standard code and PDF page placement were checked against ${spec.fileName} (attachment ${spec.attachmentNo}, SHA-256 ${spec.sha256}); the summary is repository-authored and does not quote the official standard text.`,
    sourceEvidence: [
      reviewedLocator,
      { textPolicy: 'Repository-authored non-quoting summary; official standard wording omitted.' },
    ],
  };
}

function buildSubject(specKey) {
  const spec = OFFICIAL_SUBJECT_SPECS[specKey];
  const meta = SUBJECT_META[specKey];
  const facets = FACETS[specKey];
  const standards = spec.standards.map((standard) => buildStandard(specKey, standard));
  const microTopics = [];
  const standardMappings = [];
  const dependencySuggestions = [];
  const topicsByStandard = new Map();

  for (const standard of standards) {
    const [ageRangeStart, ageRangeEnd] = ageRange(standard.code);
    const ids = [];
    const topicContext = {
      ...standard,
      focus: standard.summary,
      unitName: standard.domainKorean,
    };
    for (const [index, facet] of facets.entries()) {
      const id = `kr.mt.${meta.slug}.${standard.gradeBand}.${topicCode(standard.code)}.${facet.key}`;
      const name = `${standard.summary} — ${facet.label}`;
      ids.push(id);
      microTopics.push({
        id,
        type: facet.type,
        subject: standard.subject,
        subjectKorean: standard.subjectKorean,
        domain: standard.domain,
        domainKorean: standard.domainKorean,
        gradeBand: standard.gradeBand,
        ageRangeStart,
        ageRangeEnd,
        name,
        title: name,
        titleKorean: name,
        titleEnglish: `${standard.subject} ${standard.code} ${facet.key}`,
        description: facet.description(topicContext),
        summary: `${standard.code}의 저장소 작성 요약 “${standard.summary}”에 기반해 ${facet.label} 학습으로 세분화한 주제이다.`,
        evidence: facet.evidence(topicContext),
        assessmentPrompt: facet.prompt(topicContext),
        standards: [standard.key],
        sourceStandardCode: standard.code,
        sourceTextIncluded: false,
        sourceRefs: [...standard.sourceRefs],
        sourceLocator: standard.sourceLocator,
        verificationStatus: 'public-doc-derived',
        generationBasis: `${standard.code}의 검증된 코드·페이지 앵커와 저장소 작성 비인용 요약을 ${facet.label} 학습으로 분해했다. 이 마이크로토픽은 공식 성취기준 문구가 아니다.`,
        provenanceEvidence: [
          `${spec.fileName}, attachment ${spec.attachmentNo}, PDF p.${standard.sourcePage}, ${standard.code}.`,
          'Official wording is omitted; the topic wording and assessment design are repository-authored.',
        ],
      });
      standardMappings.push({
        standardKey: standard.key,
        microTopicId: id,
        relationship: index === 0 ? 'introduces' : index === 1 ? 'supports' : 'assesses',
        confidence: 'official-source-derived',
        note: `${standard.code} 코드·페이지 앵커의 비인용 요약을 ${facet.label} 세부 주제로 연결한다.`,
      });
    }
    topicsByStandard.set(standard.key, ids);
    dependencySuggestions.push(
      {
        topicId: ids[1], prerequisiteId: ids[0], strength: 'hard', status: 'suggested-for-review',
        reason: `${standard.code}의 적용 주제는 같은 기준의 핵심 이해를 먼저 다루는 흐름이 자연스럽다.`,
      },
      {
        topicId: ids[2], prerequisiteId: ids[1], strength: 'soft', status: 'suggested-for-review',
        reason: `${standard.code}의 성찰 주제는 같은 기준의 자료 탐구 또는 수행 경험 뒤에 점검하는 흐름이다.`,
      },
    );
  }

  const groups = new Map();
  for (const standard of standards) {
    const key = `${standard.gradeBand}\u0000${standard.unitNumber}\u0000${standard.domainKorean}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(standard);
  }
  const clusters = [...groups.values()].map((group) => {
    const first = group[0];
    const topicIds = group.flatMap((standard) => topicsByStandard.get(standard.key));
    return {
      id: `kr.cluster.${meta.slug}.${first.gradeBand}.unit-${first.unitNumber}`,
      name: `${first.subjectKorean} ${first.gradeBand}학년군 — ${first.domainKorean}`,
      title: `${first.subjectKorean} ${first.gradeBand}학년군 — ${first.domainKorean}`,
      titleKorean: `${first.subjectKorean} ${first.gradeBand}학년군 — ${first.domainKorean}`,
      titleEnglish: `${first.subject} ${first.gradeBand} unit ${first.unitNumber}`,
      subject: first.subject,
      subjectKorean: first.subjectKorean,
      domain: first.domain,
      domainKorean: first.domainKorean,
      gradeBand: first.gradeBand,
      topicCount: topicIds.length,
      topics: topicIds,
      summary: `${first.domainKorean}의 공식 코드 ${group.length}개를 코드당 세 개의 저장소 작성 세부 주제로 구성한 클러스터이다.`,
    };
  });

  return { standards, microTopics, standardMappings, dependencySuggestions, clusters };
}

function artifactFor(keys, fileName) {
  const built = keys.map((key) => ({ key, spec: OFFICIAL_SUBJECT_SPECS[key], data: buildSubject(key) }));
  const sources = built.map(({ spec }) => sourceRecord(spec));
  const standards = built.flatMap(({ data }) => data.standards);
  const microTopics = built.flatMap(({ data }) => data.microTopics);
  const standardMappings = built.flatMap(({ data }) => data.standardMappings);
  const dependencySuggestions = built.flatMap(({ data }) => data.dependencySuggestions);
  const clusters = built.flatMap(({ data }) => data.clusters);
  const subject = keys.length === 1 ? built[0].spec.subject : 'Art, Music, and Physical Education';
  const subjectKorean = keys.length === 1 ? built[0].spec.subjectKorean : '미술·음악·체육';
  const coverageGaps = [
    {
      id: `gap.kr.${fileName}.official-text-omitted`, severity: 'intentional',
      note: 'Official achievement-standard wording is not reproduced; each record keeps the verified code, subject-PDF identity, attachment number, hash, page locator, and a repository-authored summary.',
    },
    {
      id: `gap.kr.${fileName}.classroom-calibration`, severity: 'review-needed',
      note: 'Generated mastery criteria and assessment prompts require classroom and subject-specialist calibration before product release.',
    },
    {
      id: `gap.kr.${fileName}.dependency-review`, severity: 'review-needed',
      note: 'Dependencies stay within one official standard and express only understand/apply/reflect sequencing; no synthetic cross-subject edges were added.',
    },
  ];
  const artifact = {
    $schema: '../../../schema/kr-curriculum-standards.schema.json',
    dataset: `Korean Elementary Learning Map ${fileName} official-source workstream`,
    taxonomyVersion: `kr-full-depth-v0.4-workstream-${fileName}`,
    generatedAt: GENERATED_AT,
    locale: 'ko-KR',
    country: 'KR',
    subject,
    subjectKorean,
    curriculumId: keys.length === 1 ? built[0].spec.curriculumId : undefined,
    curriculumIds: built.map(({ spec }) => spec.curriculumId),
    status: 'subject-workstream-artifact',
    verificationStatus: 'official-source-checked',
    sourceBasis: 'Official elementary achievement-standard code inventories and page placements were checked against the subject PDFs identified below; summaries and learning-design fields are repository-authored paraphrases, not official text.',
    textPolicy: {
      officialStandardTextIncluded: false,
      summaryPolicy: 'Repository-authored non-quoting summaries only.',
      licensingStatus: 'Public government source metadata with locally authored taxonomy design.',
      licenseCaution: 'Keep source ids, attachment numbers, hashes, and page locators when integrating; do not treat generated topic language as official curriculum wording.',
    },
    sources,
    sourceCount: sources.length,
    standards,
    standardCount: standards.length,
    microTopics,
    microTopicCount: microTopics.length,
    standardMappings,
    mappingCount: standardMappings.length,
    dependencySuggestions,
    dependencySuggestionCount: dependencySuggestions.length,
    clusters,
    clusterCount: clusters.length,
    coverageGaps,
    coverageGapCount: coverageGaps.length,
    counts: {
      sources: sources.length,
      standards: standards.length,
      microTopics: microTopics.length,
      standardMappings: standardMappings.length,
      dependencySuggestions: dependencySuggestions.length,
      clusters: clusters.length,
      coverageGaps: coverageGaps.length,
    },
  };
  if (artifact.curriculumId === undefined) delete artifact.curriculumId;
  const standardsBeforeRepair = JSON.stringify(artifact.standards);
  const repaired = repairWorkstreamContent(artifact);
  if (JSON.stringify(repaired.standards) !== standardsBeforeRepair) {
    throw new Error(`${fileName}: compatibility repair changed official reconciled standards`);
  }
  return repaired;
}

function validateArtifact(artifact, keys, fileName) {
  const errors = [];
  const check = (condition, message) => { if (!condition) errors.push(message); };
  const expectedSpecs = keys.map((key) => OFFICIAL_SUBJECT_SPECS[key]);
  const expectedCodes = expectedSpecs.flatMap((spec) => spec.standards.map((standard) => standard.code));
  const expectedByCode = new Map(expectedSpecs.flatMap((spec) => spec.standards.map((standard) => [standard.code, { spec, standard }])));
  const actualCodes = artifact.standards.map((standard) => standard.code);
  check(actualCodes.length === expectedCodes.length, `expected ${expectedCodes.length} standards, got ${actualCodes.length}`);
  check(new Set(actualCodes).size === actualCodes.length, 'duplicate standard codes');
  check(JSON.stringify([...actualCodes].sort()) === JSON.stringify([...expectedCodes].sort()), 'official code inventory mismatch');
  check(artifact.microTopics.length === artifact.standards.length * 3, 'expected three topics per standard');
  check(artifact.standardMappings.length === artifact.microTopics.length, 'mapping count mismatch');
  check(artifact.dependencySuggestions.length === artifact.standards.length * 2, 'dependency count mismatch');
  check(new Set(artifact.microTopics.map((topic) => topic.id)).size === artifact.microTopics.length, 'duplicate topic ids');
  if (keys.some((key) => key !== 'social')) {
    check(!actualCodes.some((code) => /^\[2(미|음|체)/.test(code)), 'synthetic grade 1-2 arts/PE code family remains');
  }
  for (const standard of artifact.standards) {
    const expected = expectedByCode.get(standard.code);
    check(Boolean(expected), `unexpected standard ${standard.code}`);
    if (!expected) continue;
    const { spec, standard: inventory } = expected;
    check(standard.summary === inventory.focus, `summary mismatch ${standard.code}`);
    check(standard.verificationStatus === 'official-source-checked', `verification mismatch ${standard.code}`);
    check(standard.sourceRefs.length === 1 && standard.sourceRefs[0] === spec.sourceId, `source id mismatch ${standard.code}`);
    check(standard.sourceLocator?.sourceId === spec.sourceId, `locator source mismatch ${standard.code}`);
    check(standard.sourceLocator?.attachmentNo === spec.attachmentNo, `locator attachment mismatch ${standard.code}`);
    check(standard.sourceLocator?.sha256 === spec.sha256, `locator hash mismatch ${standard.code}`);
    check(standard.sourceLocator?.pdfPage === inventory.pdfPage, `locator page mismatch ${standard.code}`);
    check(standard.sourceTextIncluded === false, `source text policy missing ${standard.code}`);
  }
  errors.push(...contentQualityErrors(artifact.microTopics));
  if (errors.length) {
    throw new Error(`${fileName} workstream validation failed with ${errors.length} problem(s):\n- ${errors.join('\n- ')}`);
  }
}

const outputs = [
  { file: 'social.json', keys: ['social'] },
  { file: 'arts-pe.json', keys: ['art', 'music', 'physicalEducation'] },
];

mkdirSync(WORKSTREAM_DIR, { recursive: true });
for (const output of outputs) {
  const artifact = artifactFor(output.keys, output.file.replace('.json', ''));
  validateArtifact(artifact, output.keys, output.file);
  const path = resolve(WORKSTREAM_DIR, output.file);
  writeFileSync(path, `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(`Wrote ${path}: ${artifact.standardCount} standards, ${artifact.microTopicCount} topics, ${artifact.clusterCount} clusters.`);
}
