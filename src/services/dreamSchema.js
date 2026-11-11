/**
 * Client-side shape guard for analysis results.
 *
 * The backend is the authority — it validates every field before responding
 * (server/src/validateAnalysis.js). This runs anyway, because a client should
 * never render whatever a network response happens to contain.
 *
 * The limits here are the same ones the server enforces.
 */

import { normalizeCategory } from '../data/categories';

export const FIELD_LIMITS = {
  title: { min: 1, max: 60 },
  summary: { min: 1, max: 240 },
  interpretation: { min: 1, max: 500 },
  reflectionQuestion: { min: 1, max: 160 },
  themes: { min: 1, max: 5, itemMax: 24 },
  moods: { min: 1, max: 3, itemMax: 24 },
  symbolKey: { min: 1, max: 40 },
  symbolLabel: { min: 1, max: 40 },
  transcript: { min: 1, max: 6000 },
};

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function lengthWithin(value, limits) {
  return value.length >= limits.min && value.length <= limits.max;
}

/**
 * Counts user-perceived characters (grapheme clusters), so an emoji built from
 * surrogate pairs, a variation selector, or a ZWJ sequence counts as one.
 */
export function glyphCount(value) {
  if (typeof value !== 'string') return 0;
  const trimmed = value.trim();
  if (!trimmed) return 0;

  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    try {
      const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
      return [...segmenter.segment(trimmed)].length;
    } catch (_error) {
      // Fall through to the code-point approximation below.
    }
  }

  // Approximation for engines without Intl.Segmenter: count code points,
  // ignoring joiners and variation selectors that only modify the glyph before.
  return [...trimmed].filter((char) => char !== '\u200D' && char !== '\uFE0F').length;
}

/** One display emoji: at least one pictographic code point, no letters. */
export function isSingleEmoji(value) {
  const trimmed = text(value);
  if (!trimmed || trimmed.length > 16) return false;
  if (/[A-Za-z0-9]/.test(trimmed)) return false;
  if (!/\p{Extended_Pictographic}/u.test(trimmed)) return false;
  return glyphCount(trimmed) <= 3;
}

/**
 * @param {unknown} candidate
 * @returns {{ok: true, value: object} | {ok: false, errors: string[]}}
 */
export function validateAnalysis(candidate) {
  const errors = [];
  if (!candidate || typeof candidate !== 'object') {
    return { ok: false, errors: ['The analysis response was not an object.'] };
  }

  const title = text(candidate.title);
  if (!lengthWithin(title, FIELD_LIMITS.title)) errors.push('title must be 1-60 characters.');

  const summary = text(candidate.summary);
  if (!lengthWithin(summary, FIELD_LIMITS.summary)) {
    errors.push('summary must be 1-240 characters.');
  }

  const interpretation = text(candidate.interpretation);
  if (!lengthWithin(interpretation, FIELD_LIMITS.interpretation)) {
    errors.push('interpretation must be 1-500 characters.');
  }

  const reflectionQuestion = text(candidate.reflectionQuestion);
  if (!lengthWithin(reflectionQuestion, FIELD_LIMITS.reflectionQuestion)) {
    errors.push('reflectionQuestion must be 1-160 characters.');
  }

  const primaryCategory = normalizeCategory(candidate.primaryCategory);
  if (!primaryCategory) {
    errors.push('primaryCategory must be one of the defined categories.');
  }

  const themes = normalizeTagList(candidate.themes, FIELD_LIMITS.themes);
  if (!themes) errors.push('themes must be 1-5 short strings.');

  const moods = normalizeTagList(candidate.moods, FIELD_LIMITS.moods);
  if (!moods) errors.push('moods must be 1-3 short strings.');

  const symbol = candidate.symbol && typeof candidate.symbol === 'object' ? candidate.symbol : {};
  const symbolKey = text(symbol.key);
  const symbolLabel = text(symbol.label);
  const emoji = text(symbol.emoji);
  if (!lengthWithin(symbolKey, FIELD_LIMITS.symbolKey)) errors.push('symbol.key is required.');
  if (!lengthWithin(symbolLabel, FIELD_LIMITS.symbolLabel)) {
    errors.push('symbol.label is required.');
  }
  if (!isSingleEmoji(emoji)) errors.push('symbol.emoji must be one display emoji.');

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      title,
      summary,
      interpretation,
      reflectionQuestion,
      primaryCategory,
      themes,
      moods,
      symbol: { key: symbolKey.toLowerCase(), label: symbolLabel, emoji },
    },
  };
}

export function normalizeTagList(value, limits) {
  if (!Array.isArray(value)) return null;
  const cleaned = [];
  const seen = new Set();
  for (const item of value) {
    const tag = text(item).toLowerCase();
    if (!tag || tag.length > limits.itemMax) continue;
    if (seen.has(tag)) continue;
    seen.add(tag);
    cleaned.push(tag);
    if (cleaned.length === limits.max) break;
  }
  return cleaned.length >= limits.min ? cleaned : null;
}

export default validateAnalysis;
