/**
 * iOS phone-native speech recognition.
 *
 * Adapted from the class reference repository
 * (https://github.com/UMSI669/Voice-To-Text, src/services/stt/nativeStt.ios.js,
 * MIT licensed — see LICENSE-THIRD-PARTY.md). The adapter interface is
 * preserved; the dream-specific parts are the silence timeout, the maximum
 * duration, and the partial/final separation the capture screen relies on.
 *
 * IMPORTANT, and stated this way on screen too: this is the operating
 * system's speech service. iOS may process the audio on the device or send it
 * to Apple's servers, and the app cannot tell which. It is therefore NOT
 * described anywhere as guaranteed-offline transcription.
 */

import { SPEECH_MODULE_MISSING, getSpeechModule } from './speechModule';
import { AppState } from 'react-native';
import { claimMicrophone } from './micLock';
import { describeSpeechError } from './speechErrors';

const FOREGROUND_TIMEOUT_MS = 5000;

/**
 * The native module, or a thrown explanation when this build does not have it.
 * Resolved per call rather than at import, so a missing module degrades to a
 * clear message instead of crashing the app at launch.
 */
function speechOrThrow() {
  const module = getSpeechModule();
  if (!module) throw new Error(SPEECH_MODULE_MISSING);
  return module;
}

let activeSession = null;

function makeAbortError(message = 'Listening canceled.') {
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

/**
 * iOS will refuse the audio session if it is claimed while the permission
 * dialog is still dismissing, so wait for the app to be properly foregrounded.
 */
function waitForForeground(signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(makeAbortError());
      return;
    }
    if (AppState.currentState === 'active') {
      resolve();
      return;
    }

    const finish = (error) => {
      clearTimeout(timer);
      subscription.remove();
      signal.removeEventListener('abort', onAbort);
      if (error) reject(error);
      else resolve();
    };
    const onAbort = () => finish(makeAbortError());
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') finish();
    });
    const timer = setTimeout(
      () => finish(new Error('The app did not return to the foreground. Please try recording again.')),
      FOREGROUND_TIMEOUT_MS,
    );
    signal.addEventListener('abort', onAbort);
  });
}

function clearSession(session) {
  if (!session || activeSession !== session) return;
  session.startupController.abort();
  session.subscriptions.forEach((subscription) => subscription.remove());
  session.releaseMicrophone?.();
  activeSession = null;
}

export const nativeStt = {
  capabilities: {
    microphone: true,
    processingLocation: 'system-service',
    unavailableReason: null,
  },

  /** Runtime capability check — never assumed from the platform alone. */
  async getAvailability() {
    const speech = getSpeechModule();
    if (!speech) {
      return { available: false, permissionGranted: false, message: SPEECH_MODULE_MISSING };
    }
    try {
      const available = speech.isRecognitionAvailable();
      const permission = await speech.getPermissionsAsync();
      return {
        available,
        permissionGranted: Boolean(permission.granted),
        message: available
          ? permission.granted
            ? 'Phone transcription is ready.'
            : 'Microphone and speech-recognition permission will be requested when you start recording.'
          : 'This phone’s speech-recognition service is unavailable. You can still type your dream.',
      };
    } catch (_error) {
      return {
        available: false,
        permissionGranted: false,
        message:
          'The speech-recognition module is not installed in this build. Use a development build, or type your dream.',
      };
    }
  },

  /**
   * @param {object} handlers
   * @param {(text: string) => void} handlers.onPartial Interim guesses, shown
   *        greyed out. Never treated as the transcript.
   * @param {(result: {transcript: string}) => void} handlers.onFinal
   * @param {(error: Error) => void} handlers.onError
   * @param {() => void} handlers.onEnd
   * @param {string} [handlers.language]
   */
  async startListening({ onPartial, onFinal, onError, onEnd, language = 'en-US' }) {
    const speech = speechOrThrow();
    if (activeSession) {
      throw new Error('A recording session is already active.');
    }
    if (!speech.isRecognitionAvailable()) {
      throw new Error(
        'This phone’s speech-recognition service is unavailable. You can type your dream instead.',
      );
    }

    const session = {
      subscriptions: [],
      startupController: new AbortController(),
      started: false,
      releaseMicrophone: null,
      lastFinalText: null,
      ended: false,
    };
    activeSession = session;

    try {
      const { signal } = session.startupController;
      const permission = await speech.requestPermissionsAsync();
      if (signal.aborted) throw makeAbortError();
      if (!permission.granted) {
        throw new Error(
          'Microphone or speech-recognition permission was denied. You can type your dream instead, ' +
            'or allow access in Settings.',
        );
      }

      await waitForForeground(signal);
      if (signal.aborted) throw makeAbortError();
      session.releaseMicrophone = claimMicrophone('phone-native');

      session.subscriptions.push(
        speech.addListener('result', (event) => {
          const text = event.results?.[0]?.transcript?.trim() || '';
          // Partial and final results are kept strictly separate: a partial is
          // a live preview, a final result is what gets appended.
          if (!event.isFinal) {
            session.lastFinalText = null;
            if (text) onPartial?.(text);
            return;
          }
          if (!text || session.lastFinalText === text) return;
          session.lastFinalText = text;
          onFinal?.({ transcript: text, isFinal: true });
        }),
        speech.addListener('speechstart', () => {
          session.lastFinalText = null;
        }),
        speech.addListener('error', (event) => {
          if (event.error === 'aborted') return;
          onError?.(translateError(event));
        }),
        speech.addListener('end', () => {
          if (session.ended) return;
          session.ended = true;
          clearSession(session);
          onEnd?.();
        }),
      );

      session.started = true;
      speech.start({
        lang: language,
        interimResults: true,
        continuous: true,
        addsPunctuation: true,
        iosTaskHint: 'dictation',
        // Left false deliberately: forcing on-device recognition fails on
        // devices without the local model, and the app does not promise it.
        requiresOnDeviceRecognition: false,
      });
    } catch (error) {
      clearSession(session);
      // Re-thrown with an explanation the user can act on, rather than the
      // bare native string.
      const described = describeSpeechError(error);
      if (described !== (error instanceof Error ? error.message : '')) {
        const friendly = new Error(described);
        friendly.name = error?.name === 'AbortError' ? 'AbortError' : 'SpeechRecognitionError';
        friendly.cause = error;
        throw friendly;
      }
      throw error;
    }
  },

  async stopListening() {
    if (activeSession?.started) getSpeechModule()?.stop();
  },

  async cancelListening() {
    const session = activeSession;
    if (!session) return;
    try {
      if (session.started) getSpeechModule()?.abort();
    } finally {
      clearSession(session);
    }
  },
};

function translateError(event) {
  const map = {
    'not-allowed': 'Microphone or speech-recognition permission was denied.',
    'service-not-allowed': 'The phone’s speech service refused the request.',
    'no-speech': 'No speech was detected. Try recording again, a little closer to the microphone.',
    network: 'The phone’s speech service could not reach the network it needed.',
    'language-not-supported':
      'This phone’s speech service does not support that language. Try typing your dream instead.',
    audio: 'The microphone could not be read. Another app may be using it.',
  };
  if (map[event.error]) return new Error(map[event.error]);
  return new Error(describeSpeechError(event.message || `Speech recognition error: ${event.error}.`));
}

export default nativeStt;
