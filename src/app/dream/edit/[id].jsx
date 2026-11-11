/**
 * Dream edit.
 *
 * Rules enforced here:
 *  - Save and Cancel are both explicit buttons; nothing autosaves
 *  - unsaved changes live in a local draft, and leaving with changes asks first
 *  - editing the transcript does NOT silently regenerate the interpretation
 *  - "Reinterpret" is a separate, explicit action that says it sends text to AI
 *  - the existing card stays intact until a new interpretation actually succeeds
 *  - the keyboard never covers the inputs, Save, or Cancel
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { editDream, selectDreamById } from '../../../store/dreamsSlice';
import { CATEGORIES } from '../../../data/categories';
import { FIELD_LIMITS } from '../../../services/dreamSchema';
import {
  ANALYSIS_NOTICE,
  analysisToDreamFields,
  analyzeDreamText,
} from '../../../services/dreamAnalysis';
import { isApiConfigured, getMissingApiConfig } from '../../../services/apiClient';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  FieldLabel,
  Input,
  NightBackground,
  SectionTitle,
  StatusMessage,
} from '../../../components/ui';
import { colors, fontSizes, spacing } from '../../../theme';

export default function EditDreamScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const dream = useSelector(selectDreamById(String(id)));

  if (!dream) {
    return (
      <NightBackground>
        <SafeAreaView style={styles.fill}>
          <EmptyState title="This dream is not here" body="It may have been deleted.">
            <Button title="Back" onPress={() => router.replace('/')} />
          </EmptyState>
        </SafeAreaView>
      </NightBackground>
    );
  }

  // Keyed by id so the draft is initialized from the record exactly once per
  // dream, with no hydration effect and no chance of a store refresh
  // overwriting what the user is typing.
  return <EditDreamForm key={dream.id} dream={dream} />;
}

/** Turns a stored record into the editable draft shape. */
function toDraft(dream) {
  return {
    transcript: dream.transcript,
    title: dream.title,
    summary: dream.summary,
    symbolLabel: dream.symbolLabel,
    emoji: dream.emoji,
    interpretation: dream.interpretation,
    reflectionQuestion: dream.reflectionQuestion,
    primaryCategory: dream.primaryCategory,
    themes: dream.themes.join(', '),
    moods: dream.moods.join(', '),
  };
}

