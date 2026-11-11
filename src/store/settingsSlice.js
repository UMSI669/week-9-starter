/**
 * App settings, persisted in the same SQLite database as the dreams.
 */

import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { readSetting, writeSetting } from '../services/dreamRepository';
import { TRANSCRIPTION_MODES } from '../services/stt';
import { isSpeechModuleAvailable } from '../services/stt/speechModule';

const MODE_KEY = 'transcriptionMode';

const VALID_MODES = new Set(Object.values(TRANSCRIPTION_MODES));

/**
 * Phone-native is preferred when the build can actually do it. In Expo Go, on
 * web, or in a development build made before expo-speech-recognition was
 * added, the native module is absent, and defaulting to a mode that cannot
 * work would drop the user into a dead end. Cloud is the fallback because it
 * is the only other mode that records audio; typing always remains available
 * from the capture screen regardless.
 */
export function defaultTranscriptionMode() {
  return isSpeechModuleAvailable() ? TRANSCRIPTION_MODES.PHONE : TRANSCRIPTION_MODES.CLOUD;
}

export const loadSettings = createAsyncThunk('settings/load', async () => {
  const fallback = defaultTranscriptionMode();
  const stored = await readSetting(MODE_KEY, null);
  const mode = VALID_MODES.has(stored) ? stored : fallback;

  // A stored preference for phone transcription cannot be honoured in a build
  // without the native module. Fall back rather than leaving the user on a
  // mode whose record button always fails.
  const usable =
    mode === TRANSCRIPTION_MODES.PHONE && !isSpeechModuleAvailable() ? fallback : mode;

  return {
    transcriptionMode: usable,
    nativeSpeechAvailable: isSpeechModuleAvailable(),
    downgradedFromPhone: usable !== mode,
  };
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
    nativeSpeechAvailable: true,
    downgradedFromPhone: false,
    loaded: false,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadSettings.fulfilled, (state, action) => {
        state.transcriptionMode = action.payload.transcriptionMode;
        state.nativeSpeechAvailable = action.payload.nativeSpeechAvailable;
        state.downgradedFromPhone = action.payload.downgradedFromPhone;
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
export const selectNativeSpeechAvailable = (state) => state.settings.nativeSpeechAvailable;
export const selectDowngradedFromPhone = (state) => state.settings.downgradedFromPhone;
export const selectSettingsLoaded = (state) => state.settings.loaded;

export default settingsSlice.reducer;
