import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { Body, Button, Card, Field, ListItem, Pill, Screen, SectionTitle } from '../../components/ui';
import { SAMPLE_INTERVIEWS } from '../../data/samples';
import { importAudioFile } from '../../services/audio/audioFiles';
import { useAppDispatch, useAppSelector } from '../../store';
import { dataActions } from '../../store/dataSlice';
import { addSampleSession, createSession, deleteSession } from '../../store/thunks';
import { safeErrorMessage } from '../../utils/safeError';

export default function NewSessionScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const dispatch = useAppDispatch();
  const sessions = useAppSelector((s) => s.data.sessions);
  const count = useMemo(() => Object.values(sessions).filter((s) => s.projectId === projectId).length, [sessions, projectId]);
  const [title, setTitle] = useState('');
  const [label, setLabel] = useState(`P${String(count + 1).padStart(2, '0')}`);
  const [busy, setBusy] = useState(false);

  const make = () => dispatch(createSession(projectId, { title: title || `Interview ${label}`, participantLabel: label }));
  const open = (id: string, screen?: 'record' | 'transcript') =>
    router.replace(
      screen
        ? { pathname: `/session/[sessionId]/${screen}`, params: { sessionId: id } }
        : { pathname: '/session/[sessionId]', params: { sessionId: id } },
    );

  const importFile = async () => {
    setBusy(true);
    const id = make();
    try {
      const audio = await importAudioFile(id);
      if (!audio) {
        dispatch(deleteSession(id));
        return;
      }
      dispatch(dataActions.sessionAudioSet({ id, audio }));
      open(id);
    } catch (error) {
      dispatch(deleteSession(id));
      Alert.alert('Import failed', safeErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Card>
        <Field label="Title (local only)" value={title} onChangeText={setTitle} placeholder={`Interview ${label}`} />
        <Field
          label="Participant label"
          value={label}
          onChangeText={setLabel}
          autoCapitalize="characters"
          hint="Use a pseudonymous code such as P03, not a name."
        />
      </Card>

      <Card>
        <SectionTitle>Add audio</SectionTitle>
        <Button title="Record on this iPhone" onPress={() => open(make(), 'record')} disabled={busy} />
        <Button variant="secondary" title="Import audio file" onPress={importFile} loading={busy} />
        <Button variant="secondary" title="Type or paste a transcript" onPress={() => open(make(), 'transcript')} disabled={busy} />
        <Body muted>
          Audio is copied into the app’s private storage under a neutral name. The original file name is kept locally and never
          uploaded. For on-device Whisper, import 16-bit PCM WAV files; recordings made in the app are already WAV.
        </Body>
      </Card>

      <Card>
        <SectionTitle>Bundled sample interviews</SectionTitle>
        <Body muted>Synthetic interviews with pre-written sample transcripts, for simulator testing and demos.</Body>
        {SAMPLE_INTERVIEWS.map((sample) => (
          <ListItem
            key={sample.id}
            title={sample.title}
            subtitle={`${Math.round(sample.durationMs / 1000)} s · ${sample.participantLabel}`}
            right={<Pill label="Sample" tone="demo" />}
            onPress={() => {
              const id = dispatch(addSampleSession(projectId, sample.id));
              if (id) open(id);
            }}
          />
        ))}
      </Card>
    </Screen>
  );
}
