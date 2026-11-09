import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { Body, Button, ButtonRow, Card, Empty, Field, ListItem, Pill, Screen, SectionTitle, Segmented, ToggleRow } from '../../../components/ui';
import type { EntityCategory } from '../../../models/types';
import { useAppDispatch, useAppSelector } from '../../../store';
import { dataActions } from '../../../store/dataSlice';
import { deleteProject } from '../../../store/thunks';
import { newId } from '../../../utils/ids';
import { sessionStatus } from '../../../utils/status';

const IDENTIFIER_CATEGORIES: { value: EntityCategory; label: string }[] = [
  { value: 'PERSON', label: 'Person' },
  { value: 'ORG', label: 'Org' },
  { value: 'LOCATION', label: 'Place' },
  { value: 'ID', label: 'ID' },
];

export default function ProjectScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const dispatch = useAppDispatch();
  const project = useAppSelector((s) => s.data.projects[projectId]);
  const allSessions = useAppSelector((s) => s.data.sessions);
  const sessions = useMemo(
    () => Object.values(allSessions).filter((s) => s.projectId === projectId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [allSessions, projectId],
  );
  const [identifier, setIdentifier] = useState('');
  const [category, setCategory] = useState<EntityCategory>('PERSON');

  if (!project) {
    return (
      <Screen>
        <Empty title="Project not found" />
      </Screen>
    );
  }

  const update = (changes: Parameters<typeof dataActions.projectUpdated>[0]['changes']) =>
    dispatch(dataActions.projectUpdated({ id: project.id, changes }));

  const confirmDelete = () =>
    Alert.alert(
      'Delete project?',
      `This permanently deletes ${sessions.length} interview(s), their audio, transcripts, identity mappings and analyses from this iPhone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            dispatch(deleteProject(project.id));
            router.back();
          },
        },
      ],
    );

  return (
    <Screen>
      <Stack.Screen options={{ title: project.name }} />
      {project.isDemo ? <Pill label="Demo project · synthetic data" tone="demo" /> : null}

      <Card>
        <SectionTitle right={<Button small title="+ Interview" onPress={() => router.push({ pathname: '/session/new', params: { projectId } })} />}>
          Interviews
        </SectionTitle>
        {sessions.length === 0 ? (
          <Empty title="No interviews yet" />
        ) : (
          sessions.map((session) => {
            const status = sessionStatus(session);
            return (
              <ListItem
                key={session.id}
                title={session.title}
                subtitle={`${session.participantLabel} · ${session.segments.length} segments`}
                right={<Pill label={status.label} tone={status.tone} />}
                onPress={() => router.push({ pathname: '/session/[sessionId]', params: { sessionId: session.id } })}
              />
            );
          })
        )}
        <Button
          variant="secondary"
          title="Codebook & themes across interviews"
          onPress={() => router.push({ pathname: '/project/[projectId]/codebook', params: { projectId } })}
          disabled={!sessions.some((s) => s.analysis)}
        />
      </Card>

      <Card>
        <SectionTitle>Research context</SectionTitle>
        <Field label="Project name (local only)" value={project.name} onChangeText={(name) => update({ name })} />
        <Field label="Research question" value={project.researchQuestion} onChangeText={(researchQuestion) => update({ researchQuestion })} multiline />
        <Field label="Study context" value={project.researchContext} onChangeText={(researchContext) => update({ researchContext })} multiline />
        <ToggleRow
          label="Share research question & context with the cloud model"
          description="Masked with this interview's placeholders and shown in the payload preview before sending."
          value={project.shareContext}
          onValueChange={(shareContext) => update({ shareContext })}
        />
      </Card>

      <Card>
        <SectionTitle>Always mask</SectionTitle>
        <Body muted>
          Names you already know must be hidden in every interview of this project, such as the participant’s employer, a
          clinic or a neighborhood. They are matched case-insensitively as whole words.
        </Body>
        {project.knownIdentifiers.map((k) => (
          <ListItem
            key={k.id}
            title={k.text}
            subtitle={k.category}
            right={<Button small variant="ghost" title="Remove" onPress={() => dispatch(dataActions.knownIdentifierRemoved({ projectId: project.id, id: k.id }))} />}
          />
        ))}
        <Field label="Add identifier" value={identifier} onChangeText={setIdentifier} placeholder="e.g. Northwind Logistics" autoCapitalize="words" />
        <Segmented options={IDENTIFIER_CATEGORIES} value={category} onChange={setCategory} />
        <Button
          variant="secondary"
          title="Add"
          disabled={identifier.trim().length < 2}
          onPress={() => {
            dispatch(dataActions.knownIdentifierAdded({ projectId: project.id, identifier: { id: newId('kid'), text: identifier.trim(), category } }));
            setIdentifier('');
          }}
        />
      </Card>

      <View>
        <ButtonRow>
          <Button variant="danger" title="Delete project" onPress={confirmDelete} />
        </ButtonRow>
      </View>
    </Screen>
  );
}
