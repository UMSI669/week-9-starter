import { router } from 'expo-router';
import { Button, EmptyState, Screen } from '../features/common/ui';
export default function NotFound() { return <Screen><EmptyState title="This page isn’t on the list" message="Head back to this week’s groceries." action={<Button title="Go home" onPress={() => router.replace('/')} />} /></Screen>; }
