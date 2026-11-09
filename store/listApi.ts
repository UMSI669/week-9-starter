import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { getRepository } from '../services/db';
import { safeError } from '../services/apiErrors';
import type { GroceryDraft, GroceryItem, Week } from '../utils/groceries';
import type { MergeResult, Snapshot } from '../services/db/repository';
type ApiError = { message: string };
async function call<T>(operation: (repo: Awaited<ReturnType<typeof getRepository>>) => Promise<T>): Promise<{ data: T } | { error: ApiError }> {
  try { return { data: await operation(await getRepository()) }; }
  catch (error) { return { error: { message: safeError(error) } }; }
}
function callVoid(operation: (repo: Awaited<ReturnType<typeof getRepository>>) => Promise<void>) {
  // RTK Query requires defined data even when a database write has no result.
  return call(async repo => { await operation(repo); return null; });
}
export const listApi = createApi({
  reducerPath: 'listApi', baseQuery: fakeBaseQuery<ApiError>(), tagTypes: ['Lists'],
  endpoints: builder => ({
    snapshot: builder.query<Snapshot, void>({ queryFn: () => call(repo => repo.snapshot()), providesTags: ['Lists'] }),
    history: builder.query<Week[], void>({ queryFn: () => call(repo => repo.history()), providesTags: ['Lists'] }),
    weekItems: builder.query<GroceryItem[], string>({ queryFn: id => call(repo => repo.weekItems(id)), providesTags: ['Lists'] }),
    recent: builder.query<GroceryItem[], void>({ queryFn: () => call(repo => repo.recent()), providesTags: ['Lists'] }),
    add: builder.mutation<MergeResult, { items: GroceryDraft[]; source?: 'manual' | 'voice' }>({ queryFn: arg => call(repo => repo.addOrMergeItems(arg.items, arg.source)), invalidatesTags: ['Lists'] }),
    update: builder.mutation<MergeResult, { id: string; item: GroceryDraft }>({ queryFn: arg => call(repo => repo.updateItem(arg.id, arg.item)), invalidatesTags: ['Lists'] }),
    toggle: builder.mutation<null, string>({ queryFn: id => callVoid(repo => repo.toggle(id)), invalidatesTags: ['Lists'] }),
    remove: builder.mutation<GroceryItem, string>({ queryFn: id => call(repo => repo.remove(id)), invalidatesTags: ['Lists'] }),
    restore: builder.mutation<null, GroceryItem>({ queryFn: item => callVoid(repo => repo.restore(item)), invalidatesTags: ['Lists'] }),
    setting: builder.mutation<null, { key: string; value: string }>({ queryFn: arg => callVoid(repo => repo.setSetting(arg.key, arg.value)), invalidatesTags: ['Lists'] }),
    copy: builder.mutation<MergeResult, string>({ queryFn: id => call(repo => repo.copyUnchecked(id)), invalidatesTags: ['Lists'] }),
    clear: builder.mutation<null, void>({ queryFn: () => callVoid(repo => repo.clear()), invalidatesTags: ['Lists'] }),
  }),
});
export const { useSnapshotQuery, useHistoryQuery, useWeekItemsQuery, useRecentQuery, useAddMutation, useUpdateMutation,
  useToggleMutation, useRemoveMutation, useRestoreMutation, useSettingMutation, useCopyMutation, useClearMutation } = listApi;