function EditDreamForm({ dream }) {
  const router = useRouter();
  const navigation = useNavigation();
  const dispatch = useDispatch();

  const [draft, setDraft] = useState(() => toDraft(dream));
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(null);
  const savedRef = useRef(false);

  const isDirty = useMemo(() => {
    if (!dream || !draft) return false;
    return (
      draft.transcript !== dream.transcript ||
      draft.title !== dream.title ||
      draft.summary !== dream.summary ||
      draft.symbolLabel !== dream.symbolLabel ||
      draft.emoji !== dream.emoji ||
      draft.interpretation !== dream.interpretation ||
      draft.reflectionQuestion !== dream.reflectionQuestion ||
      draft.primaryCategory !== dream.primaryCategory ||
      draft.themes !== dream.themes.join(', ') ||
      draft.moods !== dream.moods.join(', ')
    );
  }, [dream, draft]);

  // Warn before losing a changed draft, including on the system back gesture.
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (!isDirty || savedRef.current) return;
      event.preventDefault();
      Alert.alert(
        'Discard your changes?',
        'This dream has unsaved edits. Leaving now throws them away.',
        [
          { text: 'Keep editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              savedRef.current = true;
              navigation.dispatch(event.data.action);
            },
          },
        ],
      );
    });
    return unsubscribe;
  }, [navigation, isDirty]);

  const update = useCallback((field, value) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setStatus(null);
  }, []);

  async function save() {
    setBusy('save');
    setStatus(null);
    try {
      const transcriptChanged = draft.transcript.trim() !== dream.transcript;
      await dispatch(
        editDream({
          id: dream.id,
          changes: {
            transcript: draft.transcript.trim(),
            title: draft.title.trim(),
            summary: draft.summary.trim(),
            symbolLabel: draft.symbolLabel.trim(),
            emoji: draft.emoji.trim(),
            interpretation: draft.interpretation.trim(),
            reflectionQuestion: draft.reflectionQuestion.trim(),
            primaryCategory: draft.primaryCategory,
            themes: parseTags(draft.themes, FIELD_LIMITS.themes.max),
            moods: parseTags(draft.moods, FIELD_LIMITS.moods.max),
            // A hand edit is recorded as 'edited', so the card never claims to
            // be unmodified AI output. Editing the transcript does not touch
            // the interpretation.
            analysisStatus:
              dream.analysisStatus === 'none' && !draft.interpretation.trim()
                ? 'none'
                : 'edited',
          },
        }),
      ).unwrap();

      savedRef.current = true;
      setBusy(null);
      if (transcriptChanged && dream.interpretation) {
        // Say plainly that the old reflection was kept, rather than quietly
        // leaving a mismatch.
        Alert.alert(
          'Saved',
          'Your transcript changed, and the existing reflection was kept as it was. Use "Reinterpret" if you want a new one.',
          [{ text: 'OK', onPress: () => router.back() }],
        );
        return;
      }
      router.back();
    } catch (error) {
      setBusy(null);
      setStatus({ tone: 'error', text: error?.message || 'Could not save your changes.' });
    }
  }

  function confirmReinterpret() {
    Alert.alert(
      'Send this text for a new reflection?',
      'The transcript below will be sent to this app’s backend and forwarded to OpenRouter. ' +
        'Your current card stays exactly as it is unless the new reflection succeeds.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reinterpret', onPress: reinterpret },
      ],
    );
  }

  async function reinterpret() {
    setBusy('reinterpret');
    setStatus(null);
    try {
      const analysis = await analyzeDreamText({ transcript: draft.transcript.trim() });
      const fields = analysisToDreamFields(analysis);
      // Only now is the draft replaced. A failure above leaves it untouched.
      setDraft((current) => ({
        ...current,
        title: fields.title,
        summary: fields.summary,
        symbolLabel: fields.symbolLabel,
        emoji: fields.emoji,
        interpretation: fields.interpretation,
        reflectionQuestion: fields.reflectionQuestion,
        primaryCategory: fields.primaryCategory,
        themes: fields.themes.join(', '),
        moods: fields.moods.join(', '),
      }));
      setStatus({
        tone: 'success',
        text: 'A new reflection is loaded below. Nothing is stored until you tap Save.',
      });
    } catch (error) {
      setStatus({
        tone: 'error',
        text: `${error?.message || 'The new reflection failed.'} Your current card is unchanged.`,
      });
    } finally {
      setBusy(null);
    }
  }

  const apiMissing = getMissingApiConfig();

  return (
    <NightBackground>
      <SafeAreaView style={styles.fill} edges={['left', 'right', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            {status ? (
              <StatusMessage tone={status.tone} announce>
                {status.text}
              </StatusMessage>
            ) : null}

            {isDirty ? (
              <StatusMessage tone="warning">
                You have unsaved changes. They are kept here until you Save or Cancel.
              </StatusMessage>
            ) : null}

            <Card>
              <SectionTitle>Transcript</SectionTitle>
              <FieldLabel hint="Editing this does not change your reflection. Use Reinterpret for that.">
                What you dreamed
              </FieldLabel>
              <Input
                multiline
                minHeight={150}
                value={draft.transcript}
                onChangeText={(value) => update('transcript', value)}
                accessibilityLabel="Dream transcript"
                maxLength={FIELD_LIMITS.transcript.max}
              />
            </Card>

            <Card>
              <SectionTitle>The card</SectionTitle>

              <FieldLabel hint={`Up to ${FIELD_LIMITS.title.max} characters.`}>Title</FieldLabel>
              <Input
                value={draft.title}
                onChangeText={(value) => update('title', value)}
                accessibilityLabel="Dream title"
                maxLength={FIELD_LIMITS.title.max}
              />

              <FieldLabel hint={`Up to ${FIELD_LIMITS.summary.max} characters.`}>Summary</FieldLabel>
              <Input
                multiline
                minHeight={80}
                value={draft.summary}
                onChangeText={(value) => update('summary', value)}
                accessibilityLabel="Dream summary"
                maxLength={FIELD_LIMITS.summary.max}
              />

              <View style={styles.row}>
                <View style={styles.emojiField}>
                  <FieldLabel>Emoji</FieldLabel>
                  <Input
                    value={draft.emoji}
                    onChangeText={(value) => update('emoji', value)}
                    accessibilityLabel="Symbol emoji"
                    maxLength={8}
                    style={styles.emojiInput}
                  />
                </View>
                <View style={styles.symbolField}>
                  <FieldLabel>Symbol label</FieldLabel>
                  <Input
                    value={draft.symbolLabel}
                    onChangeText={(value) => update('symbolLabel', value)}
                    accessibilityLabel="Symbol label"
                    maxLength={FIELD_LIMITS.symbolLabel.max}
                  />
                </View>
              </View>

              <FieldLabel hint={`Up to ${FIELD_LIMITS.interpretation.max} characters.`}>
                Interpretation
              </FieldLabel>
              <Input
                multiline
                minHeight={130}
                value={draft.interpretation}
                onChangeText={(value) => update('interpretation', value)}
                accessibilityLabel="Interpretation"
                maxLength={FIELD_LIMITS.interpretation.max}
              />

              <FieldLabel>Reflection question</FieldLabel>
              <Input
                multiline
                minHeight={70}
                value={draft.reflectionQuestion}
                onChangeText={(value) => update('reflectionQuestion', value)}
                accessibilityLabel="Reflection question"
                maxLength={FIELD_LIMITS.reflectionQuestion.max}
              />
            </Card>

            <Card>
              <SectionTitle>Category</SectionTitle>
              <Text style={styles.hint}>
                Exactly one primary category. Changing it moves this dream in the cloud map.
              </Text>
              <View style={styles.chipRow}>
                {CATEGORIES.map((category) => (
                  <Chip
                    key={category.key}
                    label={category.label}
                    emoji={category.emoji}
                    selected={draft.primaryCategory === category.key}
                    onPress={() => update('primaryCategory', category.key)}
                    accessibilityLabel={category.label}
                  />
                ))}
              </View>
            </Card>

            <Card>
              <SectionTitle>Tags</SectionTitle>
              <FieldLabel hint={`Comma separated, up to ${FIELD_LIMITS.themes.max}.`}>
                Themes
              </FieldLabel>
              <Input
                value={draft.themes}
                onChangeText={(value) => update('themes', value)}
                accessibilityLabel="Themes, comma separated"
                autoCapitalize="none"
              />
              <FieldLabel hint={`Comma separated, up to ${FIELD_LIMITS.moods.max}.`}>
                Moods
              </FieldLabel>
              <Input
                value={draft.moods}
                onChangeText={(value) => update('moods', value)}
                accessibilityLabel="Moods, comma separated"
                autoCapitalize="none"
              />
            </Card>

            <Card>
              <SectionTitle>Reinterpret</SectionTitle>
              {apiMissing.length > 0 ? (
                <StatusMessage tone="warning">
                  No backend is configured ({apiMissing.join(', ')}), so reinterpreting is
                  unavailable. You can still edit every field by hand.
                </StatusMessage>
              ) : (
                <Text style={styles.hint}>{ANALYSIS_NOTICE}</Text>
              )}
              <Button
                title="Reinterpret with AI"
                variant="secondary"
                busy={busy === 'reinterpret'}
                disabled={!isApiConfigured() || !draft.transcript.trim()}
                onPress={confirmReinterpret}
                accessibilityHint="Asks for a new reflection. Your current card is kept until it succeeds."
              />
            </Card>

            {/* Save and Cancel stay in the scroll flow, above the bottom inset,
                so both remain reachable with the keyboard open. */}
            <Button title="Save changes" busy={busy === 'save'} onPress={save} />
            <Button
              title="Cancel"
              variant="ghost"
              onPress={() => router.back()}
              accessibilityHint={isDirty ? 'Asks before discarding your changes.' : undefined}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </NightBackground>
  );
}

function parseTags(value, max) {
  return String(value || '')
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .filter((tag, index, all) => all.indexOf(tag) === index)
    .slice(0, max);
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  hint: { color: colors.textSecondary, fontSize: fontSizes.small, lineHeight: 20 },
  row: { flexDirection: 'row', gap: spacing.md },
  emojiField: { gap: spacing.xs, width: 92 },
  emojiInput: { fontSize: 22, textAlign: 'center' },
  symbolField: { flex: 1, gap: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
