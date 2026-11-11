/**
 * Dreams in Redux are a CACHE for the interface, not the store of record.
 *
 * Every thunk here writes to SQLite through dreamRepository first and only
 * then updates this slice with what SQLite actually returned. That is why a
 * restart shows the same dreams: the list is rebuilt from the database, not
 * rehydrated from memory.
 */

import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  countDemoDreams,
  deleteDemoDreams,
  deleteDream,
  listDreams,
  readSetting,
  saveDream,
  saveManyDreams,
  updateDream,
  writeSetting,
} from '../services/dreamRepository';
import { buildDemoDreams, SEED_SETTING_KEY, seedStamp } from '../services/seedDreams';
import { CATEGORIES } from '../data/categories';

export const loadDreams = createAsyncThunk('dreams/load', async () => {
  const dreams = await listDreams();
  return dreams;
});

/**
 * Seeds the labelled demo dreams exactly once, on a genuinely empty database.
 * It never overwrites real dreams, and a user who removes the demos does not
 * get them back on the next launch.
 */
export const seedDemoDreamsIfFirstRun = createAsyncThunk(
  'dreams/seedIfFirstRun',
  async (_arg, { dispatch }) => {
    const alreadySeeded = await readSetting(SEED_SETTING_KEY);
    if (alreadySeeded) return { seeded: false, reason: 'already-seeded' };

    const existing = await listDreams();
    if (existing.length > 0) {
      // Real dreams are present: record the stamp so this never runs again,
      // but add nothing.
      await writeSetting(SEED_SETTING_KEY, seedStamp());
      return { seeded: false, reason: 'not-empty' };
    }

    await saveManyDreams(buildDemoDreams());
    await writeSetting(SEED_SETTING_KEY, seedStamp());
    await dispatch(loadDreams());
    return { seeded: true, reason: 'first-run' };
  },
);

/** Settings action: add the demos back on demand. */
export const addDemoDreams = createAsyncThunk('dreams/addDemos', async (_arg, { dispatch }) => {
  await saveManyDreams(buildDemoDreams());
  await writeSetting(SEED_SETTING_KEY, seedStamp());
  await dispatch(loadDreams());
  return { added: true };
});

export const removeDemoDreams = createAsyncThunk(
  'dreams/removeDemos',
  async (_arg, { dispatch }) => {
    const removed = await deleteDemoDreams();
    await dispatch(loadDreams());
    return { removed };
  },
);

export const countDemos = createAsyncThunk('dreams/countDemos', async () => countDemoDreams());

export const createDream = createAsyncThunk('dreams/create', async (draft) => saveDream(draft));

export const editDream = createAsyncThunk('dreams/edit', async ({ id, changes }) =>
  updateDream(id, changes),
);

export const removeDream = createAsyncThunk('dreams/remove', async (id) => deleteDream(id));

/** Undo re-inserts the exact record, keeping its id, dates, and visualSeed. */
export const restoreDream = createAsyncThunk('dreams/restore', async (dream) => saveDream(dream));

const initialState = {
  items: [],
  status: 'idle',
  error: null,
  demoCount: 0,
  lastDeleted: null,
};

const dreamsSlice = createSlice({
  name: 'dreams',
  initialState,
  reducers: {
    clearError(state) {
      state.error = null;
    },
    clearLastDeleted(state) {
      state.lastDeleted = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadDreams.pending, (state) => {
        state.status = state.items.length > 0 ? 'refreshing' : 'loading';
        state.error = null;
      })
      .addCase(loadDreams.fulfilled, (state, action) => {
        state.items = action.payload;
        state.status = 'ready';
        state.demoCount = action.payload.filter((dream) => dream.isDemo).length;
      })
      .addCase(loadDreams.rejected, (state, action) => {
        state.status = 'error';
        state.error = action.error?.message || 'Could not load your dreams.';
      })
      .addCase(createDream.fulfilled, (state, action) => {
        upsert(state, action.payload);
      })
      .addCase(editDream.fulfilled, (state, action) => {
        upsert(state, action.payload);
      })
      .addCase(removeDream.fulfilled, (state, action) => {
        state.items = state.items.filter((dream) => dream.id !== action.meta.arg);
        state.lastDeleted = action.payload || null;
        state.demoCount = state.items.filter((dream) => dream.isDemo).length;
      })
      .addCase(restoreDream.fulfilled, (state, action) => {
        upsert(state, action.payload);
        state.lastDeleted = null;
      })
      .addCase(countDemos.fulfilled, (state, action) => {
        state.demoCount = action.payload;
      })
      .addMatcher(
        (action) => action.type.startsWith('dreams/') && action.type.endsWith('/rejected'),
        (state, action) => {
          state.error = action.error?.message || 'Something went wrong with local storage.';
        },
      );
  },
});

function upsert(state, dream) {
  if (!dream) return;
  const index = state.items.findIndex((item) => item.id === dream.id);
  if (index >= 0) state.items[index] = dream;
  else state.items.push(dream);
  // Newest first, with a stable id tie-breaker so order never flickers.
  state.items.sort((a, b) => {
    if (a.createdAt === b.createdAt) return b.id.localeCompare(a.id);
    return a.createdAt < b.createdAt ? 1 : -1;
  });
  state.demoCount = state.items.filter((item) => item.isDemo).length;
}

export const { clearError, clearLastDeleted } = dreamsSlice.actions;

/* --------------------------------- selectors -------------------------------- */

export const selectDreams = (state) => state.dreams.items;
export const selectDreamsStatus = (state) => state.dreams.status;
export const selectDreamsError = (state) => state.dreams.error;
export const selectDemoCount = (state) => state.dreams.demoCount;
export const selectLastDeleted = (state) => state.dreams.lastDeleted;

export const selectDreamById = (id) => (state) =>
  state.dreams.items.find((dream) => dream.id === id) || null;

/** Every category with its live count, including the empty ones. */
export const selectCategoryCounts = (state) => {
  const counts = new Map(CATEGORIES.map((category) => [category.key, 0]));
  state.dreams.items.forEach((dream) => {
    counts.set(dream.primaryCategory, (counts.get(dream.primaryCategory) || 0) + 1);
  });
  return CATEGORIES.map((category) => ({ ...category, count: counts.get(category.key) || 0 }));
};

/** Newest first, filtered by category, searched over title/transcript/tags. */
export const selectFilteredDreams = (category, search) => (state) => {
  const term = String(search || '').trim().toLowerCase();
  return state.dreams.items.filter((dream) => {
    if (category && dream.primaryCategory !== category) return false;
    if (!term) return true;
    return (
      dream.title.toLowerCase().includes(term) ||
      dream.transcript.toLowerCase().includes(term) ||
      dream.symbolLabel.toLowerCase().includes(term) ||
      dream.themes.some((tag) => tag.includes(term)) ||
      dream.moods.some((tag) => tag.includes(term))
    );
  });
};

export default dreamsSlice.reducer;
