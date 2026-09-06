// Canonical source identities and official inventory gates for the integrated
// Korean dataset. Workstreams may carry historical portal aliases, but the
// published build keeps only direct, reviewable source records.

export const STALE_KR_SOURCE_IDS = new Set([
  'kr-moe-2022-33-annex15-pdf',
  'kr-ncic',
  'kr-ncic-2022-elem-integrated-attachment',
  'kr-ncic-2022-notice-543',
  'kr-ncic-2022-notices',
  'kr-ncic-2026-amendment-notice-1864',
  'kr-ncic-domestic-inventory',
  'kr-ncic-inventory',
  'kr-ncic-inventory-api',
]);

export const KR_SOURCE_ALIAS_REPLACEMENTS = new Map([
  ['kr-ncic-2026-amendment-notice-1864', 'kr-ncic-2026-1-annex15-pdf'],
  // 2026-1 일부개정으로 통합교과 인용본을 단일 판(별책15 2026-1)으로 통일했다.
  // 2022-33 별책15와 2022.12 인벤토리 행은 더 이상 인용하지 않는다.
  ['kr-moe-2022-33-annex15-pdf', 'kr-ncic-2026-1-annex15-pdf'],
  ['kr-ncic-2022-elem-integrated-attachment', 'kr-ncic-2026-elem-integrated-attachment'],
]);

