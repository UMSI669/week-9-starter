import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Banner, Body, Button, ButtonRow, Card, colors, Field, Pill, ProgressBar, Screen, SectionTitle, ToggleRow } from '../components/ui';
import { SAMPLE_INTERVIEWS } from '../data/samples';
import { CLOUD_MODELS, isPlausibleModelId } from '../services/analysis/models';
import { verifyApiKey } from '../services/analysis/openRouter';
import { formatBytes, LOCAL_MODELS, type LocalModel } from '../services/localModels/catalog';
import { deleteModel, downloadModel, getModelStatus } from '../services/localModels/manager';
import { evaluateRedaction, SAMPLE_GROUND_TRUTH } from '../services/privacy/evaluation';
import { loadLocalLlm } from '../services/privacy/localLlm';
import { maskSegments } from '../services/privacy/placeholders';
import { runDetection } from '../services/privacy/redaction';
import { MVP, runtimeMode } from '../services/runtime';
import { deleteApiKey, getApiKey, maskKeyForDisplay, saveApiKey } from '../services/secure/credentials';
import { useAppDispatch, useAppSelector } from '../store';
import { settingsActions } from '../store/settingsSlice';
import { wipeAllData } from '../store/thunks';
import { isAbortError, safeErrorMessage } from '../utils/safeError';

