import { Link, router, Stack } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, Text } from 'react-native';
import { RuntimeBanner } from '../components/RuntimeBanner';
import { Body, Button, ButtonRow, Card, colors, Empty, ListItem, Pill, Screen, SectionTitle } from '../components/ui';
import { useAppDispatch, useAppSelector } from '../store';
import { createDemoProject } from '../store/thunks';

export default function ProjectsScreen() {
  const dispatch = useAppDispatch();
  const projects = useAppSelector((s) => s.data.projects);
  const sessions = useAppSelector((s) => s.data.sessions);

  const list = useMemo(
    () =>
      Object.values(projects)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map((p) => ({ project: p, count: Object.values(sessions).filter((s) => s.projectId === p.id).length })),
    [projects, sessions],
  );

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link href="/settings" asChild>
              <Pressable accessibilityRole="button" accessibilityLabel="Settings" hitSlop={10}>
                <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '600' }}>Settings</Text>
              </Pressable>
            </Link>
          ),
        }}
      />
      <RuntimeBanner />
      <Body muted>
        Record or import interviews, transcribe them on this iPhone, pseudonymize identifying details locally, review exactly
        what will be shared, then run AI-assisted coding with your own OpenRouter key.
      </Body>

      <Card>
        <SectionTitle>Projects</SectionTitle>
        {list.length === 0 ? (
          <Empty title="No projects yet">
            <Body muted style={{ textAlign: 'center' }}>
              Start with the demo project (two synthetic interviews) or create your own.
            </Body>
          </Empty>
        ) : (
          list.map(({ project, count }) => (
            <ListItem
              key={project.id}
              title={project.name}
              subtitle={`${count} interview${count === 1 ? '' : 's'} · updated ${project.updatedAt.slice(0, 10)}`}
              right={project.isDemo ? <Pill label="Demo" tone="demo" /> : undefined}
              onPress={() => router.push({ pathname: '/project/[projectId]', params: { projectId: project.id } })}
            />
          ))
        )}
        <ButtonRow>
          <Button title="New project" onPress={() => router.push('/project/new')} />
          <Button
            variant="secondary"
            title="Add demo project"
            onPress={() => {
              const id = dispatch(createDemoProject());
              router.push({ pathname: '/project/[projectId]', params: { projectId: id } });
            }}
          />
        </ButtonRow>
      </Card>

      <Link href="/about" style={{ color: colors.primary, fontWeight: '600', textAlign: 'center', padding: 8 }}>
        Privacy, pseudonymization & limitations
      </Link>
    </Screen>
  );
}
