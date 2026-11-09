/**
 * The dream-capture state machine.
 *
 *   idle -> requesting-permission -> recording -> transcribing
 *        -> reviewing-transcript -> analyzing -> reviewing-card
 *        -> saving -> saved
 *
 * Guarantees this hook is responsible for:
 *  - recording starts only from an explicit call, never on mount
 *  - a 3-minute cap stops the recording and KEEPS what was transcribed
 *  - navigating away or backgrounding the app stops the microphone
 *  - subscriptions, the microphone claim, and temporary audio files are
 *    released on every exit path, including errors
 *  - a recoverable error never discards a usable transcript draft
 *  - audio is never uploaded unless the user chose cloud mode first
 *  - exactly one microphone consumer at a time (see stt/micLock.js)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { setAudioModeAsync, useAudioStream } from 'expo-audio';
import { File } from 'expo-file-system';
import { TRANSCRIPTION_MODES, cloudStt, nativeStt } from '../services/stt';
import { claimMicrophone, safeErrorMessage } from '../services/stt/micLock';

export const MAX_RECORDING_MS = 180_000;
/** Native mode gives up if nothing at all is heard in this long. */
export const SILENCE_TIMEOUT_MS = 12_000;

export const CAPTURE_STATES = {
  IDLE: 'idle',
  REQUESTING_PERMISSION: 'requesting-permission',
  RECORDING: 'recording',
  TRANSCRIBING: 'transcribing',
  REVIEWING_TRANSCRIPT: 'reviewing-transcript',
  ANALYZING: 'analyzing',
  REVIEWING_CARD: 'reviewing-card',
  SAVING: 'saving',
  SAVED: 'saved',
};

