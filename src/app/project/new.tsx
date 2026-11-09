import { router } from 'expo-router';
import { useState } from 'react';
import { Body, Button, Card, Field, Screen } from '../../components/ui';
import { useAppDispatch } from '../../store';
import { createProject } from '../../store/thunks';

export default function NewProjectScreen() {
  const dispatch = useAppDispatch();
  const [name, setName] = useState('');
  const [question, setQuestion] = useState('');
  const [context, setContext] = useState('');

  const create = () => {
    const id = dispatch(createProject({ name, researchQuestion: question, researchContext: context }));
    router.replace({ pathname: '/project/[projectId]', params: { projectId: id } });
  };

  return (
    <Screen>
      <Card>
        <Field label="Project name" value={name} onChangeText={setName} placeholder="e.g. Clinic booking study" autoFocus />
        <Field
          label="Research question"
          value={question}
          onChangeText={setQuestion}
          multiline
          placeholder="What do you want to learn?"
          hint="Can be shared with the cloud model as context (you can turn this off per project)."
        />
        <Field
          label="Study context (optional)"
          value={context}
          onChangeText={setContext}
          multiline
          placeholder="Product area, goals, what to focus on"
          hint="Avoid participant names or organizations here."
        />
        <Body muted>Project names stay on this device and are never sent to the cloud.</Body>
        <Button title="Create project" onPress={create} disabled={!name.trim()} />
      </Card>
    </Screen>
  );
}
