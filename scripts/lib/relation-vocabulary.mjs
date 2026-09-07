// Shared K-12 relation vocabulary (contract: docs/plans/2026-09-05-k12-relation-vocabulary-spec.md).
// Elementary and secondary repositories must agree on these enums and derivations.
import { createHash } from 'node:crypto';

// Common SKOS facet scheme: https://dexa.art/learnmap/vocab/facet/
export const FACET_KEYS = [
  'concept',
  'procedure',
  'representation',
  'application',
  'inquiry',
  'communication',
  'reflection',
  'core',
];

// Topic roles (contract section 8). Every achievement standard has exactly one anchor; the topics a
// facet-collapse rule marks are auxiliary, and everything else is a plain facet.
export const TOPIC_ROLES = ['anchor', 'facet', 'auxiliary'];

export const RELATION_ENUMS = {
  layer: ['official', 'pedagogical-candidate'],
  relationKind: ['required-prerequisite', 'recommended-before'],
  basisKind: [
    'official-source',
    'official-code-order',
    'decomposition-order',
    'repository-authored',
    'expert-authored',
  ],
  scope: ['same-standard', 'same-domain', 'same-subject', 'cross-school-level'],
  reviewStatus: ['candidate', 'internal-reviewed', 'subject-expert-reviewed', 'classroom-reviewed'],
  decompositionKind: ['standard-core', 'subject-facet'],
  facetKey: FACET_KEYS,
  topicRole: TOPIC_ROLES,
};

// Elementary topic `type` must agree with the facet the id suffix already declares (contract
// section 9). application and inquiry have no type of their own; both are carried out procedurally.
export const TYPES_BY_FACET_KEY = {
  concept: ['CONCEPTUAL'],
  procedure: ['PROCEDURAL'],
  representation: ['REPRESENTATIONAL'],
  communication: ['LANGUAGE'],
  reflection: ['META'],
  application: ['PROCEDURAL'],
  inquiry: ['PROCEDURAL'],
  core: ['CONCEPTUAL', 'PROCEDURAL', 'REPRESENTATIONAL', 'LANGUAGE', 'META'],
};

export const COVERAGE_GAP_SEVERITIES = ['high', 'medium', 'low', 'intentional'];
export const COVERAGE_GAP_STATUSES = ['open', 'needs-review', 'resolved', 'intentional', 'out-of-scope'];

// Elementary topic-id facet suffixes mapped onto the common eight facets.
const SUFFIX_FACET_KEYS = new Map([
  ['concept', 'concept'],
  ['understand', 'concept'],
  ['procedure', 'procedure'],
  ['perform', 'procedure'],
  ['make', 'procedure'],
  ['representation', 'representation'],
  ['application', 'application'],
  ['practice', 'application'],
  ['inquiry', 'inquiry'],
  ['reflect', 'reflection'],
]);

// `.evidence` is the one suffix the generators use for two different facets: 표현·근거 topics
// (REPRESENTATIONAL) and 탐구 topics. Reading it as `inquiry` regardless of type made the 49 social
// `.evidence` topics collide with the `.inquiry` sibling of the same standard, so the type decides.
const EVIDENCE_SUFFIX_FACET_KEYS = new Map([['REPRESENTATIONAL', 'representation']]);

// Fallback used by numeric suffixes (.01-.04) and by free-text Korean suffixes.
const TYPE_FACET_KEYS = new Map([
  ['CONCEPTUAL', 'concept'],
  ['PROCEDURAL', 'procedure'],
  ['REPRESENTATIONAL', 'representation'],
  ['LANGUAGE', 'communication'],
  ['META', 'reflection'],
]);

const LEGACY_BASIS_RULES = [
  // Within-standard decomposition order and the four facet bridges.
  [/^within-standard\s/i, 'decomposition-order'],
  // Official code / unit sequence: document ordering, never an official prerequisite claim.
  [/official-code sequence/i, 'official-code-order'],
  [/within-unit official sequence/i, 'official-code-order'],
  // Repository-authored pedagogical progressions.
  [/grade-band progression/i, 'repository-authored'],
  [/same-grade domain sequence/i, 'repository-authored'],
  [/cross-grade official linkage candidate/i, 'repository-authored'],
  [/workstream-authored/i, 'repository-authored'],
];

export function classifyLegacyBasis(basisText) {
  const text = typeof basisText === 'string' ? basisText.trim() : '';
  if (!text) return 'repository-authored';
  for (const [pattern, basisKind] of LEGACY_BASIS_RULES) {
    if (pattern.test(text)) return basisKind;
  }
  return 'repository-authored';
}

