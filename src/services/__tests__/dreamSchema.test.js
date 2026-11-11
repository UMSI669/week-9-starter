/**
 * Client-side guard on analysis output. The backend is the authority, but the
 * app validates anyway so a surprising response cannot reach the interface.
 */

import { FIELD_LIMITS, isSingleEmoji, normalizeTagList, validateAnalysis } from '../dreamSchema';
import { CATEGORY_KEYS, CATEGORY_LABELS, normalizeCategory } from '../../data/categories';

const GOOD = {
  title: 'The Library Above the Clouds',
  summary: 'I explored a floating library while searching for a friend.',
  symbol: { key: 'library', label: 'Library', emoji: '\u{1F4DA}' },
  interpretation: 'The library could reflect curiosity or a search for direction.',
  reflectionQuestion: 'What were you hoping to find?',
  primaryCategory: 'Adventure',
  themes: ['exploration', 'friendship'],
  moods: ['curious', 'hopeful'],
};

describe('valid output', () => {
  it('accepts the documented example and normalizes the category to a key', () => {
    const result = validateAnalysis(GOOD);
    expect(result.ok).toBe(true);
    expect(result.value.primaryCategory).toBe('adventure');
    expect(CATEGORY_KEYS).toContain(result.value.primaryCategory);
  });

  it('accepts every defined category, by key or by label', () => {
    CATEGORY_KEYS.forEach((key) => {
      expect(validateAnalysis({ ...GOOD, primaryCategory: key }).ok).toBe(true);
    });
    CATEGORY_LABELS.forEach((label) => {
      expect(validateAnalysis({ ...GOOD, primaryCategory: label }).ok).toBe(true);
    });
  });
});

describe('rejected output', () => {
  it('rejects an unknown category', () => {
    const result = validateAnalysis({ ...GOOD, primaryCategory: 'Nightmares' });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/primaryCategory/);
  });

  it('never invents a category for an unrecognised value', () => {
    ['', 'dreams', 'school and work', null, 7, {}, []].forEach((value) => {
      expect(normalizeCategory(value)).toBeNull();
    });
  });

  it('enforces each documented length limit at the boundary', () => {
    const cases = [
      ['title', FIELD_LIMITS.title.max],
      ['summary', FIELD_LIMITS.summary.max],
      ['interpretation', FIELD_LIMITS.interpretation.max],
      ['reflectionQuestion', FIELD_LIMITS.reflectionQuestion.max],
    ];
    cases.forEach(([field, max]) => {
      expect(validateAnalysis({ ...GOOD, [field]: 'x'.repeat(max) }).ok).toBe(true);
      expect(validateAnalysis({ ...GOOD, [field]: 'x'.repeat(max + 1) }).ok).toBe(false);
    });
  });

  it('rejects a non-object without throwing', () => {
    [null, undefined, 'text', 42, [], true].forEach((value) => {
      const result = validateAnalysis(value);
      expect(result.ok).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  it('requires a symbol with a key, a label, and one emoji', () => {
    expect(validateAnalysis({ ...GOOD, symbol: {} }).ok).toBe(false);
    expect(validateAnalysis({ ...GOOD, symbol: { key: 'k', label: 'L', emoji: 'nope' } }).ok).toBe(
      false,
    );
  });

  it('collects every error rather than stopping at the first', () => {
    const result = validateAnalysis({ title: '', summary: '', primaryCategory: 'bogus' });
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
  });
});

describe('tags', () => {
  it('lowercases, de-duplicates, and caps', () => {
    const result = validateAnalysis({
      ...GOOD,
      themes: ['Water', 'water', ' WATER ', 'flight', 'home', 'school', 'work'],
    });
    expect(result.value.themes).toEqual(['water', 'flight', 'home', 'school', 'work']);
  });

  it('requires at least one of each', () => {
    expect(validateAnalysis({ ...GOOD, themes: [] }).ok).toBe(false);
    expect(validateAnalysis({ ...GOOD, moods: [] }).ok).toBe(false);
  });

  it('drops individual tags that are too long', () => {
    expect(normalizeTagList(['ok', 'x'.repeat(40)], FIELD_LIMITS.themes)).toEqual(['ok']);
  });
});

describe('emoji detection', () => {
  it('accepts single emoji, including modified and joined ones', () => {
    ['\u{1F4DA}', '❤️', '\u{1F98A}', '⛈️', '\u{1F468}‍\u{1F469}‍\u{1F467}'].forEach(
      (emoji) => expect(isSingleEmoji(emoji)).toBe(true),
    );
  });

  it('refuses text, punctuation, and emoji runs', () => {
    ['library', 'A', ':)', '', '   ', '\u{1F4DA}\u{1F4DA}\u{1F4DA}\u{1F4DA}', 'x\u{1F4DA}'].forEach((value) =>
      expect(isSingleEmoji(value)).toBe(false),
    );
  });
});
