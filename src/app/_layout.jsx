/**
 * Root layout: Redux provider, navigation stack, and first-run bootstrap.
 *
 * Bootstrap order matters. Settings and dreams load from SQLite before the
 * first screen renders anything meaningful, and the labelled demo dreams are
 * seeded only when the database is genuinely empty.
 */

import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider, useDispatch } from 'react-redux';
import { store } from '../store/store';
import { loadDreams, seedDemoDreamsIfFirstRun } from '../store/dreamsSlice';
import { loadSettings } from '../store/settingsSlice';
import { cleanUpAllExports } from '../services/exportDream';
import { Button, NightBackground } from '../components/ui';
import { colors, fontSizes, spacing } from '../theme';

export default function RootLayout() {
  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Bootstrap>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.background },
              headerTintColor: colors.textPrimary,
              headerTitleStyle: { fontWeight: '800' },
              headerShadowVisible: false,
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="gallery" options={{ title: 'Dreams' }} />
            <Stack.Screen name="settings" options={{ title: 'Settings' }} />
            <Stack.Screen name="dream/[id]" options={{ title: 'Dream' }} />
            <Stack.Screen name="dream/edit/[id]" options={{ title: 'Edit dream' }} />
          </Stack>
        </Bootstrap>
      </SafeAreaProvider>
    </Provider>
  );
}

function Bootstrap({ children }) {
  const dispatch = useDispatch();
  const [state, setState] = useState({ phase: 'loading', message: null });

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        // Leftover export PNGs from a previous run are no longer useful.
        cleanUpAllExports();

        await dispatch(loadSettings()).unwrap();
        await dispatch(seedDemoDreamsIfFirstRun()).unwrap();
        await dispatch(loadDreams()).unwrap();
        if (!cancelled) setState({ phase: 'ready', message: null });
      } catch (error) {
        if (cancelled) return;
        // A storage failure is recoverable and says so, rather than showing an
        // empty gallery that looks like lost data.
        setState({
          phase: 'error',
          message:
            error?.message ||
            'Dream Decoder could not open its local database. Your saved dreams are still on the device.',
        });
      }
    }

    start();
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  const retry = () => {
    setState({ phase: 'loading', message: null });
    dispatch(loadSettings());
    dispatch(loadDreams());
    setState({ phase: 'ready', message: null });
  };

  if (state.phase === 'error') {
    return (
      <NightBackground>
        <View style={styles.center}>
          <Text accessibilityRole="header" style={styles.errorTitle}>
            Storage could not be opened
          </Text>
          <Text style={styles.errorBody}>{state.message}</Text>
          <Button title="Try again" onPress={retry} />
        </View>
      </NightBackground>
    );
  }

  // The stack renders immediately; screens show their own loading state. This
  // avoids a blank gate on a slow first database open.
  return children;
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.lg,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  errorTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.title,
    fontWeight: '800',
    textAlign: 'center',
  },
  errorBody: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    lineHeight: 22,
    textAlign: 'center',
  },
});
