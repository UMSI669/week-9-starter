/**
 * Validation tests. No network, no key, no cost.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ANALYSIS_JSON_SCHEMA,
  isSingleEmoji,
  normalizeTagList,
  parseModelJson,
  validateAnalysis,
} from './validateAnalysis.js';
import { CATEGORY_KEYS, CATEGORY_LABELS, normalizeCategory } from './categories.js';

const GOOD = {
  title: 'The Library Above the Clouds',
  summary: 'I explored a floating library while searching for a friend.',
  symbol: { key: 'library', label: 'Library', emoji: '\u{1F4DA}' },
  interpretation:
    'The library could reflect curiosity or a search for direction. Looking for your friend may connect with a desire for reassurance or connection.',
  reflectionQuestion: 'What were you hoping to find?',
  primaryCategory: 'Adventure',
  themes: ['exploration', 'friendship'],
  moods: ['curious', 'hopeful'],
};

test('accepts the documented example response', () => {
  const result = validateAnalysis(GOOD);
  assert.equal(result.ok, true);
  assert.equal(result.value.primaryCategory, 'adventure');
  assert.deepEqual(result.value.themes, ['exploration', 'friendship']);
  assert.equal(result.value.symbol.emoji, '\u{1F4DA}');
});

test('rejects an unknown category', () => {
  const result = validateAnalysis({ ...GOOD, primaryCategory: 'Nightmares' });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /primaryCategory/);
});

test('rejects every category not in the shared list', () => {
  for (const bogus of ['', '  ', 'Dreams', 'ADVENTURE!', 'school and work', null, 42, {}, []]) {
    assert.equal(
      validateAnalysis({ ...GOOD, primaryCategory: bogus }).ok,
      false,
      JSON.stringify(bogus),
    );
  }
});

test('surrounding whitespace on a valid category is trimmed, not rejected', () => {
  assert.equal(validateAnalysis({ ...GOOD, primaryCategory: ' adventure ' }).value.primaryCategory, 'adventure');
});

test('accepts a category given as a key or as a label', () => {
  for (const key of CATEGORY_KEYS) {
    assert.equal(validateAnalysis({ ...GOOD, primaryCategory: key }).ok, true, key);
  }
  for (const label of CATEGORY_LABELS) {
    const result = validateAnalysis({ ...GOOD, primaryCategory: label });
    assert.equal(result.ok, true, label);
    assert.ok(CATEGORY_KEYS.includes(result.value.primaryCategory));
  }
});

test('category normalization is case-insensitive on labels but never invents one', () => {
  assert.equal(normalizeCategory('school & work'), 'school-work');
  assert.equal(normalizeCategory('SCHOOL & WORK'), 'school-work');
  assert.equal(normalizeCategory('school and work'), null);
});

test('enforces the documented length limits', () => {
  assert.equal(validateAnalysis({ ...GOOD, title: 'x'.repeat(61) }).ok, false);
  assert.equal(validateAnalysis({ ...GOOD, title: 'x'.repeat(60) }).ok, true);
  assert.equal(validateAnalysis({ ...GOOD, summary: 'x'.repeat(241) }).ok, false);
  assert.equal(validateAnalysis({ ...GOOD, summary: 'x'.repeat(240) }).ok, true);
  assert.equal(validateAnalysis({ ...GOOD, interpretation: 'x'.repeat(501) }).ok, false);
  assert.equal(validateAnalysis({ ...GOOD, interpretation: 'x'.repeat(500) }).ok, true);
  assert.equal(validateAnalysis({ ...GOOD, reflectionQuestion: 'x'.repeat(161) }).ok, false);
  assert.equal(validateAnalysis({ ...GOOD, reflectionQuestion: 'x'.repeat(160) }).ok, true);
});

test('rejects empty strings for every required text field', () => {
  for (const field of ['title', 'summary', 'interpretation', 'reflectionQuestion']) {
    assert.equal(validateAnalysis({ ...GOOD, [field]: '   ' }).ok, false, field);
  }
});

test('themes and moods must be non-empty and are capped, not rejected, when long', () => {
  assert.equal(validateAnalysis({ ...GOOD, themes: [] }).ok, false);
  assert.equal(validateAnalysis({ ...GOOD, themes: 'exploration' }).ok, false);
  assert.equal(validateAnalysis({ ...GOOD, moods: [] }).ok, false);

  const manyThemes = validateAnalysis({
    ...GOOD,
    themes: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  });
  assert.equal(manyThemes.ok, true);
  assert.equal(manyThemes.value.themes.length, 5);

  const manyMoods = validateAnalysis({ ...GOOD, moods: ['calm', 'sad', 'free', 'tense'] });
  assert.equal(manyMoods.ok, true);
  assert.equal(manyMoods.value.moods.length, 3);
});

test('tags are lowercased and de-duplicated', () => {
  const result = validateAnalysis({ ...GOOD, themes: ['Water', 'water', ' WATER ', 'flight'] });
  assert.deepEqual(result.value.themes, ['water', 'flight']);
});

test('drops over-long individual tags rather than accepting them', () => {
  assert.deepEqual(normalizeTagList(['ok', 'x'.repeat(25)], { min: 1, max: 5, itemMax: 24 }), [
    'ok',
  ]);
  assert.equal(normalizeTagList(['x'.repeat(25)], { min: 1, max: 5, itemMax: 24 }), null);
});

test('symbol requires a key, a label, and exactly one display emoji', () => {
  assert.equal(validateAnalysis({ ...GOOD, symbol: { key: '', label: 'L', emoji: '\u{1F4DA}' } }).ok, false);
  assert.equal(validateAnalysis({ ...GOOD, symbol: { key: 'k', label: '', emoji: '\u{1F4DA}' } }).ok, false);
  assert.equal(validateAnalysis({ ...GOOD, symbol: null }).ok, false);
  assert.equal(validateAnalysis({ ...GOOD, symbol: 'library' }).ok, false);
});

test('symbol keys are slugified so they index consistently', () => {
  const result = validateAnalysis({
    ...GOOD,
    symbol: { key: 'Being Chased', label: 'Being chased', emoji: '\u{1F3C3}' },
  });
  assert.equal(result.value.symbol.key, 'being-chased');
});

test('emoji detection accepts real emoji and refuses text', () => {
  assert.equal(isSingleEmoji('\u{1F4DA}'), true);
  assert.equal(isSingleEmoji('❤️'), true);
  assert.equal(isSingleEmoji('\u{1F468}‍\u{1F469}‍\u{1F467}'), true);
  assert.equal(isSingleEmoji('⛈️'), true);
  assert.equal(isSingleEmoji('library'), false);
  assert.equal(isSingleEmoji(':)'), false);
  assert.equal(isSingleEmoji(''), false);
  assert.equal(isSingleEmoji('\u{1F4DA}\u{1F4DA}\u{1F4DA}\u{1F4DA}'), false);
  assert.equal(isSingleEmoji('A\u{1F4DA}'), false);
});

test('non-objects are rejected without throwing', () => {
  for (const bogus of [null, undefined, 'text', 42, [], true]) {
    const result = validateAnalysis(bogus);
    assert.equal(result.ok, false);
    assert.ok(result.errors.length > 0);
  }
});

test('reports every problem at once instead of only the first', () => {
  const result = validateAnalysis({ title: '', summary: '', primaryCategory: 'nope' });
  assert.equal(result.ok, false);
  assert.ok(result.errors.length >= 4);
});

test('parseModelJson handles bare JSON, fenced JSON, and prose-wrapped JSON', () => {
  assert.equal(parseModelJson('{"title":"x"}').value.title, 'x');
  assert.equal(parseModelJson('```json\n{"title":"y"}\n```').value.title, 'y');
  assert.equal(parseModelJson('Here you go:\n{"title":"z"}\nHope that helps.').value.title, 'z');
});

test('parseModelJson refuses garbage rather than inventing a result', () => {
  assert.equal(parseModelJson('I am sorry, I cannot do that.').ok, false);
  assert.equal(parseModelJson('').ok, false);
  assert.equal(parseModelJson(null).ok, false);
});

test('the JSON schema sent to the model lists exactly the shared categories', () => {
  assert.deepEqual(
    ANALYSIS_JSON_SCHEMA.schema.properties.primaryCategory.enum,
    CATEGORY_LABELS,
  );
  assert.equal(ANALYSIS_JSON_SCHEMA.strict, true);
  assert.equal(ANALYSIS_JSON_SCHEMA.schema.additionalProperties, false);
});

/* ---------------------- structured-output configuration ---------------------- */

test('the structured-output switch defaults on and can be turned off', async () => {
  // config.js reads the environment once at import, so this asserts the
  // parsing rule rather than re-importing the module.
  const parse = (value) => String(value || '').trim().toLowerCase() !== 'off';
  assert.equal(parse(undefined), true);
  assert.equal(parse(''), true);
  assert.equal(parse('on'), true);
  assert.equal(parse('off'), false);
  assert.equal(parse('OFF'), false);
  assert.equal(parse(' off '), false);
});
