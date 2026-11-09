/**
 * Store-level tests for first-run demo seeding and the selectors Home uses.
 * Real SQLite underneath, so this exercises the whole path the app takes on a
 * fresh install.
 */

import { jest } from '@jest/globals';

jest.mock('expo-sqlite', () => require('../../services/__tests__/sqliteFake'));

const { configureStore } = require('@reduxjs/toolkit');
const sqliteFake = require('../../services/__tests__/sqliteFake');
const { resetDatabaseHandleForTests } = require('../../services/db');
const repository = require('../../services/dreamRepository');
const { DEMO_DREAM_COUNT, demoCountsByCategory } = require('../../services/seedDreams');
const dreamsReducer = require('../dreamsSlice').default;
const {
  addDemoDreams,
  createDream,
  editDream,
  loadDreams,
  removeDemoDreams,
  removeDream,
  restoreDream,
  seedDemoDreamsIfFirstRun,
  selectCategoryCounts,
  selectDreams,
  selectFilteredDreams,
} = require('../dreamsSlice');

function makeStore() {
  return configureStore({ reducer: { dreams: dreamsReducer } });
}

beforeEach(() => {
  sqliteFake.__resetAllDatabases();
  resetDatabaseHandleForTests();
});

describe('first-run demo seeding', () => {
  it('populates an empty database so the gallery is not blank on install', async () => {
    const store = makeStore();
    const result = await store.dispatch(seedDemoDreamsIfFirstRun()).unwrap();

    expect(result).toEqual({ seeded: true, reason: 'first-run' });
    expect(selectDreams(store.getState())).toHaveLength(DEMO_DREAM_COUNT);
  });

  it('gives the cloud map a real size hierarchy with a tie to break', async () => {
    const store = makeStore();
    await store.dispatch(seedDemoDreamsIfFirstRun());

    const counts = selectCategoryCounts(store.getState());
    const populated = counts.filter((category) => category.count > 0);

    // Several populated categories, a clear largest, and at least one pair of
    // equal counts, which is what exercises the alphabetical tie-breaker.
    expect(populated.length).toBeGreaterThanOrEqual(5);
    const sorted = [...populated].sort((a, b) => b.count - a.count);
    expect(sorted[0].count).toBeGreaterThan(sorted[sorted.length - 1].count);

    const tallies = populated.map((category) => category.count);
    expect(new Set(tallies).size).toBeLessThan(tallies.length);

    // And at least one category deliberately left empty.
    expect(counts.some((category) => category.count === 0)).toBe(true);
  });

  it('matches the fixture counts exactly', async () => {
    const store = makeStore();
    await store.dispatch(seedDemoDreamsIfFirstRun());

    const counts = selectCategoryCounts(store.getState());
    const expected = demoCountsByCategory();
    Object.entries(expected).forEach(([key, count]) => {
      expect(counts.find((category) => category.key === key).count).toBe(count);
    });
  });

  it('marks every seeded dream as demo data, with an honest model field', async () => {
    const store = makeStore();
    await store.dispatch(seedDemoDreamsIfFirstRun());

    selectDreams(store.getState()).forEach((dream) => {
      expect(dream.isDemo).toBe(true);
      expect(dream.analysisModel).toMatch(/not AI output/i);
      // Each one is a complete, displayable card.
      expect(dream.title.length).toBeGreaterThan(0);
      expect(dream.title.length).toBeLessThanOrEqual(60);
      expect(dream.summary.length).toBeLessThanOrEqual(240);
      expect(dream.interpretation.length).toBeGreaterThan(0);
      expect(dream.interpretation.length).toBeLessThanOrEqual(500);
      expect(dream.reflectionQuestion.length).toBeLessThanOrEqual(160);
      expect(dream.themes.length).toBeGreaterThanOrEqual(1);
      expect(dream.themes.length).toBeLessThanOrEqual(5);
      expect(dream.moods.length).toBeGreaterThanOrEqual(1);
      expect(dream.moods.length).toBeLessThanOrEqual(3);
      expect(dream.emoji).toBeTruthy();
      expect(dream.visualSeed).toBeTruthy();
    });
  });

  it('uses tentative language, never a definite or predictive claim', async () => {
    const store = makeStore();
    await store.dispatch(seedDemoDreamsIfFirstRun());

    // Targets the overclaiming constructions specifically. The bare word
    // "means" is fine in a relativising sentence such as "what the fox means
    // here depends on what foxes mean to you", which is the opposite of a
    // fixed-meaning claim.
    const overclaims =
      /\bthis means\b|\bmeans that you\b|\bsymbolizes\b|\bsymbolises\b|\brepresents\b|\bwill happen\b|\bpredicts?\b|\bproves\b|\bdiagnos/i;

    selectDreams(store.getState()).forEach((dream) => {
      expect(dream.interpretation).toMatch(/could reflect|might connect|may connect|could be/i);
      expect(dream.interpretation).not.toMatch(overclaims);
      expect(dream.reflectionQuestion).not.toMatch(overclaims);
    });
  });

  it('does not run twice', async () => {
    const store = makeStore();
    await store.dispatch(seedDemoDreamsIfFirstRun());
    const second = await store.dispatch(seedDemoDreamsIfFirstRun()).unwrap();

    expect(second).toEqual({ seeded: false, reason: 'already-seeded' });
    expect(selectDreams(store.getState())).toHaveLength(DEMO_DREAM_COUNT);
  });

  it('never adds demos to a database that already holds real dreams', async () => {
    await repository.saveDream({ transcript: 'a real dream', title: 'Mine' });

    const store = makeStore();
    const result = await store.dispatch(seedDemoDreamsIfFirstRun()).unwrap();

    expect(result).toEqual({ seeded: false, reason: 'not-empty' });
    await store.dispatch(loadDreams());
    expect(selectDreams(store.getState())).toHaveLength(1);
  });

  it('does not bring the demos back after the user removes them', async () => {
    const store = makeStore();
    await store.dispatch(seedDemoDreamsIfFirstRun());
    await store.dispatch(removeDemoDreams());
    expect(selectDreams(store.getState())).toHaveLength(0);

    // A later launch.
    resetDatabaseHandleForTests();
    const relaunch = makeStore();
    const result = await relaunch.dispatch(seedDemoDreamsIfFirstRun()).unwrap();
    expect(result.seeded).toBe(false);
    expect(selectDreams(relaunch.getState())).toHaveLength(0);
  });

  it('can be re-added deliberately from Settings', async () => {
    const store = makeStore();
    await store.dispatch(seedDemoDreamsIfFirstRun());
    await store.dispatch(removeDemoDreams());
    await store.dispatch(addDemoDreams());
    expect(selectDreams(store.getState())).toHaveLength(DEMO_DREAM_COUNT);
  });

  it('survives a restart', async () => {
    const store = makeStore();
    await store.dispatch(seedDemoDreamsIfFirstRun());

    resetDatabaseHandleForTests();
    const relaunch = makeStore();
    await relaunch.dispatch(loadDreams());
    expect(selectDreams(relaunch.getState())).toHaveLength(DEMO_DREAM_COUNT);
  });
});

