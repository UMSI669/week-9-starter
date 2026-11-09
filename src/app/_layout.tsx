import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Provider } from 'react-redux';
import { colors } from '../components/ui';
import { store, useAppDispatch, useAppSelector } from '../store';
import { hydrateApp } from '../store/thunks';

function HydrationGate({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const hydrated = useAppSelector((s) => s.data.hydrated);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    dispatch(hydrateApp()).catch(() => setError('Local data could not be loaded.'));
  }, [dispatch]);
  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: colors.danger, fontSize: 16 }}>{error}</Text>
      </View>
    );
  }
  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <Provider store={store}>
      <StatusBar style="dark" />
      <HydrationGate>
        <Stack
          screenOptions={{
            headerTintColor: colors.primary,
            headerTitleStyle: { color: colors.ink },
            headerLargeTitleShadowVisible: false,
            contentStyle: { backgroundColor: colors.background },
            headerBackButtonDisplayMode: 'minimal',
          }}
        >
          <Stack.Screen name="index" options={{ title: 'Interview Lens', headerLargeTitle: true }} />
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
          <Stack.Screen name="about" options={{ title: 'Privacy & limitations' }} />
          <Stack.Screen name="project/new" options={{ title: 'New project', presentation: 'modal' }} />
          <Stack.Screen name="project/[projectId]/index" options={{ title: 'Project' }} />
          <Stack.Screen name="project/[projectId]/codebook" options={{ title: 'Codebook' }} />
          <Stack.Screen name="session/new" options={{ title: 'New interview', presentation: 'modal' }} />
          <Stack.Screen name="session/[sessionId]/index" options={{ title: 'Interview' }} />
          <Stack.Screen name="session/[sessionId]/record" options={{ title: 'Record', gestureEnabled: false }} />
          <Stack.Screen name="session/[sessionId]/transcript" options={{ title: 'Transcript' }} />
          <Stack.Screen name="session/[sessionId]/privacy" options={{ title: 'Privacy review' }} />
          <Stack.Screen name="session/[sessionId]/analysis" options={{ title: 'Analysis' }} />
          <Stack.Screen name="session/[sessionId]/export" options={{ title: 'Export', presentation: 'modal' }} />
        </Stack>
      </HydrationGate>
    </Provider>
  );
}
