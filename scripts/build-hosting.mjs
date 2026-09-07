#!/usr/bin/env node
// Builds the static IRI hosting tree for the elementary ontology under dist/hosting/.
// Every https://dexa.art/learnmap IRI that the ontology sources mention must resolve to a file in
// this tree (or to the parent-facing learnmap app, which owns https://dexa.art/learnmap/#/...).
// The tree is copied to the dexa.art site by adxdeck-blog-main/scripts/sync-learnmap-ontology.mjs.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  RDF,
  classifyTerm,
  collectSiteIris,
  escapeHtml,
  formatBytes,
  iriLink,
  iris,
  literal,
  localName,
  renderArtifactTable,
  renderDocument,
  renderTermTable,
  resolveIriCoverage,
  scanTurtle,
  sha256,
  summariseCoverage,
  walkFiles,
  writeHostingTree,
} from './lib/iri-hosting.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(SCRIPT_DIR, '..');
export const DEFAULT_DIST = path.join(ROOT, 'dist', 'hosting');

const SERIES_IRI = 'https://dexa.art/learnmap/ontology';
const CORE_IRI = 'https://dexa.art/learnmap/ontology/k12-core';
const VOCAB_IRI = 'https://dexa.art/learnmap/vocab/';
const FACET_IRI = 'https://dexa.art/learnmap/vocab/facet/';
const APP_PATH = 'learnmap/index.html';
// The parent-facing learnmap app is pinned to the 0.3.0-p3 projection and links these two files by
// name, so the current release artifacts live under ontology/<version>/ instead of replacing them.
const LEGACY_ARTIFACT_VERSION = '0.3.0-p3';
const PINNED_PATHS = ['learnmap/ontology/learning-map.ttl', 'learnmap/ontology/learning-map.jsonld'];
const RESERVED_PREFIXES = ['https://dexa.art/learnmap/id/'];

const readJson = async (filePath) => JSON.parse(await readFile(filePath, 'utf8'));