export function facetSuffixOf(topicId) {
  const segments = String(topicId ?? '').split('.');
  return segments.length > 0 ? segments[segments.length - 1].toLowerCase() : '';
}

export function deriveFacetKey(topic) {
  if (!topic) return 'concept';
  const suffix = facetSuffixOf(topic.id);
  const type = String(topic.type).toUpperCase();
  if (suffix === 'evidence') return EVIDENCE_SUFFIX_FACET_KEYS.get(type) ?? 'inquiry';
  const bySuffix = SUFFIX_FACET_KEYS.get(suffix);
  if (bySuffix) return bySuffix;
  return TYPE_FACET_KEYS.get(type) ?? 'concept';
}

/**
 * Anchor selection (contract section 8): the `concept` facet stands for the whole standard, and a
 * standard without one — elementary English has only communication, procedure, and reflection —
 * gives the role to the first topic in id order. Topics that already carry `topicRole` win, so the
 * builder decides once and every consumer reads the same answer.
 */
export function anchorTopicOf(topics) {
  const sorted = [...topics].sort((left, right) => left.id.localeCompare(right.id));
  const declared = sorted.find((topic) => topic.topicRole === 'anchor');
  if (declared) return declared;
  return sorted.find((topic) => (topic.facetKey ?? deriveFacetKey(topic)) === 'concept') ?? sorted[0] ?? null;
}

export function standardKeyOf(topic) {
  return topic?.standardKey ?? topic?.standards?.[0] ?? null;
}

export function standardCodeOf(topic) {
  if (topic?.sourceStandardCode) return topic.sourceStandardCode;
  const key = standardKeyOf(topic);
  if (typeof key !== 'string') return null;
  return key.includes(':') ? key.slice(key.indexOf(':') + 1) : key;
}

function domainOf(topic) {
  return topic?.domain ?? topic?.officialArea ?? null;
}

function schoolLevelOf(topic) {
  return topic?.schoolLevel ?? 'elementary';
}

// Mechanically compares standard, domain, and subject of both endpoints.
// The widest bucket in the shared enum is cross-school-level, so any pair that
// is neither same-standard, same-domain, nor same-subject falls back to it.
export function computeScope(topicA, topicB) {
  if (!topicA || !topicB) return 'cross-school-level';
  if (schoolLevelOf(topicA) !== schoolLevelOf(topicB)) return 'cross-school-level';
  const subjectA = topicA.subject ?? topicA.subjectKorean;
  const subjectB = topicB.subject ?? topicB.subjectKorean;
  if (subjectA !== subjectB) return 'cross-school-level';
  const standardA = standardKeyOf(topicA);
  const standardB = standardKeyOf(topicB);
  if (standardA && standardA === standardB) return 'same-standard';
  const domainA = domainOf(topicA);
  const domainB = domainOf(topicB);
  if (domainA && domainA === domainB) return 'same-domain';
  return 'same-subject';
}

export function relationId(topicId, prerequisiteId) {
  const digest = createHash('sha256').update(`${topicId}->${prerequisiteId}`).digest('hex');
  return `kr.dep.${digest.slice(0, 20)}`;
}

const SEVERITY_BY_STATUS = new Map([
  ['intentional', 'intentional'],
  ['out-of-scope', 'intentional'],
  ['resolved', 'low'],
  ['needs-review', 'medium'],
  ['open', 'medium'],
]);

// `statusFallback` is the already-normalized status; it decides severity when the
// source record carries none (24 of the 43 legacy gaps).
export function normalizeCoverageGapSeverity(value, statusFallback = 'open') {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text || text === 'undefined' || text === 'null') {
    return SEVERITY_BY_STATUS.get(statusFallback) ?? 'medium';
  }
  if (COVERAGE_GAP_SEVERITIES.includes(text)) return text;
  if (/^(critical|blocker|severe)$/.test(text)) return 'high';
  if (/^(minor|informational|note|documented)$/.test(text)) return 'low';
  if (/intentional|by-design|policy|out-of-scope/.test(text)) return 'intentional';
  if (/review|follow-?up|pending|candidate/.test(text)) return 'medium';
  return 'medium';
}

export function normalizeCoverageGapStatus(value) {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text || text === 'undefined' || text === 'null') return 'open';
  if (COVERAGE_GAP_STATUSES.includes(text)) return text;
  if (/^out-of-scope/.test(text)) return 'out-of-scope';
  if (/resolved|closed|complete/.test(text)) return 'resolved';
  if (/intentional|by-design|policy/.test(text)) return 'intentional';
  if (/review|follow-?up|candidate|pending/.test(text)) return 'needs-review';
  return 'open';
}
