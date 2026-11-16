import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { GroceryItem } from '../utils/groceries';

interface Notice { id: number; text: string; undo?: GroceryItem; }
interface UiState { notices: Notice[]; }
const initialState: UiState = { notices: [] };
const uiSlice = createSlice({ name: 'ui', initialState, reducers: {
  notice(state, action: PayloadAction<{ text: string; undo?: GroceryItem }>) {
    state.notices.push({ ...action.payload, id: Date.now() + Math.random() });
  },
  dismissNotice(state) { state.notices.shift(); },
} });
export const { notice, dismissNotice } = uiSlice.actions;
export default uiSlice.reducer;