export const OFFICIAL_PDF_SOURCE_SNAPSHOTS = {
  'kr-moe-2022-33-annex5-pdf': {
    sourceType: 'official-pdf',
    publisher: '교육부',
    via: 'NCIC 국가교육과정정보센터',
    url: 'https://ncic.re.kr/inv/org/download.do?year=2022&seq=10003553&orgType=ogi4',
    subjectCode: '1713',
    attachmentName: '[별책5] 국어과 교육과정.pdf',
    attachmentNo: '10003553',
    sha256: '5c30ae42a973a8f912bae156b160cd16d56636b3a64af84c3bdc378c9b482544',
    fileSizeBytes: 2078590,
    pdfPages: 222,
  },
  'kr-ncic-math-pdf-2022': {
    sourceType: 'official-pdf',
    publisher: '교육부',
    via: 'NCIC 국가교육과정정보센터',
    url: 'https://ncic.re.kr/inv/org/download.do?year=2022&seq=10003559&orgType=ogi4',
    subjectCode: '2511',
    attachmentName: '[별책8] 수학과 교육과정.pdf',
    attachmentNo: '10003559',
    sha256: 'ba7c7c63ad31ba0fd32e5eb8148d696dd73288acce111495c593298112f8f840',
    fileSizeBytes: 1938993,
    pdfPages: 263,
  },
  'kr-ncic-science-pdf-2022': {
    sourceType: 'official-pdf',
    publisher: '교육부',
    via: 'NCIC 국가교육과정정보센터',
    url: 'https://ncic.re.kr/inv/org/download.do?year=2022&seq=10003551&orgType=ogi4',
    subjectCode: '1306',
    attachmentName: '[별책9] 과학과 교육과정.pdf',
    attachmentNo: '10003551',
    sha256: '0cf53427691d54366d6805767c428a15b0e817580807b4354947de7e3b58b738',
    fileSizeBytes: 2663278,
    pdfPages: 292,
  },
  'kr-ncic-2022-social-pdf': {
    sourceType: 'official-pdf',
    publisher: '교육부',
    via: 'NCIC 국가교육과정정보센터',
    url: 'https://ncic.re.kr/inv/org/download.do?year=2022&seq=10003800&orgType=ogi4',
    subjectCode: '2304',
    attachmentName: '[별책7] 사회과 교육과정.pdf',
    attachmentNo: '10003800',
    sha256: 'a852e8da3e6aea7d1c95690dcae140be02e014b779ac2e5cc0801200cfb16923',
    fileSizeBytes: 4332996,
    pdfPages: 316,
  },
  'kr-ncic-2022-english-pdf': {
    sourceType: 'official-pdf',
    publisher: '교육부',
    via: 'NCIC 국가교육과정정보센터',
    url: 'https://ncic.re.kr/inv/org/download.do?year=2022&seq=10003794&orgType=ogi4',
    subjectCode: '3360',
    attachmentName: '[별책14] 영어과 교육과정.pdf',
    attachmentNo: '10003794',
    sha256: '596d13897b002a4279a3e21f16396bdae7ac74988450f45fb348f87af943f92a',
    fileSizeBytes: 2313266,
    pdfPages: 306,
  },
  'kr-ncic-moral-pdf-2022': {
    sourceType: 'official-pdf',
    publisher: '교육부',
    via: 'NCIC 국가교육과정정보센터',
    url: 'https://ncic.re.kr/inv/org/download.do?year=2022&seq=10003738&orgType=ogi4',
    subjectCode: '3311',
    attachmentName: '[별책6] 도덕과 교육과정.pdf',
    attachmentNo: '10003738',
    sha256: '0682710d786a0be26efdfbd835195e4871c71bc7c3c11f71427c7087c07a850e',
    fileSizeBytes: 1412105,
    pdfPages: 92,
  },
  // Re-pinned 2026-09-05: NCIC replaced the 초등학교(2022.12) 실과 attachment
  // 10003781 with 10004244. Same 39 elementary codes and same page placement;
  // [6실04-06] differs only in its sentence ending in the reissued print.
  'kr-ncic-practical-arts-pdf-2022': {
    sourceType: 'official-pdf',
    publisher: '교육부',
    via: 'NCIC 국가교육과정정보센터',
    url: 'https://ncic.re.kr/inv/org/download.do?year=2022&seq=10004244&orgType=ogi4',
    subjectCode: '3396',
    attachmentName: '[별책10] 실과(기술·가정)/정보과 교육과정.pdf',
    attachmentNo: '10004244',
    sha256: '8eaa773fc8767d6fc081ba6324e40188e9635443c4d242ba1b53047b73d9ef38',
    fileSizeBytes: 2806751,
    pdfPages: 222,
  },
  // Sole governing source for 통합교과 since the 2026-09-05 re-pin. The 2022-33
  // [별책15] (attachment 10003571) is no longer cited: its 즐거운 생활 codes were
  // reassigned by this amendment. See docs/source-version-diff-2026-09.md.
  'kr-ncic-2026-1-annex15-pdf': {
    sourceType: 'official-pdf',
    publisher: '교육부·국가교육위원회',
    via: 'NCIC 국가교육과정정보센터',
    url: 'https://ncic.re.kr/inv/org/download.do?year=2026&seq=10004214&orgType=ogi4',
    subjectCode: '3417',
    attachmentName: '바른 생활, 슬기로운 생활, 건강한 생활, 즐거운 생활 교육과정.pdf',
    attachmentNo: '10004214',
    sha256: '39954a4b5605b0ee691bd1a13e8207568ecb9079c97cdd6bf4ef490a7b7a41c6',
    fileSizeBytes: 1449216,
    pdfPages: 90,
  },
  // Cross-check only: one document carrying all 620 elementary codes.
  'kr-ncic-2026-1-annex2-pdf': {
    sourceType: 'official-pdf',
    publisher: '교육부·국가교육위원회',
    via: 'NCIC 국가교육과정정보센터',
    url: 'https://ncic.re.kr/inv/org/download.do?year=2026&seq=10004180&orgType=ogi4',
    subjectCode: '1100',
    attachmentName: '[별책2] 초등학교 교육과정.pdf',
    attachmentNo: '10004180',
    sha256: 'f943dab812a4b1fdb48af16fd724b5391d0db64bda83ed4e4b3b2a95faf3d4f9',
    fileSizeBytes: 6402622,
    pdfPages: 563,
  },
  'kr-ncic-2022-art-pdf': {
    sourceType: 'official-pdf',
    publisher: '교육부',
    via: 'NCIC 국가교육과정정보센터',
    url: 'https://ncic.re.kr/inv/org/download.do?year=2022&seq=10003555&orgType=ogi4',
    subjectCode: '2201',
    attachmentName: '[별책13] 미술과 교육과정.pdf',
    attachmentNo: '10003555',
    sha256: 'b47363c9a1060b00777c6de555d972b509b64b886d7beca89460a552a33c77b2',
    fileSizeBytes: 1983114,
    pdfPages: 76,
  },
  // Re-pinned 2026-09-05 to the current NCIC attachment (국가교육위원회 고시 제2024-3호
  // 일부개정). [4음02-05]·[6음02-05] and two elementary content-system cells moved from
  // 문화유산 to 국가유산 wording. PDF page placement is byte-identical to the 2022-33 print.
  'kr-ncic-2022-music-pdf': {
    sourceType: 'official-pdf',
    publisher: '교육부·국가교육위원회',
    via: 'NCIC 국가교육과정정보센터',
    url: 'https://ncic.re.kr/inv/org/download.do?year=2024&seq=10003999&orgType=ogi4',
    subjectCode: '2801',
    attachmentName: '(2022개정) 초·중등학교 교육과정 [별책12] 음악과_ 국가교육위원회 고시 제2024-3호(2024.08.16.).pdf',
    attachmentNo: '10003999',
    sha256: '54af8340687ace3599f5242dcc6d4d95382af24144be186fa6c4b246417d0487',
    fileSizeBytes: 1943652,
    pdfPages: 96,
  },
  'kr-ncic-2022-physical-education-pdf': {
    sourceType: 'official-pdf',
    publisher: '교육부',
    via: 'NCIC 국가교육과정정보센터',
    url: 'https://ncic.re.kr/inv/org/download.do?year=2022&seq=10003695&orgType=ogi4',
    subjectCode: '3009',
    attachmentName: '[별책11] 체육과 교육과정.pdf',
    attachmentNo: '10003695',
    sha256: '49cdef2bbcdf1decb796204ab66a0b6a308cd2903ead7168dde892b1f48cf2fb',
    fileSizeBytes: 2371909,
    pdfPages: 125,
  },
};

