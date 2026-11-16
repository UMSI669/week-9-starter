import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { File } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { store, useAppDispatch, useAppSelector } from '../../store';
import { useParseMutation, useTranscribeMutation } from '../../store/voiceApi';
import { resetVoice, voiceAudio, voiceError, voiceReview, voiceStatus, voiceTranscript } from '../../store/voiceSlice';
import { fallbackGroceries } from '../../utils/groceries';
import { safeError } from '../../services/apiErrors';

export function deleteRecording(uri: string | null) {
  if (!uri) return;
  try {
    if (Platform.OS === 'web' && uri.startsWith('blob:')) URL.revokeObjectURL(uri);
    else { const file = new File(uri); if (file.exists) file.delete(); }
  } catch { /* Cache files are also cleaned by the OS. */ }
}

export function useVoiceRecording() {
  const voice = useAppSelector(state => state.voice); const dispatch = useAppDispatch();
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, numberOfChannels: 1, isMeteringEnabled: true });
  const recorderState = useAudioRecorderState(recorder, 200);
  const [transcribe] = useTranscribeMutation(); const [parse] = useParseMutation();
  const [starting, setStarting] = useState(false); const [permissionDenied, setPermissionDenied] = useState(false);
  const [warning, setWarning] = useState(false);
  const operation = useRef(0); const mounted = useRef(true); const stopPending = useRef(false); const recording = useRef(false);
  const pending = useRef<{ abort: () => void } | null>(null);
  const fail = useCallback((error: unknown) => dispatch(voiceError(safeError(error))), [dispatch]);

  const reparse = useCallback(async (transcript: string, token = ++operation.current) => {
    if (!transcript.trim()) { fail(new Error('Enter a transcript before formatting items.')); return; }
    dispatch(voiceStatus('parsing'));
    const request = parse(transcript); pending.current = request;
    try {
      const items = await request.unwrap();
      if (!mounted.current || token !== operation.current) return;
      dispatch(voiceReview({ items }));
    } catch (error) {
      if (!mounted.current || token !== operation.current) return;
      dispatch(voiceReview({ items: fallbackGroceries(transcript), warning: `Automatic formatting failed. ${safeError(error)} Review these recovered items carefully or re-parse.` }));
    } finally { if (token === operation.current) pending.current = null; }
  }, [dispatch, fail, parse]);

  const upload = useCallback(async (uri: string) => {
    const token = ++operation.current;
    dispatch(voiceStatus('transcribing')); const request = transcribe(uri); pending.current = request;
    try {
      const transcript = await request.unwrap();
      if (!mounted.current || token !== operation.current) return;
      dispatch(voiceTranscript(transcript)); await reparse(transcript, token);
    } catch (error) { if (mounted.current && token === operation.current) fail(error); }
    finally { if (token === operation.current) pending.current = null; }
  }, [dispatch, transcribe, reparse, fail]);

  const start = async () => {
    if (starting || recording.current || voice.status === 'transcribing' || voice.status === 'parsing') return;
    const token = ++operation.current;
    setStarting(true); setPermissionDenied(false); setWarning(false); pending.current?.abort();
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!mounted.current || token !== operation.current) return;
      if (!permission.granted) { setPermissionDenied(true); throw new Error('Microphone access is turned off. Allow access in Settings to record your list.'); }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, allowsBackgroundRecording: false });
      if (!mounted.current || token !== operation.current) return;
      await recorder.prepareToRecordAsync();
      if (!mounted.current || token !== operation.current) return;
      deleteRecording(store.getState().voice.audioUri); dispatch(resetVoice());
      recorder.record(); recording.current = true; dispatch(voiceStatus('recording'));
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch (error) {
      if (mounted.current && token === operation.current) {
        if (error instanceof Error && /NotAllowed|Permission/i.test(error.name + error.message)) setPermissionDenied(true);
        fail(error);
      }
    }
    finally { if (mounted.current) setStarting(false); }
  };

  const stop = useCallback(async (background = false) => {
    if (!recording.current || stopPending.current) return;
    stopPending.current = true; recording.current = false;
    try {
      await recorder.stop();
      const uri = recorder.uri;
      await setAudioModeAsync({ allowsRecording: false });
      if (!uri) throw new Error('The recording could not be saved. Please record again.');
      dispatch(voiceAudio(uri));
      if (background || !mounted.current) { dispatch(voiceError('Recording stopped when you left the screen. Your audio is kept; tap Retry transcription.')); }
      else await upload(uri);
    } catch (error) { fail(error); }
    finally { stopPending.current = false; }
  }, [dispatch, fail, recorder, upload]);

  useEffect(() => {
    if (voice.status !== 'recording') return;
    const warningTimer = setTimeout(() => { setWarning(true); void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}); }, 50_000);
    const stopTimer = setTimeout(() => { void stop(); }, 60_000);
    return () => { clearTimeout(warningTimer); clearTimeout(stopTimer); };
  }, [voice.status, stop]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') { operation.current++; pending.current?.abort(); if (recording.current) void stop(true); else if (['transcribing', 'parsing'].includes(store.getState().voice.status)) dispatch(voiceError('Processing paused when the app went into the background. Tap Retry to continue.')); }
    });
    return () => subscription.remove();
  }, [dispatch, stop]);
  useEffect(() => {
    mounted.current = true;
    const session = operation;
    return () => {
      mounted.current = false; session.current++; pending.current?.abort();
      if (recording.current) void stop(true);
      else if (['transcribing', 'parsing'].includes(store.getState().voice.status)) dispatch(voiceError('Processing paused. Tap Retry to continue.'));
    };
  }, [dispatch, stop]);

  const discard = async () => {
    operation.current++; pending.current?.abort();
    if (recording.current) {
      recording.current = false;
      try { await recorder.stop(); deleteRecording(recorder.uri); } catch { /* The recorder may already be stopped. */ }
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    }
    deleteRecording(store.getState().voice.audioUri); dispatch(resetVoice());
  };
  return { voice, start, stop, upload, reparse, discard, starting, permissionDenied, warning,
    seconds: Math.min(60, Math.floor(recorderState.durationMillis / 1000)), level: recorderState.metering ?? -55 };
}
