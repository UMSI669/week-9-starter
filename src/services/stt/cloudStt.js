/**
 * Optional cloud transcription. A separate, explicitly selected mode.
 *
 * Audio is NEVER uploaded automatically. This path runs only when the user
 * has chosen "Cloud transcription" in Settings and then tapped record, and
 * the capture screen shows a standing notice that audio will leave the phone.
 * When phone transcription fails, the app offers typing — it does not quietly
 * fall back to uploading.
 *
 * Upload shape adapted from the class reference repository
 * (https://github.com/UMSI669/Voice-To-Text, src/services/stt/cloudStt.js,
 * MIT licensed — see LICENSE-THIRD-PARTY.md), redirected at this project's own
 * backend instead of calling OpenRouter from the phone.
 */

import { File } from 'expo-file-system';
import { apiRequest } from '../apiClient';
import { getAudioFileMetadata } from './micLock';

export const CLOUD_NOTICE =
  'Cloud transcription uploads the audio recording to this app’s backend, which forwards it to ' +
  'OpenRouter. The recording leaves your phone. Phone transcription and typing do not upload audio.';

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_DURATION_SECONDS = 185;

export const cloudStt = {
  capabilities: {
    microphone: true,
    audioFile: true,
    processingLocation: 'cloud',
    unavailableReason: null,
  },

  /**
   * @param {object} input
   * @param {string} input.uri Local file URI from expo-audio.
   * @param {number} [input.durationMs]
   * @param {AbortSignal} [input.signal]
   */
  async transcribeFile({ uri, durationMs, signal }) {
    if (!uri) throw new Error('There is no recording to upload.');

    const file = new File(uri);
    if (!file.exists) {
      throw new Error('The recording file is no longer available. Try recording again.');
    }

    // Validate size and duration before spending an upload or a billable call.
    const size = Number(file.size) || 0;
    if (size < 1024) {
      throw new Error('That recording is too short to contain speech. Try again.');
    }
    if (size > MAX_UPLOAD_BYTES) {
      throw new Error(
        `That recording is ${(size / 1024 / 1024).toFixed(1)} MB, over the ${MAX_UPLOAD_BYTES / 1024 / 1024} MB upload limit.`,
      );
    }

    const durationSeconds = durationMs ? Math.round(durationMs / 1000) : null;
    if (durationSeconds && durationSeconds > MAX_DURATION_SECONDS) {
      throw new Error(
        `That recording is ${durationSeconds} seconds, over the ${MAX_DURATION_SECONDS} second limit.`,
      );
    }

    // The actual format comes from the file itself rather than an assumption:
    // expo-audio's container differs by platform and by recording options.
    const { filename, mimeType } = getAudioFileMetadata(uri);
    const resolvedType = file.type || mimeType;

    const formData = new FormData();
    // Content-Type is intentionally NOT set on the request: fetch must add
    // multipart/form-data itself so the boundary parameter is correct.
    // The filename is passed explicitly so the backend's MIME allowlist sees
    // the real extension rather than whatever the platform happened to name
    // the temporary file.
    formData.append('file', file, file.name || filename);
    if (durationSeconds) formData.append('durationSeconds', String(durationSeconds));

    const body = await apiRequest('/api/transcribe', {
      formData,
      /**
       * This budget must cover UPLOAD TIME PLUS the backend's own 90s cap on
       * the transcription model. Audio here is uncompressed 16 kHz mono WAV
       * (32 KB per second), so a 3 minute dream is around 5.7 MB, which on a
       * phone hotspot uplink can take a minute on its own. At the old 120s
       * the client gave up before the backend had a chance to answer.
       */
      timeoutMs: 240_000,
      signal,
    });

    if (typeof body.text !== 'string' || !body.text.trim()) {
      throw new Error('The transcription came back empty. The recording may have been silent.');
    }

    return {
      transcript: body.text.trim(),
      language: body.language || null,
      model: body.model || null,
      filename,
      mimeType: resolvedType,
      sizeBytes: size,
    };
  },
};

export default cloudStt;
