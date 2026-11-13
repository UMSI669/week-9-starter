// Microphone -> WAV file -> OpenRouter transcript.
// Adapted from the Voice-To-Text demo's useMicrophoneTranscription hook, without
// Redux logging or router focus handling. It hands the transcript to
// `onTranscript`; parsing and scoring happen in the caller.
import { AudioModule, setAudioModeAsync, useAudioStream } from 'expo-audio';
import { File } from 'expo-file-system';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getAudioFileMetadata, safeErrorMessage } from '../services/audio/recording';
import { cloudStt } from '../services/stt/cloudStt';
import { openRouterConfig } from '../services/stt/openRouterConfig';

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RECORDING_MS = 10_000;

export function useVoiceAnswer({ onTranscript, onError }) {
  const { stream } = useAudioStream({ sampleRate: 16_000, channels: 1, encoding: 'int16' });
  const [status, setStatus] = useState('idle'); // idle | starting | recording | processing
  const statusRef = useRef('idle');
  const recordingUriRef = useRef(null);
  const abortControllerRef = useRef(null);
  const autoStopRef = useRef(null);
  const sessionRef = useRef(0);
  const stopRef = useRef(null);
  const handlersRef = useRef({ onTranscript, onError });
  useLayoutEffect(() => {
    handlersRef.current = { onTranscript, onError };
  });

  const updateStatus = useCallback((next) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const releaseAudio = useCallback(() => {
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    autoStopRef.current = null;
    try {
      stream.stop();
    } catch {
      // The stream may already be stopped.
    }
    const uri = recordingUriRef.current;
    recordingUriRef.current = null;
    if (uri) {
      try {
        const file = new File(uri);
        if (file.exists) file.delete();
      } catch {
        // Temporary recordings are best-effort cleanup.
      }
    }
  }, [stream]);

  // Stops any recording or request in progress. Its result is ignored.
  const cancel = useCallback(() => {
    sessionRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    releaseAudio();
    updateStatus('idle');
  }, [releaseAudio, updateStatus]);

  useEffect(() => cancel, [cancel]);

  // Resolves once recording has started. Throws if the mic cannot be opened.
  const start = useCallback(async () => {
    if (statusRef.current !== 'idle') return false;
    const session = sessionRef.current + 1;
    sessionRef.current = session;
    updateStatus('starting');
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) throw new Error('Microphone permission was denied.');
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      if (sessionRef.current !== session) return false;
      await stream.start();
      const recording = await stream.startFileRecordingAsync({ format: 'wav' });
      recordingUriRef.current = recording.uri;
      if (sessionRef.current !== session) {
        releaseAudio();
        return false;
      }
      updateStatus('recording');
      autoStopRef.current = setTimeout(() => stopRef.current?.(), MAX_RECORDING_MS);
      return true;
    } catch (error) {
      if (sessionRef.current === session) {
        releaseAudio();
        updateStatus('idle');
      }
      throw new Error(safeErrorMessage(error, 'Could not start the microphone.'));
    }
  }, [releaseAudio, stream, updateStatus]);

  // Ends a transcription session once; later calls for the same session do nothing.
  const finish = useCallback((session, timeout) => {
    clearTimeout(timeout);
    if (sessionRef.current !== session || statusRef.current === 'idle') return;
    abortControllerRef.current = null;
    releaseAudio();
    updateStatus('idle');
  }, [releaseAudio, updateStatus]);

  // Stops recording (by the button or the 10-second limit) and reports the
  // transcript or error through the callbacks. Canceled sessions report nothing.
  const stopAndTranscribe = useCallback(async () => {
    if (statusRef.current !== 'recording') return;
    const session = sessionRef.current;
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    autoStopRef.current = null;
    updateStatus('processing');

    const controller = new AbortController();
    abortControllerRef.current = controller;
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
      const recording = await stream.stopFileRecordingAsync();
      recordingUriRef.current = recording.uri;
      stream.stop();
      if (sessionRef.current !== session) return;

      const { filename, mimeType } = getAudioFileMetadata(recording.uri);
      const response = await cloudStt.transcribeFile({
        uri: recording.uri,
        filename,
        mimeType,
        model: openRouterConfig.sttModel,
        signal: controller.signal,
      });
      if (sessionRef.current !== session) return;
      finish(session, timeout);
      handlersRef.current.onTranscript?.(response.transcript || '');
    } catch (error) {
      if (sessionRef.current !== session) return;
      finish(session, timeout);
      if (!timedOut && error?.name === 'AbortError') return;
      handlersRef.current.onError?.(
        timedOut ? 'That took too long. Try again.' : safeErrorMessage(error),
      );
    } finally {
      finish(session, timeout);
    }
  }, [finish, stream, updateStatus]);

  useLayoutEffect(() => {
    stopRef.current = stopAndTranscribe;
  }, [stopAndTranscribe]);

  return { status, start, stopAndTranscribe, cancel };
}
