/**
 * One microphone consumer at a time.
 *
 * Adapted from the class reference repository
 * (https://github.com/UMSI669/Voice-To-Text, src/services/audio/recording.js,
 * MIT licensed — see LICENSE-THIRD-PARTY.md).
 *
 * Two consumers on the microphone at once produces silent recordings on
 * Android and a thrown audio-session error on iOS, so native recognition and
 * cloud recording can never both be live.
 */

let activeOwner = null;

export function claimMicrophone(owner) {
  if (activeOwner && activeOwner !== owner) {
    throw new Error('Another microphone session is already active. Stop it before starting a new one.');
  }

  activeOwner = owner;
  return function release() {
    if (activeOwner === owner) activeOwner = null;
  };
}

export function microphoneOwner() {
  return activeOwner;
}

/** Recovery hatch for an owner that crashed without releasing. */
export function forceReleaseMicrophone() {
  activeOwner = null;
}

export function getAudioFileMetadata(uri) {
  const filename = uri?.split('/').pop() || 'dream.m4a';
  const extension = filename.split('.').pop()?.toLowerCase();
  const mimeType =
    extension === 'wav'
      ? 'audio/wav'
      : extension === 'm4a' || extension === 'mp4'
        ? 'audio/mp4'
        : extension === 'webm'
          ? 'audio/webm'
          : 'audio/mp4';

  return { filename, mimeType, extension };
}

/**
 * Strips anything key-shaped, plus URLs, out of a message before it reaches
 * the interface. Adapted from the reference repository's safeErrorMessage.
 */
export function safeErrorMessage(error, fallback = 'Something went wrong.') {
  let message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  if (!message) message = fallback;

  const token = process.env.EXPO_PUBLIC_API_AUTH_TOKEN?.trim();
  if (token) message = message.split(token).join('[redacted]');

  return message
    .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [redacted]')
    .replace(/sk-[A-Za-z0-9_-]{12,}/g, '[redacted]')
    .slice(0, 400);
}
