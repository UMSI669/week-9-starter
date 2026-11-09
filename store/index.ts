import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import { listApi } from './listApi';
import { voiceApi } from './voiceApi';
import ui from './uiSlice';
import voice from './voiceSlice';
export const store = configureStore({
  reducer: { ui, voice, [listApi.reducerPath]: listApi.reducer, [voiceApi.reducerPath]: voiceApi.reducer },
  middleware: getDefault => getDefault().concat(listApi.middleware, voiceApi.middleware),
});
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
