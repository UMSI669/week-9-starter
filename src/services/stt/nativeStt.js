/**
 * Platform fallback for phone-native speech recognition.
 *
 * Metro picks nativeStt.ios.js or nativeStt.android.js on a device. This file
 * is what loads anywhere else (web, or a platform without the native module),
 * and it reports itself unavailable instead of pretending.
 */

const unavailable =
  'Phone transcription needs an iOS or Android development build. You can still type your dream.';

export const nativeStt = {
  capabilities: {
    microphone: false,
    processingLocation: 'system-service',
    unavailableReason: unavailable,
  },
  async getAvailability() {
    return { available: false, permissionGranted: false, message: unavailable };
  },
  async startListening() {
    throw new Error(unavailable);
  },
  async stopListening() {},
  async cancelListening() {},
};

export default nativeStt;
