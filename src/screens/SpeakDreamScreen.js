import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DictationStatus, useDreamDictation } from '../hooks/useDreamDictation';
import CategoryPicker from '../components/CategoryPicker';

const colors = {
  background: '#F5F3FB',
  card: '#FFFFFF',
  ink: '#1E1B3A',
  muted: '#625D80',
  border: '#DDD8EE',
  accent: '#5B4BC4',
  accentSoft: '#ECE8FB',
  recording: '#C2410C',
  recordingSoft: '#FDEDE4',
  error: '#B42318',
  errorSoft: '#FEF0EE',
  success: '#1F7A4D',
  successSoft: '#E7F6EE',
};

function formatElapsed(ms) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function wordCount(text) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length;
}

const MIC_LABELS = {
  [DictationStatus.idle]: 'Start speaking',
  [DictationStatus.requesting]: 'Waiting for permission…',
  [DictationStatus.listening]: 'Stop',
  [DictationStatus.stopping]: 'Finishing…',
};

/**
 * Task #1 – "Speak a dream" screen.
 *
 * Props:
 *   onSave(entry) – called when the user saves. `entry` is
 *     { text: string, category: string, createdAt: ISO date string }.
 *     It may return a Promise. If it throws, the draft is kept and the error
 *     is shown.
 */
