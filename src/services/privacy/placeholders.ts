import type { EntityCategory, MaskedSegment, RedactionSpan, TranscriptSegment } from '../../models/types';
import { findWholeWord } from './patterns';
import { reconcileSpans } from './spans';

export function normalizeEntity(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/['’]s$/, '')
    .replace(/[^\p{L}\p{N}@.+]+/gu, ' ')
    .trim();
}

export const identityKey = (category: EntityCategory, text: string) => `${category}:${normalizeEntity(text)}`;

const PLACEHOLDER_RE = /^\[([A-Z]+)_(\d+)\]$/;

function nextIndex(identityMap: Record<string, string>, category: EntityCategory): number {
  let max = 0;
  for (const placeholder of Object.values(identityMap)) {
    const match = placeholder.match(PLACEHOLDER_RE);
    if (match && match[1] === category) max = Math.max(max, Number(match[2]));
  }
  return max + 1;
}

/**
 * For people, "Maria" and "Maria Delgado" should share one placeholder. Returns
 * an existing PERSON placeholder whose name shares a token with `normalized`.
 */
function findRelatedPerson(identityMap: Record<string, string>, normalized: string): string | undefined {
  const tokens = new Set(normalized.split(' ').filter((t) => t.length >= 3));
  if (tokens.size === 0) return undefined;
  for (const [key, placeholder] of Object.entries(identityMap)) {
    if (!key.startsWith('PERSON:')) continue;
    const existing = key.slice('PERSON:'.length).split(' ');
    if (existing.some((t) => tokens.has(t))) return placeholder;
  }
  return undefined;
}

/**
 * Assigns stable placeholders such as [PERSON_01] to accepted spans. Returns a
 * new identity map; existing assignments are never renumbered, so placeholders
 * stay stable across re-detection and transcript edits.
 */
export function assignPlaceholders(
  spans: RedactionSpan[],
  identityMap: Record<string, string>,
): Record<string, string> {
  const map = { ...identityMap };
  // Longer names first so "Maria Delgado" claims PERSON_01 before "Maria" is seen.
  const accepted = spans
    .filter((s) => s.status === 'accepted')
    .sort((a, b) => b.text.length - a.text.length);
  for (const span of accepted) {
    const key = identityKey(span.category, span.text);
    if (map[key]) continue;
    const normalized = key.slice(span.category.length + 1);
    const related = span.category === 'PERSON' ? findRelatedPerson(map, normalized) : undefined;
    if (related) {
      map[key] = related;
      continue;
    }
    const index = nextIndex(map, span.category);
    map[key] = `[${span.category}_${String(index).padStart(2, '0')}]`;
  }
  return map;
}

export function placeholderFor(span: Pick<RedactionSpan, 'category' | 'text'>, identityMap: Record<string, string>): string {
  return identityMap[identityKey(span.category, span.text)] ?? `[${span.category}]`;
}

/**
 * Produces cloud-bound text. Only the accepted spans are replaced; every other
 * character of the participant's wording is preserved exactly.
 */
export function maskSegments(
  segments: TranscriptSegment[],
  spans: RedactionSpan[],
  identityMap: Record<string, string>,
): MaskedSegment[] {
  const live = reconcileSpans(segments, spans).filter((s) => s.status === 'accepted');
  const bySegment = new Map<string, RedactionSpan[]>();
  for (const span of live) {
    const list = bySegment.get(span.segmentId) ?? [];
    list.push(span);
    bySegment.set(span.segmentId, list);
  }
  return segments.map((segment) => {
    const segmentSpans = (bySegment.get(segment.id) ?? []).sort((a, b) => a.start - b.start);
    let cursor = 0;
    let text = '';
    for (const span of segmentSpans) {
      if (span.start < cursor) continue; // defensive: overlaps are resolved upstream
      text += segment.text.slice(cursor, span.start) + placeholderFor(span, identityMap);
      cursor = span.end;
    }
    text += segment.text.slice(cursor);
    return {
      id: segment.id,
      startMs: segment.startMs,
      endMs: segment.endMs,
      speaker: segment.speaker,
      text,
    };
  });
}

export interface LeakFinding {
  segmentId: string;
  category: EntityCategory;
  /** Only shown locally; never logged. */
  text: string;
}

/**
 * Safety net before anything leaves the device: any accepted identifier that
 * still appears in the masked text (e.g. a new occurrence typed in after
 * detection) is reported. Occurrences the researcher explicitly rejected are
 * not counted.
 */
export function findLeaks(
  masked: MaskedSegment[],
  spans: RedactionSpan[],
): LeakFinding[] {
  const rejected = new Set(spans.filter((s) => s.status === 'rejected').map((s) => s.text.toLowerCase()));
  const needles = new Map<string, EntityCategory>();
  for (const span of spans) {
    if (span.status !== 'accepted' || span.text.trim().length < 2) continue;
    if (rejected.has(span.text.toLowerCase())) continue;
    needles.set(span.text, span.category);
  }
  const leaks: LeakFinding[] = [];
  for (const segment of masked) {
    for (const [needle, category] of needles) {
      if (findWholeWord(segment.text, needle).length > 0) {
        leaks.push({ segmentId: segment.id, category, text: needle });
      }
    }
  }
  return leaks;
}