export async function buildHosting({ root = ROOT, distDir = DEFAULT_DIST } = {}) {
  const ontologyDir = path.join(root, 'ontology');
  const releaseDir = path.join(root, 'dist', 'ontology');
  const [tboxText, coreText, contextText, metadataText, shapesText, vocabularyText, release, dataManifestText] = await Promise.all([
    readFile(path.join(ontologyDir, 'learning-map.ttl'), 'utf8'),
    readFile(path.join(ontologyDir, 'k12-core.ttl'), 'utf8'),
    readFile(path.join(ontologyDir, 'context.jsonld'), 'utf8'),
    readFile(path.join(ontologyDir, 'metadata.ttl'), 'utf8'),
    readFile(path.join(ontologyDir, 'shapes.ttl'), 'utf8'),
    readFile(path.join(ontologyDir, 'controlled-vocabulary.json'), 'utf8'),
    readJson(path.join(releaseDir, 'release-manifest.json')),
    readFile(path.join(root, 'data', 'kr', 'manifest.json'), 'utf8'),
  ]);
  const vocabulary = JSON.parse(vocabularyText);
  const tbox = scanTurtle(tboxText);
  const core = scanTurtle(coreText);
  const version = vocabulary.version;
  const priorVersion = vocabulary.priorVersion;
  if (release.ontologyVersion !== version) throw new Error(`release manifest ${release.ontologyVersion} != vocabulary ${version}`);
  const seriesTerm = tbox.terms.find((term) => term.iri === SERIES_IRI);
  const coreTerm = core.terms.find((term) => term.iri === CORE_IRI);
  if (!seriesTerm || !coreTerm) throw new Error('ontology headers not found in TBox files');
  const coreVersion = literal(coreTerm, RDF.versionInfo);
  const coreVersionIri = iris(coreTerm, RDF.versionIRI)[0];

  const releaseFile = (name) => {
    const entry = release.files.find((file) => file.path === `dist/ontology/${name}`);
    if (!entry) throw new Error(`release manifest is missing ${name}`);
    return entry;
  };
  const versionDir = `learnmap/ontology/${version}`;
  const abox = [
    { name: 'learning-map.ttl', sourcePath: path.join(releaseDir, 'learning-map.ttl'), entry: releaseFile('learning-map.ttl') },
    { name: 'learning-map.jsonld', sourcePath: path.join(releaseDir, 'learning-map.jsonld'), entry: releaseFile('learning-map.jsonld') },
  ];
  for (const artifact of abox) {
    const digest = sha256(await readFile(artifact.sourcePath));
    if (digest !== artifact.entry.sha256) throw new Error(`${artifact.name} differs from the release manifest; run npm run build:ontology:release`);
  }
  const staticFiles = [
    { name: 'ontology.ttl', content: tboxText, note: '용어 정의(TBox)만 담은 온톨로지 문서' },
    { name: 'k12-core.ttl', content: coreText, note: '초·중등 공용 코어 TBox' },
    { name: 'context.jsonld', content: contextText, note: 'JSON-LD context' },
    { name: 'shapes.ttl', content: shapesText, note: 'SHACL 제약' },
    { name: 'metadata.ttl', content: metadataText, note: '릴리스·권리 메타데이터' },
    { name: 'controlled-vocabulary.json', content: vocabularyText, note: '통제 어휘 레지스트리' },
  ];
  const describe = (name, text, note) => ({ name, href: `./${name}`, mediaType: name.endsWith('.json') ? 'application/json' : name.endsWith('.jsonld') ? 'application/ld+json' : 'text/turtle', bytes: Buffer.byteLength(text), sha256: sha256(text), note });

  const byKind = (scan) => {
    const groups = { class: [], objectProperty: [], datatypeProperty: [], annotationProperty: [], conceptScheme: [], concept: [] };
    for (const term of scan.terms) {
      const kind = classifyTerm(term);
      if (groups[kind]) groups[kind].push(term);
    }
    return groups;
  };
  const tboxGroups = byKind(tbox);
  const coreGroups = byKind(core);
  const facetConcepts = coreGroups.concept
    .filter((term) => iris(term, RDF.inScheme).some((scheme) => localName(scheme) === 'FacetScheme'))
    .map((term) => ({ term, key: literal(term, RDF.notation) }))
    .sort((a, b) => a.key.localeCompare(b.key, 'en'));
  if (facetConcepts.length === 0) throw new Error('k12-core FacetScheme concepts not found');

  const files = [];
  const add = (hostedPath, content) => files.push({ path: hostedPath, content });

  // --- Series landing: https://dexa.art/learnmap/ontology (and every ontology#Term) ---
  add('learnmap/ontology/index.html', renderDocument({
    title: '초등 교육과정 학습 온톨로지',
    description: `대한민국 2022 개정 초등 교육과정 학습지도 온톨로지 ${version}의 용어 정의와 배포 파일.`,
    canonicalPath: 'learnmap/ontology/index.html',
    eyebrow: 'Korean Elementary Curriculum Learning Ontology',
    heading: '초등 교육과정 학습 온톨로지',
    lead: `${escapeHtml(literal(seriesTerm, RDF.description, 'en') ?? '')}<br>이 문서는 <code>${escapeHtml(SERIES_IRI)}#</code> 이름공간의 모든 용어를 설명합니다. 용어 IRI의 fragment(<code>#LearningTopic</code>)가 아래 표의 해당 행으로 이동합니다.`,
    crumbs: [{ href: '/learnmap/', label: 'learnmap' }, { label: 'ontology' }],
    meta: [
      ['온톨로지 IRI', iriLink(SERIES_IRI)],
      ['현재 버전', `<a href="./${escapeHtml(version)}/"><b>${escapeHtml(version)}</b></a> · ${iriLink(release.ontologyVersionIri)}`],
      ['이전 버전', `<a href="./${escapeHtml(priorVersion)}/">${escapeHtml(priorVersion)}</a>`],
      ['imports', `<a href="./k12-core/">K-12 코어 ${escapeHtml(coreVersion)}</a> · ${iriLink(CORE_IRI)}`],
      ['릴리스 상태', `${escapeHtml(release.releaseStatus)} / ${escapeHtml(release.officialStatus)}`],
      ['발행일', escapeHtml(release.releaseDate ?? '')],
      ['데이터셋 릴리스', escapeHtml(release.datasetRelease?.identifier ?? release.datasetRelease ?? '')],
      ['권리 상태', `${escapeHtml(release.rights?.status ?? '')} — 공식 원문 미포함(${escapeHtml(String(release.rights?.officialTextIncluded))})`],
      ['용어 수', `클래스 ${tboxGroups.class.length} · 객체 속성 ${tboxGroups.objectProperty.length} · 데이터 속성 ${tboxGroups.datatypeProperty.length} · 통제 어휘 스킴 ${vocabulary.conceptSchemes.length}`],
    ],
    notes: [
      '주제·성취기준 같은 인스턴스 IRI는 <code>https://dexa.art/learnmap/#/topic/…</code> 형식의 fragment IRI이며 <a href="/learnmap/">배움 지도</a> 문서로 해석됩니다. 통제 어휘 개념은 <a href="/learnmap/vocab/">/learnmap/vocab/</a>에서 해석됩니다.',
    ],
    sections: [
      { id: 'downloads', heading: '문서와 배포 파일', html: `${renderArtifactTable([
        ...staticFiles.map((file) => describe(file.name, file.content, file.note)),
        ...abox.map((artifact) => ({ name: `${version}/${artifact.name}`, href: `./${version}/${artifact.name}`, mediaType: artifact.entry.mediaType, bytes: artifact.entry.bytes, sha256: artifact.entry.sha256, note: `현재 릴리스 ABox (${version})` })),
      ])}<p class="lh-note">GitHub Pages는 콘텐츠 협상을 지원하지 않으므로 파일 확장자로 표현을 고릅니다. 예: <code>curl -L ${escapeHtml(SERIES_IRI)}/ontology.ttl</code></p>` },
      { id: 'classes', heading: `클래스 (${tboxGroups.class.length})`, html: renderTermTable(tboxGroups.class) },
      { id: 'object-properties', heading: `객체 속성 (${tboxGroups.objectProperty.length})`, html: renderTermTable(tboxGroups.objectProperty) },
      { id: 'datatype-properties', heading: `데이터 속성 (${tboxGroups.datatypeProperty.length})`, html: renderTermTable(tboxGroups.datatypeProperty) },
      ...(tboxGroups.annotationProperty.length ? [{ id: 'annotation-properties', heading: `주석 속성 (${tboxGroups.annotationProperty.length})`, html: renderTermTable(tboxGroups.annotationProperty) }] : []),
      ...(tboxGroups.conceptScheme.length ? [{ id: 'concept-schemes', heading: `개념 스킴 (${tboxGroups.conceptScheme.length})`, html: renderTermTable(tboxGroups.conceptScheme, { anchorFor: (term) => term.qname ? localName(term.iri) : `scheme-${localName(term.iri.replace(/\/$/, ''))}` }) }] : []),
      { id: 'iri-policy', heading: 'IRI 정책 요약', html: `<ul>
<li>용어 IRI는 <code>${escapeHtml(SERIES_IRI)}#</code> 뒤에 레지스트리 용어를 그대로 붙입니다. 레이블이 바뀌어도 IRI는 바뀌지 않습니다.</li>
<li>인스턴스 IRI는 <code>https://dexa.art/learnmap/#/&lt;kind&gt;/&lt;id&gt;</code> fragment 형식입니다. <code>/learnmap/id/</code> 경로는 예약만 되어 있고 발급되지 않습니다.</li>
<li>버전 IRI(<code>${escapeHtml(SERIES_IRI)}/${escapeHtml(version)}</code>)는 해당 릴리스의 배포 파일과 검증 요약으로 해석됩니다.</li>
<li>전체 정책: <a href="https://github.com/DECK6/korean-elementary-learning-map/blob/main/ontology/uri-policy.md">ontology/uri-policy.md</a></li>
</ul>` },
    ],
    footer: [`저장소: <a href="https://github.com/DECK6/korean-elementary-learning-map">DECK6/korean-elementary-learning-map</a> · 생성: <code>npm run build:hosting</code>`],
  }));
  for (const file of staticFiles) add(`learnmap/ontology/${file.name}`, file.content);
  add('learnmap/data/kr/manifest.json', dataManifestText);

  // --- Version pages ---
  const reviewItems = Object.entries(release.review ?? {}).map(([key, value]) => `<li><code>${escapeHtml(key)}</code>: ${escapeHtml(String(value))}</li>`).join('');
  add(`${versionDir}/index.html`, renderDocument({
    title: `초등 온톨로지 ${version}`,
    description: `초등 교육과정 학습 온톨로지 버전 ${version}의 배포 파일과 검증 요약.`,
    canonicalPath: `${versionDir}/index.html`,
    eyebrow: 'Version IRI',
    heading: `초등 온톨로지 ${version}`,
    lead: `이 페이지는 버전 IRI <code>${escapeHtml(release.ontologyVersionIri)}</code>의 해석 결과입니다. 시리즈 IRI는 <a href="../">${escapeHtml(SERIES_IRI)}</a>입니다.`,
    crumbs: [{ href: '/learnmap/', label: 'learnmap' }, { href: '/learnmap/ontology/', label: 'ontology' }, { label: version }],
    meta: [
      ['버전 IRI', iriLink(release.ontologyVersionIri)],
      ['이전 버전', release.priorOntologyVersionIri ? `<a href="../${escapeHtml(priorVersion)}/">${escapeHtml(priorVersion)}</a> · ${iriLink(release.priorOntologyVersionIri)}` : escapeHtml(priorVersion)],
      ['발행일', escapeHtml(release.releaseDate ?? '')],
      ['상태', `${escapeHtml(release.releaseStatus)} / ${escapeHtml(release.officialStatus)}`],
      ['데이터셋 릴리스', escapeHtml(release.datasetRelease?.identifier ?? release.datasetRelease ?? '')],
      ['생성기', escapeHtml(release.generator ?? '')],
    ],
    sections: [
      { id: 'artifacts', heading: '배포 파일', html: renderArtifactTable([
        ...abox.map((artifact) => ({ name: artifact.name, href: `./${artifact.name}`, mediaType: artifact.entry.mediaType, bytes: artifact.entry.bytes, sha256: artifact.entry.sha256, note: 'ABox 전체 그래프' })),
        { name: 'release-manifest.json', href: './release-manifest.json', mediaType: 'application/json', bytes: Buffer.byteLength(JSON.stringify(release, null, 2) + '\n'), sha256: sha256(JSON.stringify(release, null, 2) + '\n'), note: '릴리스 매니페스트(파일 해시·검증 상태)' },
      ]) },
      { id: 'review', heading: '검증 요약', html: `<ul>${reviewItems}</ul><p class="lh-note">자동 게이트 통과는 내용 전문가 승인이나 권리 해제를 뜻하지 않습니다. 학습자 진단 기능은 제공하지 않습니다.</p>` },
    ],
  }));
  for (const artifact of abox) files.push({ path: `${versionDir}/${artifact.name}`, sourcePath: artifact.sourcePath });
  add(`${versionDir}/release-manifest.json`, `${JSON.stringify(release, null, 2)}\n`);

  add(`learnmap/ontology/${priorVersion}/index.html`, renderDocument({
    title: `초등 온톨로지 ${priorVersion}`,
    description: `초등 교육과정 학습 온톨로지 이전 버전 ${priorVersion}.`,
    canonicalPath: `learnmap/ontology/${priorVersion}/index.html`,
    eyebrow: 'Version IRI (superseded)',
    heading: `초등 온톨로지 ${priorVersion}`,
    lead: `이 버전은 <a href="../${escapeHtml(version)}/">${escapeHtml(version)}</a>으로 대체되었습니다.`,
    crumbs: [{ href: '/learnmap/', label: 'learnmap' }, { href: '/learnmap/ontology/', label: 'ontology' }, { label: priorVersion }],
    meta: [
      ['버전 IRI', iriLink(`${SERIES_IRI}/${priorVersion}`)],
      ['대체 버전', `<a href="../${escapeHtml(version)}/">${escapeHtml(version)}</a>`],
    ],
    sections: priorVersion === LEGACY_ARTIFACT_VERSION
      ? [{ id: 'artifacts', heading: '배포 파일', html: `<p>이 버전의 ABox는 <a href="/learnmap/">학부모용 배움 지도</a>가 참조하므로 기존 경로에 그대로 유지됩니다.</p><ul><li><a href="../learning-map.ttl"><code>/learnmap/ontology/learning-map.ttl</code></a></li><li><a href="../learning-map.jsonld"><code>/learnmap/ontology/learning-map.jsonld</code></a></li></ul>` }]
      : [{ id: 'artifacts', heading: '배포 파일', html: '<p>이 버전의 배포 파일은 더 이상 호스팅하지 않습니다. 저장소 git 이력에서 확인할 수 있습니다.</p>' }],
  }));

  // --- K-12 core ---
  const coreSchemes = coreGroups.conceptScheme;
  const conceptsByScheme = new Map(coreSchemes.map((scheme) => [scheme.iri, []]));
  for (const concept of coreGroups.concept) for (const scheme of iris(concept, RDF.inScheme)) conceptsByScheme.get(scheme)?.push(concept);
  add('learnmap/ontology/k12-core/index.html', renderDocument({
    title: 'K-12 학습지도 코어 온톨로지',
    description: '초등·중등 학습지도가 공유하는 K-12 코어 클래스·속성·개념 어휘.',
    canonicalPath: 'learnmap/ontology/k12-core/index.html',
    eyebrow: 'K-12 Korean Curriculum Learning Map Core',
    heading: literal(coreTerm, RDF.title, 'ko') ?? 'K-12 학습지도 코어 온톨로지',
    lead: `${escapeHtml(literal(coreTerm, RDF.description, 'en') ?? '')}<br>${escapeHtml(literal(coreTerm, RDF.comment, 'ko') ?? '')}`,
    crumbs: [{ href: '/learnmap/', label: 'learnmap' }, { href: '/learnmap/ontology/', label: 'ontology' }, { label: 'k12-core' }],
    meta: [
      ['온톨로지 IRI', iriLink(CORE_IRI)],
      ['버전', `<a href="./${escapeHtml(coreVersion)}/">${escapeHtml(coreVersion)}</a> · ${iriLink(coreVersionIri)}`],
      ['라이선스', iris(coreTerm, RDF.license).map((value) => iriLink(value)).join(', ')],
      ['생성일', escapeHtml(literal(coreTerm, RDF.created) ?? '')],
      ['문서', `<a href="../k12-core.ttl"><code>k12-core.ttl</code></a> (${escapeHtml(formatBytes(Buffer.byteLength(coreText)))})`],
      ['사용 저장소', '<a href="/learnmap/ontology/">초등 온톨로지</a> · <a href="/learnmap/secondary/ontology/">중등 온톨로지</a>'],
    ],
    sections: [
      { id: 'classes', heading: `클래스 (${coreGroups.class.length})`, html: renderTermTable(coreGroups.class) },
      { id: 'object-properties', heading: `객체 속성 (${coreGroups.objectProperty.length})`, html: renderTermTable(coreGroups.objectProperty) },
      { id: 'datatype-properties', heading: `데이터 속성 (${coreGroups.datatypeProperty.length})`, html: renderTermTable(coreGroups.datatypeProperty) },
      ...coreSchemes.map((scheme) => ({ id: localName(scheme.iri), heading: `${literal(scheme, RDF.label, 'ko') ?? literal(scheme, RDF.prefLabel, 'ko') ?? localName(scheme.iri)} (${conceptsByScheme.get(scheme.iri).length})`, html: `<p class="mono" style="font-size:12px">${escapeHtml(scheme.qname ?? scheme.iri)} · ${escapeHtml(literal(scheme, RDF.definition, 'en') ?? literal(scheme, RDF.comment, 'en') ?? '')}</p>${renderTermTable(conceptsByScheme.get(scheme.iri), { relationColumns: false })}` })),
    ],
    footer: ['두 저장소의 <code>ontology/k12-core.ttl</code> 사본은 바이트 단위로 동일하게 유지되며 각 저장소의 동기 테스트가 이를 검사합니다.'],
  }));
  add(`learnmap/ontology/k12-core/${coreVersion}/index.html`, renderDocument({
    title: `K-12 코어 ${coreVersion}`,
    description: `K-12 학습지도 코어 온톨로지 버전 ${coreVersion}.`,
    canonicalPath: `learnmap/ontology/k12-core/${coreVersion}/index.html`,
    eyebrow: 'Version IRI',
    heading: `K-12 코어 ${coreVersion}`,
    lead: `버전 IRI <code>${escapeHtml(coreVersionIri)}</code>의 해석 결과입니다. 시리즈 IRI는 <a href="../">${escapeHtml(CORE_IRI)}</a>입니다.`,
    crumbs: [{ href: '/learnmap/', label: 'learnmap' }, { href: '/learnmap/ontology/', label: 'ontology' }, { href: '/learnmap/ontology/k12-core/', label: 'k12-core' }, { label: coreVersion }],
    meta: [['버전 IRI', iriLink(coreVersionIri)], ['문서', '<a href="../../k12-core.ttl"><code>k12-core.ttl</code></a>'], ['SHA-256', `<span class="mono" style="font-size:12px">${sha256(coreText)}</span>`]],
    sections: [],
  }));

  // --- Controlled vocabulary: https://dexa.art/learnmap/vocab/#/Scheme/term ---
  const schemeSections = vocabulary.conceptSchemes.map((scheme) => {
    const rows = scheme.concepts.map((concept) => `<tr id="/${escapeHtml(scheme.term)}/${escapeHtml(concept.term)}"><td class="term"><code>${escapeHtml(concept.term)}</code><a class="lh-anchor" href="#/${escapeHtml(scheme.term)}/${escapeHtml(concept.term)}" aria-label="링크">#</a></td><td>${escapeHtml(concept.definition ?? '')}</td><td class="mono" style="font-size:11px;overflow-wrap:anywhere">${escapeHtml(`${VOCAB_IRI}#/${scheme.term}/${concept.term}`)}</td></tr>`).join('');
    return {
      id: `/${scheme.term}`,
      heading: `${scheme.term} (${scheme.concepts.length})`,
      html: `<p>${escapeHtml(scheme.definition ?? '')}${scheme.modeling ? ` <span class="mono" style="font-size:12px">· ${escapeHtml(scheme.modeling)}</span>` : ''}</p><div class="lh-table-wrap"><table><thead><tr><th>개념</th><th>정의</th><th>IRI</th></tr></thead><tbody>${rows}</tbody></table></div>`,
    };
  });
  const conceptTotal = vocabulary.conceptSchemes.reduce((sum, scheme) => sum + scheme.concepts.length, 0);
  add('learnmap/vocab/index.html', renderDocument({
    title: '학습지도 통제 어휘',
    description: `초등 학습지도 온톨로지의 통제 어휘 ${vocabulary.conceptSchemes.length}개 스킴, 개념 ${conceptTotal}개.`,
    canonicalPath: 'learnmap/vocab/index.html',
    eyebrow: 'Controlled vocabulary',
    heading: '학습지도 통제 어휘',
    lead: `개념 IRI는 <code>${escapeHtml(VOCAB_IRI)}#/&lt;Scheme&gt;/&lt;term&gt;</code> 형식이며 fragment가 이 문서의 해당 행으로 이동합니다. 스킴과 개념 이름은 대소문자를 구분하고 <a href="/learnmap/ontology/controlled-vocabulary.json"><code>controlled-vocabulary.json</code></a>에서만 옵니다.`,
    crumbs: [{ href: '/learnmap/', label: 'learnmap' }, { label: 'vocab' }],
    meta: [
      ['어휘 루트', iriLink(VOCAB_IRI)],
      ['버전', escapeHtml(vocabulary.version)],
      ['스킴', `${vocabulary.conceptSchemes.length}개 · 개념 ${conceptTotal}개`],
      ['facet 어휘', `<a href="./facet/">${escapeHtml(FACET_IRI)}</a> (K-12 코어, 경로형 IRI)`],
    ],
    sections: [
      { id: 'schemes', heading: '스킴 목록', html: `<div class="lh-cards">${vocabulary.conceptSchemes.map((scheme) => `<a class="lh-card" href="#/${escapeHtml(scheme.term)}"><b>${escapeHtml(scheme.term)}</b><small>${scheme.concepts.length} concepts</small></a>`).join('')}</div>` },
      ...schemeSections,
    ],
  }));

  // --- Facet vocabulary: https://dexa.art/learnmap/vocab/facet/<key> ---
  add('learnmap/vocab/facet/index.html', renderDocument({
    title: '학습 facet 어휘',
    description: '학습 주제를 성취기준 안에서 나누는 facet 8종.',
    canonicalPath: 'learnmap/vocab/facet/index.html',
    eyebrow: 'Facet scheme',
    heading: '학습 facet 어휘',
    lead: `facet IRI는 <code>${escapeHtml(FACET_IRI)}&lt;key&gt;</code> 경로형이며 각 key마다 문서가 있습니다. 정의는 K-12 코어의 <code>core:FacetScheme</code>에서 옵니다.`,
    crumbs: [{ href: '/learnmap/', label: 'learnmap' }, { href: '/learnmap/vocab/', label: 'vocab' }, { label: 'facet' }],
    meta: [['스킴 IRI', iriLink(FACET_IRI)], ['코어 스킴', iriLink(`${CORE_IRI}#FacetScheme`, 'core:FacetScheme')]],
    sections: [{ id: 'facets', heading: `facet (${facetConcepts.length})`, html: `<div class="lh-cards">${facetConcepts.map(({ term, key }) => `<a class="lh-card" href="./${escapeHtml(key)}/"><b>${escapeHtml(literal(term, RDF.prefLabel, 'ko') ?? key)} <span class="mono" style="font-weight:400">${escapeHtml(key)}</span></b><small>${escapeHtml(`${FACET_IRI}${key}`)}</small><p>${escapeHtml(literal(term, RDF.definition, 'en') ?? '')}</p></a>`).join('')}</div>` }],
  }));
  for (const { term, key } of facetConcepts) {
    add(`learnmap/vocab/facet/${key}/index.html`, renderDocument({
      title: `facet: ${key}`,
      description: `학습 facet ${key} — ${literal(term, RDF.definition, 'en') ?? ''}`,
      canonicalPath: `learnmap/vocab/facet/${key}/index.html`,
      eyebrow: 'Facet concept',
      heading: `${literal(term, RDF.prefLabel, 'ko') ?? key} · ${key}`,
      lead: escapeHtml(literal(term, RDF.definition, 'en') ?? ''),
      crumbs: [{ href: '/learnmap/', label: 'learnmap' }, { href: '/learnmap/vocab/', label: 'vocab' }, { href: '/learnmap/vocab/facet/', label: 'facet' }, { label: key }],
      meta: [
        ['개념 IRI', iriLink(`${FACET_IRI}${key}`)],
        ['코어 개념', iriLink(term.iri, term.qname ?? term.iri)],
        ['레이블', `${escapeHtml(literal(term, RDF.prefLabel, 'ko') ?? '')} / ${escapeHtml(literal(term, RDF.prefLabel, 'en') ?? '')}`],
        ['스킴', `<a href="../">${escapeHtml(FACET_IRI)}</a>`],
      ],
      sections: [],
    }));
  }

  // --- IRI coverage ---
  const iriSet = new Set();
  const sourceFiles = [
    // Test fixtures are not part of the release and may mint throw-away IRIs.
    ...(await walkFiles(ontologyDir)).filter((file) => /\.(ttl|jsonld|json|rq)$/.test(file) && !file.includes(`${path.sep}fixtures${path.sep}`)),
    ...(await walkFiles(path.join(root, 'schema'))).filter((file) => file.endsWith('.json')),
    path.join(releaseDir, 'learning-map.ttl'),
  ];
  for (const file of sourceFiles) for (const iri of collectSiteIris(await readFile(file, 'utf8'))) iriSet.add(iri);
  for (const reserved of RESERVED_PREFIXES) {
    const minted = [...iriSet].filter((iri) => iri.startsWith(reserved) && iri !== reserved);
    if (minted.length) throw new Error(`reserved IRI path minted: ${minted.slice(0, 3).join(', ')}`);
  }
  const hostedPaths = files.map((file) => file.path);
  const coverage = resolveIriCoverage(iriSet, {
    hostedPaths,
    assumedPaths: [APP_PATH, ...PINNED_PATHS],
    ignoredPrefixes: RESERVED_PREFIXES,
  });
  if (coverage.uncovered.length) {
    throw new Error(`unhosted IRIs: ${coverage.uncovered.slice(0, 5).map((entry) => `${entry.iri} -> ${entry.path}`).join(' | ')}`);
  }

  const manifest = await writeHostingTree(distDir, files, {
    formatVersion: 1,
    repository: 'korean-elementary-learning-map',
    ontologyIri: SERIES_IRI,
    ontologyVersion: version,
    coreVersion,
    ownedPrefixes: ['learnmap/ontology/', 'learnmap/vocab/', 'learnmap/data/kr/'],
    sharedPaths: ['learnmap/ontology/k12-core.ttl'],
    pinnedPaths: PINNED_PATHS,
    assumedPaths: [APP_PATH],
    iriCount: iriSet.size,
    iriCoverage: summariseCoverage(coverage.covered),
  });
  return manifest;
}

async function main() {
  const manifest = await buildHosting();
  const bytes = manifest.files.reduce((sum, file) => sum + file.bytes, 0);
  console.log(`hosting build passed: ${manifest.files.length} files (${formatBytes(bytes)}), ${manifest.iriCount} site IRIs resolved to ${manifest.iriCoverage.length} documents`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error.stack ?? error);
    process.exitCode = 1;
  });
}