export default function SpeakDreamScreen({ onSave }) {
  const dictation = useDreamDictation();
  const { status, transcript, setTranscript, interim, error } = dictation;
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [savedMessage, setSavedMessage] = useState(null);
  const [category, setCategory] = useState('Uncategorized');
  const [confirmClear, setConfirmClear] = useState(false);
  const clearTimer = useRef(null);

  useEffect(() => () => clearTimeout(clearTimer.current), []);

  const listening = status === DictationStatus.listening;
  const micDisabled = status === DictationStatus.requesting || status === DictationStatus.stopping;
  const textEditable = !dictation.isBusy && !saving;
  const draft = listening || status === DictationStatus.stopping ? [transcript, interim].filter(Boolean).join(' ') : transcript;
  const canSave = transcript.trim().length > 0 && !dictation.isBusy && !saving;

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  function handleMicPress() {
    setSavedMessage(null);
    if (listening) dictation.stop();
    else dictation.start();
  }

  function handleClear() {
    if (!confirmClear) {
      setConfirmClear(true);
      clearTimeout(clearTimer.current);
      clearTimer.current = setTimeout(() => setConfirmClear(false), 3000);
      return;
    }
    clearTimeout(clearTimer.current);
    setConfirmClear(false);
    setSaveError(null);
    dictation.reset();
  }

  async function handleSave() {
    const text = transcript.trim();
    if (!text) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave?.({ text, category, createdAt: new Date().toISOString() });
      dictation.reset();
      setCategory('Uncategorized');
      setSavedMessage('Dream saved.');
    } catch (caught) {
      setSaveError(caught?.message || 'Could not save this dream. Your text is still here, so try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          <View style={styles.heading}>
            <Text style={styles.eyebrow}>{today}</Text>
            <Text accessibilityRole="header" style={styles.title}>
              Speak a dream
            </Text>
            <Text style={styles.description}>
              Describe it while it&apos;s still fresh. You can fix the words before you save.
            </Text>
          </View>

          {dictation.unavailableReason ? (
            <View style={[styles.message, styles.infoMessage]}>
              <Text style={styles.messageText}>{dictation.unavailableReason}</Text>
            </View>
          ) : (
            <View style={styles.card}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={listening ? 'Stop listening' : 'Start speaking'}
                accessibilityState={{ disabled: micDisabled, busy: micDisabled }}
                disabled={micDisabled}
                onPress={handleMicPress}
                style={({ pressed }) => [
                  styles.micButton,
                  listening && styles.micButtonListening,
                  micDisabled && styles.micButtonDisabled,
                  pressed && styles.pressed,
                ]}
              >
                {micDisabled ? (
                  <ActivityIndicator color={colors.accent} />
                ) : (
                  <View style={[styles.micIcon, listening && styles.stopIcon]} />
                )}
                <Text style={[styles.micLabel, listening && styles.micLabelListening]}>{MIC_LABELS[status]}</Text>
              </Pressable>

              <View style={styles.statusRow} accessibilityLiveRegion="polite">
                <View style={[styles.statusDot, listening && styles.statusDotLive]} />
                <Text style={styles.statusText}>
                  {listening
                    ? `Listening · ${formatElapsed(dictation.elapsedMs)}`
                    : status === DictationStatus.stopping
                      ? 'Catching your last words…'
                      : status === DictationStatus.requesting
                        ? 'Allow the microphone to continue.'
                        : transcript
                          ? 'Tap to keep talking. New words are added to the end.'
                          : 'Tap the button and start talking.'}
                </Text>
              </View>
            </View>
          )}

          {error ? (
            <View style={[styles.message, styles.errorMessage]} accessibilityLiveRegion="assertive">
              <Text style={styles.messageText}>{error.message}</Text>
              <View style={styles.messageActions}>
                {error.kind === 'permission' && !error.canAskAgain ? (
                  <SmallButton title="Open Settings" onPress={dictation.openSettings} />
                ) : null}
                <SmallButton title="Dismiss" onPress={dictation.clearError} />
              </View>
            </View>
          ) : null}

          {savedMessage ? (
            <View style={[styles.message, styles.successMessage]} accessibilityLiveRegion="polite">
              <Text style={styles.messageText}>{savedMessage}</Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <View style={styles.labelRow}>
              <Text style={styles.fieldLabel}>Your dream</Text>
              <Text style={styles.countText}>{wordCount(draft)} words</Text>
            </View>
            <TextInput
              accessibilityLabel="Dream transcript"
              multiline
              editable={textEditable}
              value={draft}
              onChangeText={(value) => {
                setSavedMessage(null);
                setTranscript(value);
              }}
              placeholder="Your words will appear here as you speak. You can also type."
              placeholderTextColor={colors.muted}
              style={[styles.input, !textEditable && styles.inputLocked]}
              textAlignVertical="top"
            />
            {dictation.isBusy ? (
              <Text style={styles.hint}>You can edit the text once listening stops.</Text>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Category</Text>
            <CategoryPicker value={category} onChange={setCategory} />
          </View>

          {saveError ? (
            <View style={[styles.message, styles.errorMessage]}>
              <Text style={styles.messageText}>{saveError}</Text>
            </View>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSave }}
              disabled={!canSave}
              onPress={handleSave}
              style={({ pressed }) => [styles.primaryButton, !canSave && styles.buttonDisabled, pressed && styles.pressed]}
            >
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Save dream</Text>}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={dictation.isBusy || saving || !transcript}
              onPress={handleClear}
              style={({ pressed }) => [
                styles.secondaryButton,
                (dictation.isBusy || saving || !transcript) && styles.buttonDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.secondaryButtonText, confirmClear && styles.destructiveText]}>
                {confirmClear ? 'Tap again to clear' : 'Clear'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SmallButton({ title, onPress }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}>
      <Text style={styles.smallButtonText}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.background },
  page: { padding: 20, paddingBottom: 36, gap: 16, width: '100%', maxWidth: 640, alignSelf: 'center' },
  heading: { gap: 6, marginTop: 4 },
  eyebrow: { color: colors.accent, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  title: { color: colors.ink, fontSize: 30, fontWeight: '800' },
  description: { color: colors.muted, fontSize: 16, lineHeight: 23 },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  micButton: {
    minHeight: 64,
    borderRadius: 32,
    backgroundColor: colors.accentSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 20,
  },
  micButtonListening: { backgroundColor: colors.recordingSoft },
  micButtonDisabled: { opacity: 0.7 },
  micIcon: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.accent },
  stopIcon: { borderRadius: 3, backgroundColor: colors.recording },
  micLabel: { color: colors.accent, fontSize: 18, fontWeight: '700' },
  micLabelListening: { color: colors.recording },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  statusDotLive: { backgroundColor: colors.recording },
  statusText: { color: colors.muted, fontSize: 14, flex: 1 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  fieldLabel: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  countText: { color: colors.muted, fontSize: 13 },
  input: {
    minHeight: 180,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    color: colors.ink,
    fontSize: 16,
    lineHeight: 23,
    backgroundColor: '#FCFBFF',
  },
  inputLocked: { backgroundColor: colors.background },
  hint: { color: colors.muted, fontSize: 13 },
  message: { borderRadius: 12, padding: 14, gap: 10, borderWidth: 1 },
  infoMessage: { backgroundColor: colors.accentSoft, borderColor: colors.border },
  errorMessage: { backgroundColor: colors.errorSoft, borderColor: '#F5C2BC' },
  successMessage: { backgroundColor: colors.successSoft, borderColor: '#B9E3CC' },
  messageText: { color: colors.ink, fontSize: 15, lineHeight: 21 },
  messageActions: { flexDirection: 'row', gap: 8 },
  smallButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  smallButtonText: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  actions: { gap: 10 },
  primaryButton: {
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  destructiveText: { color: colors.error },
  buttonDisabled: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
});
