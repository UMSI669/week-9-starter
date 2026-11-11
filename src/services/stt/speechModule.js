/**
 * Optional access to the native speech-recognition module.
 *
 * expo-speech-recognition is not bundled in Expo Go, and its JS entry point
 * calls `requireNativeModule("ExpoSpeechRecognition")` at module scope, which
 * throws when the native half is absent.
 *
 * Wrapping `require('expo-speech-recognition')` in try/catch does NOT help:
 * the throw happens while Metro is initializing the module, and Metro reports
 * module-initialization failures to the global error handler regardless of
 * whether userland code catches the rethrow. The result is a red screen on
 * launch even though the error was handled.
 *
 * `requireOptionalNativeModule` is the supported way to do this. It asks the
 * native registry directly and returns null when the module is not present,
 * so the failing package JS is never loaded at all.
 *
 * The package's export is exactly this native module — see
 * expo-speech-recognition/build/ExpoSpeechRecognitionModule.js, which is
 * `requireNativeModule("ExpoSpeechRecognition")` plus two zero-argument
 * wrappers around stop/abort that the adapters here do not depend on.
 */

import { requireOptionalNativeModule } from 'expo-modules-core';

/** Name the native module registers under. */
const NATIVE_MODULE_NAME = 'ExpoSpeechRecognition';

let resolved;

/**
 * @returns {object|null} The native module, or null where it is unavailable
 *          (Expo Go, web, or a development build predating the dependency).
 */
export function getSpeechModule() {
  if (resolved !== undefined) return resolved;
  try {
    resolved = requireOptionalNativeModule(NATIVE_MODULE_NAME) ?? null;
  } catch (_error) {
    // Belt and braces: older expo-modules-core versions could still throw.
    resolved = null;
  }
  return resolved;
}

export function isSpeechModuleAvailable() {
  return getSpeechModule() !== null;
}

export const SPEECH_MODULE_MISSING =
  'Phone transcription is not available in this build. Expo Go does not include the speech ' +
  'recognition module, so you need a development build for it. You can use cloud transcription ' +
  'or type your dream instead.';

/** Test hook: forget the cached resolution. */
export function resetSpeechModuleForTests() {
  resolved = undefined;
}
