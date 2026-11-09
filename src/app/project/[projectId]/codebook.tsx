import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { Body, Card, colors, Empty, ListItem, Pill, Screen, SectionTitle } from '../../../components/ui';
import { useAppSelector } from '../../../store';

interface CodeGroup {
  label: string;
  occurrences: { sessionId: string; participant: string; segments: number; status: string }[];
}

/**
 * Cross-interview coding view: codes from every analyzed interview grouped by
 * label, and themes grouped by title. Rejected suggestions are excluded.
 */
export default function CodebookScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const allSessions = useAppSelector((s) => s.data.sessions);
  const sessions = useMemo(
    () => Object.values(allSessions).filter((s) => s.projectId === projectId && s.analysis),
    [allSessions, projectId],
  );

  const { codes, themes } = useMemo(() => {
    const codeMap = new Map<string, CodeGroup>();
    const themeMap = new Map<string, { title: string; descriptions: string[]; participants: Set<string>; codeLabels: Set<string> }>();
    for (const session of sessions) {
      const analysis = session.analysis!;
      const labelById = new Map(analysis.codes.map((c) => [c.id, c.label]));
      for (const code of analysis.codes) {
        if (code.status === 'rejected') continue;
        const key = code.label.trim().toLowerCase();
        const group = codeMap.get(key) ?? { label: code.label, occurrences: [] };
        group.occurrences.push({ sessionId: session.id, participant: session.participantLabel, segments: code.segmentIds.length, status: code.status });
        codeMap.set(key, group);
      }
      for (const theme of analysis.themes) {
        if (theme.status === 'rejected') continue;
        const key = theme.title.trim().toLowerCase();
        const group = themeMap.get(key) ?? { title: theme.title, descriptions: [], participants: new Set(), codeLabels: new Set() };
        group.descriptions.push(theme.description);
        group.participants.add(session.participantLabel);
        theme.codeIds.forEach((id) => labelById.get(id) && group.codeLabels.add(labelById.get(id)!));
        themeMap.set(key, group);
      }
    }
    return {
      codes: [...codeMap.values()].sort((a, b) => b.occurrences.length - a.occurrences.length),
      themes: [...themeMap.values()].sort((a, b) => b.participants.size - a.participants.size),
    };
  }, [sessions]);

  if (sessions.length === 0) {
    return (
      <Screen>
        <Empty title="No analyzed interviews yet" />
      </Screen>
    );
  }

  return (
    <Screen>
      <Body muted>
        {sessions.length} analyzed interview(s). Codes with the same label are grouped; edit or merge them in each interview’s
        analysis.
      </Body>
      <Card>
        <SectionTitle>Themes</SectionTitle>
        {themes.map((theme) => (
          <View key={theme.title} style={{ gap: 4, paddingVertical: 6 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink }}>{theme.title}</Text>
            <Body muted>{theme.descriptions[0]}</Body>
            <Text style={{ fontSize: 13, color: colors.muted }}>
              {[...theme.participants].join(', ')} · codes: {[...theme.codeLabels].join('; ') || '—'}
            </Text>
          </View>
        ))}
      </Card>
      <Card>
        <SectionTitle>Codes</SectionTitle>
        {codes.map((group) => (
          <View key={group.label}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.ink, marginTop: 6 }}>
              {group.label} <Text style={{ color: colors.muted, fontWeight: '400' }}>({group.occurrences.length})</Text>
            </Text>
            {group.occurrences.map((o) => (
              <ListItem
                key={o.sessionId + group.label}
                title={o.participant}
                subtitle={`${o.segments} supporting segment(s)`}
                right={<Pill label={o.status} tone={o.status === 'accepted' ? 'success' : 'info'} />}
                onPress={() => router.push({ pathname: '/session/[sessionId]/analysis', params: { sessionId: o.sessionId } })}
              />
            ))}
          </View>
        ))}
      </Card>
    </Screen>
  );
}
