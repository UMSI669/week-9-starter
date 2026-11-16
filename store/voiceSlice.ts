import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { GroceryDraft } from '../utils/groceries';
export type VoiceStatus = 'idle' | 'recording' | 'transcribing' | 'parsing' | 'reviewing' | 'error';
interface VoiceState {
  status: VoiceStatus; transcript: string; parsedTranscript: string; items: GroceryDraft[]; error: string;
  warning: string; audioUri: string | null;
}
const initialState: VoiceState = { status: 'idle', transcript: '', parsedTranscript: '', items: [], error: '', warning: '', audioUri: null };
const slice = createSlice({ name: 'voice', initialState, reducers: {
  resetVoice: () => initialState,
  voiceStatus(state, action: PayloadAction<VoiceStatus>) { state.status = action.payload; state.error = ''; },
  voiceAudio(state, action: PayloadAction<string>) { state.audioUri = action.payload; },
  voiceTranscript(state, action: PayloadAction<string>) { state.transcript = action.payload; },
  voiceReview(state, action: PayloadAction<{ items: GroceryDraft[]; warning?: string }>) {
    state.items = action.payload.items; state.parsedTranscript = state.transcript; state.warning = action.payload.warning || ''; state.status = 'reviewing'; state.error = '';
  },
  voiceError(state, action: PayloadAction<string>) { state.status = 'error'; state.error = action.payload; },
  editVoiceItem(state, action: PayloadAction<{ index: number; item: GroceryDraft }>) { state.items[action.payload.index] = action.payload.item; },
  removeVoiceItem(state, action: PayloadAction<number>) { state.items.splice(action.payload, 1); },
} });
export const { resetVoice, voiceStatus, voiceAudio, voiceTranscript, voiceReview, voiceError, editVoiceItem, removeVoiceItem } = slice.actions;
export default slice.reducer;
