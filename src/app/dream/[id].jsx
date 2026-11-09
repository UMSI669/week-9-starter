/**
 * Dream detail, including export.
 *
 * Export behaviour is deliberately explicit about what it can and cannot
 * promise: "Copy text" confirms the clipboard write, "Share" confirms only
 * that the share sheet opened, and "Save image" confirms a save only when
 * the media library actually returns an asset.
 *
 * The PNG is captured from a dedicated off-screen ExportCard, so the image
 * never contains these buttons or the screen chrome, and it is shown for
 * review before anything is shared.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import {
  clearLastDeleted,
  loadDreams,
  removeDream,
  restoreDream,
  selectDreamById,
  selectLastDeleted,
} from '../../store/dreamsSlice';
import { categoryEmoji, categoryLabel } from '../../data/categories';
import { resolveSymbolEntry } from '../../data/symbolCatalog';
import { formatDreamDate } from '../../services/formatDate';
import {
  captureDreamCard,
  cleanUpExportFile,
  copyDreamText,
  saveDreamImageToPhotos,
  shareDreamImage,
  shareDreamText,
} from '../../services/exportDream';
import { DreamCard } from '../../components/DreamCard';
import { EXPORT_CARD_WIDTH, ExportCard } from '../../components/ExportCard';
import {
  Button,
  Card,
  Divider,
  EmptyState,
  PageHeading,
  Screen,
  SectionTitle,
  StatusMessage,
  Tag,
} from '../../components/ui';
import { colors, fontSizes, radii, spacing } from '../../theme';

const UNDO_WINDOW_MS = 7000;

export default function DreamDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const dispatch = useDispatch();

  const dream = useSelector(selectDreamById(String(id)));
  const lastDeleted = useSelector(selectLastDeleted);

  const exportRef = useRef(null);
  const [status, setStatus] = useState(null);
  const [exportUri, setExportUri] = useState(null);
  const [busy, setBusy] = useState(null);
  const [undoVisible, setUndoVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      dispatch(loadDreams());
    }, [dispatch]),
  );

  // Delete the captured PNG when leaving the screen: it has served its purpose.
  useEffect(
    () => () => {
      if (exportUri) cleanUpExportFile(exportUri);
    },
    [exportUri],
  );

  if (!dream) {
    return (
      <Screen>
        <EmptyState
          title="This dream is not here"
          body="It may have been deleted. Your other dreams are unaffected."
        >
          <Button title="Back to the dream sky" onPress={() => router.replace('/')} />
        </EmptyState>
      </Screen>
    );
  }

  const symbolEntry = resolveSymbolEntry(dream.symbolKey, dream.symbolLabel, dream.emoji);

  async function run(key, action, successMessage) {
    setBusy(key);
    setStatus(null);
    try {
      const result = await action();
      setStatus({ tone: 'success', text: successMessage(result) });
    } catch (error) {
      setStatus({ tone: 'error', text: error?.message || 'That did not work.' });
    } finally {
      setBusy(null);
    }
  }

  async function prepareImage() {
    setBusy('capture');
    setStatus(null);
    try {
      if (exportUri) cleanUpExportFile(exportUri);
      const { uri } = await captureDreamCard({ viewRef: exportRef, dream });
      setExportUri(uri);
      setStatus({
        tone: 'success',
        text: 'Card image ready. Check it below before sharing or saving.',
      });
    } catch (error) {
      setStatus({ tone: 'error', text: error?.message || 'The image could not be created.' });
    } finally {
      setBusy(null);
    }
  }

  function confirmDelete() {
    Alert.alert(
      'Delete this dream?',
      `"${dream.title || 'Untitled dream'}" from ${formatDreamDate(dream.createdAt)} will be removed from this device. You will have a few seconds to undo.`,
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await dispatch(removeDream(dream.id)).unwrap();
              setUndoVisible(true);
              setTimeout(() => {
                setUndoVisible(false);
                dispatch(clearLastDeleted());
              }, UNDO_WINDOW_MS);
              router.replace('/');
            } catch (error) {
              setStatus({ tone: 'error', text: error?.message || 'Could not delete this dream.' });
            }
          },
        },
      ],
    );
  }

  return (
    <Screen>
      <PageHeading
        eyebrow={formatDreamDate(dream.createdAt)}
        title={dream.title || 'Untitled dream'}
      />

      {dream.isDemo ? (
        <StatusMessage tone="warning">
          This is demo data — a hand-written sample that shipped with the app. It was not
          produced by an AI model. You can delete it, or remove all the samples in Settings.
        </StatusMessage>
      ) : null}

      {status ? (
        <StatusMessage tone={status.tone} announce>
          {status.text}
        </StatusMessage>
      ) : null}

      {undoVisible && lastDeleted ? (
        <Card>
          <StatusMessage tone="warning" announce>
            Deleted &ldquo;{lastDeleted.title || 'Untitled dream'}&rdquo;.
          </StatusMessage>
          <Button
            title="Undo delete"
            onPress={async () => {
              await dispatch(restoreDream(lastDeleted));
              setUndoVisible(false);
              router.replace(`/dream/${lastDeleted.id}`);
            }}
          />
        </Card>
      ) : null}

      <DreamCard dream={dream} onPress={() => {}} />

      {dream.interpretation ? (
        <Card>
          <SectionTitle>Reflection</SectionTitle>
          <Text style={styles.body}>{dream.interpretation}</Text>
          {dream.reflectionQuestion ? (
            <View style={styles.questionBlock}>
              <Text style={styles.questionLabel}>Something to sit with</Text>
              <Text style={styles.question}>{dream.reflectionQuestion}</Text>
            </View>
          ) : null}
          <Text style={styles.disclaimer}>
            A reflective possibility, not a scientific, diagnostic, supernatural, or predictive
            conclusion.
          </Text>
          {dream.analysisModel ? (
            <Text style={styles.meta}>
              {dream.analysisStatus === 'edited' ? 'Edited by you. Originally from' : 'From'}{' '}
              {dream.analysisModel}
            </Text>
          ) : null}
        </Card>
      ) : (
        <Card>
          <SectionTitle>No reflection yet</SectionTitle>
          <Text style={styles.body}>
            This dream was saved as a transcript. You can ask for a reflection from the edit screen.
          </Text>
        </Card>
      )}

      <Card>
        <SectionTitle>Symbol</SectionTitle>
        <View style={styles.symbolRow}>
          <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.symbolEmoji}>
            {dream.emoji || '✨'}
          </Text>
          <Text style={styles.symbolLabel}>{dream.symbolLabel || 'None recorded'}</Text>
        </View>
        <Text style={styles.body}>{symbolEntry.associations[0]}</Text>
        <Button
          title="Open in the symbol catalog"
          variant="secondary"
          onPress={() =>
            router.push({
              pathname: '/symbols',
              params: { symbol: dream.symbolKey, label: dream.symbolLabel },
            })
          }
        />
      </Card>

      <Card>
        <SectionTitle>Category and tags</SectionTitle>
        <Text style={styles.body}>
          {categoryEmoji(dream.primaryCategory)} {categoryLabel(dream.primaryCategory)}
        </Text>
        {dream.themes.length > 0 ? (
          <View style={styles.tagRow}>
            <Text style={styles.tagGroupLabel}>Themes</Text>
            {dream.themes.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </View>
        ) : null}
        {dream.moods.length > 0 ? (
          <View style={styles.tagRow}>
            <Text style={styles.tagGroupLabel}>Moods</Text>
            {dream.moods.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </View>
        ) : null}
      </Card>

      <Card>
        <SectionTitle>Transcript</SectionTitle>
        <Text selectable style={styles.transcript}>
          {dream.transcript || 'No transcript was saved.'}
        </Text>
        {dream.originalTranscript && dream.originalTranscript !== dream.transcript ? (
          <>
            <Divider />
            <Text style={styles.meta}>Original transcription, before your edits</Text>
            <Text selectable style={styles.originalTranscript}>
              {dream.originalTranscript}
            </Text>
          </>
        ) : null}
        {dream.capturedTimeZone ? (
          <Text style={styles.meta}>Captured in {dream.capturedTimeZone}</Text>
        ) : null}
      </Card>

      {/* ------------------------------- export ------------------------------- */}
      <Card>
        <SectionTitle>Export</SectionTitle>
        <Text style={styles.body}>
          The exported text and image include the title, date, symbol, and reflection. They do not
          include your raw transcript.
        </Text>

        <Button
          title="Copy text"
          icon={'📋'}
          variant="secondary"
          busy={busy === 'copy'}
          onPress={() =>
            run('copy', () => copyDreamText(dream), () => 'Copied to the clipboard.')
          }
        />
        <Button
          title="Share text"
          variant="secondary"
          busy={busy === 'shareText'}
          onPress={() =>
            run(
              'shareText',
              () => shareDreamText(dream),
              (result) =>
                result.dismissed
                  ? 'The share sheet was dismissed. Nothing was sent.'
                  : 'The share sheet opened. Whether it reached anyone is up to that app.',
            )
          }
        />

        <Divider />

        <Button
          title={exportUri ? 'Rebuild card image' : 'Create card image'}
          icon={'🖼️'}
          variant="secondary"
          busy={busy === 'capture'}
          onPress={prepareImage}
        />

        {exportUri ? (
          <View style={styles.previewBlock}>
            <Text style={styles.meta}>Preview of the image that will be shared or saved</Text>
            <Image
              accessibilityLabel={`Preview of the dream card image for ${dream.title || 'this dream'}`}
              source={{ uri: exportUri }}
              style={styles.preview}
              resizeMode="contain"
            />
            <Button
              title="Share image"
              busy={busy === 'shareImage'}
              onPress={() =>
                run(
                  'shareImage',
                  () => shareDreamImage(exportUri),
                  () => 'The share sheet opened. Delivery is up to the app you picked.',
                )
              }
            />
            <Button
              title="Save image to photos"
              variant="secondary"
              busy={busy === 'savePhoto'}
              onPress={() =>
                run(
                  'savePhoto',
                  () => saveDreamImageToPhotos(exportUri),
                  () => 'Saved to your photo library.',
                )
              }
            />
          </View>
        ) : null}

        <Text style={styles.disclaimerSmall}>
          Emoji are drawn by each platform, so the card looks slightly different on iOS and Android.
        </Text>
      </Card>

      <Button
        title="Edit this dream"
        onPress={() => router.push(`/dream/edit/${dream.id}`)}
      />
      <Button title="Delete this dream" variant="danger" onPress={confirmDelete} />

      {/*
        The capture source. Rendered far off-screen rather than with display:none
        or zero opacity, because a view that is not actually laid out captures
        as a blank image on Android.
      */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={styles.offscreen}
      >
        <ExportCard ref={exportRef} dream={dream} width={EXPORT_CARD_WIDTH} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { color: colors.textSecondary, fontSize: fontSizes.body, lineHeight: 22 },
  transcript: { color: colors.textPrimary, fontSize: fontSizes.body, lineHeight: 23 },
  originalTranscript: { color: colors.textMuted, fontSize: fontSizes.small, lineHeight: 21 },
  meta: { color: colors.textMuted, fontSize: fontSizes.caption, fontWeight: '600' },
  questionBlock: {
    backgroundColor: 'rgba(196,181,253,0.1)',
    borderRadius: radii.md,
    gap: 3,
    padding: spacing.md,
  },
  questionLabel: {
    color: colors.accent,
    fontSize: fontSizes.caption,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  question: { color: colors.textPrimary, fontSize: fontSizes.body, lineHeight: 22 },
  disclaimer: { color: colors.textMuted, fontSize: fontSizes.caption, lineHeight: 18 },
  disclaimerSmall: { color: colors.textMuted, fontSize: 11, lineHeight: 16 },
  symbolRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  symbolEmoji: { fontSize: 32 },
  symbolLabel: { color: colors.textPrimary, fontSize: fontSizes.bodyLarge, fontWeight: '700' },
  tagRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 },
  tagGroupLabel: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    fontWeight: '700',
    marginRight: 2,
  },
  previewBlock: { gap: spacing.md },
  preview: {
    alignSelf: 'center',
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    height: 420,
    width: '100%',
  },
  offscreen: { left: -10000, position: 'absolute', top: 0 },
});
