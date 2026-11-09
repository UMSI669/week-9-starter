/**
 * Export text format. A locale and time zone are passed explicitly so the
 * assertions do not depend on whatever machine runs the tests.
 */

import { EXPORT_DISCLAIMER, buildDreamExportText } from '../dreamExportText';

const OPTIONS = { locale: 'en-US', timeZone: 'UTC' };

const DREAM = {
  id: 'dream_1',
  createdAt: '2026-03-14T06:58:00.000Z',
  title: 'The Library Above the Clouds',
  emoji: '\u{1F4DA}',
  symbolLabel: 'Library',
  primaryCategory: 'adventure',
  interpretation:
    'The library could reflect curiosity or a search for direction. Looking for your friend may connect with a desire for reassurance.',
  reflectionQuestion: 'What were you hoping to find?',
  themes: ['exploration', 'friendship'],
  moods: ['curious', 'hopeful'],
  transcript: 'A long private transcript that must never be exported.',
};

describe('format', () => {
  const text = buildDreamExportText(DREAM, OPTIONS);
  const lines = text.split('\n');

  it('starts with the title followed by the emoji', () => {
    expect(lines[0]).toBe('The Library Above the Clouds \u{1F4DA}');
  });

  it('puts the localized date on the second line', () => {
    expect(lines[1]).toBe('March 14, 2026');
  });

  it('labels the symbol and the category', () => {
    expect(text).toContain('Symbol: Library');
    expect(text).toContain('Category: Adventure');
  });

  it('includes the interpretation and the reflection question', () => {
    expect(text).toContain(DREAM.interpretation);
    expect(text).toContain('Reflection: What were you hoping to find?');
  });

  it('lists themes and moods comma separated', () => {
    expect(text).toContain('Themes: exploration, friendship');
    expect(text).toContain('Moods: curious, hopeful');
  });

  it('ends with the disclaimer', () => {
    expect(lines[lines.length - 1]).toBe(EXPORT_DISCLAIMER);
    expect(EXPORT_DISCLAIMER).toBe('Dream Decoder — a reflection, not a prediction.');
  });

  it('never includes the raw transcript', () => {
    expect(text).not.toContain(DREAM.transcript);
    expect(text).not.toContain('private transcript');
  });

  it('produces the whole documented shape', () => {
    expect(text).toBe(
      [
        'The Library Above the Clouds \u{1F4DA}',
        'March 14, 2026',
        'Symbol: Library',
        'Category: Adventure',
        '',
        DREAM.interpretation,
        'Reflection: What were you hoping to find?',
        '',
        'Themes: exploration, friendship',
        'Moods: curious, hopeful',
        '',
        EXPORT_DISCLAIMER,
      ].join('\n'),
    );
  });
});

describe('localization', () => {
  it('formats the date with the given locale', () => {
    const german = buildDreamExportText(DREAM, { locale: 'de-DE', timeZone: 'UTC' });
    expect(german.split('\n')[1]).toBe('14. März 2026');
  });

  it('uses the given time zone, which can change the calendar day', () => {
    const dream = { ...DREAM, createdAt: '2026-03-14T02:30:00.000Z' };
    const utc = buildDreamExportText(dream, { locale: 'en-US', timeZone: 'UTC' });
    const losAngeles = buildDreamExportText(dream, {
      locale: 'en-US',
      timeZone: 'America/Los_Angeles',
    });
    expect(utc.split('\n')[1]).toBe('March 14, 2026');
    expect(losAngeles.split('\n')[1]).toBe('March 13, 2026');
  });
});

describe('partial dreams', () => {
  it('handles a transcript-only dream with no reflection', () => {
    const text = buildDreamExportText(
      {
        createdAt: '2026-03-14T06:58:00.000Z',
        title: 'Untitled',
        primaryCategory: 'other',
        themes: [],
        moods: [],
      },
      OPTIONS,
    );
    expect(text).toContain('Untitled');
    expect(text).toContain('Category: Other');
    expect(text).not.toContain('Themes:');
    expect(text).not.toContain('Symbol:');
    expect(text.split('\n').pop()).toBe(EXPORT_DISCLAIMER);
  });

  it('falls back to a placeholder title', () => {
    const text = buildDreamExportText({ createdAt: '2026-03-14T06:58:00.000Z' }, OPTIONS);
    expect(text.split('\n')[0]).toBe('Untitled dream');
  });

  it('marks demo data in the exported text', () => {
    const text = buildDreamExportText({ ...DREAM, isDemo: true }, OPTIONS);
    expect(text).toContain('Demo data');
  });

  it('returns an empty string for nothing', () => {
    expect(buildDreamExportText(null)).toBe('');
    expect(buildDreamExportText(undefined)).toBe('');
  });

  it('survives a malformed date without throwing', () => {
    expect(() =>
      buildDreamExportText({ ...DREAM, createdAt: 'not a date' }, OPTIONS),
    ).not.toThrow();
  });

  it('ignores non-array tag fields', () => {
    const text = buildDreamExportText({ ...DREAM, themes: 'exploration', moods: null }, OPTIONS);
    expect(text).not.toContain('Themes:');
    expect(text).not.toContain('Moods:');
  });
});
