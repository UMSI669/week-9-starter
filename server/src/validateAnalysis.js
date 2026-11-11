/**
 * Server-side validation of model output.
 *
 * A strict JSON schema is also sent to the model when the selected model
 * supports structured outputs, but this runs regardless. Structured-output
 * support varies by model and provider, "strict" is not a guarantee, and a
 * provider can always return something unexpected. Malformed output is
 * rejected; it is never patched up and presented as a successful result.
 */

import { CATEGORY_KEYS, CATEGORY_LABELS, normalizeCategory } from './categories.js';

export const FIELD_LIMITS = {
  title: { min: 1, max: 60 },
  summary: { min: 1, max: 240 },
  interpretation: { min: 1, max: 500 },
  reflectionQuestion: { min: 1, max: 160 },
  themes: { min: 1, max: 5, itemMax: 24 },
  moods: { min: 1, max: 3, itemMax: 24 },
  symbolKey: { min: 1, max: 40 },
  symbolLabel: { min: 1, max: 40 },
};

/** The schema handed to the model when it supports structured outputs. */
export const ANALYSIS_JSON_SCHEMA = {
  name: 'dream_reflection',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'title',
      'summary',
      'symbol',
      'interpretation',
      'reflectionQuestion',
      'primaryCategory',
      'themes',
      'moods',
    ],
    properties: {
      title: { type: 'string', minLength: 1, maxLength: 60 },
      summary: { type: 'string', minLength: 1, maxLength: 240 },
      symbol: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'label', 'emoji'],
        properties: {
          key: { type: 'string', minLength: 1, maxLength: 40 },
          label: { type: 'string', minLength: 1, maxLength: 40 },
          emoji: { type: 'string', minLength: 1, maxLength: 16 },
        },
      },
      interpretation: { type: 'string', minLength: 1, maxLength: 500 },
      reflectionQuestion: { type: 'string', minLength: 1, maxLength: 160 },
      primaryCategory: { type: 'string', enum: CATEGORY_LABELS },
      themes: {
        type: 'array',
        minItems: 1,
        maxItems: 5,
        items: { type: 'string', minLength: 1, maxLength: 24 },
      },
      moods: {
        type: 'array',
        minItems: 1,
        maxItems: 3,
        items: { type: 'string', minLength: 1, maxLength: 24 },
      },
    },
  },
};

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function within(value, limits) {
  return value.length >= limits.min && value.length <= limits.max;
}

function graphemeCount(value) {
  try {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    return [...segmenter.segment(value)].length;
  } catch (_error) {
    return [...value].filter((char) => char !== '‍' && char !== '️').length;
  }
}

/** One display emoji: pictographic, no letters or digits. */
export function isSingleEmoji(value) {
  const trimmed = text(value);
  if (!trimmed || trimmed.length > 16) return false;
  if (/[A-Za-z0-9]/.test(trimmed)) return false;
  if (!/\p{Extended_Pictographic}/u.test(trimmed)) return false;
  return graphemeCount(trimmed) <= 3;
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

/**
 * @param {unknown} candidate Parsed model output.
 * @returns {{ok: true, value: object} | {ok: false, errors: string[]}}
 */
export function validateAnalysis(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return { ok: false, errors: ['The model did not return a JSON object.'] };
  }

  const errors = [];

  const title = text(candidate.title);
  if (!within(title, FIELD_LIMITS.title)) errors.push('title must be 1-60 characters.');

  const summary = text(candidate.summary);
  if (!within(summary, FIELD_LIMITS.summary)) errors.push('summary must be 1-240 characters.');

  const interpretation = text(candidate.interpretation);
  if (!within(interpretation, FIELD_LIMITS.interpretation)) {
    errors.push('interpretation must be 1-500 characters.');
  }

  const reflectionQuestion = text(candidate.reflectionQuestion);
  if (!within(reflectionQuestion, FIELD_LIMITS.reflectionQuestion)) {
    errors.push('reflectionQuestion must be 1-160 characters.');
  }

  const primaryCategory = normalizeCategory(candidate.primaryCategory);
  if (!primaryCategory) {
    errors.push(`primaryCategory must be one of: ${CATEGORY_KEYS.join(', ')}.`);
  }

  const themes = normalizeTagList(candidate.themes, FIELD_LIMITS.themes);
  if (!themes) errors.push('themes must be 1-5 short strings.');

  const moods = normalizeTagList(candidate.moods, FIELD_LIMITS.moods);
  if (!moods) errors.push('moods must be 1-3 short strings.');

  const symbol =
    candidate.symbol && typeof candidate.symbol === 'object' && !Array.isArray(candidate.symbol)
      ? candidate.symbol
      : {};
  const symbolKey = text(symbol.key);
  const symbolLabel = text(symbol.label);
  const emoji = text(symbol.emoji);
  if (!within(symbolKey, FIELD_LIMITS.symbolKey)) {
    errors.push('symbol.key must be 1-40 characters.');
  }
  if (!within(symbolLabel, FIELD_LIMITS.symbolLabel)) {
    errors.push('symbol.label must be 1-40 characters.');
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
      symbol: {
        key: symbolKey.toLowerCase().replace(/\s+/g, '-'),
        label: symbolLabel,
        emoji,
      },
    },
  };
}

/**
 * Pulls JSON out of a chat completion's text content. Handles a bare object
 * and a fenced ```json block, which some models emit despite instructions.
 * Anything else is a rejection, not a repair.
 */
export function parseModelJson(content) {
  const raw = text(content);
  if (!raw) return { ok: false, errors: ['The model returned an empty response.'] };

  const candidates = [raw];
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidates.push(fenced[1]);
  const braced = raw.match(/\{[\s\S]*\}/);
  if (braced) candidates.push(braced[0]);

  for (const candidate of candidates) {
    try {
      return { ok: true, value: JSON.parse(candidate) };
    } catch (_error) {
      // Try the next shape.
    }
  }

  return { ok: false, errors: ['The model response was not valid JSON.'] };
}

export default validateAnalysis;
