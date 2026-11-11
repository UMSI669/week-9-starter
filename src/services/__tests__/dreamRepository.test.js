/**
 * Persistence, migrations, and query behaviour, against real SQLite.
 */

import { jest } from '@jest/globals';

jest.mock('expo-sqlite', () => require('./sqliteFake'));

const sqliteFake = require('./sqliteFake');
const { DREAM_SCHEMA_VERSION, getDatabase, resetDatabaseHandleForTests, runMigrations } = require('../db');
const repository = require('../dreamRepository');
const { buildDemoDreams, DEMO_DREAM_COUNT } = require('../seedDreams');

beforeEach(() => {
  sqliteFake.__resetAllDatabases();
  resetDatabaseHandleForTests();
});

const DRAFT = {
  transcript: 'I was walking through a purple forest and found a glowing door.',
  originalTranscript: 'i was walking through a purple forest and found a glowing door',
  title: 'The Glowing Door',
  summary: 'I walked through a purple forest and found a door.',
  symbolKey: 'doors',
  symbolLabel: 'Door',
  emoji: '\u{1F6AA}',
  interpretation: 'A door could reflect a threshold.',
  reflectionQuestion: 'Did you want to go through?',
  primaryCategory: 'mystery',
  themes: ['thresholds', 'nature'],
  moods: ['curious'],
  analysisStatus: 'generated',
  analysisModel: 'test/model',
};

describe('migrations', () => {
  it('creates the schema and records the version', async () => {
    const db = await getDatabase();
    const row = await db.getFirstAsync('PRAGMA user_version;');
    expect(Number(row.user_version)).toBe(DREAM_SCHEMA_VERSION);
  });

  it('is idempotent: running again changes nothing and loses nothing', async () => {
    const db = await getDatabase();
    await repository.saveDream(DRAFT);

    const version = await runMigrations(db);
    expect(version).toBe(DREAM_SCHEMA_VERSION);
    expect(await repository.countDreams()).toBe(1);
  });

  it('creates both tables the app needs', async () => {
    const db = await getDatabase();
    const tables = await db.getAllAsync(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    );
    const names = tables.map((table) => table.name);
    expect(names).toContain('dreams');
    expect(names).toContain('app_settings');
  });

  it('never re-runs a migration that is already applied', async () => {
    const db = await getDatabase();
    // Claim a far-future version; no migration should fire.
    await db.execAsync('PRAGMA user_version = 99;');
    expect(await runMigrations(db)).toBe(99);
  });
});