describe('selectors Home and the gallery depend on', () => {
  it('orders dreams newest first', async () => {
    const store = makeStore();
    await store.dispatch(seedDemoDreamsIfFirstRun());

    const dates = selectDreams(store.getState()).map((dream) => dream.createdAt);
    const sorted = [...dates].sort().reverse();
    expect(dates).toEqual(sorted);
  });

  it('counts every category, including the empty ones', async () => {
    const store = makeStore();
    await store.dispatch(seedDemoDreamsIfFirstRun());

    const counts = selectCategoryCounts(store.getState());
    expect(counts).toHaveLength(8);
    expect(counts.reduce((sum, category) => sum + category.count, 0)).toBe(DEMO_DREAM_COUNT);
  });

  it('filters by category and searches title, transcript, and tags', async () => {
    const store = makeStore();
    await store.dispatch(seedDemoDreamsIfFirstRun());
    const state = store.getState();

    expect(selectFilteredDreams('adventure', '')(state)).toHaveLength(4);
    expect(selectFilteredDreams(null, 'library')(state).length).toBeGreaterThan(0);
    expect(selectFilteredDreams(null, 'curious')(state).length).toBeGreaterThan(0);
    expect(selectFilteredDreams(null, 'zzzznothing')(state)).toHaveLength(0);
  });
});

describe('counts update after every mutation', () => {
  it('a new dream increases its category count immediately', async () => {
    const store = makeStore();
    await store.dispatch(seedDemoDreamsIfFirstRun());
    const before = countFor(store, 'mystery');

    await store.dispatch(
      createDream({ transcript: 'a new dream', title: 'New', primaryCategory: 'mystery' }),
    );
    expect(countFor(store, 'mystery')).toBe(before + 1);
  });

  it('changing a category moves the dream between clouds', async () => {
    const store = makeStore();
    await store.dispatch(seedDemoDreamsIfFirstRun());
    const adventureBefore = countFor(store, 'adventure');
    const mysteryBefore = countFor(store, 'mystery');

    const dream = selectDreams(store.getState()).find((d) => d.primaryCategory === 'adventure');
    await store.dispatch(editDream({ id: dream.id, changes: { primaryCategory: 'mystery' } }));

    expect(countFor(store, 'adventure')).toBe(adventureBefore - 1);
    expect(countFor(store, 'mystery')).toBe(mysteryBefore + 1);
  });

  it('deleting removes it from the count, and Undo puts it back unchanged', async () => {
    const store = makeStore();
    await store.dispatch(seedDemoDreamsIfFirstRun());
    const dream = selectDreams(store.getState()).find((d) => d.primaryCategory === 'mystery');
    const before = countFor(store, 'mystery');

    const removed = await store.dispatch(removeDream(dream.id)).unwrap();
    expect(countFor(store, 'mystery')).toBe(before - 1);
    expect(store.getState().dreams.lastDeleted.id).toBe(dream.id);

    await store.dispatch(restoreDream(removed));
    expect(countFor(store, 'mystery')).toBe(before);

    const restored = selectDreams(store.getState()).find((d) => d.id === dream.id);
    expect(restored.createdAt).toBe(dream.createdAt);
    expect(restored.visualSeed).toBe(dream.visualSeed);
    expect(restored.title).toBe(dream.title);
  });
});

function countFor(store, key) {
  return selectCategoryCounts(store.getState()).find((category) => category.key === key).count;
}
