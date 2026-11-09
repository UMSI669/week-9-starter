import * as SecureStore from 'expo-secure-store';
import { forgetSecrets, registerSecret } from '../../utils/safeError';

/**
 * The researcher's own OpenRouter key lives only in the iOS Keychain via
 * expo-secure-store. It is never bundled, never in EXPO_PUBLIC_* variables,
 * never in Redux / the JSON data file, and is not migrated to other devices.
 */
const KEY = 'openrouter_api_key';
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export async function getApiKey(): Promise<string | null> {
  const value = await SecureStore.getItemAsync(KEY, OPTIONS);
  registerSecret(value);
  return value;
}

export async function saveApiKey(value: string): Promise<void> {
  const trimmed = value.trim();
  if (!trimmed) throw new Error('Enter an API key.');
  if (/\s/.test(trimmed)) throw new Error('The API key should not contain spaces.');
  await SecureStore.setItemAsync(KEY, trimmed, OPTIONS);
  registerSecret(trimmed);
}

export async function deleteApiKey(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY, OPTIONS);
  forgetSecrets();
}

export function maskKeyForDisplay(value: string): string {
  return value.length <= 10 ? '••••' : `${value.slice(0, 6)}…${value.slice(-4)}`;
}
