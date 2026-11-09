import { configureStore, createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import { saveVault } from '../services/storage/vault';
import dataReducer, { dataActions } from './dataSlice';
import settingsReducer, { settingsActions } from './settingsSlice';

const listener = createListenerMiddleware();

export const store = configureStore({
  reducer: { data: dataReducer, settings: settingsReducer },
  middleware: (getDefault) => getDefault({ serializableCheck: { warnAfter: 200 }, immutableCheck: { warnAfter: 200 } }).prepend(listener.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();

/** Debounced local save after any data/settings change (except hydration itself). */
listener.startListening({
  predicate: (action, current) =>
    (current as RootState).data.hydrated &&
    (action.type.startsWith('data/') || action.type.startsWith('settings/')) &&
    !isAnyOf(dataActions.hydrated, settingsActions.settingsHydrated)(action),
  effect: async (_action, api) => {
    api.cancelActiveListeners();
    await api.delay(400);
    const state = api.getState() as RootState;
    await saveVault({
      projects: Object.values(state.data.projects),
      sessions: Object.values(state.data.sessions),
      settings: { ...state.settings },
    }).catch(() => {
      // Saving failures are surfaced on next launch (data stays in memory); no content is logged.
    });
  },
});