export function useDreamCapture({ mode }) {
  const isCloud = mode === TRANSCRIPTION_MODES.CLOUD;

  // Only created for cloud mode, but the hook must be called unconditionally.
  const { stream } = useAudioStream({ sampleRate: 16_000, channels: 1, encoding: 'int16' });

  const [state, setState] = useState(CAPTURE_STATES.IDLE);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [partial, setPartial] = useState('');
  const [finalSegments, setFinalSegments] = useState([]);
  const [durationMs, setDurationMs] = useState(0);
  const [recordingInfo, setRecordingInfo] = useState(null);

  const ownerRef = useRef(Symbol('dream-capture'));
  const releaseMicRef = useRef(null);
  const recordingUriRef = useRef(null);
  const startedAtRef = useRef(null);
  const maxTimerRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const heardSomethingRef = useRef(false);
  const abortRef = useRef(null);

  /**
   * The current state, readable from callbacks and native listeners without
   * re-creating them. Synced in an effect rather than during render: the
   * listeners that read it only ever fire after the commit.
   */
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  /* -------------------------------- timers -------------------------------- */

  useEffect(() => {
    if (state !== CAPTURE_STATES.RECORDING) return undefined;
    const timer = setInterval(() => {
      setDurationMs(Date.now() - (startedAtRef.current || Date.now()));
    }, 200);
    return () => clearInterval(timer);
  }, [state]);

  const clearTimers = useCallback(() => {
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    maxTimerRef.current = null;
    silenceTimerRef.current = null;
  }, []);

  /* ------------------------------- teardown ------------------------------- */

  const releaseAudio = useCallback(
    async (deleteRecording) => {
      clearTimers();

      try {
        await nativeStt.cancelListening();
      } catch (_error) {
        // Already stopped.
      }

      if (isCloud) {
        try {
          stream.stop();
        } catch (_error) {
          // The stream may already have stopped on a permission error.
        }
      }

      const uri = recordingUriRef.current;
      if (deleteRecording && uri) {
        recordingUriRef.current = null;
        try {
          const file = new File(uri);
          if (file.exists) file.delete();
        } catch (_error) {
          // Temporary file cleanup is best-effort.
        }
      }

      releaseMicRef.current?.();
      releaseMicRef.current = null;

      try {
        if (isCloud) await setAudioModeAsync({ allowsRecording: false });
      } catch (_error) {
        // Restoring the audio mode is best-effort.
      }
    },
    [clearTimers, isCloud, stream],
  );

  /** Full stop that keeps whatever text exists. Used by interruptions. */
  const stopForInterruption = useCallback(
    async (message) => {
      if (
        stateRef.current !== CAPTURE_STATES.RECORDING &&
        stateRef.current !== CAPTURE_STATES.REQUESTING_PERMISSION
      ) {
        return;
      }
      await releaseAudio(true);
      setState((current) =>
        // Keep a transcript if one was gathered; otherwise go back to idle.
        current === CAPTURE_STATES.RECORDING ? CAPTURE_STATES.REVIEWING_TRANSCRIPT : CAPTURE_STATES.IDLE,
      );
      setPartial('');
      if (message) setNotice(message);
    },
    [releaseAudio],
  );

  // Stop the microphone when the screen loses focus. Nothing keeps recording
  // in the background.
  useFocusEffect(
    useCallback(
      () => () => {
        void stopForInterruption('Recording stopped because you left the screen.');
      },
      [stopForInterruption],
    ),
  );

  // Stop on a phone call, another app taking the microphone, or backgrounding.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') {
        void stopForInterruption('Recording stopped because the app went to the background.');
      }
    });
    return () => subscription.remove();
  }, [stopForInterruption]);

  // Last-resort cleanup if the component unmounts mid-session.
  useEffect(
    () => () => {
      abortRef.current?.abort();
      void releaseAudio(true);
    },
    [releaseAudio],
  );

  /* ------------------------------- recording ------------------------------ */

  const transcript = [...finalSegments].join(' ').replace(/\s+/g, ' ').trim();

  const stopRecording = useCallback(async () => {
    if (stateRef.current !== CAPTURE_STATES.RECORDING) return;
    clearTimers();

    if (isCloud) {
      const uri = recordingUriRef.current;
      setState(CAPTURE_STATES.TRANSCRIBING);
      // Release the microphone before the upload: the mic is not needed for it,
      // and holding it would block another recording.
      try {
        stream.stop();
      } catch (_error) {
        // Already stopped.
      }
      releaseMicRef.current?.();
      releaseMicRef.current = null;

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const result = await cloudStt.transcribeFile({
          uri,
          durationMs: Date.now() - (startedAtRef.current || Date.now()),
          signal: controller.signal,
        });
        setFinalSegments([result.transcript]);
        setRecordingInfo({
          filename: result.filename,
          mimeType: result.mimeType,
          sizeBytes: result.sizeBytes,
          model: result.model,
        });
        setState(CAPTURE_STATES.REVIEWING_TRANSCRIPT);
      } catch (caughtError) {
        if (caughtError?.name === 'AbortError') {
          setState(CAPTURE_STATES.IDLE);
          return;
        }
        setError(safeErrorMessage(caughtError, 'The upload could not be transcribed.'));
        // Straight to review so the dream can still be typed out by hand.
        setState(CAPTURE_STATES.REVIEWING_TRANSCRIPT);
      } finally {
        abortRef.current = null;
        await releaseAudio(true);
      }
      return;
    }

    // Native mode: stopListening triggers onEnd, which moves to review.
    try {
      await nativeStt.stopListening();
    } catch (_error) {
      // Fall through: onEnd may not fire if the session already ended.
    }
    setState(CAPTURE_STATES.REVIEWING_TRANSCRIPT);
    await releaseAudio(true);
  }, [clearTimers, isCloud, releaseAudio, stream]);

  const startRecording = useCallback(async () => {
    if (stateRef.current === CAPTURE_STATES.RECORDING) return;

    setError('');
    setNotice('');
    setPartial('');
    setFinalSegments([]);
    setDurationMs(0);
    setRecordingInfo(null);
    heardSomethingRef.current = false;
    setState(CAPTURE_STATES.REQUESTING_PERMISSION);

    try {
      if (isCloud) {
        releaseMicRef.current = claimMicrophone(ownerRef.current);
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await stream.start();
        const recording = await stream.startFileRecordingAsync({ format: 'wav' });
        recordingUriRef.current = recording.uri;
      } else {
        await nativeStt.startListening({
          onPartial: (text) => {
            heardSomethingRef.current = true;
            if (silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current);
              silenceTimerRef.current = null;
            }
            setPartial(text);
          },
          onFinal: ({ transcript: text }) => {
            heardSomethingRef.current = true;
            // Finals accumulate; partials are discarded once a final arrives.
            setFinalSegments((segments) => [...segments, text]);
            setPartial('');
          },
          onError: (recognitionError) => {
            setError(safeErrorMessage(recognitionError, 'Transcription failed.'));
            void releaseAudio(true);
            // Whatever was already recognized stays on screen to edit.
            setState((current) =>
              current === CAPTURE_STATES.RECORDING
                ? CAPTURE_STATES.REVIEWING_TRANSCRIPT
                : CAPTURE_STATES.IDLE,
            );
            setPartial('');
          },
          onEnd: () => {
            if (stateRef.current === CAPTURE_STATES.RECORDING) {
              void releaseAudio(true);
              setState(CAPTURE_STATES.REVIEWING_TRANSCRIPT);
              setPartial('');
            }
          },
        });
      }

      startedAtRef.current = Date.now();
      setState(CAPTURE_STATES.RECORDING);

      // Hard 3-minute cap. Stops cleanly and keeps the text.
      maxTimerRef.current = setTimeout(() => {
        setNotice('Reached the 3 minute limit, so recording stopped. Your text is below.');
        void stopRecording();
      }, MAX_RECORDING_MS);

      // Native mode only: if nothing is heard at all, say so rather than
      // leaving the user staring at a running timer.
      if (!isCloud) {
        silenceTimerRef.current = setTimeout(() => {
          if (!heardSomethingRef.current) {
            setNotice(
              'Nothing was heard yet. Keep talking, or stop and type the dream instead.',
            );
          }
        }, SILENCE_TIMEOUT_MS);
      }
    } catch (caughtError) {
      await releaseAudio(true);
      setState(CAPTURE_STATES.IDLE);
      if (caughtError?.name === 'AbortError') return;
      setError(safeErrorMessage(caughtError, 'Recording could not be started.'));
    }
  }, [isCloud, releaseAudio, stopRecording, stream]);

  const cancel = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = null;
    await releaseAudio(true);
    setState(CAPTURE_STATES.IDLE);
    setPartial('');
    setFinalSegments([]);
    setDurationMs(0);
    setError('');
    setNotice('');
    setRecordingInfo(null);
  }, [releaseAudio]);

  /** Jumps straight to the editable transcript with no microphone at all. */
  const startTyping = useCallback(() => {
    setError('');
    setNotice('');
    setState(CAPTURE_STATES.REVIEWING_TRANSCRIPT);
  }, []);

  return {
    state,
    setState,
    error,
    setError,
    notice,
    setNotice,
    partial,
    transcript,
    setTranscript: (text) => setFinalSegments([text]),
    durationMs,
    recordingInfo,
    startRecording,
    stopRecording,
    cancel,
    startTyping,
    isRecording: state === CAPTURE_STATES.RECORDING,
    remainingMs: Math.max(0, MAX_RECORDING_MS - durationMs),
  };
}

export default useDreamCapture;
