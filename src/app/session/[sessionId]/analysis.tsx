import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { MaskedText } from '../../../components/HighlightedText';
import { Banner, Body, Button, ButtonRow, Card, colors, Empty, Field, Pill, Screen, SectionTitle, styles as ui } from '../../../components/ui';
import type { ResearchCode, SuggestionStatus } from '../../../models/types';
import { CLOUD_MODELS } from '../../../services/analysis/models';
import { AnalysisError, requestAnalysis } from '../../../services/analysis/openRouter';
import { buildAnalysisRequest } from '../../../services/analysis/payload';
import { isApproved } from '../../../services/privacy/redaction';
import { getApiKey } from '../../../services/secure/credentials';
import { useAppDispatch, useAppSelector } from '../../../store';
import { dataActions } from '../../../store/dataSlice';
import { formatLocal } from '../../../utils/ids';
import { safeErrorMessage } from '../../../utils/safeError';

const statusTone = (s: SuggestionStatus) => (s === 'accepted' ? 'success' : s === 'rejected' ? 'danger' : 'info');

export default function AnalysisScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const dispatch = useAppDispatch();
  const session = useAppSelector((s) => s.data.sessions[sessionId]);
  const project = useAppSelector((s) => (session ? s.data.projects[session.projectId] : undefined));
  const settings = useAppSelector((s) => s.settings);

  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [showPayload, setShowPayload] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useFocusEffect(
    useCallback(() => {
      getApiKey()
        .then((k) => setHasKey(Boolean(k)))
        .catch(() => setHasKey(false));
      return () => controllerRef.current?.abort();
    }, []),
  );

  const approved = session ? isApproved(session.segments, session.redaction) : false;
  const request = useMemo(
    () =>
      session && project && session.redaction
        ? buildAnalysisRequest({
            project,
            session,
            model: settings.cloudModel,
            privacy: { denyDataCollection: settings.denyDataCollection, requireZdr: settings.requireZdr },
          })
        : null,
    [session, project, settings.cloudModel, settings.denyDataCollection, settings.requireZdr],
  );

  if (!session || !project) return <Empty title="Interview not found" />;

  const modelInfo = CLOUD_MODELS.find((m) => m.id === settings.cloudModel);
  const wire = request ? JSON.stringify(request.body) : '';
  const estTokens = Math.round(wire.length / 3.6);
  const estCost = modelInfo ? (estTokens * modelInfo.inputPerM + 2500 * modelInfo.outputPerM) / 1e6 : undefined;
  const analysis = session.analysis;
  const maskedById = new Map(request?.masked.map((m) => [m.id, m.text]) ?? []);
  const canSend = Boolean(hasKey && approved && request && request.leaks.length === 0 && !sending);

  const send = async () => {
    if (!request) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setSending(true);
    setError(null);
    try {
      const apiKey = await getApiKey();
      const result = await requestAnalysis({ apiKey, request, signal: controller.signal });
      dispatch(dataActions.analysisSet({ id: session.id, analysis: result }));
    } catch (e) {
      if (e instanceof AnalysisError && e.kind === 'canceled') return;
      const title =
        e instanceof AnalysisError
          ? { auth: 'API key rejected', credits: 'Out of credits', 'rate-limit': 'Rate limited', timeout: 'Timed out', offline: 'Offline', 'privacy-routing': 'No compliant provider', truncated: 'Response cut off', 'invalid-response': 'Unexpected response', 'missing-key': 'No API key', provider: 'Provider error', canceled: 'Canceled' }[e.kind]
          : 'Analysis failed';
      setError({ title, message: safeErrorMessage(e) });
    } finally {
      controllerRef.current = null;
      setSending(false);
    }
  };

  const confirmSend = () => {
    const replace = analysis?.editedByResearcher ? '\n\nThis replaces your edited analysis.' : '';
    Alert.alert(
      'Send masked transcript?',
      `The reviewed, masked text (${request?.masked.length} segments) will be sent to ${modelInfo?.name ?? settings.cloudModel} through OpenRouter using your key. Audio, names and the identity mapping stay on this iPhone.${replace}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send', onPress: () => void send() },
      ],
    );
  };

  const setCode = (code: Partial<ResearchCode> & { id: string }) => dispatch(dataActions.codeUpserted({ id: session.id, code }));

  return (
    <Screen>
      <Card>
        <SectionTitle>Send for analysis</SectionTitle>
        <CheckRow ok={approved} label="Privacy review approved" action={approved ? undefined : { title: 'Review', onPress: () => router.push({ pathname: '/session/[sessionId]/privacy', params: { sessionId } }) }} />
        <CheckRow ok={Boolean(hasKey)} label="OpenRouter API key saved on this iPhone" action={hasKey ? undefined : { title: 'Add key', onPress: () => router.push('/settings') }} />
        <CheckRow ok label={`Model: ${modelInfo?.name ?? settings.cloudModel}`} action={{ title: 'Change', onPress: () => router.push('/settings') }} />
        <CheckRow ok={settings.denyDataCollection} label={settings.denyDataCollection ? `Providers that store data excluded${settings.requireZdr ? ' · ZDR only' : ''}` : 'Provider data collection allowed'} />
        {request ? (
          <Body muted>
            ≈{estTokens.toLocaleString()} input tokens{estCost !== undefined ? ` · est. $${estCost.toFixed(3)}` : ''}. Billed to your OpenRouter account.
          </Body>
        ) : null}
        <Button variant="secondary" small title={showPayload ? 'Hide exact payload' : 'Show exact payload'} onPress={() => setShowPayload((v) => !v)} disabled={!request} />
        {showPayload && request ? (
          <TextInput value={JSON.stringify(request.body, null, 2)} editable={false} multiline style={[ui.input, { fontFamily: 'Menlo', fontSize: 11, maxHeight: 360 }]} accessibilityLabel="Exact request payload" />
        ) : null}
        {sending ? (
          <ButtonRow>
            <Button title="Analyzing…" loading onPress={() => undefined} />
            <Button variant="secondary" title="Cancel" onPress={() => controllerRef.current?.abort()} />
          </ButtonRow>
        ) : (
          <Button title={analysis ? 'Re-run analysis' : 'Analyze'} onPress={confirmSend} disabled={!canSend} />
        )}
        {error ? <Banner tone="danger" title={error.title}>{error.message}</Banner> : null}
      </Card>

      {analysis ? (
        <>
          <Body muted>
            {analysis.model} · {formatLocal(analysis.createdAt)}
            {analysis.usage?.cost !== undefined ? ` · $${analysis.usage.cost.toFixed(4)}` : ''}
            {analysis.editedByResearcher ? ' · edited by researcher' : ''}
          </Body>
          {analysis.warnings.length ? (
            <Banner tone="warning" title="Validation notes">
              {analysis.warnings.slice(0, 5).join('\n')}
            </Banner>
          ) : null}

          <Card>
            <SectionTitle>Summary</SectionTitle>
            <Field label="AI summary (editable)" value={analysis.summary} multiline onChangeText={(summary) => dispatch(dataActions.summaryEdited({ id: session.id, summary }))} />
          </Card>

          <Card>
            <SectionTitle right={<Button small variant="secondary" title="+ Theme" onPress={() => dispatch(dataActions.themeUpserted({ id: session.id, theme: {} }))} />}>Themes</SectionTitle>
            {analysis.themes.map((theme) => (
              <View key={theme.id} style={{ gap: 6, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, opacity: theme.status === 'rejected' ? 0.5 : 1 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <Pill label={theme.origin === 'ai' ? `AI · ${theme.status}` : 'Researcher'} tone={statusTone(theme.status)} />
                </View>
                <TextInput value={theme.title} onChangeText={(title) => dispatch(dataActions.themeUpserted({ id: session.id, theme: { id: theme.id, title } }))} style={{ fontSize: 16, fontWeight: '700', color: colors.ink }} accessibilityLabel="Theme title" />
                <TextInput value={theme.description} multiline onChangeText={(description) => dispatch(dataActions.themeUpserted({ id: session.id, theme: { id: theme.id, description } }))} style={{ fontSize: 14, color: colors.muted }} accessibilityLabel="Theme description" />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {analysis.codes.filter((c) => c.status !== 'rejected').map((code) => {
                    const inTheme = theme.codeIds.includes(code.id);
                    return (
                      <Pressable
                        key={code.id}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: inTheme }}
                        onPress={() =>
                          dispatch(
                            dataActions.themeUpserted({
                              id: session.id,
                              theme: { id: theme.id, codeIds: inTheme ? theme.codeIds.filter((id) => id !== code.id) : [...theme.codeIds, code.id] },
                            }),
                          )
                        }
                        style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: inTheme ? colors.primary : colors.paleBlue }}
                      >
                        <Text style={{ fontSize: 12, color: inTheme ? '#fff' : colors.primaryDark }}>{code.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <SuggestionButtons
                  status={theme.status}
                  onStatus={(status) => dispatch(dataActions.themeStatusSet({ id: session.id, themeId: theme.id, status }))}
                  onDelete={() => dispatch(dataActions.themeDeleted({ id: session.id, themeId: theme.id }))}
                />
              </View>
            ))}
          </Card>

          <Card>
            <SectionTitle right={<Button small variant="secondary" title="+ Code" onPress={() => dispatch(dataActions.codeUpserted({ id: session.id, code: {} }))} />}>Codes</SectionTitle>
            {analysis.codes.map((code) => (
              <View key={code.id} style={{ gap: 6, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, opacity: code.status === 'rejected' ? 0.5 : 1 }}>
                <Pill label={code.origin === 'ai' ? `AI · ${code.status}` : 'Researcher'} tone={statusTone(code.status)} />
                <TextInput value={code.label} onChangeText={(label) => setCode({ id: code.id, label })} style={{ fontSize: 16, fontWeight: '700', color: colors.ink }} accessibilityLabel="Code label" />
                <TextInput value={code.description} multiline onChangeText={(description) => setCode({ id: code.id, description })} style={{ fontSize: 14, color: colors.muted }} accessibilityLabel="Code description" />
                <Pressable onPress={() => setExpandedCode(expandedCode === code.id ? null : code.id)} accessibilityRole="button">
                  <Text style={{ color: colors.primary, fontWeight: '600' }}>
                    {code.segmentIds.length} supporting segment(s) {expandedCode === code.id ? '▲' : '▼'}
                  </Text>
                </Pressable>
                {expandedCode === code.id
                  ? code.segmentIds.map((id) => (
                      <View key={id} style={{ backgroundColor: colors.background, borderRadius: 8, padding: 8, gap: 2 }}>
                        <Text style={{ fontSize: 11, color: colors.faint }}>{id}</Text>
                        <MaskedText text={maskedById.get(id) ?? '(segment removed)'} />
                        <Button small variant="ghost" title="Unlink" onPress={() => setCode({ id: code.id, segmentIds: code.segmentIds.filter((s) => s !== id) })} />
                      </View>
                    ))
                  : null}
                <SuggestionButtons
                  status={code.status}
                  onStatus={(status) => dispatch(dataActions.codeStatusSet({ id: session.id, codeId: code.id, status }))}
                  onDelete={() => dispatch(dataActions.codeDeleted({ id: session.id, codeId: code.id }))}
                />
              </View>
            ))}
          </Card>

          <Card>
            <SectionTitle>Supporting quotes</SectionTitle>
            {analysis.quotes.map((quote) => (
              <View key={quote.id} style={{ gap: 4, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }}>
                <MaskedText text={`“${quote.text}”`} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Text style={{ fontSize: 12, color: colors.faint }}>{quote.segmentId}</Text>
                  {quote.verbatim ? <Pill label="verbatim" tone="success" /> : <Pill label="not verbatim — check" tone="warning" />}
                  <Button small variant="ghost" title="Open transcript" onPress={() => router.push({ pathname: '/session/[sessionId]/transcript', params: { sessionId } })} />
                  <Button small variant="ghost" title="Remove" onPress={() => dispatch(dataActions.quoteDeleted({ id: session.id, quoteId: quote.id }))} />
                </View>
              </View>
            ))}
          </Card>
          <Body muted>AI suggestions are a starting point. Accept, edit, or reject them; rejected items are excluded from exports and the codebook.</Body>
        </>
      ) : null}
    </Screen>
  );
}

function CheckRow({ ok, label, action }: { ok: boolean; label: string; action?: { title: string; onPress: () => void } }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Text style={{ fontSize: 16, color: ok ? colors.success : colors.amber }} accessibilityLabel={ok ? 'Done' : 'Needed'}>
        {ok ? '✓' : '○'}
      </Text>
      <Text style={{ flex: 1, color: colors.ink, fontSize: 14 }}>{label}</Text>
      {action ? <Button small variant="ghost" title={action.title} onPress={action.onPress} /> : null}
    </View>
  );
}

function SuggestionButtons({ status, onStatus, onDelete }: { status: SuggestionStatus; onStatus: (s: SuggestionStatus) => void; onDelete: () => void }) {
  return (
    <ButtonRow>
      {status !== 'accepted' ? <Button small variant="secondary" title="Accept" onPress={() => onStatus('accepted')} /> : null}
      {status !== 'rejected' ? <Button small variant="secondary" title="Reject" onPress={() => onStatus('rejected')} /> : null}
      <Button small variant="ghost" title="Delete" onPress={onDelete} />
    </ButtonRow>
  );
}
