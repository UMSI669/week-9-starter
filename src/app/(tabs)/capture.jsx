/**
 * Capture Dream.
 *
 * Flow on screen, matching useDreamCapture's states:
 *   idle              -> big labelled "Start recording" plus "Type it instead"
 *   recording         -> live timer, partial text, obvious Stop, Cancel
 *   transcribing      -> cloud upload progress
 *   reviewing         -> EDITABLE transcript, then "Decode my dream"
 *   analyzing         -> waiting on the backend
 *   reviewing-card    -> the generated card, with Save or Discard
 *   saved             -> confirmation and links
 *
 * Key behaviours:
 *  - the original transcription is kept separately from the edited text
 *  - if analysis fails the transcript survives and can be saved on its own
 *  - the recording draft is never thrown away because the AI was unavailable
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { CAPTURE_STATES, MAX_RECORDING_MS, useDreamCapture } from '../../hooks/useDreamCapture';
import { createDream } from '../../store/dreamsSlice';
import {
  selectTranscriptionMode,
} from '../../store/settingsSlice';
import { ANALYSIS_NOTICE, analyzeDreamText, analysisToDreamFields } from '../../services/dreamAnalysis';
import { MODE_DESCRIPTIONS, MODE_LABELS, TRANSCRIPTION_MODES } from '../../services/stt';
import { getMissingApiConfig, isApiConfigured } from '../../services/apiClient';
import { deviceTimeZone, formatDuration, nowIso } from '../../services/formatDate';
import { FIELD_LIMITS } from '../../services/dreamSchema';
import { categoryLabel } from '../../data/categories';
import { DreamCard } from '../../components/DreamCard';
import {
  Button,
  Card,
  FieldLabel,
  Input,
  NightBackground,
  PageHeading,
  SectionTitle,
  StatusMessage,
} from '../../components/ui';
import { colors, fontSizes, radii, spacing } from '../../theme';
import { createVisualSeed } from '../../services/visualSeed';

export default function CaptureScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const mode = useSelector(selectTranscriptionMode);

  const capture = useDreamCapture({ mode });
  const {
    state,
    setState,
    error,
    setError,
    notice,
    partial,
    transcript,
    durationMs,
    isRecording,
  } = capture;

  // The text the user is editing. The original transcription is preserved
  // separately so an edit never erases what was actually heard.
  const [editedText, setEditedText] = useState('');
  const [originalTranscript, setOriginalTranscript] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [analysisError, setAnalysisError] = useState('');
  const [savedDream, setSavedDream] = useState(null);
  const hydratedRef = useRef(false);

  /**
   * One visual seed per capture attempt. It is state rather than a ref because
   * the preview reads it while rendering, and it is created lazily so each
   * capture screen gets its own. The card the user approved is therefore
   * byte-for-byte the card that gets stored.
   */
  const [visualSeed, setVisualSeed] = useState(() => createVisualSeed());

  // Seed the editor once, the first time the review step is reached. Doing
  // this in an effect rather than during render keeps the transcription
  // results and the editable draft from fighting over the same state.
  useEffect(() => {
    if (state === CAPTURE_STATES.REVIEWING_TRANSCRIPT && !hydratedRef.current) {
      hydratedRef.current = true;
      setEditedText(transcript);
      setOriginalTranscript(transcript);
    }
    if (state === CAPTURE_STATES.IDLE && hydratedRef.current) {
      hydratedRef.current = false;
    }
  }, [state, transcript]);

  const reviewedText = editedText.trim();
  const tooLong = reviewedText.length > FIELD_LIMITS.transcript.max;
  const apiMissing = getMissingApiConfig();

  const previewDream = useMemo(() => {
    if (!analysis) return null;
    return {
      id: 'preview',
      createdAt: nowIso(),
      visualSeed,
      transcript: reviewedText,
      title: analysis.title,
      summary: analysis.summary,
      symbolKey: analysis.symbol.key,
      symbolLabel: analysis.symbol.label,
      emoji: analysis.symbol.emoji,
      interpretation: analysis.interpretation,
      reflectionQuestion: analysis.reflectionQuestion,
      primaryCategory: analysis.primaryCategory,
      themes: analysis.themes,
      moods: analysis.moods,
      isDemo: false,
    };
  }, [analysis, reviewedText, visualSeed]);

  async function decode() {
    setAnalysisError('');
    setError('');
    setState(CAPTURE_STATES.ANALYZING);
    try {
      const result = await analyzeDreamText({ transcript: reviewedText });
      setAnalysis(result);
      setState(CAPTURE_STATES.REVIEWING_CARD);
    } catch (caughtError) {
      // The transcript is untouched and still saveable. The draft survives
      // the AI being unavailable.
      setAnalysisError(caughtError?.message || 'The reflection could not be generated.');
      setState(CAPTURE_STATES.REVIEWING_TRANSCRIPT);
    }
  }

  async function save({ withAnalysis }) {
    setState(CAPTURE_STATES.SAVING);
    try {
      const draft = {
        createdAt: nowIso(),
        capturedTimeZone: deviceTimeZone(),
        originalTranscript: originalTranscript || reviewedText,
        transcript: reviewedText,
        visualSeed,
        ...(withAnalysis && analysis
          ? analysisToDreamFields(analysis)
          : {
              title: makeFallbackTitle(reviewedText),
              summary: '',
              analysisStatus: 'none',
            }),
      };
      const stored = await dispatch(createDream(draft)).unwrap();
      setSavedDream(stored);
      setState(CAPTURE_STATES.SAVED);
    } catch (caughtError) {
      setError(caughtError?.message || 'Could not save this dream.');
      setState(withAnalysis ? CAPTURE_STATES.REVIEWING_CARD : CAPTURE_STATES.REVIEWING_TRANSCRIPT);
    }
  }

  function startOver() {
    setAnalysis(null);
    setAnalysisError('');
    setSavedDream(null);
    setEditedText('');
    setOriginalTranscript('');
    setVisualSeed(createVisualSeed());
    capture.cancel();
  }

  return (
    <NightBackground>
      <SafeAreaView style={styles.fill} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView
          style={styles.fill}
          // iOS needs padding so the form lifts above the keyboard; Android
          // resizes the window itself (softwareKeyboardLayoutMode in app.json).
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            <PageHeading
              eyebrow="Capture"
              title="Record a dream"
              description={MODE_LABELS[mode]}
            />

            <Card>
              <Text style={styles.modeNote}>{MODE_DESCRIPTIONS[mode]}</Text>
              <Button
                title="Change transcription mode"
                variant="ghost"
                onPress={() => router.push('/settings')}
              />
            </Card>

            {error ? (
              <StatusMessage tone="error" announce>
                {error}
              </StatusMessage>
            ) : null}
            {notice ? (
              <StatusMessage tone="info" announce>
                {notice}
              </StatusMessage>
            ) : null}

            {/* ------------------------------ idle ------------------------------ */}
            {state === CAPTURE_STATES.IDLE ? (
              <Card>
                <SectionTitle>Ready when you are</SectionTitle>
                <Text style={styles.body}>
                  Recording starts only when you tap the button, and stops after 3 minutes at the
                  latest.
                </Text>
                {mode === TRANSCRIPTION_MODES.MANUAL ? null : (
                  <Button
                    title="Start recording"
                    icon={'🎙️'}
                    variant="record"
                    onPress={capture.startRecording}
                  />
                )}
                <Button
                  title="Type it instead"
                  variant="secondary"
                  onPress={capture.startTyping}
                  accessibilityHint="Skips the microphone and opens a text box."
                />
              </Card>
            ) : null}

            {/* ------------------------- requesting permission ------------------ */}
            {state === CAPTURE_STATES.REQUESTING_PERMISSION ? (
              <Card>
                <StatusMessage tone="info" announce>
                  Asking for microphone permission...
                </StatusMessage>
                <Button title="Cancel" variant="ghost" onPress={capture.cancel} />
              </Card>
            ) : null}

            {/* ---------------------------- recording --------------------------- */}
            {isRecording ? (
              <Card glowIntensity="lg">
                <View
                  accessibilityLiveRegion="polite"
                  accessibilityLabel={`Recording. ${formatDuration(durationMs)} elapsed.`}
                  style={styles.timerRow}
                >
                  <View style={styles.recordDot} />
                  <Text style={styles.timer}>{formatDuration(durationMs)}</Text>
                  <Text style={styles.timerMax}>/ {formatDuration(MAX_RECORDING_MS)}</Text>
                </View>

                <Text style={styles.recordingLabel}>Recording. Speak your dream.</Text>

                {transcript ? <Text style={styles.liveText}>{transcript}</Text> : null}
                {partial ? (
                  <Text style={styles.partialText}>
                    {partial}
                    <Text style={styles.partialNote}> (still listening)</Text>
                  </Text>
                ) : null}
                {!transcript && !partial ? (
                  <Text style={styles.body}>
                    {mode === TRANSCRIPTION_MODES.CLOUD
                      ? 'Recording audio. Text appears after you stop and it is transcribed.'
                      : 'Listening...'}
                  </Text>
                ) : null}

                <Button title="Stop" icon={'⏹'} variant="primary" onPress={capture.stopRecording} />
                <Button
                  title="Cancel and discard"
                  variant="ghost"
                  onPress={capture.cancel}
                  accessibilityHint="Throws away this recording."
                />
              </Card>
            ) : null}

            {/* --------------------------- transcribing ------------------------- */}
            {state === CAPTURE_STATES.TRANSCRIBING ? (
              <Card>
                <StatusMessage tone="info" announce>
                  Uploading the recording and waiting for the transcript...
                </StatusMessage>
                <Button title="Cancel" variant="ghost" onPress={capture.cancel} />
              </Card>
            ) : null}

            {/* ----------------------- reviewing transcript --------------------- */}
            {state === CAPTURE_STATES.REVIEWING_TRANSCRIPT ? (
              <Card>
                <SectionTitle>Review the text</SectionTitle>
                <FieldLabel hint="Fix anything the transcription got wrong. Nothing is sent anywhere yet.">
                  Dream transcript
                </FieldLabel>
                <Input
                  multiline
                  minHeight={170}
                  value={editedText}
                  onChangeText={setEditedText}
                  placeholder="I was walking through a purple forest and found a glowing door..."
                  accessibilityLabel="Dream transcript"
                  maxLength={FIELD_LIMITS.transcript.max}
                />
                <Text style={styles.counter}>
                  {reviewedText.length} / {FIELD_LIMITS.transcript.max} characters
                </Text>

                {originalTranscript && originalTranscript !== reviewedText ? (
                  <Text style={styles.body}>
                    The original transcription is kept separately and will be saved alongside your
                    edited version.
                  </Text>
                ) : null}

                {analysisError ? (
                  <StatusMessage tone="error" announce>
                    {analysisError} Your text is still here — you can try again or save the
                    transcript on its own.
                  </StatusMessage>
                ) : null}

                {apiMissing.length > 0 ? (
                  <StatusMessage tone="warning">
                    No backend is configured ({apiMissing.join(', ')}), so decoding is unavailable.
                    You can still save this dream as a transcript.
                  </StatusMessage>
                ) : (
                  <StatusMessage tone="info">{ANALYSIS_NOTICE}</StatusMessage>
                )}

                <Text style={styles.meta}>
                  Decoding happens once per dream. Check the text above now — after this you can
                  still edit everything, but from the saved dream&apos;s edit screen.
                </Text>
                <Button
                  title="Decode my dream"
                  icon={'✨'}
                  onPress={decode}
                  disabled={!reviewedText || tooLong || !isApiConfigured()}
                  accessibilityHint="Sends the text above for a reflective interpretation. This happens once per dream."
                />
                <Button
                  title="Save transcript only"
                  variant="secondary"
                  onPress={() => save({ withAnalysis: false })}
                  disabled={!reviewedText || tooLong}
                />
                <Button title="Start over" variant="ghost" onPress={startOver} />
              </Card>
            ) : null}

            {/* ------------------------------ analyzing ------------------------- */}
            {state === CAPTURE_STATES.ANALYZING ? (
              <Card>
                <StatusMessage tone="info" announce>
                  Reading your dream and writing a reflection...
                </StatusMessage>
                <Text style={styles.body}>
                  Your transcript is saved in this screen either way. If this fails, nothing is lost.
                </Text>
              </Card>
            ) : null}

            {/* --------------------------- reviewing card ----------------------- */}
            {state === CAPTURE_STATES.REVIEWING_CARD && previewDream ? (
              <>
                <SectionTitle>Your dream card</SectionTitle>
                <DreamCard dream={previewDream} previewLines={null} />
                <Card>
                  <Text style={styles.body}>
                    {previewDream.reflectionQuestion}
                  </Text>
                  <Text style={styles.meta}>
                    Category: {categoryLabel(previewDream.primaryCategory)}
                  </Text>
                  {analysis?.analysisModel ? (
                    <Text style={styles.meta}>Model: {analysis.analysisModel}</Text>
                  ) : null}
                  <Text style={styles.disclaimer}>
                    This is a reflective possibility, not a scientific, diagnostic, or predictive
                    conclusion.
                  </Text>
                  <Button title="Save this dream" onPress={() => save({ withAnalysis: true })} />
                  {/* No route back to the transcript from here. Decoding happens
                      once per dream: a second pass would spend another billable
                      call on text the reader has already seen interpreted. The
                      transcript and every card field stay editable after saving,
                      from the dream's edit screen. */}
                  <Button title="Discard" variant="ghost" onPress={startOver} />
                </Card>
              </>
            ) : null}

            {/* ------------------------------- saving --------------------------- */}
            {state === CAPTURE_STATES.SAVING ? (
              <Card>
                <StatusMessage tone="info" announce>
                  Saving to this device...
                </StatusMessage>
              </Card>
            ) : null}

            {/* -------------------------------- saved --------------------------- */}
            {state === CAPTURE_STATES.SAVED && savedDream ? (
              <Card>
                <StatusMessage tone="success" announce>
                  Saved. {savedDream.title || 'Your dream'} is in your dream sky.
                </StatusMessage>
                <Button
                  title="Open the dream"
                  onPress={() => {
                    const id = savedDream.id;
                    startOver();
                    router.push(`/dream/${id}`);
                  }}
                />
                <Button
                  title="Record another"
                  variant="secondary"
                  onPress={startOver}
                />
                <Button
                  title="Back to the dream sky"
                  variant="ghost"
                  onPress={() => {
                    startOver();
                    router.push('/');
                  }}
                />
              </Card>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </NightBackground>
  );
}

function makeFallbackTitle(text) {
  const firstSentence = String(text).split(/[.!?\n]/)[0].trim();
  if (!firstSentence) return 'Untitled dream';
  const words = firstSentence.split(/\s+/).slice(0, 7).join(' ');
  return words.length > 56 ? `${words.slice(0, 53)}...` : words;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  body: { color: colors.textSecondary, fontSize: fontSizes.body, lineHeight: 22 },
  modeNote: { color: colors.textSecondary, fontSize: fontSizes.small, lineHeight: 20 },
  timerRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  recordDot: {
    backgroundColor: colors.danger,
    borderRadius: 7,
    height: 14,
    width: 14,
  },
  timer: {
    color: colors.textPrimary,
    fontSize: 30,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
  },
  timerMax: { color: colors.textMuted, fontSize: fontSizes.body, fontWeight: '600' },
  recordingLabel: { color: colors.textPrimary, fontSize: fontSizes.body, fontWeight: '700' },
  liveText: { color: colors.textPrimary, fontSize: fontSizes.body, lineHeight: 22 },
  partialText: { color: colors.textMuted, fontSize: fontSizes.body, fontStyle: 'italic', lineHeight: 22 },
  partialNote: { color: colors.textMuted, fontSize: fontSizes.caption },
  counter: { color: colors.textMuted, fontSize: fontSizes.caption, textAlign: 'right' },
  meta: { color: colors.textSecondary, fontSize: fontSizes.caption, fontWeight: '600' },
  disclaimer: {
    backgroundColor: 'rgba(196,181,253,0.09)',
    borderRadius: radii.sm,
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
    lineHeight: 17,
    padding: spacing.sm,
  },
});
