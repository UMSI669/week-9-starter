/** Pure helpers that turn recognizer output into timestamped transcript segments. */

export interface DraftSegment {
  startMs: number;
  endMs: number;
  text: string;
}

export interface TimedToken {
  text: string;
  startMs: number;
  endMs: number;
}

/**
 * Groups word/phrase-level timestamps into readable segments. A new segment
 * starts after sentence-ending punctuation once a segment is long enough, after
 * a long pause, or when a segment grows too long.
 */
export function groupTokens(
  tokens: TimedToken[],
  options: { pauseMs?: number; minChars?: number; maxChars?: number } = {},
): DraftSegment[] {
  const pauseMs = options.pauseMs ?? 1200;
  const minChars = options.minChars ?? 60;
  const maxChars = options.maxChars ?? 360;
  const segments: DraftSegment[] = [];
  let current: DraftSegment | null = null;
  let previousEnd = 0;

  for (const token of tokens) {
    const word = token.text.trim();
    if (!word) continue;
    const gap = token.startMs - previousEnd;
    if (current && (gap >= pauseMs || current.text.length >= maxChars)) {
      segments.push(current);
      current = null;
    }
    if (!current) {
      current = { startMs: token.startMs, endMs: token.endMs, text: word };
    } else {
      const joiner = /^[,.;:!?%')\]]/.test(word) ? '' : ' ';
      current.text += joiner + word;
      current.endMs = token.endMs;
    }
    previousEnd = token.endMs;
    if (/[.!?]["')\]]?$/.test(word) && current.text.length >= minChars) {
      segments.push(current);
      current = null;
    }
  }
  if (current) segments.push(current);
  return segments;
}

/**
 * Fallback when a recognizer returns text without timestamps: split into
 * sentences and spread the duration proportionally to length. Timestamps are
 * approximate and the UI says so.
 */
export function splitTextEvenly(text: string, durationMs: number): DraftSegment[] {
  const sentences = text
    .replace(/\s+/g, ' ')
    .trim()
    .match(/[^.!?]+[.!?]*["')\]]?\s*/g)
    ?.map((s) => s.trim())
    .filter(Boolean) ?? [];
  if (sentences.length === 0) return [];
  const merged: string[] = [];
  for (const sentence of sentences) {
    if (merged.length && merged[merged.length - 1].length < 60) merged[merged.length - 1] += ` ${sentence}`;
    else merged.push(sentence);
  }
  const total = merged.reduce((sum, s) => sum + s.length, 0) || 1;
  let cursor = 0;
  return merged.map((sentence) => {
    const length = Math.round((sentence.length / total) * Math.max(durationMs, 0));
    const segment = { startMs: cursor, endMs: cursor + length, text: sentence };
    cursor += length;
    return segment;
  });
}
