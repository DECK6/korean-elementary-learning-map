// Expands subject official-relation specs (code pairs) into topic-level edges.
// Contract sections 3 and 8: each achievement standard is represented by its anchor topic — the
// `facetKey: concept` topic, or the first topic in id order when a standard has none (elementary
// English). The anchor is the same topic the builder stamps with `topicRole: anchor`.
import { anchorTopicOf, computeScope, relationId, standardCodeOf } from './relation-vocabulary.mjs';

function noticeLabel(sourceName = '') {
  const issuer = sourceName.match(/(교육부|국가교육위원회)/)?.[1];
  const noticeNumber = sourceName.match(/고시\s*제\s*([0-9]+-[0-9]+)\s*호/)?.[1];
  const annex = sourceName.match(/별책\s*([0-9]+)/)?.[1];
  const parts = [];
  if (noticeNumber) parts.push(`${issuer ? `${issuer} ` : ''}고시 제${noticeNumber}호`);
  if (annex) parts.push(`별책${annex}`);
  if (parts.length > 0) return parts.join(' ');
  // Some source records store only the annex file title; keep it verbatim
  // rather than inventing a notice number.
  return sourceName.replace(/\.pdf$/i, '').trim();
}

export function officialBasisText({ sourceName, sourceId, printedPage, domainLabel, tier }) {
  const prefix = noticeLabel(sourceName) || sourceId;
  const section = tier === 'content-system' ? `내용 체계표 '${domainLabel}'` : '성취기준 해설';
  return `${prefix} ${section} p.${printedPage}`;
}

/** Maps every achievement-standard code to the anchor topic that stands for the whole standard. */
export function anchorTopicsByCode(topics) {
  const byCode = new Map();
  for (const topic of topics) {
    const code = standardCodeOf(topic);
    if (!code) continue;
    if (!byCode.has(code)) byCode.set(code, []);
    byCode.get(code).push(topic);
  }
  const anchors = new Map();
  for (const [code, members] of byCode) anchors.set(code, anchorTopicOf(members));
  return anchors;
}

/**
 * @param {object} input
 * @param {object[]} input.specs subject specs (contract section 3 shape)
 * @param {object[]} input.topics built topic records
 * @param {Map<string, object>} input.sourcesById source records by id
 * @returns {{ relations: object[], expansions: object[] }}
 */
export function expandOfficialRelations({ specs = [], topics = [], sourcesById = new Map() }) {
  const representatives = anchorTopicsByCode(topics);
  const relations = [];
  const expansions = [];
  const seen = new Set();

  for (const spec of [...specs].sort((left, right) => String(left.subject).localeCompare(String(right.subject)))) {
    const source = sourcesById.get(spec.sourceId);
    if (!source) {
      throw new Error(`official relation spec ${spec.subject}: unknown sourceId ${spec.sourceId}`);
    }
    const tiers = [
      { tier: 'content-system', tuples: spec.contentSystemRequired || [], hasDomain: true },
      { tier: 'commentary', tuples: spec.commentaryRequired || [], hasDomain: false },
    ];

    for (const { tier, tuples, hasDomain } of tiers) {
      for (const tuple of tuples) {
        const [fromCode, toCode] = tuple;
        const domainLabel = hasDomain ? tuple[2] : null;
        const printedPage = hasDomain ? tuple[3] : tuple[2];
        const note = hasDomain ? tuple[4] : tuple[3];
        const prerequisiteTopic = representatives.get(fromCode);
        const dependentTopic = representatives.get(toCode);
        if (!prerequisiteTopic || !dependentTopic) {
          throw new Error(
            `official relation spec ${spec.subject}: no topic for ${!prerequisiteTopic ? fromCode : toCode}`,
          );
        }
        if (!Number.isInteger(printedPage)) {
          throw new Error(`official relation spec ${spec.subject}: printedPage must be an integer for ${fromCode}->${toCode}`);
        }
        if (prerequisiteTopic.id === dependentTopic.id) {
          throw new Error(`official relation spec ${spec.subject}: self relation for ${fromCode}->${toCode}`);
        }
        const key = `${dependentTopic.id}->${prerequisiteTopic.id}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const sourceLocator = { sourceId: spec.sourceId, printedPage };
        if (tier === 'content-system') sourceLocator.section = `내용 체계표 > ${domainLabel}`;
        else sourceLocator.section = '성취기준 해설';

        relations.push({
          id: relationId(dependentTopic.id, prerequisiteTopic.id),
          layer: 'official',
          topicId: dependentTopic.id,
          prerequisiteId: prerequisiteTopic.id,
          relationKind: 'required-prerequisite',
          basisKind: 'official-source',
          scope: computeScope(dependentTopic, prerequisiteTopic),
          strength: 'hard',
          reviewStatus: 'internal-reviewed',
          reason: note
            ? `${fromCode} → ${toCode} (${note})`
            : `${fromCode}에서 다룬 내용을 ${toCode}가 이어받는다.`,
          basis: officialBasisText({
            sourceName: source.name,
            sourceId: spec.sourceId,
            printedPage,
            domainLabel,
            tier,
          }),
          source: `official-relation-spec:${spec.specFile || `${spec.subject}.mjs`}`,
          sourceRefs: [spec.sourceId],
          sourceLocator,
        });
        expansions.push({
          subject: spec.subject,
          tier,
          fromCode,
          toCode,
          prerequisiteId: prerequisiteTopic.id,
          topicId: dependentTopic.id,
        });
      }
    }
  }

  relations.sort(
    (left, right) =>
      left.topicId.localeCompare(right.topicId) || left.prerequisiteId.localeCompare(right.prerequisiteId),
  );
  return { relations, expansions };
}
