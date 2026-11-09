import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Expo Go ("storeClient") only contains Expo's bundled native modules. The
 * on-device speech (expo-speech-recognition), Whisper (whisper.rn) and
 * Qwen/Llama (llama.rn) integrations need a development build, so in Expo Go
 * the app runs in a clearly labeled DEMO mode and never touches those modules.
 */
export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export const isIos = Platform.OS === 'ios';

export const iosMajorVersion = isIos ? Number.parseInt(String(Platform.Version), 10) : 0;

/** Native AI modules may be required only when this is true. */
export const nativeAiAvailable = !isExpoGo && (Platform.OS === 'ios' || Platform.OS === 'android');

export type RuntimeMode = 'demo' | 'full';
export const runtimeMode: RuntimeMode = nativeAiAvailable ? 'full' : 'demo';

export const MVP = {
  supportedDevices: 'iPhone 12 or later (A14 Bionic, 4 GB RAM)',
  minimumIos: 17,
  languages: ['en-US'],
  maxRecordingMinutes: 90,
  recommendedRecordingMinutes: 60,
};
