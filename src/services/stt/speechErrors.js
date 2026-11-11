/**
 * Turns platform speech-recognition failures into messages a person can act on.
 *
 * Kept free of native imports so it can be unit-tested directly, and shared by
 * the iOS and Android adapters.
 *
 * The motivating case: iOS reports a recognizer it cannot construct as a bare
 * "failed to initialize recognizer". The overwhelmingly common reason is the
 * iOS Simulator, which has no SFSpeechRecognizer implementation at all.
 * `isRecognitionAvailable()` still returns true there, so this cannot be
 * detected before `start()` is called — the message has to carry the
 * explanation instead.
 */

export const TYPE_INSTEAD = 'You can type your dream instead.';

/**
 * @param {Error|string} error
 * @returns {string} A message safe and useful to show the user.
 */
export function describeSpeechError(error) {
  const raw = (error instanceof Error ? error.message : String(error || '')).trim();

  if (/initiali[sz]e.*recogni[sz]er|recogni[sz]er.*(unavailable|nil|null|not available)/i.test(raw)) {
    return (
      'This device could not start its speech recognizer. The iOS Simulator does not support ' +
      `speech recognition at all — recording needs a physical iPhone. ${TYPE_INSTEAD} ` +
      'Everything else in the app works here.'
    );
  }

  if (/audio session|audio engine|AVAudioSession|audio input/i.test(raw)) {
    return (
      'The microphone could not be opened. Another app may be using it, or this device has no ' +
      `audio input. ${TYPE_INSTEAD}`
    );
  }

  if (/permission|not-allowed|denied/i.test(raw)) {
    return `Microphone or speech-recognition permission was denied. ${TYPE_INSTEAD}`;
  }

  return raw || 'Speech recognition could not be started.';
}

export default describeSpeechError;
