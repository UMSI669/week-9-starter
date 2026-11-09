/**
 * Settings: transcription mode, configuration status, and demo data.
 *
 * The configuration panel reports what is actually true — whether a backend
 * URL exists, whether that backend answers, and which models it has
 * configured. It never claims a capability it has not confirmed, and it never
 * displays a key, because the app does not have one.
 */

import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import {
  addDemoDreams,
  countDemos,
  loadDreams,
  removeDemoDreams,
  selectDemoCount,
  selectDreams,
} from '../store/dreamsSlice';
import { selectTranscriptionMode, setTranscriptionMode } from '../store/settingsSlice';
import {
  MODE_DESCRIPTIONS,
  MODE_LABELS,
  TRANSCRIPTION_MODES,
  nativeStt,
} from '../services/stt';
import { apiConfig, fetchBackendStatus, getMissingApiConfig } from '../services/apiClient';
import { DEMO_DREAM_COUNT } from '../services/seedDreams';
import { DATABASE_NAME, DREAM_SCHEMA_VERSION } from '../services/db';
import {
  Button,
  Card,
  Divider,
  PageHeading,
  Screen,
  SectionTitle,
  StatusMessage,
} from '../components/ui';
import { colors, fontSizes, radii, spacing, touchTarget } from '../theme';

