// Loads the phone's speech-recognition module without crashing when it is missing.
//
// `expo-speech-recognition` contains native code, so it only exists in a
// development build (npx expo run:ios / run:android) or in a web browser that
// supports the Web Speech API. In Expo Go the import throws, so we catch that
// and let the screen fall back to typing.

let speechModule = null;
let speechUnavailableReason = null;

try {
  speechModule = require('expo-speech-recognition').ExpoSpeechRecognitionModule;
} catch {
  speechUnavailableReason =
    'Voice input needs a development build (it does not run in Expo Go). You can still type your dream below.';
}

export function isSpeechAvailable() {
  if (!speechModule) return false;
  try {
    return speechModule.isRecognitionAvailable();
  } catch {
    return false;
  }
}

export { speechModule, speechUnavailableReason };
