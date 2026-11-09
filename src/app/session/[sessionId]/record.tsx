import {
  AudioModule,
  AudioQuality,
  IOSOutputFormat,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
} from 'expo-audio';
import { File } from 'expo-file-system';
import { router, useLocalSearchParams, usePreventRemove } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Text, View } from 'react-native';
import { Banner, Body, Button, ButtonRow, Card, colors, Screen } from '../../../components/ui';
import { storeRecording } from '../../../services/audio/audioFiles';
import { MVP } from '../../../services/runtime';
import { deleteAudioFile } from '../../../services/storage/vault';
import { useAppDispatch, useAppSelector } from '../../../store';
import { dataActions } from '../../../store/dataSlice';
import { formatMs } from '../../../utils/ids';
import { safeErrorMessage } from '../../../utils/safeError';

/**
 * 16 kHz mono 16-bit PCM WAV on iOS: the format both Apple file recognition
 * and whisper.rn accept directly (≈115 MB per hour). Android falls back to AAC.
 */
const INTERVIEW_WAV: RecordingOptions = {
  extension: '.wav',
  sampleRate: 16_000,
  numberOfChannels: 1,
  bitRate: 256_000,
  isMeteringEnabled: true,
  ios: {
    extension: '.wav',
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.MAX,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  android: { extension: '.m4a', outputFormat: 'mpeg4', audioEncoder: 'aac' },
  web: {},
};

function discardTempRecording(uri: string | null) {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // best effort
  }
}

export default function RecordScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const dispatch = useAppDispatch();
  const session = useAppSelector((s) => s.data.sessions[sessionId]);
  const recorder = useAudioRecorder(INTERVIEW_WAV);
  const state = useAudioRecorderState(recorder, 250);
  const [phase, setPhase] = useState<'idle' | 'recording' | 'paused' | 'saving'>('idle');
  const [error, setError] = useState('');
  const [denied, setDenied] = useState(false);

  // Discard an unsaved recording only after confirmation if the screen is left mid-recording.
  usePreventRemove(phase === 'recording' || phase === 'paused', ({ repeat }) => {
    Alert.alert('Discard recording?', 'The recording has not been saved.', [
      { text: 'Keep recording', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: async () => {
          await recorder.stop().catch(() => undefined);
          discardTempRecording(recorder.uri);
          setPhase('idle');
          repeat();
        },
      },
    ]);
  });

  const start = async () => {
    setError('');
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setDenied(true);
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, allowsBackgroundRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setPhase('recording');
    } catch (e) {
      setError(safeErrorMessage(e, 'Could not start recording.'));
    }
  };

  const stopAndSave = async () => {
    setPhase('saving');
    try {
      const duration = state.durationMillis;
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (!recorder.uri) throw new Error('The recording file was not created.');
      if (session?.audio?.uri) deleteAudioFile(session.audio.uri);
      const audio = storeRecording(sessionId, recorder.uri, duration);
      dispatch(dataActions.sessionAudioSet({ id: sessionId, audio }));
      setPhase('idle');
      setTimeout(() => router.back(), 0);
    } catch (e) {
      setError(safeErrorMessage(e, 'Could not save the recording.'));
      setPhase('idle');
    }
  };

  // Hard stop at the supported maximum length (reacting to the native recorder's clock).
  const overLimit = phase === 'recording' && state.durationMillis > MVP.maxRecordingMinutes * 60_000;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (overLimit) void stopAndSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overLimit]);

  const level = state.metering !== undefined ? Math.max(0, Math.min(1, (state.metering + 60) / 60)) : 0;

  return (
    <Screen>
      <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
        <Text style={{ fontSize: 48, fontWeight: '300', fontVariant: ['tabular-nums'], color: colors.ink }} accessibilityLiveRegion="polite">
          {formatMs(state.durationMillis)}
        </Text>
        <View style={{ height: 8, width: '80%', backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' }}>
          <View style={{ height: 8, width: `${level * 100}%`, backgroundColor: phase === 'recording' ? colors.danger : colors.faint }} />
        </View>
        <Body muted>
          {phase === 'recording' ? 'Recording… keeps going if the screen locks.' : phase === 'paused' ? 'Paused' : 'Ready'}
        </Body>
      </Card>

      {denied ? (
        <Banner tone="danger" title="Microphone access is off">
          <Body>Allow microphone access for Interview Lens in iOS Settings to record interviews.</Body>
          <Button small variant="secondary" title="Open Settings" onPress={() => void Linking.openSettings()} />
        </Banner>
      ) : null}
      {error ? <Banner tone="danger">{error}</Banner> : null}

      {phase === 'idle' ? (
        <Button title="Start recording" onPress={start} />
      ) : (
        <ButtonRow>
          {phase === 'recording' ? (
            <Button
              variant="secondary"
              title="Pause"
              onPress={() => {
                recorder.pause();
                setPhase('paused');
              }}
            />
          ) : phase === 'paused' ? (
            <Button
              variant="secondary"
              title="Resume"
              onPress={() => {
                recorder.record();
                setPhase('recording');
              }}
            />
          ) : null}
          <Button title="Stop & save" onPress={stopAndSave} loading={phase === 'saving'} />
        </ButtonRow>
      )}

      <Body muted>
        Get the participant’s consent before recording. Audio is saved as WAV in the app’s private storage and is never uploaded.
        Recommended length up to {MVP.recommendedRecordingMinutes} minutes; recording stops automatically at {MVP.maxRecordingMinutes}.
        Simulators have no real microphone, so use bundled samples there and validate recording on an iPhone.
      </Body>
    </Screen>
  );
}
