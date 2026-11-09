import { nativeAiAvailable } from '../runtime';
import { getLocalModel, DEFAULT_WHISPER_MODEL } from '../localModels/catalog';
import { getModelStatus, modelFile } from '../localModels/manager';
import { makeAbortError } from '../../utils/safeError';
import type { TranscriptionEngine } from './types';

function whisperModule() {
  if (!nativeAiAvailable) throw new Error('Whisper requires a development build.');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('whisper.rn') as typeof import('whisper.rn');
}


export const whisperEngine: TranscriptionEngine = {
  id: 'whisper-on-device',
  name: 'Whisper (on-device)',
  description:
    'Runs a quantized Whisper model locally with whisper.rn. Requires a 16-bit PCM WAV file and a downloaded model.',

  async checkAvailability(modelId = DEFAULT_WHISPER_MODEL) {
    if (!nativeAiAvailable) return { available: false, reason: 'Requires a development build (not Expo Go).' };
    const model = getLocalModel(modelId);
    if (!model) return { available: false, reason: 'No Whisper model selected.' };
    const status = getModelStatus(model);
    if (status !== 'ready') return { available: false, reason: `Download ${model.name} in Settings first.` };
    return { available: true };
  },

  async transcribeFile({ uri, signal, onProgress, modelId = DEFAULT_WHISPER_MODEL }) {
    const model = getLocalModel(modelId);
    if (!model || getModelStatus(model) !== 'ready') {
      throw new Error('The Whisper model is missing or incomplete. Download it in Settings.');
    }
    if (!uri.toLowerCase().endsWith('.wav')) {
      throw new Error('Whisper on-device needs a WAV (16-bit PCM) file. Record in the app or import a WAV.');
    }
    if (signal?.aborted) throw makeAbortError('Transcription canceled.');

    const { initWhisper } = whisperModule();
    let context: Awaited<ReturnType<typeof initWhisper>> | undefined;
    let stop: (() => Promise<void>) | undefined;
    let aborted = false;
    const onAbort = () => {
      aborted = true;
      void stop?.();
    };
    signal?.addEventListener('abort', onAbort, { once: true });

    try {
      context = await initWhisper({ filePath: modelFile(model).uri, useGpu: true, useCoreMLIos: false });
      if (signal?.aborted) throw makeAbortError('Transcription canceled.');
      const job = context.transcribe(uri, {
        language: 'en',
        maxLen: 0,
        onProgress: (p: number) => onProgress?.(p / 100),
      });
      stop = job.stop;
      const result = await job.promise;
      if (aborted || result.isAborted) throw makeAbortError('Transcription canceled.');
      const segments = (result.segments ?? [])
        .map((s) => ({
          // whisper.cpp timestamps are in 10 ms units.
          startMs: s.t0 * 10,
          endMs: s.t1 * 10,
          text: s.text.trim(),
        }))
        .filter((s) => s.text && !/^\[(BLANK_AUDIO|MUSIC|NOISE)\]$/i.test(s.text));
      if (segments.length === 0) throw new Error('No speech was recognized in this recording.');
      return { segments, model: model.id, approximateTimestamps: false };
    } finally {
      signal?.removeEventListener('abort', onAbort);
      await context?.release();
    }
  },
};
