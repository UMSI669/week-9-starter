/**
 * App settings, persisted in the same SQLite database as the dreams.
 */

import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { readSetting, writeSetting } from '../services/dreamRepository';
import { TRANSCRIPTION_MODES } from '../services/stt';

const MODE_KEY = 'transcriptionMode';

const VALID_MODES = new Set(Object.values(TRANSCRIPTION_MODES));

export const loadSettings = createAsyncThunk('settings/load', async () => {
  const mode = await readSetting(MODE_KEY, TRANSCRIPTION_MODES.PHONE);
  return { transcriptionMode: VALID_MODES.has(mode) ? mode : TRANSCRIPTION_MODES.PHONE };
});

export const setTranscriptionMode = createAsyncThunk('settings/setMode', async (mode) => {
  const next = VALID_MODES.has(mode) ? mode : TRANSCRIPTION_MODES.PHONE;
  await writeSetting(MODE_KEY, next);
  return next;
});

const settingsSlice = createSlice({
  name: 'settings',
  initialState: {
    transcriptionMode: TRANSCRIPTION_MODES.PHONE,
    loaded: false,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadSettings.fulfilled, (state, action) => {
        state.transcriptionMode = action.payload.transcriptionMode;
        state.loaded = true;
      })
      .addCase(loadSettings.rejected, (state) => {
        // Fall back to the default rather than blocking the app on a read error.
        state.loaded = true;
      })
      .addCase(setTranscriptionMode.fulfilled, (state, action) => {
        state.transcriptionMode = action.payload;
      });
  },
});

export const selectTranscriptionMode = (state) => state.settings.transcriptionMode;
export const selectSettingsLoaded = (state) => state.settings.loaded;

export default settingsSlice.reducer;
