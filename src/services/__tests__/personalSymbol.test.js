/**
 * Symbols the bundled catalog does not contain.
 *
 * The AI picks a symbol freely, so most saved dreams produce an image that is
 * not one of the ten catalog entries. The old behaviour announced "This symbol
 * is not in the bundled catalog", which describes our data rather than the
 * reader's dream. These tests pin the replacement: a reflection that names
 * their image, stays tentative, and never mentions the catalog.
 */

import {
  GENERAL_SYMBOL_ENTRY,
  personalSymbolEntry,
  resolveSymbolEntry,
} from '../../data/symbolCatalog';

describe('resolveSymbolEntry for a catalog symbol', () => {
  it('returns the catalog entry and marks it as one', () => {
    const entry = resolveSymbolEntry('water', 'Water', '💧');
    expect(entry.key).toBe('water');
    expect(entry.inCatalog).toBe(true);
    expect(entry.associations.length).toBeGreaterThan(0);
  });

  it('matches by label as well as by key', () => {
    expect(resolveSymbolEntry(null, 'Flying').inCatalog).toBe(true);
  });
});

describe('resolveSymbolEntry for a symbol of the dreamer’s own', () => {
  const entry = resolveSymbolEntry('floating-library', 'Floating Library', '📚');

  it('is not marked as a catalog entry, so the catalog button can be hidden', () => {
    expect(entry.inCatalog).toBe(false);
  });

  it('keeps the dream’s own label and emoji', () => {
    expect(entry.label).toBe('Floating Library');
    expect(entry.emoji).toBe('📚');
  });

  it('names the symbol instead of talking about the catalog', () => {
    const text = entry.associations.join(' ');
    expect(text).toContain('Floating Library');
    expect(text).not.toMatch(/catalog/i);
    expect(text).not.toMatch(/not in the/i);
  });

  it('offers a reflection, not a verdict', () => {
    const text = entry.associations.join(' ');
    expect(text).toMatch(/could reflect|might|whatever/i);
    // No claim of a fixed or universal meaning.
    expect(text).not.toMatch(/means that you|symbolises|represents the/i);
  });

  it('asks a question that names the symbol', () => {
    expect(entry.reflectionQuestion).toContain('Floating Library');
    expect(entry.reflectionQuestion.endsWith('?')).toBe(true);
  });

  it('is deterministic — the same label always gives the same text', () => {
    expect(resolveSymbolEntry('x', 'Floating Library', '📚')).toEqual(entry);
  });
});

describe('edge cases', () => {
  it('falls back to the general entry when there is no label at all', () => {
    expect(personalSymbolEntry('', '✨')).toBe(GENERAL_SYMBOL_ENTRY);
    expect(personalSymbolEntry(null)).toBe(GENERAL_SYMBOL_ENTRY);
    expect(personalSymbolEntry('   ')).toBe(GENERAL_SYMBOL_ENTRY);
  });

  it('still renders a usable entry with no emoji', () => {
    const entry = personalSymbolEntry('A Brass Key');
    expect(entry.emoji).toBeTruthy();
    expect(entry.label).toBe('A Brass Key');
  });

  it('trims a padded label rather than embedding the padding', () => {
    expect(personalSymbolEntry('  A Brass Key  ').label).toBe('A Brass Key');
  });

  it('the general entry itself no longer mentions the catalog', () => {
    const text = GENERAL_SYMBOL_ENTRY.associations.join(' ');
    expect(text).not.toMatch(/catalog/i);
  });
});
