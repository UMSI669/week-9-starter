import type { ExpoSpeechRecognitionResultEvent } from 'expo-speech-recognition';
import { iosMajorVersion, isIos, nativeAiAvailable } from '../runtime';
import { makeAbortError } from '../../utils/safeError';
import { groupTokens, splitTextEvenly, type TimedToken } from './segmenter';
import type { TranscriptionEngine } from './types';

const LOCALE = 'en-US';

/**
 * Lazily loads the native module. This function is the only place the module
 * is required, and it is never called in Expo Go (nativeAiAvailable === false).
 */
function speechModule() {
  if (!nativeAiAvailable) throw new Error('Apple speech recognition requires a development build.');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-speech-recognition').ExpoSpeechRecognitionModule as typeof import('expo-speech-recognition').ExpoSpeechRecognitionModule;
}

export const appleSpeechEngine: TranscriptionEngine = {
  id: 'apple-on-device',
  name: 'Apple on-device speech',
  description:
    'Uses iOS speech recognition with requiresOnDeviceRecognition enabled. Audio never leaves the phone; if on-device recognition is unavailable the app stops.',

  async checkAvailability() {
    if (!nativeAiAvailable) return { available: false, reason: 'Requires a development build (not Expo Go).' };
    if (!isIos) return { available: false, reason: 'Implemented for iOS only.' };
    if (iosMajorVersion < 17) return { available: false, reason: 'File transcription requires iOS 17 or later.' };
    const mod = speechModule();
    if (!mod.isRecognitionAvailable()) return { available: false, reason: 'Speech recognition is unavailable on this device.' };
    if (!mod.supportsOnDeviceRecognition()) {
      return { available: false, reason: 'This iPhone does not support on-device speech recognition.' };
    }
    try {
      const { locales, installedLocales } = await mod.getSupportedLocales({});
      const supported = [...(installedLocales ?? []), ...(locales ?? [])].some(
        (l) => l.replace('_', '-').toLowerCase() === LOCALE.toLowerCase(),
      );
      if (!supported) {
        return {
          available: false,
          reason: 'English (US) on-device speech is not installed. Enable it in Settings › General › Keyboard › Dictation.',
        };
      }
    } catch {
      // Locale listing is best-effort; start() will still fail safely if unsupported.
    }
    return { available: true };
  },

  async transcribeFile({ uri, durationMs, signal, onPartial }) {
    const mod = speechModule();
    const permission = await mod.requestSpeechRecognizerPermissionsAsync();
    if (!permission.granted) throw new Error('Speech recognition permission was denied. Enable it in iOS Settings.');
    if (signal?.aborted) throw makeAbortError('Transcription canceled.');

    return new Promise((resolve, reject) => {
      const tokens: TimedToken[] = [];
      const texts: string[] = [];
      let offsetMs = 0;
      let lastFinal = '';
      let settled = false;
      const subscriptions: { remove(): void }[] = [];

      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        subscriptions.forEach((s) => s.remove());
        signal?.removeEventListener('abort', onAbort);
        if (error) {
          reject(error);
          return;
        }
        const segments = tokens.length > 0 ? groupTokens(tokens) : splitTextEvenly(texts.join(' '), durationMs ?? 0);
        if (segments.length === 0) {
          reject(new Error('No speech was recognized in this recording.'));
          return;
        }
        resolve({ segments, model: `apple-sfspeech-${LOCALE}-on-device`, approximateTimestamps: tokens.length === 0 });
      };
      const onAbort = () => {
        try {
          mod.abort();
        } finally {
          finish(makeAbortError('Transcription canceled.'));
        }
      };

      subscriptions.push(
        mod.addListener('result', (event: ExpoSpeechRecognitionResultEvent) => {
          const best = event.results?.[0];
          const text = best?.transcript?.trim() ?? '';
          if (!event.isFinal) {
            if (text) onPartial?.(text);
            return;
          }
          if (!text || text === lastFinal) return;
          lastFinal = text;
          texts.push(text);
          // Long files can produce several final results. If a result's word
          // timestamps restart near zero, offset them after the previous result.
          const words = best?.segments ?? [];
          const base = words.length > 0 && words[0].startTimeMillis + 500 < offsetMs ? offsetMs : 0;
          let resultEnd = offsetMs;
          for (const word of words) {
            tokens.push({ text: word.segment, startMs: base + word.startTimeMillis, endMs: base + word.endTimeMillis });
            resultEnd = Math.max(resultEnd, base + word.endTimeMillis);
          }
          offsetMs = resultEnd;
        }),
        mod.addListener('error', (event) => {
          if (event.error === 'aborted') return;
          if (event.error === 'no-speech' && texts.length > 0) return;
          finish(new Error(`On-device recognition failed (${event.error}). ${event.message ?? ''} Audio was not uploaded.`.trim()));
        }),
        mod.addListener('end', () => finish()),
      );

      signal?.addEventListener('abort', onAbort, { once: true });
      try {
        mod.start({
          lang: LOCALE,
          interimResults: true,
          continuous: true,
          addsPunctuation: true,
          iosTaskHint: 'dictation',
          // Privacy requirement: never let iOS send audio to Apple's servers.
          requiresOnDeviceRecognition: true,
          audioSource: { uri },
        });
      } catch (error) {
        finish(error instanceof Error ? error : new Error('Could not start on-device recognition.'));
      }
    });
  },
};