export const OFFICIAL_INVENTORY_GATES = {
  'kr-2022-elem-korean': {
    standardCount: 87,
    codeInventorySha256: '36e4718853dac0f1ec0e1f498b3d33188cb4fc944111d12d58c0a1679542440b',
    sourceGroups: [{ sourceId: 'kr-moe-2022-33-annex5-pdf', standardCount: 87 }],
  },
  'kr-2022-elem-math': {
    standardCount: 121,
    codeInventorySha256: 'cdd3af2d3dd3cd0a2a8e8b45ad5c23fc86cf7d23f77f902b2ef0edbcf409388d',
    sourceGroups: [{ sourceId: 'kr-ncic-math-pdf-2022', standardCount: 121 }],
  },
  'kr-2022-elem-science': {
    standardCount: 102,
    codeInventorySha256: 'ff43626ce2101eb5657977c573eec6911719db4c65b572f4d7a4b29a4159afab',
    sourceGroups: [{ sourceId: 'kr-ncic-science-pdf-2022', standardCount: 102 }],
  },
  'kr-2022-elem-social-studies': {
    standardCount: 49,
    codeInventorySha256: 'ee21669fa7c22ad09f213b82bdd0dcc812168c5b87e5f4759e4eb9feb0686c97',
    sourceGroups: [{ sourceId: 'kr-ncic-2022-social-pdf', standardCount: 49 }],
  },
  'kr-2022-elem-english-efl': {
    standardCount: 40,
    codeInventorySha256: '918f4b27897c9e355267527a66c6f28e7a3df76eabcebcdc5c4b03d19986991d',
    sourceGroups: [{ sourceId: 'kr-ncic-2022-english-pdf', standardCount: 40 }],
  },
  'kr-2022-elem-moral': {
    standardCount: 24,
    codeInventorySha256: 'cd32abf381f71dd1123a31398b9164957f3a95ab0bcc0bd8230b8f5943cc7920',
    sourceGroups: [{ sourceId: 'kr-ncic-moral-pdf-2022', standardCount: 24 }],
  },
  'kr-2022-elem-practical-arts': {
    standardCount: 39,
    codeInventorySha256: '3efc7c6600abd077ba4569993f7a02fed5fff9c8b347ddb0ffcf34ed68fd3953',
    sourceGroups: [{ sourceId: 'kr-ncic-practical-arts-pdf-2022', standardCount: 39 }],
  },
  // Single-edition gate: 바 16 + 슬 16 + 건 9 + 즐 16 from attachment 10004214.
  // The digest is what catches the ghost/missing 즐거운 생활 codes that a bare
  // count check ({48 + 9} and {16 + 16 + 9 + 16} are both 57) cannot see.
  'kr-2022-elem-integrated': {
    standardCount: 57,
    codeInventorySha256: '9fa9b32be2fe82e156466a5ed69e404cf5ed9b6a3d02834051864b51e651e516',
    sourceGroups: [{ sourceId: 'kr-ncic-2026-1-annex15-pdf', standardCount: 57 }],
  },
  'kr-2022-elem-art': {
    standardCount: 26,
    codeInventorySha256: 'a87f20c90a6bcc5ba4a1054751c6e3e62427d22c02e48b6b157b73e510460290',
    sourceGroups: [{ sourceId: 'kr-ncic-2022-art-pdf', standardCount: 26 }],
  },
  'kr-2022-elem-music': {
    standardCount: 26,
    codeInventorySha256: '2ebee7b6c8e03224a78be602bd37cb1f62e8720676e735ef3ab2127380835d3d',
    sourceGroups: [{ sourceId: 'kr-ncic-2022-music-pdf', standardCount: 26 }],
  },
  'kr-2022-elem-physical-education': {
    standardCount: 49,
    codeInventorySha256: '8736002ddc0ff012c0b37230b4e8eafe7318e1f1b6b5184239eaa38909c51b42',
    sourceGroups: [{ sourceId: 'kr-ncic-2022-physical-education-pdf', standardCount: 49 }],
  },
};

