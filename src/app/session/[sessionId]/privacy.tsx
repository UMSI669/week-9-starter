import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { HighlightedText, MaskedText } from '../../../components/HighlightedText';
import { Banner, Body, Button, ButtonRow, Card, colors, Empty, Field, Pill, ProgressBar, Screen, SectionTitle, Segmented, ToggleRow } from '../../../components/ui';
import type { EntityCategory, RedactionSpan } from '../../../models/types';
import { getLocalModel } from '../../../services/localModels/catalog';
import { getModelStatus } from '../../../services/localModels/manager';
import { loadLocalLlm, type LocalLlm } from '../../../services/privacy/localLlm';
import { findLeaks, identityKey, maskSegments } from '../../../services/privacy/placeholders';
import { addManualPhrase, reviewFingerprint, runDetection, setSpanCategory, setSpanStatus, transcriptFingerprint } from '../../../services/privacy/redaction';
import { reconcileSpans } from '../../../services/privacy/spans';
import { runtimeMode } from '../../../services/runtime';
import { useAppDispatch, useAppSelector } from '../../../store';
import { dataActions } from '../../../store/dataSlice';
import { settingsActions } from '../../../store/settingsSlice';
import { formatLocal, formatMs } from '../../../utils/ids';
import { isAbortError, safeErrorMessage } from '../../../utils/safeError';

const CATEGORIES: { value: EntityCategory; label: string }[] = [
  { value: 'PERSON', label: 'Person' },
  { value: 'ORG', label: 'Org' },
  { value: 'LOCATION', label: 'Place' },
  { value: 'ID', label: 'ID' },
  { value: 'CONTEXT', label: 'Context' },
];

type View_ = 'changes' | 'original' | 'cloud';