export default function SettingsScreen() {
  const dispatch = useDispatch();
  const mode = useSelector(selectTranscriptionMode);
  const demoCount = useSelector(selectDemoCount);
  const dreams = useSelector(selectDreams);

  const [speech, setSpeech] = useState(null);
  const [backend, setBackend] = useState(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(null);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    dispatch(countDemos());
    // A real runtime capability check, not an assumption from the platform.
    nativeStt.getAvailability().then(setSpeech).catch(() => setSpeech(null));
  }, [dispatch]);

  // The first check runs from an effect, so its state updates happen in the
  // async continuation rather than synchronously inside the effect body.
  useEffect(() => {
    let cancelled = false;
    fetchBackendStatus().then((result) => {
      if (cancelled) return;
      setBackend(result);
      setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /** The "Check again" button. Here a synchronous update is exactly right. */
  const checkBackend = useCallback(async () => {
    setChecking(true);
    setBackend(await fetchBackendStatus());
    setChecking(false);
  }, []);

  const missing = getMissingApiConfig();

  async function chooseMode(next) {
    if (next === TRANSCRIPTION_MODES.CLOUD) {
      Alert.alert(
        'Use cloud transcription?',
        'In this mode the audio recording is uploaded to this app’s backend and forwarded to ' +
          'OpenRouter. The recording leaves your phone. Phone transcription and typing never ' +
          'upload audio.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Use cloud mode',
            onPress: () => dispatch(setTranscriptionMode(next)),
          },
        ],
      );
      return;
    }
    dispatch(setTranscriptionMode(next));
  }

  async function run(key, action, message) {
    setBusy(key);
    setStatus(null);
    try {
      await action();
      setStatus({ tone: 'success', text: message });
      await dispatch(loadDreams());
    } catch (error) {
      setStatus({ tone: 'error', text: error?.message || 'That did not work.' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <PageHeading
        eyebrow="Settings"
        title="How Dream Decoder works"
        description="Everything here is stored on this device."
      />

      {status ? (
        <StatusMessage tone={status.tone} announce>
          {status.text}
        </StatusMessage>
      ) : null}

      {/* ------------------------- transcription mode ------------------------- */}
      <Card>
        <SectionTitle>Transcription mode</SectionTitle>
        {Object.values(TRANSCRIPTION_MODES).map((option) => {
          const selected = mode === option;
          const disabled =
            option === TRANSCRIPTION_MODES.PHONE && speech && speech.available === false;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled: Boolean(disabled) }}
              accessibilityLabel={`${MODE_LABELS[option]}. ${MODE_DESCRIPTIONS[option]}`}
              disabled={Boolean(disabled)}
              onPress={() => chooseMode(option)}
              style={({ pressed }) => [
                styles.modeRow,
                selected && styles.modeRowSelected,
                disabled && styles.modeRowDisabled,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.modeHeader}>
                <Text style={styles.modeLabel}>{MODE_LABELS[option]}</Text>
                {/* A word, not just a colour. */}
                <Text style={styles.modeState}>{selected ? 'Selected ✓' : 'Not selected'}</Text>
              </View>
              <Text style={styles.modeDescription}>{MODE_DESCRIPTIONS[option]}</Text>
              {disabled ? (
                <Text style={styles.modeWarning}>
                  Unavailable on this device or build. You can still type your dreams.
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </Card>

      {/* ------------------------- phone speech status ------------------------ */}
      <Card>
        <SectionTitle>Phone speech service</SectionTitle>
        {speech ? (
          <>
            <StatusLine
              label="Available"
              value={speech.available ? 'Yes' : 'No'}
              tone={speech.available ? 'good' : 'bad'}
            />
            <StatusLine
              label="Permission granted"
              value={speech.permissionGranted ? 'Yes' : 'Not yet'}
              tone={speech.permissionGranted ? 'good' : 'neutral'}
            />
            {Platform.OS === 'android' && Array.isArray(speech.services) ? (
              <StatusLine
                label="Installed services"
                value={speech.services.length > 0 ? speech.services.join(', ') : 'None reported'}
                tone={speech.services.length > 0 ? 'good' : 'neutral'}
              />
            ) : null}
            <Text style={styles.note}>{speech.message}</Text>
          </>
        ) : (
          <Text style={styles.note}>Checking the device speech service...</Text>
        )}
        <Text style={styles.note}>
          Phone transcription uses the operating system&apos;s own speech service. Depending on the
          device and its installed language packs, the OS may process the audio locally or on its
          own servers. The app cannot tell which, so it does not promise offline transcription.
        </Text>
      </Card>

      {/* --------------------------- backend status --------------------------- */}
      <Card>
        <SectionTitle>AI backend</SectionTitle>

        {missing.length > 0 ? (
          <StatusMessage tone="warning">
            Not configured. Missing: {missing.join(', ')}. Add them to .env and restart the dev
            server. Recording, typing, editing, the cloud map, the moon, and export all work
            without it.
          </StatusMessage>
        ) : null}

        <StatusLine
          label="Backend URL"
          value={apiConfig.baseUrl || 'Not set'}
          tone={apiConfig.baseUrl ? 'neutral' : 'bad'}
        />
        <StatusLine
          label="Access token"
          value={apiConfig.authToken ? 'Set' : 'Not set'}
          tone={apiConfig.authToken ? 'good' : 'bad'}
        />
        <StatusLine
          label="Reachable"
          value={checking ? 'Checking...' : backend?.reachable ? 'Yes' : 'No'}
          tone={backend?.reachable ? 'good' : checking ? 'neutral' : 'bad'}
        />
        {backend?.reachable ? (
          <>
            <StatusLine
              label="Analysis model"
              value={backend.analysis?.model || 'Not configured on the server'}
              tone={backend.analysis?.configured ? 'good' : 'bad'}
            />
            <StatusLine
              label="Cloud transcription"
              value={
                backend.transcription?.configured
                  ? backend.transcription.model
                  : 'Disabled on the server'
              }
              tone={backend.transcription?.configured ? 'good' : 'neutral'}
            />
          </>
        ) : null}

        <Button
          title="Check again"
          variant="secondary"
          busy={checking}
          onPress={checkBackend}
        />

        <Divider />
        <Text style={styles.note}>
          The OpenRouter key lives only on the backend. This app holds a backend URL and an access
          token, nothing else. Values beginning with EXPO_PUBLIC_ are compiled into the app and are
          readable by anyone who has it, which is why no provider key is kept here.
        </Text>
      </Card>

      {/* ----------------------------- demo data ------------------------------ */}
      <Card>
        <SectionTitle>Demo data</SectionTitle>
        <Text style={styles.note}>
          Dream Decoder ships with {DEMO_DREAM_COUNT} hand-written sample dreams so the gallery and
          the cloud map have something to show on a fresh install. They were not produced by an AI
          model. Every sample is marked DEMO DATA on its card.
        </Text>
        <StatusLine label="Samples on this device" value={String(demoCount)} tone="neutral" />
        <StatusLine
          label="Dreams in total"
          value={String(dreams.length)}
          tone="neutral"
        />

        {demoCount > 0 ? (
          <Button
            title="Remove all demo dreams"
            variant="danger"
            busy={busy === 'removeDemos'}
            onPress={() =>
              Alert.alert(
                'Remove the demo dreams?',
                `This deletes the ${demoCount} sample ${demoCount === 1 ? 'dream' : 'dreams'}. Dreams you recorded yourself are not touched.`,
                [
                  { text: 'Keep them', style: 'cancel' },
                  {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: () =>
                      run(
                        'removeDemos',
                        () => dispatch(removeDemoDreams()).unwrap(),
                        'The demo dreams were removed.',
                      ),
                  },
                ],
              )
            }
          />
        ) : (
          <Button
            title="Add the demo dreams back"
            variant="secondary"
            busy={busy === 'addDemos'}
            onPress={() =>
              run(
                'addDemos',
                () => dispatch(addDemoDreams()).unwrap(),
                `${DEMO_DREAM_COUNT} demo dreams were added.`,
              )
            }
          />
        )}
      </Card>

      {/* ------------------------------ storage ------------------------------- */}
      <Card>
        <SectionTitle>Storage</SectionTitle>
        <StatusLine label="Database" value={DATABASE_NAME} tone="neutral" />
        <StatusLine label="Schema version" value={String(DREAM_SCHEMA_VERSION)} tone="neutral" />
        <Text style={styles.note}>
          Dreams are stored in a local SQLite database in this app&apos;s own storage. They survive
          app restarts and updates. This app does not encrypt them, does not back them up, and does
          not sync them anywhere. Deleting the app deletes the dreams. Audio recordings are not
          kept: they are deleted as soon as a transcript exists.
        </Text>
      </Card>

      <Card>
        <SectionTitle>About</SectionTitle>
        <Text style={styles.note}>
          Dream Decoder offers reflective possibilities, not scientific, diagnostic, supernatural,
          or predictive conclusions. The moon phase is calculated on the device from the current
          date and is approximate. No location permission is used.
        </Text>
      </Card>
    </Screen>
  );
}

/** A labelled value row. The tone adds colour; the words carry the meaning. */
function StatusLine({ label, value, tone = 'neutral' }) {
  const toneColor =
    tone === 'good' ? colors.success : tone === 'bad' ? colors.danger : colors.textSecondary;
  return (
    <View accessibilityLabel={`${label}: ${value}`} style={styles.statusLine}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={[styles.statusValue, { color: toneColor }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  modeRow: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.xs,
    minHeight: touchTarget,
    padding: spacing.md,
  },
  modeRowSelected: { borderColor: colors.accent, borderWidth: 2 },
  modeRowDisabled: { opacity: 0.55 },
  modeHeader: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  modeLabel: { color: colors.textPrimary, flex: 1, fontSize: fontSizes.body, fontWeight: '700' },
  modeState: { color: colors.accent, fontSize: fontSizes.caption, fontWeight: '700' },
  modeDescription: { color: colors.textSecondary, fontSize: fontSizes.small, lineHeight: 19 },
  modeWarning: { color: colors.warning, fontSize: fontSizes.caption, lineHeight: 17 },
  statusLine: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  statusLabel: { color: colors.textMuted, fontSize: fontSizes.small, fontWeight: '600' },
  statusValue: {
    flex: 1,
    fontSize: fontSizes.small,
    fontWeight: '700',
    textAlign: 'right',
  },
  note: { color: colors.textMuted, fontSize: fontSizes.caption, lineHeight: 18 },
  pressed: { opacity: 0.75 },
});
