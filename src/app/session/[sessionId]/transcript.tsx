import { useLocalSearchParams } from 'expo-router';
import { memo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AudioPlayerBar, useSessionPlayer } from '../../../components/AudioPlayerBar';
import { TranscriptSourceLabel } from '../../../components/RuntimeBanner';
import { Banner, Body, Button, ButtonRow, Card, colors, Empty, Field, Pill, styles as ui } from '../../../components/ui';
import type { TranscriptSegment } from '../../../models/types';
import { splitTextEvenly } from '../../../services/transcription/segmenter';
import { useAppDispatch, useAppSelector } from '../../../store';
import { dataActions } from '../../../store/dataSlice';
import { formatMs } from '../../../utils/ids';

const SegmentRow = memo(function SegmentRow({
  segment,
  onSeek,
  onCommit,
  onAddAfter,
  onDelete,
}: {
  segment: TranscriptSegment;
  onSeek: (ms: number) => void;
  onCommit: (id: string, changes: { text?: string; speaker?: string }) => void;
  onAddAfter: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [text, setText] = useState(segment.text);
  const [speaker, setSpeaker] = useState(segment.speaker ?? '');
  const [showOriginal, setShowOriginal] = useState(false);
  return (
    <View style={s.row}>
      <View style={s.rowHeader}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Play from ${formatMs(segment.startMs)}`} onPress={() => onSeek(segment.startMs)} hitSlop={8}>
          <Text style={s.time}>▶ {formatMs(segment.startMs)}</Text>
        </Pressable>
        <TextInput
          value={speaker}
          onChangeText={setSpeaker}
          onEndEditing={() => speaker !== (segment.speaker ?? '') && onCommit(segment.id, { speaker: speaker.trim() || undefined })}
          placeholder="Speaker"
          placeholderTextColor={colors.faint}
          accessibilityLabel="Speaker label"
          style={s.speaker}
        />
        <Text style={s.id}>{segment.id}</Text>
        {segment.edited ? (
          <Pressable onPress={() => setShowOriginal((v) => !v)} accessibilityRole="button" accessibilityLabel="Show recognized text">
            <Pill label={showOriginal ? 'hide original' : 'corrected'} tone="warning" />
          </Pressable>
        ) : null}
      </View>
      <TextInput
        value={text}
        onChangeText={setText}
        onEndEditing={() => text !== segment.text && onCommit(segment.id, { text })}
        multiline
        accessibilityLabel={`Segment ${segment.id} text`}
        style={[ui.input, s.text]}
      />
      {showOriginal ? <Text style={s.original}>Recognized: {segment.recognizedText || '—'}</Text> : null}
      <View style={s.actions}>
        <Button small variant="ghost" title="+ Below" onPress={() => onAddAfter(segment.id)} />
        <Button small variant="ghost" title="Delete" onPress={() => onDelete(segment.id)} />
      </View>
    </View>
  );
});

export default function TranscriptScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const dispatch = useAppDispatch();
  const session = useAppSelector((st) => st.data.sessions[sessionId]);
  const { player, status, seekAndPlay } = useSessionPlayer(session?.audio);
  const [pasted, setPasted] = useState('');

  if (!session) return <Empty title="Interview not found" />;

  const commit = (segmentId: string, changes: { text?: string; speaker?: string }) =>
    dispatch(dataActions.segmentEdited({ id: session.id, segmentId, changes }));
  const remove = (segmentId: string) =>
    Alert.alert('Delete segment?', 'Its text and any masking on it are removed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => dispatch(dataActions.segmentDeleted({ id: session.id, segmentId })) },
    ]);

  const importPasted = () => {
    const duration = session.audio?.durationMs ?? (status.duration ? status.duration * 1000 : 0);
    const paragraphs = pasted.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    const speakerPrefix = /^([A-Za-z0-9 ]{1,20}):\s*/;
    const total = paragraphs.reduce((sum, p) => sum + p.length, 0) || 1;
    let cursor = 0;
    const drafts =
      paragraphs.length > 1
        ? paragraphs.map((p) => {
            // Spread the audio duration across turns proportionally to their length.
            const length = Math.round((p.length / total) * duration);
            const draft = { startMs: cursor, endMs: cursor + length, text: p.replace(speakerPrefix, ''), speaker: p.match(speakerPrefix)?.[1] };
            cursor += length;
            return draft;
          })
        : splitTextEvenly(pasted, duration);
    if (drafts.length === 0) return;
    dispatch(dataActions.transcriptReplaced({ id: session.id, source: 'manual', model: 'typed by researcher', segments: drafts }));
    setPasted('');
  };

  const header = (
    <View style={{ gap: 12, marginBottom: 12 }}>
      <TranscriptSourceLabel source={session.transcriptSource} model={session.transcriptModel} />
      {session.transcriptSource === 'demo-sample' ? (
        <Banner tone="demo">This is a pre-written sample transcript for the synthetic demo audio, not speech-recognition output.</Banner>
      ) : null}
      {session.audio ? (
        <Card>
          <AudioPlayerBar player={player} status={status} label="Tap a timestamp to play from there" />
        </Card>
      ) : null}
      {session.segments.length === 0 ? (
        <Card>
          <Field
            label="Paste or type a transcript"
            value={pasted}
            onChangeText={setPasted}
            multiline
            placeholder={'Interviewer: How do you book appointments?\n\nParticipant: Mostly by phone…'}
            hint="Separate turns with a blank line. 'Name:' prefixes become speaker labels. Timestamps are approximate."
            style={{ minHeight: 160 }}
          />
          <ButtonRow>
            <Button title="Use this transcript" onPress={importPasted} disabled={!pasted.trim()} />
            <Button variant="secondary" title="Start empty" onPress={() => dispatch(dataActions.segmentAdded({ id: session.id }))} />
          </ButtonRow>
        </Card>
      ) : (
        <Body muted>
          Corrections are saved locally and clear any earlier privacy approval. Speaker labels are optional and are sent to the
          cloud only if they are generic roles (Interviewer, Participant, P01…).
        </Body>
      )}
    </View>
  );

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      data={session.segments}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={header}
      initialNumToRender={12}
      windowSize={7}
      renderItem={({ item }) => (
        <SegmentRow
          segment={item}
          onSeek={(ms) => void seekAndPlay(ms)}
          onCommit={commit}
          onAddAfter={(id) => dispatch(dataActions.segmentAdded({ id: session.id, afterSegmentId: id }))}
          onDelete={remove}
        />
      )}
    />
  );
}

const s = StyleSheet.create({
  row: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  time: { color: colors.primary, fontWeight: '700', fontVariant: ['tabular-nums'] },
  speaker: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.ink, paddingVertical: 2 },
  id: { fontSize: 11, color: colors.faint },
  text: { minHeight: 60, fontSize: 15, lineHeight: 21 },
  original: { fontSize: 13, color: colors.muted, fontStyle: 'italic' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 4 },
});
