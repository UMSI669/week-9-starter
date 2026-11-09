import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { Banner, Body, Button, Card, Empty, Screen, SectionTitle, Segmented, ToggleRow } from '../../../components/ui';
import { buildExport, exportFileName, type ExportFormat, type ExportVariant } from '../../../services/export/exporter';
import { shareTextFile } from '../../../services/export/share';
import { useAppSelector } from '../../../store';
import { safeErrorMessage } from '../../../utils/safeError';

export default function ExportScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const session = useAppSelector((s) => s.data.sessions[sessionId]);
  const project = useAppSelector((s) => (session ? s.data.projects[session.projectId] : undefined));
  const [variant, setVariant] = useState<ExportVariant>('masked');
  const [format, setFormat] = useState<ExportFormat>('markdown');
  const [includeTranscript, setIncludeTranscript] = useState(true);
  const [includeAnalysis, setIncludeAnalysis] = useState(true);
  const [busy, setBusy] = useState(false);

  if (!session || !project) return <Empty title="Interview not found" />;
  const maskedUnavailable = variant === 'masked' && includeTranscript && !session.redaction;

  const doExport = async () => {
    setBusy(true);
    try {
      const options = { variant, format, includeTranscript, includeAnalysis: includeAnalysis && Boolean(session.analysis) };
      const content = buildExport(project, session, options);
      await shareTextFile(exportFileName(session, options), content, format === 'json' ? 'application/json' : 'text/markdown');
    } catch (e) {
      Alert.alert('Export failed', safeErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const confirm = () => {
    if (variant === 'masked') return void doExport();
    Alert.alert(
      'Export original transcript?',
      "This file contains the participant's real words and identifying details. Share it only to places approved by your study protocol.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Export original', style: 'destructive', onPress: () => void doExport() },
      ],
    );
  };

  return (
    <Screen>
      <Card>
        <SectionTitle>Version</SectionTitle>
        <Segmented<ExportVariant>
          options={[
            { value: 'masked', label: 'Masked (pseudonymized)' },
            { value: 'original', label: 'Original' },
          ]}
          value={variant}
          onChange={setVariant}
        />
        {variant === 'masked' ? (
          <Body muted>Uses placeholders such as [PERSON_01]. Never includes original text, the identity mapping, audio, or file names.</Body>
        ) : (
          <Banner tone="warning" title="Contains identifying information">
            The original transcript includes names and other details. It is labeled as such inside the file.
          </Banner>
        )}
        {maskedUnavailable ? <Banner tone="warning">Run privacy detection first to export a masked transcript.</Banner> : null}
      </Card>
      <Card>
        <SectionTitle>Contents</SectionTitle>
        <ToggleRow label="Transcript" value={includeTranscript} onValueChange={setIncludeTranscript} />
        <ToggleRow label="Analysis (codes, themes, summary, quotes)" value={includeAnalysis && Boolean(session.analysis)} onValueChange={setIncludeAnalysis} disabled={!session.analysis} />
        <Segmented<ExportFormat>
          options={[
            { value: 'markdown', label: 'Markdown' },
            { value: 'json', label: 'JSON' },
          ]}
          value={format}
          onChange={setFormat}
        />
      </Card>
      <Button
        title={variant === 'masked' ? 'Export masked' : 'Export original…'}
        variant={variant === 'masked' ? 'primary' : 'danger'}
        onPress={confirm}
        loading={busy}
        disabled={maskedUnavailable || (!includeTranscript && !(includeAnalysis && session.analysis))}
      />
      <Body muted>The file opens in the iOS share sheet; the app keeps no extra copy.</Body>
    </Screen>
  );
}
