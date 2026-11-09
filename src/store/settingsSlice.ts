import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { DEFAULT_CLOUD_MODEL } from '../services/analysis/models';
import { DEFAULT_LLM_MODEL, DEFAULT_WHISPER_MODEL } from '../services/localModels/catalog';
import type { EngineId } from '../services/transcription/types';

/** Non-secret preferences. The API key is NOT here; it lives in SecureStore. */
export interface SettingsState {
  cloudModel: string;
  denyDataCollection: boolean;
  requireZdr: boolean;
  engine: EngineId;
  whisperModel: string;
  llmModel: string;
  useLocalLlm: boolean;
}

export const defaultSettings: SettingsState = {
  cloudModel: DEFAULT_CLOUD_MODEL,
  denyDataCollection: true,
  requireZdr: false,
  engine: 'apple-on-device',
  whisperModel: DEFAULT_WHISPER_MODEL,
  llmModel: DEFAULT_LLM_MODEL,
  useLocalLlm: true,
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState: defaultSettings,
  reducers: {
    settingsHydrated(_state, action: PayloadAction<Partial<SettingsState> | undefined>) {
      return { ...defaultSettings, ...(action.payload ?? {}) };
    },
    settingsChanged(state, action: PayloadAction<Partial<SettingsState>>) {
      Object.assign(state, action.payload);
    },
  },
});

export const settingsActions = settingsSlice.actions;
export default settingsSlice.reducer;
