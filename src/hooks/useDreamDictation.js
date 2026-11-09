import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import { isSpeechAvailable, speechModule, speechUnavailableReason } from '../speech/speechRecognition';

// Recording states shown on the Speak a Dream screen.
//   unavailable – no speech module (Expo Go) or no recognizer on this device
//   idle        – ready to listen
//   requesting  – asking for microphone / speech permission
//   listening   – microphone is on, live text is arriving
//   stopping    – user pressed stop, waiting for the final words
export const DictationStatus = {
  unavailable: 'unavailable',
  idle: 'idle',
  requesting: 'requesting',
  listening: 'listening',
  stopping: 'stopping',
};

const STOP_TIMEOUT_MS = 4000;
const FOREGROUND_TIMEOUT_MS = 5000;

function joinText(...parts) {
  return parts
    .map((part) => (part || '').trim())
    .filter(Boolean)
    .join(' ');
}

const ERROR_MESSAGES = {
  'not-allowed': 'Microphone or speech permission is off.',
  'no-speech': "I didn't catch anything. Try again a little closer to the phone.",
  'speech-timeout': "I didn't catch anything. Try again a little closer to the phone.",
  'audio-capture': 'The microphone could not be used. Close other apps that use it and try again.',
  interrupted: 'Listening stopped because something else used the audio (a call, Siri or an alarm).',
  network: 'Speech recognition needs a network connection right now. Check your connection and try again.',
  'service-not-allowed': 'Speech recognition is turned off or unavailable on this device.',
  'language-not-supported': 'English speech recognition is not available on this device.',
  busy: 'Speech recognition is busy. Wait a moment and try again.',
};

function toFriendlyError(code, message) {
  return {
    kind: code === 'not-allowed' ? 'permission' : 'speech',
    message: ERROR_MESSAGES[code] || message || 'Something went wrong while listening. Please try again.',
  };
}

// iOS can report "permission granted" before the permission dialog has fully
// closed. Starting the microphone at that moment fails, so wait until the app
// is active again (same idea as the course demo).
function waitUntilActive() {
  return new Promise((resolve) => {
    if (AppState.currentState === 'active') {
      resolve();
      return;
    }
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') finish();
    });
    const timeout = setTimeout(finish, FOREGROUND_TIMEOUT_MS);
    function finish() {
      clearTimeout(timeout);
      subscription.remove();
      requestAnimationFrame(() => resolve());
    }
  });
}

export function useDreamDictation() {
  const [status, setStatus] = useState(() =>
    isSpeechAvailable() ? DictationStatus.idle : DictationStatus.unavailable,
  );
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const statusRef = useRef(status);
  const sessionRef = useRef(null);

  const updateStatus = useCallback((next) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  // Ends the current session once: removes listeners and keeps any words
  // that arrived without a final result.
  const finishSession = useCallback(
    (session) => {
      if (!session || session.finished) return;
      session.finished = true;
      clearTimeout(session.stopTimer);
      session.subscriptions.forEach((subscription) => subscription.remove());
      if (session.segment) {
        const pending = session.segment;
        setTranscript((current) => joinText(current, pending));
      }
      if (sessionRef.current === session) sessionRef.current = null;
      setInterim('');
      updateStatus(DictationStatus.idle);
    },
    [updateStatus],
  );

  const start = useCallback(async () => {
    if (!speechModule || statusRef.current !== DictationStatus.idle) return;
    setError(null);
    updateStatus(DictationStatus.requesting);

    try {
      const permission = await speechModule.requestPermissionsAsync();
      if (!permission.granted) {
        setError({
          kind: 'permission',
          canAskAgain: permission.canAskAgain !== false,
          message: 'Dream Journal needs microphone and speech-recognition permission to hear you.',
        });
        updateStatus(DictationStatus.idle);
        return;
      }
      if (!isSpeechAvailable()) {
        setError(toFriendlyError('service-not-allowed'));
        updateStatus(DictationStatus.idle);
        return;
      }

      await waitUntilActive();

      const session = { subscriptions: [], segment: '', finished: false, stopTimer: null };
      sessionRef.current = session;

      session.subscriptions.push(
        speechModule.addListener('result', (event) => {
          if (session.finished) return;
          const text = event.results?.[0]?.transcript?.trim() || '';
          if (event.isFinal) {
            session.segment = '';
            setInterim('');
            if (text) setTranscript((current) => joinText(current, text));
          } else {
            session.segment = text;
            setInterim(text);
          }
        }),
        speechModule.addListener('error', (event) => {
          if (session.finished || event.error === 'aborted') return;
          setError(toFriendlyError(event.error, event.message));
          finishSession(session);
        }),
        speechModule.addListener('end', () => finishSession(session)),
      );

      speechModule.start({
        lang: 'en-US',
        interimResults: true,
        continuous: true,
        addsPunctuation: true,
        iosTaskHint: 'dictation',
        requiresOnDeviceRecognition: false,
      });
      setElapsedMs(0);
      session.startedAt = Date.now();
      updateStatus(DictationStatus.listening);
    } catch (caught) {
      setError({ kind: 'speech', message: caught?.message || 'Could not start listening. Please try again.' });
      finishSession(sessionRef.current);
      updateStatus(DictationStatus.idle);
    }
  }, [finishSession, updateStatus]);

  const stop = useCallback(() => {
    const session = sessionRef.current;
    if (!session || statusRef.current !== DictationStatus.listening) return;
    updateStatus(DictationStatus.stopping);
    try {
      speechModule.stop();
    } catch {
      finishSession(session);
      return;
    }
    // If the recognizer never reports "end", stop waiting and keep the words we have.
    session.stopTimer = setTimeout(() => {
      try {
        speechModule.abort();
      } catch {
        // Already stopped.
      }
      finishSession(session);
    }, STOP_TIMEOUT_MS);
  }, [finishSession, updateStatus]);

  // Elapsed-time counter while listening.
  useEffect(() => {
    if (status !== DictationStatus.listening) return undefined;
    const startedAt = sessionRef.current?.startedAt ?? Date.now();
    const timer = setInterval(() => setElapsedMs(Date.now() - startedAt), 500);
    return () => clearInterval(timer);
  }, [status]);

  // Turn the microphone off if the screen goes away mid-recording.
  useEffect(
    () => () => {
      const session = sessionRef.current;
      if (!session) return;
      session.finished = true;
      session.subscriptions.forEach((subscription) => subscription.remove());
      try {
        speechModule?.abort();
      } catch {
        // Nothing to stop.
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setTranscript('');
    setInterim('');
    setError(null);
    setElapsedMs(0);
  }, []);

  return {
    status,
    isBusy: status === DictationStatus.requesting || status === DictationStatus.listening || status === DictationStatus.stopping,
    unavailableReason:
      status === DictationStatus.unavailable
        ? speechUnavailableReason || 'Speech recognition is not available on this device. You can still type your dream below.'
        : null,
    transcript,
    setTranscript,
    interim,
    error,
    clearError: () => setError(null),
    elapsedMs,
    start,
    stop,
    reset,
    openSettings: () => Linking.openSettings().catch(() => {}),
  };
}