export default function SettingsScreen() {
  const dispatch = useAppDispatch();
  const settings = useAppSelector((s) => s.settings);
  const [storedKey, setStoredKey] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [keyMessage, setKeyMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [customModel, setCustomModel] = useState('');
  const [, setTick] = useState(0);
  const [downloads, setDownloads] = useState<Record<string, number | null>>({});
  const [benchmark, setBenchmark] = useState<string | null>(null);
  const [benchmarking, setBenchmarking] = useState(false);
  const controllers = useRef<Record<string, AbortController>>({});

  useFocusEffect(
    useCallback(() => {
      getApiKey().then(setStoredKey).catch(() => setStoredKey(null));
    }, []),
  );

  const set = (changes: Partial<typeof settings>) => dispatch(settingsActions.settingsChanged(changes));

  const save = async () => {
    try {
      await saveApiKey(keyInput);
      setStoredKey(keyInput.trim());
      setKeyInput('');
      setKeyMessage({ tone: 'success', text: 'Saved to the iOS Keychain on this device.' });
    } catch (e) {
      setKeyMessage({ tone: 'danger', text: safeErrorMessage(e) });
    }
  };

  const test = async () => {
    if (!storedKey) return;
    try {
      const info = await verifyApiKey(storedKey);
      setKeyMessage({
        tone: 'success',
        text: `Key works${info.label ? ` (${info.label})` : ''}${typeof info.limitRemaining === 'number' ? ` · $${info.limitRemaining.toFixed(2)} limit remaining` : ''}. No research data was sent.`,
      });
    } catch (e) {
      setKeyMessage({ tone: 'danger', text: safeErrorMessage(e) });
    }
  };

  const startDownload = async (model: LocalModel) => {
    const controller = new AbortController();
    controllers.current[model.id] = controller;
    setDownloads((d) => ({ ...d, [model.id]: 0 }));
    try {
      await downloadModel(model, { signal: controller.signal, onProgress: (p) => setDownloads((d) => ({ ...d, [model.id]: p })) });
    } catch (e) {
      if (!isAbortError(e)) Alert.alert('Download failed', safeErrorMessage(e));
    } finally {
      delete controllers.current[model.id];
      setDownloads((d) => {
        const next = { ...d };
        delete next[model.id];
        return next;
      });
    }
  };

  /** Benchmarks the selected local LLM on the synthetic interviews: time + missed identifiers. */
  const runBenchmark = async () => {
    setBenchmarking(true);
    setBenchmark('Loading model…');
    try {
      const loadStart = Date.now();
      const llm = await loadLocalLlm(settings.llmModel);
      const loadMs = Date.now() - loadStart;
      const lines = [`Model load: ${(loadMs / 1000).toFixed(1)} s`];
      try {
        for (const sample of SAMPLE_INTERVIEWS) {
          setBenchmark(`${lines.join('\n')}\nRunning ${sample.title}…`);
          const segments = sample.segments.map((s) => ({ ...s, recognizedText: s.text, edited: false }));
          const t0 = Date.now();
          const state = await runDetection({ segments, knownIdentifiers: [], llm: { complete: llm.complete, modelId: llm.modelId } });
          const evaluation = evaluateRedaction(segments, maskSegments(segments, state.spans, state.identityMap), state.spans, SAMPLE_GROUND_TRUTH[sample.id]);
          lines.push(
            `${sample.participantLabel}: ${((Date.now() - t0) / 1000).toFixed(1)} s, ${state.stats?.chunks} chunks, ${state.stats?.llmEntities ?? 0} model entities, recall ${(evaluation.recall * 100).toFixed(0)}%${evaluation.missed.length ? `, missed ${evaluation.missed.length}` : ''}`,
          );
        }
      } finally {
        await llm.release();
      }
      setBenchmark(lines.join('\n'));
    } catch (e) {
      setBenchmark(`Benchmark failed: ${safeErrorMessage(e)}`);
    } finally {
      setBenchmarking(false);
    }
  };

  const confirmWipe = () =>
    Alert.alert('Delete all local data?', 'Removes every project, interview, audio file, transcript, identity mapping and analysis from this iPhone. Your API key and downloaded models are kept.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete everything', style: 'destructive', onPress: () => dispatch(wipeAllData()) },
    ]);

  const renderModel = (model: LocalModel, selectedId: string, select: (id: string) => void) => {
    const status = runtimeMode === 'full' ? getModelStatus(model) : 'missing';
    const progress = downloads[model.id];
    const downloading = model.id in downloads;
    const selected = model.id === selectedId;
    return (
      <View key={model.id} style={{ gap: 6, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }}>
        <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => select(model.id)} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Text style={{ fontSize: 18, color: selected ? colors.primary : colors.faint }}>{selected ? '●' : '○'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', color: colors.ink }}>
              {model.name} {model.recommended ? <Text style={{ color: colors.success }}>· recommended</Text> : null}
            </Text>
            <Text style={{ fontSize: 13, color: colors.muted }}>
              {formatBytes(model.sizeBytes)} · {model.description}
            </Text>
          </View>
          <Pill label={status === 'ready' ? 'Ready' : status === 'incomplete' ? 'Incomplete' : 'Not downloaded'} tone={status === 'ready' ? 'success' : 'warning'} />
        </Pressable>
        {downloading ? (
          <View style={{ gap: 6 }}>
            <ProgressBar value={progress ?? null} />
            <Button small variant="secondary" title="Cancel download" onPress={() => controllers.current[model.id]?.abort()} />
          </View>
        ) : runtimeMode === 'full' ? (
          <ButtonRow>
            {status !== 'ready' ? <Button small variant="secondary" title={`Download (${formatBytes(model.sizeBytes)})`} onPress={() => void startDownload(model)} /> : null}
            {status !== 'missing' ? (
              <Button
                small
                variant="ghost"
                title="Delete"
                onPress={() => {
                  deleteModel(model);
                  setTick((t) => t + 1);
                }}
              />
            ) : null}
          </ButtonRow>
        ) : null}
      </View>
    );
  };

  return (
    <Screen>
      <Card>
        <SectionTitle right={<Pill label={runtimeMode === 'full' ? 'Development build' : 'Expo Go demo'} tone={runtimeMode === 'full' ? 'success' : 'demo'} />}>Runtime</SectionTitle>
        <Body muted>
          Supported: {MVP.supportedDevices}, iOS {MVP.minimumIos}+, English (US) interviews up to about {MVP.recommendedRecordingMinutes} minutes.
        </Body>
      </Card>

      <Card>
        <SectionTitle>OpenRouter API key</SectionTitle>
        <Body muted>
          Your own key, stored only in this iPhone’s Keychain (this-device-only: not synced or restored to other devices, never in the app bundle). Create one at
          openrouter.ai/keys and set a spending limit on it.
        </Body>
        {storedKey ? <Text style={{ fontFamily: 'Menlo', color: colors.ink }}>{maskKeyForDisplay(storedKey)}</Text> : null}
        <Field
          label={storedKey ? 'Replace key' : 'Paste key'}
          value={keyInput}
          onChangeText={setKeyInput}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="sk-or-…"
          textContentType="password"
        />
        <ButtonRow>
          <Button small title="Save" onPress={save} disabled={!keyInput.trim()} />
          <Button small variant="secondary" title="Test key" onPress={test} disabled={!storedKey} />
          <Button
            small
            variant="ghost"
            title="Remove"
            disabled={!storedKey}
            onPress={async () => {
              await deleteApiKey();
              setStoredKey(null);
              setKeyMessage(null);
            }}
          />
        </ButtonRow>
        {keyMessage ? <Banner tone={keyMessage.tone}>{keyMessage.text}</Banner> : null}
      </Card>

      <Card>
        <SectionTitle>Cloud analysis model</SectionTitle>
        {CLOUD_MODELS.map((model) => {
          const selected = settings.cloudModel === model.id;
          return (
            <Pressable key={model.id} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => set({ cloudModel: model.id })} style={{ flexDirection: 'row', gap: 8, paddingVertical: 6 }}>
              <Text style={{ fontSize: 18, color: selected ? colors.primary : colors.faint }}>{selected ? '●' : '○'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', color: colors.ink }}>{model.name}</Text>
                <Text style={{ fontSize: 13, color: colors.muted }}>
                  {model.blurb} ${model.inputPerM}/${model.outputPerM} per M tokens.
                </Text>
              </View>
            </Pressable>
          );
        })}
        {!CLOUD_MODELS.some((m) => m.id === settings.cloudModel) ? <Body>Custom: {settings.cloudModel}</Body> : null}
        <Field label="Custom OpenRouter model id" value={customModel} onChangeText={setCustomModel} autoCapitalize="none" autoCorrect={false} placeholder="provider/model" hint="Must support structured outputs (json_schema)." />
        <Button small variant="secondary" title="Use custom model" disabled={!isPlausibleModelId(customModel)} onPress={() => set({ cloudModel: customModel.trim() })} />
      </Card>

      <Card>
        <SectionTitle>Provider privacy controls</SectionTitle>
        <ToggleRow
          label="Exclude providers that store or train on data"
          description='Sends OpenRouter provider.data_collection = "deny".'
          value={settings.denyDataCollection}
          onValueChange={(denyDataCollection) => set({ denyDataCollection })}
        />
        <ToggleRow
          label="Zero Data Retention endpoints only"
          description="Sends provider.zdr = true. Some models have no ZDR endpoint and will fail with a clear message."
          value={settings.requireZdr}
          onValueChange={(requireZdr) => set({ requireZdr })}
        />
        <Body muted>Also review your account-level privacy settings at openrouter.ai/settings/privacy.</Body>
      </Card>

      <Card>
        <SectionTitle>On-device models</SectionTitle>
        {runtimeMode === 'demo' ? (
          <Banner tone="demo">Model downloads and local inference are available in the development build only.</Banner>
        ) : (
          <Body muted>Downloaded once over HTTPS from Hugging Face and stored in the app’s cache (excluded from iCloud backup). Inference never leaves the device.</Body>
        )}
        <Text style={{ fontWeight: '700', color: colors.ink, marginTop: 4 }}>Speech-to-text (Whisper)</Text>
        {LOCAL_MODELS.filter((m) => m.kind === 'whisper').map((m) => renderModel(m, settings.whisperModel, (whisperModel) => set({ whisperModel })))}
        <Text style={{ fontWeight: '700', color: colors.ink, marginTop: 8 }}>Sensitive-span detection (Qwen / Llama)</Text>
        {LOCAL_MODELS.filter((m) => m.kind === 'llm').map((m) => renderModel(m, settings.llmModel, (llmModel) => set({ llmModel })))}
        {runtimeMode === 'full' ? (
          <>
            <Button variant="secondary" title="Benchmark selected masking model" onPress={runBenchmark} loading={benchmarking} disabled={getModelStatus(LOCAL_MODELS.find((m) => m.id === settings.llmModel)!) !== 'ready'} />
            {benchmark ? <Text style={{ fontFamily: 'Menlo', fontSize: 12, color: colors.ink }}>{benchmark}</Text> : null}
          </>
        ) : null}
      </Card>

      <Card>
        <SectionTitle>Local data</SectionTitle>
        <Body muted>
          Everything is stored in the app’s private Documents folder, protected by iOS Data Protection. iOS device backups include it.
          The app has no analytics or crash reporting, and error messages never contain transcript text or keys.
        </Body>
        <Button variant="danger" title="Delete all local research data" onPress={confirmWipe} />
      </Card>
    </Screen>
  );
}
