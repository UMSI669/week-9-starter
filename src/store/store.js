import { configureStore } from '@reduxjs/toolkit';
import dreamsReducer from './dreamsSlice';
import settingsReducer from './settingsSlice';

export const store = configureStore({
  reducer: {
    dreams: dreamsReducer,
    settings: settingsReducer,
  },
});

export default store;
