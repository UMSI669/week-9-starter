import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { AudioPlayerBar, useSessionPlayer } from '../../../components/AudioPlayerBar';
import { RuntimeBanner, TranscriptSourceLabel } from '../../../components/RuntimeBanner';
import { Banner, Body, Button, ButtonRow, Card, colors, Empty, Field, ListItem, Pill, ProgressBar, Screen, SectionTitle, Segmented } from '../../../components/ui';
import { importAudioFile, isWav, localFileUri } from '../../../services/audio/audioFiles';
import { runtimeMode } from '../../../services/runtime';
import { ENGINES, type EngineId } from '../../../services/transcription';
import type { EngineAvailability } from '../../../services/transcription/types';
import { useAppDispatch, useAppSelector } from '../../../store';
import { dataActions } from '../../../store/dataSlice';
import { settingsActions } from '../../../store/settingsSlice';
import { deleteSession } from '../../../store/thunks';
import { deleteAudioFile } from '../../../services/storage/vault';
import { isAbortError, safeErrorMessage } from '../../../utils/safeError';
import { sessionStatus } from '../../../utils/status';

export default function SessionScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const dispatch = useAppDispatch();
  const session = useAppSelector((s) => s.data.sessions[sessionId]);
  const settings = useAppSelector((s) => s.settings);
  const { player, status } = useSessionPlayer(session?.audio);

  const [availability, setAvailability] = useState<EngineAvailability | null>(null);
  const [phase, setPhase] = useState<'idle' | 'running' | 'error'>('idle');
  const [progress, setProgress] = useState<number | null>(null);
  const [partial, setPartial] = useState('');
  const [error, setError] = useState('');
  const controllerRef = useRef<AbortController | null>(null);

  const engine = ENGINES[settings.engine];
  useEffect(() => {
    let current = true;
    engine
      .checkAvailability(settings.whisperModel)
      .then((a) => current && setAvailability(a))
      .catch((e) => current && setAvailability({ available: false, reason: safeErrorMessage(e) }));
    return () => {
      current = false;
    };
  }, [engine, settings.whisperModel]);

  useFocusEffect(
    useCallback(
      () => () => {
        controllerRef.current?.abort();
        player.pause();
      },
      [player],
    ),
  );

  if (!session) {
    return (
      <Screen>
        <Empty title="Interview not found" />
      </Screen>
    );
  }

  const st = sessionStatus(session);
  const redaction = session.redaction;
  const editedCount = session.segments.filter((s) => s.edited).length;

  const transcribe = async () => {
    if (!session.audio) return;
    if (!availability?.available) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setPhase('running');
    setError('');
    setPartial('');
    setProgress(null);
    player.pause();
    try {
      if (engine.id === 'whisper-on-device' && !isWav(session.audio)) {
        throw new Error('Whisper needs a WAV file. Use Apple on-device speech for this file, or import a WAV.');
      }
      const uri = await localFileUri(session.audio);
      const result = await engine.transcribeFile({
        uri,
        durationMs: session.audio.durationMs ?? (status.duration ? status.duration * 1000 : undefined),
        signal: controller.signal,
        onProgress: setProgress,
        onPartial: setPartial,
        modelId: settings.whisperModel,
      });
      dispatch(
        dataActions.transcriptReplaced({
          id: session.id,
          source: engine.id === 'apple-on-device' ? 'apple-on-device' : 'whisper-on-device',
          model: result.model + (result.approximateTimestamps ? ' (approximate timestamps)' : ''),
          segments: result.segments,
        }),
      );
      setPhase('idle');
    } catch (e) {
      if (isAbortError(e)) {
        setPhase('idle');
        return;
      }
      // Local recognition failed: stop here. Nothing is uploaded as a fallback.
      setError(safeErrorMessage(e, 'On-device transcription failed.'));
      setPhase('error');
    } finally {
      controllerRef.current = null;
      setProgress(null);
    }
  };

  const confirmTranscribe = () => {
    if (session.segments.length === 0) return void transcribe();
    Alert.alert('Replace transcript?', 'Re-transcribing replaces corrections, privacy review and analysis for this interview.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Replace', style: 'destructive', onPress: () => void transcribe() },
    ]);
  };

  const replaceAudio = async () => {
    try {
      const audio = await importAudioFile(session.id);
      if (!audio) return;
      if (session.audio?.uri && session.audio.uri !== audio.uri) deleteAudioFile(session.audio.uri);
      dispatch(dataActions.sessionAudioSet({ id: session.id, audio }));
    } catch (e) {
      Alert.alert('Import failed', safeErrorMessage(e));
    }
  };

  const confirmDelete = () =>
    Alert.alert('Delete interview?', 'Deletes the audio, transcript, identity mapping and analysis from this iPhone. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          dispatch(deleteSession(session.id));
          router.back();
        },
      },
    ]);

  const canTranscribeHere = runtimeMode === 'full';

  return (
    <Screen>
      <Stack.Screen options={{ title: session.participantLabel }} />
      {session.isDemo ? <RuntimeBanner /> : null}

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Pill label={st.label} tone={st.tone} />
          {session.isDemo ? <Pill label="Synthetic sample" tone="demo" /> : null}
        </View>
        <Field label="Title (local only)" value={session.title} onChangeText={(title) => dispatch(dataActions.sessionMetaUpdated({ id: session.id, changes: { title } }))} />
        <Field
          label="Participant label"
          value={session.participantLabel}
          autoCapitalize="characters"
          onChangeText={(participantLabel) => dispatch(dataActions.sessionMetaUpdated({ id: session.id, changes: { participantLabel } }))}
        />
      </Card>

      <Card>
        <SectionTitle>1 · Audio</SectionTitle>
        {session.audio ? (
          <>
            <AudioPlayerBar
              player={player}
              status={status}
              label={
                session.audio.kind === 'bundled-sample'
                  ? 'Bundled synthetic sample'
                  : session.audio.kind === 'recorded'
                    ? 'Recorded on this iPhone'
                    : `Imported · ${session.audio.originalFilename ?? 'audio'} (name stays on device)`
              }
            />
          </>
        ) : (
          <Body muted>No audio yet.</Body>
        )}
        {session.audio?.kind !== 'bundled-sample' ? (
          <ButtonRow>
            <Button small variant="secondary" title={session.audio ? 'Re-record' : 'Record'} onPress={() => router.push({ pathname: '/session/[sessionId]/record', params: { sessionId } })} />
            <Button small variant="secondary" title={session.audio ? 'Replace file' : 'Import file'} onPress={replaceAudio} />
          </ButtonRow>
        ) : null}
      </Card>

      <Card>
        <SectionTitle>2 · Transcribe on device</SectionTitle>
        <TranscriptSourceLabel source={session.transcriptSource} model={session.transcriptModel} />
        {!canTranscribeHere ? (
          <Banner tone="demo" title="Not available in Expo Go">
            {session.transcriptSource === 'demo-sample'
              ? 'This sample already has a pre-written sample transcript. Real on-device transcription runs in the development build.'
              : 'On-device speech recognition needs the development build. Audio is never uploaded instead. You can type or paste a transcript.'}
          </Banner>
        ) : (
          <>
            <Segmented<EngineId>
              options={[
                { value: 'apple-on-device', label: 'Apple on-device' },
                { value: 'whisper-on-device', label: 'Whisper' },
              ]}
              value={settings.engine}
              onChange={(engineId) => dispatch(settingsActions.settingsChanged({ engine: engineId }))}
            />
            <Body muted>{engine.description}</Body>
            {availability && !availability.available ? <Banner tone="warning">{availability.reason ?? 'Unavailable.'}</Banner> : null}
            {phase === 'running' ? (
              <View style={{ gap: 8 }}>
                <ProgressBar value={progress} />
                {partial ? (
                  <Text numberOfLines={3} style={{ color: colors.muted, fontStyle: 'italic' }}>
                    {partial}
                  </Text>
                ) : null}
                <Button variant="secondary" title="Cancel" onPress={() => controllerRef.current?.abort()} />
              </View>
            ) : (
              <Button
                title={session.segments.length ? 'Re-transcribe' : 'Transcribe'}
                onPress={confirmTranscribe}
                disabled={!session.audio || !availability?.available}
              />
            )}
            {phase === 'error' ? <Banner tone="danger" title="Transcription stopped">{`${error} No audio was uploaded.`}</Banner> : null}
          </>
        )}
      </Card>

      <Card>
        <SectionTitle>3 · Review & analyze</SectionTitle>
        <ListItem
          title="Transcript"
          subtitle={session.segments.length ? `${session.segments.length} segments · ${editedCount} corrected` : 'Add or type a transcript'}
          onPress={() => router.push({ pathname: '/session/[sessionId]/transcript', params: { sessionId } })}
        />
        <ListItem
          title="Privacy review"
          subtitle={
            !redaction
              ? 'Detect and mask identifying details'
              : redaction.reviewedAt
                ? `Reviewed · ${redaction.spans.filter((s) => s.status === 'accepted').length} masked`
                : `${redaction.spans.length} detections awaiting review`
          }
          right={redaction?.reviewedAt ? <Pill label="Approved" tone="success" /> : undefined}
          onPress={() => router.push({ pathname: '/session/[sessionId]/privacy', params: { sessionId } })}
        />
        <ListItem
          title="Cloud analysis"
          subtitle={session.analysis ? `${session.analysis.codes.length} codes · ${session.analysis.themes.length} themes` : 'Codes, themes, summary, quotes'}
          onPress={() => router.push({ pathname: '/session/[sessionId]/analysis', params: { sessionId } })}
        />
        <ListItem title="Export" subtitle="Choose masked or original" onPress={() => router.push({ pathname: '/session/[sessionId]/export', params: { sessionId } })} />
      </Card>

      <Card>
        <Field
          label="Private notes (local only)"
          value={session.researcherNotes}
          multiline
          onChangeText={(researcherNotes) => dispatch(dataActions.sessionMetaUpdated({ id: session.id, changes: { researcherNotes } }))}
        />
      </Card>

      <Button variant="danger" title="Delete interview" onPress={confirmDelete} />
    </Screen>
  );
}