const clone = (value) => JSON.parse(JSON.stringify(value));

export function normalizeKrSourceRecord(source, workstreamFile = 'unknown workstream') {
  const normalized = clone(source);
  normalized.id = KR_SOURCE_ALIAS_REPLACEMENTS.get(normalized.id) || normalized.id;
  normalized.name ||= normalized.title || normalized.id;
  normalized.url ||= normalized.sourceUrl;
  normalized.accessDate ||= normalized.retrievedAt;
  normalized.usage ||=
    normalized.evidenceUse ||
    `Source metadata supplied by ${workstreamFile} for taxonomy provenance and verification.`;
  normalized.sourceType ||= normalized.type;

  const attachment = normalized.attachment || {};
  const pdfMetadata = normalized.pdfMetadata || {};
  normalized.attachmentNo ||= attachment.orgAttNo;
  normalized.attachmentName ||= attachment.fileName;
  normalized.fileSizeBytes ??= attachment.fileSizeBytes ?? pdfMetadata.fileSizeBytes;
  normalized.pdfPages ??= attachment.pdfPages ?? pdfMetadata.pages;
  normalized.subjectCode ||= attachment.ncicSubjectCode;

  if (!normalized.sourceType) {
    if (/\/inv\/org\/download\.do/i.test(normalized.url || '')) normalized.sourceType = 'official-pdf';
    else if (/\/inv\/org\/list\.do/i.test(normalized.url || '')) normalized.sourceType = 'official-inventory';
    else if (/^https?:\/\//i.test(normalized.url || '')) normalized.sourceType = 'official-web';
    else normalized.sourceType = 'repository-document';
  }

  delete normalized.title;
  delete normalized.sourceUrl;
  delete normalized.retrievedAt;
  delete normalized.evidenceUse;
  delete normalized.type;
  if (/\/bbs\/eduNotice2022\//i.test(normalized.replacesUrl || '')) {
    delete normalized.replacesUrl;
    delete normalized.linkStatus;
  }
  return {
    ...normalized,
    ...(OFFICIAL_PDF_SOURCE_SNAPSHOTS[normalized.id] || {}),
  };
}

export function normalizeKrSourceRefs(sourceRefs = []) {
  return [
    ...new Set(
      sourceRefs
        .map((sourceId) => KR_SOURCE_ALIAS_REPLACEMENTS.get(sourceId) || sourceId)
        .filter((sourceId) => !STALE_KR_SOURCE_IDS.has(sourceId)),
    ),
  ].sort();
}
