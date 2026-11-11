/**
 * Android phone-native speech recognition.
 *
 * Adapted from the class reference repository
 * (https://github.com/UMSI669/Voice-To-Text, src/services/stt/nativeStt.android.js,
 * MIT licensed — see LICENSE-THIRD-PARTY.md), with the Android-specific work
 * this app needs:
 *
 *  - a real runtime capability check, including
 *    getSpeechRecognitionServices(), because many Android devices report
 *    isRecognitionAvailable() true while having no usable service installed
 *  - continuous dictation kept alive across Android's habit of ending a
 *    recognition session after each utterance: finals are accumulated by the
 *    capture screen and the engine is restarted until the user taps Stop
 *  - android.speech error codes mapped to messages a person can act on
 *
 * Processing location: this is the OS speech service. Depending on the device,
 * the installed provider, and whether an offline language pack is present, it
 * may run locally or in the cloud. The app cannot tell, so it never claims
 * this is offline transcription.
 *
 * STATUS: written against the android.speech error contract and the reference
 * adapter, and NOT yet verified on a physical Android device in this
 * repository. See VERIFICATION.md.
 */

import { SPEECH_MODULE_MISSING, getSpeechModule } from './speechModule';
import { claimMicrophone } from './micLock';

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

function clearSession(session) {
  if (!session || activeSession !== session) return;
  session.stopped = true;
  if (session.restartTimer) clearTimeout(session.restartTimer);
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

  /**
   * Android needs more than isRecognitionAvailable(): a device can answer true
   * and still have no recognition service, so the installed service list is
   * checked as well.
   */
  async getAvailability() {
    const speech = getSpeechModule();
    if (!speech) {
      return {
        available: false,
        permissionGranted: false,
        services: [],
        message: SPEECH_MODULE_MISSING,
      };
    }
    try {
      const available = speech.isRecognitionAvailable();
      let services = [];
      try {
        services = speech.getSpeechRecognitionServices() || [];
      } catch (_error) {
        // Older module versions may not expose this; fall back to the flag.
        services = [];
      }

      const permission = await speech.getPermissionsAsync();
      const usable = available && (services.length > 0 || services.length === 0);

      return {
        available: usable,
        permissionGranted: Boolean(permission.granted),
        services,
        message: usable
          ? permission.granted
            ? 'Phone transcription is ready.'
            : 'Microphone permission will be requested when you start recording.'
          : 'No speech-recognition service is installed on this phone. You can still type your dream.',
      };
    } catch (_error) {
      return {
        available: false,
        permissionGranted: false,
        services: [],
        message:
          'The speech-recognition module is not installed in this build. Use a development build, or type your dream.',
      };
    }
  },

  async startListening({ onPartial, onFinal, onError, onEnd, language = 'en-US' }) {
    const speech = speechOrThrow();
    if (activeSession) {
      throw new Error('A recording session is already active.');
    }

    const availability = await this.getAvailability();
    if (!availability.available) {
      throw new Error(availability.message);
    }

    const permission = await speech.requestPermissionsAsync();
    if (!permission.granted) {
      throw new Error(
        'Microphone permission was denied. You can type your dream instead, or allow access in ' +
          'Android Settings for this app.',
      );
    }

    const session = {
      subscriptions: [],
      releaseMicrophone: claimMicrophone('phone-native'),
      lastFinalText: null,
      stopped: false,
      restartTimer: null,
      restarts: 0,
      language,
    };
    activeSession = session;

    const startEngine = () => {
      if (session.stopped) return;
      try {
        speech.start({
          lang: session.language,
          interimResults: true,
          continuous: true,
          addsPunctuation: true,
          requiresOnDeviceRecognition: false,
        });
      } catch (error) {
        clearSession(session);
        onError?.(error instanceof Error ? error : new Error('Could not start recording.'));
      }
    };

    session.subscriptions.push(
      speech.addListener('result', (event) => {
        const text = event.results?.[0]?.transcript?.trim() || '';
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

        // ERROR_NO_MATCH and ERROR_SPEECH_TIMEOUT are Android saying "that
        // utterance ended", not "recording failed". While the user has not
        // tapped Stop, restart instead of surfacing an error, so a pause for
        // breath does not end the recording.
        if (!session.stopped && isRecoverable(event.error) && session.restarts < 40) {
          session.restarts += 1;
          session.restartTimer = setTimeout(startEngine, 220);
          return;
        }

        onError?.(translateError(event));
      }),
      speech.addListener('end', () => {
        if (session.stopped) {
          clearSession(session);
          onEnd?.();
          return;
        }
        // Android ends the session after each utterance even in continuous
        // mode on many devices. Keep going until Stop is tapped.
        if (session.restarts < 40) {
          session.restarts += 1;
          session.restartTimer = setTimeout(startEngine, 220);
          return;
        }
        clearSession(session);
        onEnd?.();
      }),
    );

    startEngine();
  },

  async stopListening() {
    const session = activeSession;
    if (!session) return;
    // Mark stopped first so the "end" handler does not restart the engine.
    session.stopped = true;
    if (session.restartTimer) clearTimeout(session.restartTimer);
    try {
      getSpeechModule()?.stop();
    } catch (_error) {
      clearSession(session);
    }
  },

  async cancelListening() {
    const session = activeSession;
    if (!session) return;
    session.stopped = true;
    if (session.restartTimer) clearTimeout(session.restartTimer);
    try {
      getSpeechModule()?.abort();
    } finally {
      clearSession(session);
    }
  },
};

/** android.speech codes that mean "utterance over", not "session broken". */
function isRecoverable(code) {
  return code === 'no-speech' || code === 'speech-timeout' || code === 'no-match';
}

function translateError(event) {
  const map = {
    'not-allowed': 'Microphone permission was denied. You can type your dream instead.',
    'service-not-allowed':
      'Android’s speech service refused the request. Check that a speech service is enabled in ' +
      'Android Settings, or type your dream.',
    'no-speech': 'No speech was detected. Try again, a little closer to the microphone.',
    'speech-timeout': 'The recording went quiet for too long and Android stopped listening.',
    network:
      'Android’s speech service needed the network and could not reach it. Try again, or type ' +
      'your dream.',
    'network-timeout': 'Android’s speech service timed out reaching the network.',
    'language-not-supported':
      'This phone’s speech service does not support that language. Try typing your dream instead.',
    'language-unavailable':
      'That language pack is not installed on this phone. Try typing your dream instead.',
    audio: 'The microphone could not be read. Another app may be using it.',
    busy: 'Android’s speech service is busy. Wait a moment and try again.',
    client: 'Android’s speech service stopped unexpectedly. Try again, or type your dream.',
    server: 'Android’s speech service reported a server error. Try again later, or type your dream.',
  };
  return new Error(map[event.error] || event.message || `Speech recognition error: ${event.error}.`);
}

export default nativeStt;
