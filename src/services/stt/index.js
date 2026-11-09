/**
 * Transcription adapters, keyed by mode.
 *
 * The interface follows the class reference repository's adapter boundary:
 * `capabilities`, `getAvailability()`, and either a listening pair
 * (startListening/stopListening/cancelListening) or `transcribeFile()`.
 *
 * Phone-native is the default where it is supported. Cloud is a separate mode
 * the user selects on purpose. Typing always works and needs neither.
 */

import { cloudStt } from './cloudStt';
import { nativeStt } from './nativeStt';

export const TRANSCRIPTION_MODES = {
  PHONE: 'phone-native',
  CLOUD: 'cloud',
  MANUAL: 'manual',
};

export const sttAdapters = {
  [TRANSCRIPTION_MODES.PHONE]: nativeStt,
  [TRANSCRIPTION_MODES.CLOUD]: cloudStt,
};

export const MODE_LABELS = {
  [TRANSCRIPTION_MODES.PHONE]: 'Phone transcription',
  [TRANSCRIPTION_MODES.CLOUD]: 'Cloud transcription',
  [TRANSCRIPTION_MODES.MANUAL]: 'Type it myself',
};

/**
 * Honest one-line description of where the audio goes in each mode.
 * Phone mode is NOT described as offline: the OS service decides.
 */
export const MODE_DESCRIPTIONS = {
  [TRANSCRIPTION_MODES.PHONE]:
    'Your phone’s own speech service turns speech into text. Depending on the device and its ' +
    'language packs, the operating system may process the audio locally or on its own servers — ' +
    'the app cannot tell which, so it does not promise offline.',
  [TRANSCRIPTION_MODES.CLOUD]:
    'The audio recording is uploaded to this app’s backend and forwarded to OpenRouter. ' +
    'The recording leaves your phone.',
  [TRANSCRIPTION_MODES.MANUAL]:
    'You type the dream. No microphone, no upload, no transcription service.',
};

export { nativeStt, cloudStt };
