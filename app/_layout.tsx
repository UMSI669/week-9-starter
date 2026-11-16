import { useEffect, useSyncExternalStore } from 'react';
import { ActivityIndicator, AppState, Platform, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import { store } from '../store';
import { listApi, useSnapshotQuery } from '../store/listApi';
import { getWeekId } from '../utils/week';
import { colors, styles } from '../theme';
import ToastHost from '../features/common/ToastHost';

const subscribeToHydration = () => () => {};

function Lifecycle() {
  useSnapshotQuery();
  useEffect(() => {
    let weekId = getWeekId();
    const refresh = () => { weekId = getWeekId(); store.dispatch(listApi.util.invalidateTags(['Lists'])); };
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    const interval = setInterval(() => { if (getWeekId() !== weekId) refresh(); }, 30_000);
    return () => { subscription.remove(); clearInterval(interval); };
  }, []);
  return null;
}
export default function RootLayout() {
  const mounted = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  // Grocery data and icon fonts initialize in the browser. Hydrate a stable
  // loading shell, then mount the local app without server/client font mismatches.
  if (Platform.OS === 'web' && !mounted) {
    return <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator color={colors.orange} /></View>;
  }
  return <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaProvider><Provider store={store}>
    <Lifecycle /><StatusBar style="dark" />
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.cream } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="voice" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
      <Stack.Screen name="item" options={{ presentation: 'modal' }} />
      <Stack.Screen name="history/index" />
      <Stack.Screen name="history/[id]" />
    </Stack><ToastHost />
  </Provider></SafeAreaProvider></GestureHandlerRootView>;
}
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return <View style={[styles.screen, { justifyContent: 'center', padding: 30, gap: 20 }]}><Text style={styles.title}>Let’s try that again</Text><Text style={styles.subtitle}>The app couldn’t open this screen. Your saved list is still on this device.</Text><Text accessibilityRole="button" onPress={retry} style={{ color: colors.orange, fontWeight: '700' }}>Reload screen</Text></View>;
}