export default function PrivacyScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const dispatch = useAppDispatch();
  const session = useAppSelector((s) => s.data.sessions[sessionId]);
  const project = useAppSelector((s) => (session ? s.data.projects[session.projectId] : undefined));
  const settings = useAppSelector((s) => s.settings);

  const [view, setView] = useState<View_>('changes');
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [phrase, setPhrase] = useState('');
  const [phraseCategory, setPhraseCategory] = useState<EntityCategory>('PERSON');
  const controllerRef = useRef<AbortController | null>(null);

  useFocusEffect(useCallback(() => () => controllerRef.current?.abort(), []));

  const llmModel = getLocalModel(settings.llmModel);
  const llmReady = runtimeMode === 'full' && llmModel !== undefined && getModelStatus(llmModel) === 'ready';
  const useLlm = llmReady && settings.useLocalLlm;

  const redaction = session?.redaction;
  const segments = useMemo(() => session?.segments ?? [], [session?.segments]);
  const spans = useMemo(() => (redaction ? reconcileSpans(segments, redaction.spans) : []), [redaction, segments]);
  const identityMap = useMemo(() => redaction?.identityMap ?? {}, [redaction]);
  const masked = useMemo(() => maskSegments(segments, spans, identityMap), [segments, spans, identityMap]);
  const leaks = useMemo(() => findLeaks(masked, spans), [masked, spans]);
  const maskedFingerprint = useMemo(() => reviewFingerprint(segments, { spans, identityMap }), [segments, spans, identityMap]);
  const stale = redaction ? redaction.transcriptFingerprint !== transcriptFingerprint(segments) : false;
  const approved = Boolean(redaction?.reviewedAt && redaction.reviewedFingerprint === maskedFingerprint);

  /** Entities grouped by placeholder, so one decision applies to every occurrence. */
  const groups = useMemo(() => {
    const map = new Map<string, { placeholder: string; category: EntityCategory; texts: Set<string>; spans: RedactionSpan[]; sources: Set<string> }>();
    for (const span of spans) {
      const placeholder = identityMap[identityKey(span.category, span.text)] ?? `[${span.category}]`;
      const key = span.status === 'rejected' ? `rejected:${span.text.toLowerCase()}` : placeholder;
      const group = map.get(key) ?? { placeholder: span.status === 'rejected' ? 'Not masked' : placeholder, category: span.category, texts: new Set(), spans: [], sources: new Set() };
      group.texts.add(span.text);
      group.spans.push(span);
      group.sources.add(span.source);
      map.set(key, group);
    }
    return [...map.values()].sort((a, b) => a.placeholder.localeCompare(b.placeholder));
  }, [spans, identityMap]);

  if (!session || !project) return <Empty title="Interview not found" />;
  if (segments.length === 0) {
    return (
      <Screen>
        <Empty title="No transcript yet">
          <Button title="Go to transcript" onPress={() => router.replace({ pathname: '/session/[sessionId]/transcript', params: { sessionId } })} />
        </Empty>
      </Screen>
    );
  }

  const detect = async () => {
    const controller = new AbortController();
    controllerRef.current = controller;
    setError('');
    setProgress(null);
    let llm: LocalLlm | undefined;
    try {
      if (useLlm) {
        setBusy(`Loading ${llmModel!.name}…`);
        llm = await loadLocalLlm(settings.llmModel, (p) => setProgress(p));
        setBusy('Local model scanning transcript…');
      } else {
        setBusy('Scanning transcript…');
      }
      const result = await runDetection({
        segments,
        knownIdentifiers: project.knownIdentifiers,
        previous: redaction,
        llm: llm ? { complete: llm.complete, modelId: llm.modelId } : undefined,
        signal: controller.signal,
        onProgress: ({ chunkIndex, chunkCount }) => {
          setProgress(chunkCount ? chunkIndex / chunkCount : null);
          setBusy(`Local model: part ${Math.min(chunkIndex + 1, chunkCount)} of ${chunkCount}`);
        },
      });
      dispatch(dataActions.redactionSet({ id: session.id, redaction: result }));
    } catch (e) {
      if (!isAbortError(e)) setError(`${safeErrorMessage(e, 'Detection failed.')} Pattern-only detection is still available.`);
    } finally {
      await llm?.release().catch(() => undefined);
      controllerRef.current = null;
      setBusy(null);
      setProgress(null);
    }
  };

  const setGroupStatus = (groupSpans: RedactionSpan[], status: RedactionSpan['status']) =>
    redaction && dispatch(dataActions.redactionSet({ id: session.id, redaction: setSpanStatus({ ...redaction, spans }, groupSpans.map((s) => s.id), status) }));

  const changeGroupCategory = (groupSpans: RedactionSpan[], category: EntityCategory) =>
    redaction && dispatch(dataActions.redactionSet({ id: session.id, redaction: setSpanCategory({ ...redaction, spans }, groupSpans.map((s) => s.id), category) }));

  const addPhrase = () => {
    if (!redaction) return;
    const { state, added } = addManualPhrase({ ...redaction, spans }, segments, phrase, phraseCategory);
    if (added === 0) {
      setError(`"${phrase}" was not found as a whole word in the transcript.`);
      return;
    }
    setError('');
    setPhrase('');
    dispatch(dataActions.redactionSet({ id: session.id, redaction: state }));
  };

  return (
    <Screen>
      <Card>
        <SectionTitle>Detection</SectionTitle>
        {runtimeMode === 'demo' ? (
          <Banner tone="demo" title="Simplified masking (demo)">
            Expo Go uses TypeScript pattern matching and your “Always mask” list only. The development build adds the on-device
            Qwen/Llama model for names and context that patterns miss. Review every interview carefully either way.
          </Banner>
        ) : (
          <ToggleRow
            label={`Also use local model${llmModel ? ` (${llmModel.name})` : ''}`}
            description={llmReady ? 'Runs fully on this iPhone, in chunks, before patterns are merged.' : 'Download the model in Settings to enable.'}
            value={useLlm}
            disabled={!llmReady}
            onValueChange={(useLocalLlm) => dispatch(settingsActions.settingsChanged({ useLocalLlm }))}
          />
        )}
        {redaction ? (
          <Body muted>
            Last run {formatLocal(redaction.detectedAt)} · {redaction.detector === 'patterns' ? 'patterns' : `patterns + ${redaction.localModelId}`} ·{' '}
            {redaction.stats ? `${(redaction.stats.durationMs / 1000).toFixed(1)} s` : ''}
            {redaction.stats?.chunks ? ` · ${redaction.stats.chunks} chunks` : ''}
          </Body>
        ) : (
          <Body muted>No detection yet.</Body>
        )}
        {stale ? <Banner tone="warning">The transcript changed since detection. Re-run to catch new identifiers.</Banner> : null}
        {busy ? (
          <View style={{ gap: 6 }}>
            <Body muted>{busy}</Body>
            <ProgressBar value={progress} />
            <Button variant="secondary" title="Cancel" onPress={() => controllerRef.current?.abort()} />
          </View>
        ) : (
          <Button title={redaction ? 'Re-run detection' : 'Detect identifying details'} onPress={detect} />
        )}
        {error ? <Banner tone="danger">{error}</Banner> : null}
      </Card>

      {redaction ? (
        <>
          <Card>
            <SectionTitle right={<Pill label={`${spans.filter((s) => s.status === 'accepted').length} masked`} tone="info" />}>Detected details</SectionTitle>
            <Body muted>Each placeholder replaces every occurrence of the same person, place or identifier.</Body>
            {groups.length === 0 ? <Body muted>Nothing detected. Add phrases below if needed.</Body> : null}
            {groups.map((group) => {
              const accepted = group.spans[0].status === 'accepted';
              return (
                <View key={group.placeholder + [...group.texts].join()} style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text style={{ fontWeight: '700', color: accepted ? colors.primaryDark : colors.muted }}>{group.placeholder}</Text>
                    <Text style={{ color: colors.ink, flexShrink: 1 }}>{[...group.texts].join(' · ')}</Text>
                  </View>
                  <Text style={{ fontSize: 12, color: colors.muted }}>
                    {group.category} · {group.spans.length}× · {[...group.sources].join(', ')}
                  </Text>
                  <ButtonRow>
                    {accepted ? (
                      <Button small variant="secondary" title="Don't mask" onPress={() => setGroupStatus(group.spans, 'rejected')} />
                    ) : (
                      <Button small variant="secondary" title="Mask" onPress={() => setGroupStatus(group.spans, 'accepted')} />
                    )}
                    {accepted ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Change category"
                        onPress={() => {
                          const order = CATEGORIES.map((c) => c.value);
                          const next = order[(order.indexOf(group.category) + 1) % order.length];
                          changeGroupCategory(group.spans, next);
                        }}
                        style={{ justifyContent: 'center', paddingHorizontal: 8 }}
                      >
                        <Text style={{ color: colors.primary, fontWeight: '600' }}>Category: {group.category} ↻</Text>
                      </Pressable>
                    ) : null}
                  </ButtonRow>
                </View>
              );
            })}
          </Card>

          <Card>
            <SectionTitle>Mask another phrase</SectionTitle>
            <Field label="Exact words" value={phrase} onChangeText={setPhrase} placeholder="e.g. the night-shift charge nurse" autoCorrect={false} />
            <Segmented options={CATEGORIES} value={phraseCategory} onChange={setPhraseCategory} />
            <Button variant="secondary" title="Mask everywhere" onPress={addPhrase} disabled={phrase.trim().length < 2} />
          </Card>

          <Card>
            <SectionTitle>Review</SectionTitle>
            <Segmented<View_>
              options={[
                { value: 'changes', label: 'Changes' },
                { value: 'original', label: 'Original' },
                { value: 'cloud', label: 'Cloud-bound' },
              ]}
              value={view}
              onChange={setView}
            />
            <Body muted>
              {view === 'cloud'
                ? 'Exactly the text that will be sent for analysis (speaker roles and segment ids are added; see the payload preview).'
                : view === 'original'
                  ? 'Original wording with detected details highlighted. Dotted text is detected but not masked.'
                  : 'Strike-through shows what is replaced and by which placeholder.'}
            </Body>
            {segments.map((segment, i) => (
              <View key={segment.id} style={{ gap: 2, paddingVertical: 6, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
                <Text style={{ fontSize: 12, color: colors.faint }}>
                  {segment.id} · {formatMs(segment.startMs)} {segment.speaker ? `· ${segment.speaker}` : ''}
                </Text>
                {view === 'cloud' ? (
                  <MaskedText text={masked[i].text} />
                ) : (
                  <HighlightedText
                    text={segment.text}
                    spans={spans.filter((s) => s.segmentId === segment.id)}
                    identityMap={identityMap}
                    mode={view === 'original' ? 'original' : 'changes'}
                  />
                )}
              </View>
            ))}
          </Card>

          {leaks.length > 0 ? (
            <Banner tone="danger" title="Unmasked identifiers remain">
              {`${leaks.length} occurrence(s) of masked details still appear in the cloud-bound text (for example in ${leaks[0].segmentId}). Re-run detection.`}
            </Banner>
          ) : null}

          {approved ? (
            <Banner tone="success" title="Approved for cloud analysis">
              {`Approved ${formatLocal(redaction.reviewedAt!)}. Any edit clears this approval.`}
            </Banner>
          ) : (
            <Button
              title="Approve cloud-bound text"
              disabled={leaks.length > 0 || stale || Boolean(busy)}
              onPress={() => dispatch(dataActions.redactionReviewed({ id: session.id, fingerprint: maskedFingerprint }))}
              accessibilityHint="Marks the masked transcript as reviewed so it can be sent for analysis"
            />
          )}
          {approved ? <Button variant="secondary" title="Continue to analysis" onPress={() => router.push({ pathname: '/session/[sessionId]/analysis', params: { sessionId } })} /> : null}
          <Body muted>
            Placeholders are pseudonymization, not guaranteed anonymity: combinations of remaining details (job, schedule, events)
            can still identify someone. Mask identifying context as needed.
          </Body>
        </>
      ) : null}
    </Screen>
  );
}
