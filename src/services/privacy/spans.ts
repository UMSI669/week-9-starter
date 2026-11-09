import type { RedactionSpan, SpanSource, TranscriptSegment } from '../../models/types';
import { findWholeWord, NAME_STOPWORDS, type SpanCandidate } from './patterns';

const SOURCE_PRIORITY: Record<SpanSource, number> = {
  manual: 5,
  'known-identifier': 4,
  pattern: 3,
  'local-llm': 2,
  propagated: 1,
};

/** Structured identifiers win over heuristics when spans overlap. */
const STRUCTURED = new Set(['EMAIL', 'URL', 'PHONE', 'ID', 'ADDRESS', 'DATE']);

function rank(span: SpanCandidate): number[] {
  return [
    span.source === 'manual' ? 1 : 0,
    STRUCTURED.has(span.category) ? 1 : 0,
    span.end - span.start,
    SOURCE_PRIORITY[span.source],
  ];
}

function better(a: SpanCandidate, b: SpanCandidate): boolean {
  const ra = rank(a);
  const rb = rank(b);
  for (let i = 0; i < ra.length; i += 1) {
    if (ra[i] !== rb[i]) return ra[i] > rb[i];
  }
  return false;
}

/**
 * Resolves overlapping candidates per segment so the final spans never
 * overlap. Longer / structured / manual spans win.
 */
export function mergeCandidates<T extends SpanCandidate>(candidates: T[]): T[] {
  const bySegment = new Map<string, T[]>();
  for (const candidate of candidates) {
    const list = bySegment.get(candidate.segmentId) ?? [];
    list.push(candidate);
    bySegment.set(candidate.segmentId, list);
  }
  const result: T[] = [];
  for (const list of bySegment.values()) {
    const kept: T[] = [];
    const ordered = [...list].sort((a, b) => (better(a, b) ? -1 : better(b, a) ? 1 : a.start - b.start));
    for (const candidate of ordered) {
      const overlaps = kept.some((k) => candidate.start < k.end && k.start < candidate.end);
      if (!overlaps) kept.push(candidate);
    }
    result.push(...kept.sort((a, b) => a.start - b.start));
  }
  return result;
}

/**
 * Makes masking consistent across the whole transcript: every other occurrence
 * of an already-detected entity (and, for people, each distinctive name part)
 * becomes a "propagated" span. This is what keeps long transcripts processed in
 * chunks consistent: "Maria" in segment 40 maps to the same [PERSON_01] as
 * "Maria Delgado" in segment 2.
 */
export function propagateEntities(
  segments: TranscriptSegment[],
  candidates: SpanCandidate[],
  rejectedTexts: Set<string> = new Set(),
): SpanCandidate[] {
  const needles = new Map<string, SpanCandidate['category']>();
  for (const candidate of candidates) {
    const key = candidate.text.trim();
    if (key.length < 2 || rejectedTexts.has(key.toLowerCase())) continue;
    if (!needles.has(key)) needles.set(key, candidate.category);
    if (candidate.category === 'PERSON') {
      for (const part of key.split(/\s+/)) {
        const lower = part.toLowerCase();
        if (part.length >= 3 && /^[A-Z]/.test(part) && !NAME_STOPWORDS.has(lower) && !rejectedTexts.has(lower)) {
          if (!needles.has(part)) needles.set(part, 'PERSON');
        }
      }
    }
  }
  const out: SpanCandidate[] = [];
  for (const [needle, category] of needles) {
    for (const segment of segments) {
      for (const hit of findWholeWord(segment.text, needle)) {
        const text = segment.text.slice(hit.start, hit.end);
        // Name parts must stay capitalized to avoid masking ordinary words ("Will", "Rose").
        if (category === 'PERSON' && !/^[A-Z]/.test(text)) continue;
        out.push({ segmentId: segment.id, start: hit.start, end: hit.end, text, category, source: 'propagated' });
      }
    }
  }
  return out;
}

export const spanKey = (span: Pick<RedactionSpan, 'segmentId' | 'start' | 'end'>) =>
  `${span.segmentId}:${span.start}:${span.end}`;

/**
 * Re-anchors spans after transcript edits. A span whose text moved is relocated
 * to the nearest occurrence of the same text in the same segment; a span whose
 * text no longer exists is dropped (the identifier is no longer in the text).
 */
export function reconcileSpans(segments: TranscriptSegment[], spans: RedactionSpan[]): RedactionSpan[] {
  const textById = new Map(segments.map((s) => [s.id, s.text]));
  const out: RedactionSpan[] = [];
  for (const span of spans) {
    const text = textById.get(span.segmentId);
    if (text === undefined) continue;
    if (text.slice(span.start, span.end) === span.text) {
      out.push(span);
      continue;
    }
    let best = -1;
    let from = text.indexOf(span.text);
    while (from !== -1) {
      if (best === -1 || Math.abs(from - span.start) < Math.abs(best - span.start)) best = from;
      from = text.indexOf(span.text, from + 1);
    }
    if (best !== -1) out.push({ ...span, start: best, end: best + span.text.length });
  }
  // Relocation can create overlaps; resolve them deterministically.
  return mergeCandidates(out);
}