describe('saving and reloading', () => {
  it('round-trips every field', async () => {
    const saved = await repository.saveDream(DRAFT);
    const reloaded = await repository.getDream(saved.id);

    expect(reloaded.title).toBe(DRAFT.title);
    expect(reloaded.transcript).toBe(DRAFT.transcript);
    expect(reloaded.originalTranscript).toBe(DRAFT.originalTranscript);
    expect(reloaded.themes).toEqual(['thresholds', 'nature']);
    expect(reloaded.moods).toEqual(['curious']);
    expect(reloaded.emoji).toBe('\u{1F6AA}');
    expect(reloaded.primaryCategory).toBe('mystery');
    expect(reloaded.analysisStatus).toBe('generated');
    expect(reloaded.analysisModel).toBe('test/model');
    expect(reloaded.schemaVersion).toBe(DREAM_SCHEMA_VERSION);
  });

  it('generates an id, UTC dates, a time zone, and a visual seed in app code', async () => {
    const saved = await repository.saveDream(DRAFT);
    expect(saved.id).toMatch(/^dream_/);
    expect(saved.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    expect(saved.updatedAt).toBe(saved.createdAt);
    expect(saved.visualSeed).toBeTruthy();
    expect(typeof saved.capturedTimeZone === 'string' || saved.capturedTimeZone === null).toBe(
      true,
    );
  });

  it('survives a simulated app restart', async () => {
    const saved = await repository.saveDream(DRAFT);
    // Drop the cached connection the way a cold start would.
    resetDatabaseHandleForTests();
    const reloaded = await repository.getDream(saved.id);
    expect(reloaded.title).toBe(DRAFT.title);
    expect(await repository.countDreams()).toBe(1);
  });

  it('returns null for an id that is not there', async () => {
    expect(await repository.getDream('nope')).toBeNull();
  });

  it('falls back to Other for a category that is not in the shared list', async () => {
    const saved = await repository.saveDream({ ...DRAFT, primaryCategory: 'nightmares' });
    expect(saved.primaryCategory).toBe('other');
    expect((await repository.getDream(saved.id)).primaryCategory).toBe('other');
  });
});

describe('editing', () => {
  it('updates the fields that changed', async () => {
    const saved = await repository.saveDream(DRAFT);
    const edited = await repository.updateDream(saved.id, {
      title: 'A Different Door',
      primaryCategory: 'adventure',
      themes: ['journey'],
    });

    expect(edited.title).toBe('A Different Door');
    expect(edited.primaryCategory).toBe('adventure');
    expect(edited.themes).toEqual(['journey']);
    expect((await repository.getDream(saved.id)).title).toBe('A Different Door');
  });

  it('keeps createdAt, visualSeed, and the original transcription through an edit', async () => {
    const saved = await repository.saveDream(DRAFT);
    const edited = await repository.updateDream(saved.id, {
      createdAt: '1999-01-01T00:00:00.000Z',
      visualSeed: 'hijacked',
      originalTranscript: 'rewritten',
      transcript: 'An edited transcript.',
    });

    expect(edited.createdAt).toBe(saved.createdAt);
    expect(edited.visualSeed).toBe(saved.visualSeed);
    expect(edited.originalTranscript).toBe(DRAFT.originalTranscript);
    expect(edited.transcript).toBe('An edited transcript.');
  });

  it('moves updatedAt forward', async () => {
    const saved = await repository.saveDream(DRAFT);
    const edited = await repository.updateDream(saved.id, { title: 'Changed' });
    expect(new Date(edited.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(saved.createdAt).getTime(),
    );
  });

  it('rejects an edit to a dream that does not exist', async () => {
    await expect(repository.updateDream('nope', { title: 'x' })).rejects.toThrow(
      /could not save your changes/i,
    );
  });
});

describe('listing, filtering, and search', () => {
  beforeEach(async () => {
    await repository.saveManyDreams([
      { ...DRAFT, id: 'a', createdAt: '2026-01-01T06:00:00.000Z', title: 'Oldest', primaryCategory: 'mystery' },
      { ...DRAFT, id: 'b', createdAt: '2026-02-01T06:00:00.000Z', title: 'Middle', primaryCategory: 'adventure', themes: ['flight'] },
      { ...DRAFT, id: 'c', createdAt: '2026-03-01T06:00:00.000Z', title: 'Newest', primaryCategory: 'adventure', moods: ['afraid'] },
    ]);
  });

  it('returns newest first by default', async () => {
    const dreams = await repository.listDreams();
    expect(dreams.map((dream) => dream.title)).toEqual(['Newest', 'Middle', 'Oldest']);
  });

  it('filters by primary category', async () => {
    const dreams = await repository.listDreams({ category: 'adventure' });
    expect(dreams.map((dream) => dream.id)).toEqual(['c', 'b']);
  });

  it('ignores a category filter that is not a real category', async () => {
    expect(await repository.listDreams({ category: 'nope' })).toHaveLength(3);
  });

  it('searches titles case-insensitively', async () => {
    expect((await repository.listDreams({ search: 'NEWEST' })).map((d) => d.id)).toEqual(['c']);
  });

  it('searches the transcript', async () => {
    expect(await repository.listDreams({ search: 'purple forest' })).toHaveLength(3);
  });

  it('searches themes and moods', async () => {
    expect((await repository.listDreams({ search: 'flight' })).map((d) => d.id)).toEqual(['b']);
    expect((await repository.listDreams({ search: 'afraid' })).map((d) => d.id)).toEqual(['c']);
  });

  it('returns nothing for a term that matches nothing', async () => {
    expect(await repository.listDreams({ search: 'xyzzy' })).toHaveLength(0);
  });

  it('counts by category, including the empty ones', async () => {
    const counts = await repository.countDreamsByCategory();
    expect(counts.adventure).toBe(2);
    expect(counts.mystery).toBe(1);
    expect(counts.other).toBe(0);
    expect(counts['school-work']).toBe(0);
  });
});

describe('deleting and undo', () => {
  it('deletes a dream and returns it so Undo can restore it', async () => {
    const saved = await repository.saveDream(DRAFT);
    const removed = await repository.deleteDream(saved.id);

    expect(removed.id).toBe(saved.id);
    expect(await repository.getDream(saved.id)).toBeNull();
    expect(await repository.countDreams()).toBe(0);

    const restored = await repository.saveDream(removed);
    expect(restored.id).toBe(saved.id);
    expect(restored.createdAt).toBe(saved.createdAt);
    expect(restored.visualSeed).toBe(saved.visualSeed);
    expect(await repository.countDreams()).toBe(1);
  });

  it('updates the category counts immediately after a delete', async () => {
    const saved = await repository.saveDream(DRAFT);
    expect((await repository.countDreamsByCategory()).mystery).toBe(1);
    await repository.deleteDream(saved.id);
    expect((await repository.countDreamsByCategory()).mystery).toBe(0);
  });

  it('deleting something that is not there does not throw', async () => {
    await expect(repository.deleteDream('nope')).resolves.toBeNull();
  });
});

describe('demo data', () => {
  it('stores every fixture, marked as demo', async () => {
    await repository.saveManyDreams(buildDemoDreams());
    expect(await repository.countDreams()).toBe(DEMO_DREAM_COUNT);
    expect(await repository.countDemoDreams()).toBe(DEMO_DREAM_COUNT);

    const dreams = await repository.listDreams();
    dreams.forEach((dream) => {
      expect(dream.isDemo).toBe(true);
      expect(dream.analysisModel).toMatch(/not AI output/i);
    });
  });

  it('removes only the demos, leaving real dreams alone', async () => {
    await repository.saveManyDreams(buildDemoDreams());
    const real = await repository.saveDream(DRAFT);

    const removed = await repository.deleteDemoDreams();
    expect(removed).toBe(DEMO_DREAM_COUNT);
    expect(await repository.countDreams()).toBe(1);
    expect((await repository.getDream(real.id)).title).toBe(DRAFT.title);
  });

  it('an edit cannot turn a real dream into a demo or back', async () => {
    const saved = await repository.saveDream(DRAFT);
    const edited = await repository.updateDream(saved.id, { isDemo: true });
    expect(edited.isDemo).toBe(false);
  });

  it('populates several categories so the cloud map has a hierarchy', async () => {
    await repository.saveManyDreams(buildDemoDreams());
    const counts = await repository.countDreamsByCategory();
    const populated = Object.values(counts).filter((count) => count > 0);
    expect(populated.length).toBeGreaterThanOrEqual(5);
    expect(Math.max(...Object.values(counts))).toBeGreaterThan(Math.min(...populated));
  });
});

describe('settings', () => {
  it('reads back what it wrote', async () => {
    await repository.writeSetting('transcriptionMode', 'cloud');
    expect(await repository.readSetting('transcriptionMode')).toBe('cloud');
  });

  it('returns the fallback for a key that was never set', async () => {
    expect(await repository.readSetting('nothing', 'fallback')).toBe('fallback');
  });

  it('overwrites an existing key', async () => {
    await repository.writeSetting('mode', 'a');
    await repository.writeSetting('mode', 'b');
    expect(await repository.readSetting('mode')).toBe('b');
  });

  it('survives a restart', async () => {
    await repository.writeSetting('mode', 'phone-native');
    resetDatabaseHandleForTests();
    expect(await repository.readSetting('mode')).toBe('phone-native');
  });
});

describe('storage errors', () => {
  it('wraps a failure in a recoverable StorageError with a readable message', async () => {
    const db = await getDatabase();
    // Pull the table out from under the repository.
    await db.execAsync('DROP TABLE dreams;');
    await expect(repository.listDreams()).rejects.toThrow(/could not load your dreams/i);
  });
});
