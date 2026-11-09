import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { parseGroceries } from '../services/umgpt/parser';
import { transcribeAudio } from '../services/openrouter/transcribe';
import { safeError } from '../services/apiErrors';
import type { GroceryDraft } from '../utils/groceries';
export const voiceApi = createApi({
  reducerPath: 'voiceApi', baseQuery: fakeBaseQuery<{ message: string }>(),
  endpoints: builder => ({
    transcribe: builder.mutation<string, string>({
      async queryFn(uri, api) {
        const timeout = new AbortController(); const timer = setTimeout(() => timeout.abort(), 60_000);
        const abort = () => timeout.abort(); api.signal.addEventListener('abort', abort);
        try { return { data: await transcribeAudio(uri, timeout.signal) }; }
        catch (error) { return { error: { message: timeout.signal.aborted ? 'Transcription stopped or timed out. Your recording is kept for retry.' : safeError(error) } }; }
        finally { clearTimeout(timer); api.signal.removeEventListener('abort', abort); }
      },
    }),
    parse: builder.mutation<GroceryDraft[], string>({
      async queryFn(transcript, api) {
        const timeout = new AbortController(); const timer = setTimeout(() => timeout.abort(), 60_000);
        const abort = () => timeout.abort(); api.signal.addEventListener('abort', abort);
        try { return { data: await parseGroceries(transcript, process.env.EXPO_PUBLIC_UMGPT_API_KEY?.trim() || '', process.env.EXPO_PUBLIC_PARSER_MODEL?.trim() || 'gpt-6-luna', timeout.signal, fetch, process.env.EXPO_PUBLIC_UMGPT_BASE_URL?.trim() || 'https://api.toolkit.umgpt.umich.edu/v1') }; }
        catch (error) { return { error: { message: timeout.signal.aborted ? 'Item formatting stopped or timed out.' : safeError(error) } }; }
        finally { clearTimeout(timer); api.signal.removeEventListener('abort', abort); }
      },
    }),
  }),
});
export const { useTranscribeMutation, useParseMutation } = voiceApi;
