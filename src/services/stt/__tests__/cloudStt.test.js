/**
 * Regression tests for the cloud transcription upload.
 *
 * These exist because of a real defect: an edit to the request options once
 * dropped the `formData` argument, so the app sent a POST with no body and the
 * backend answered "an audio file is required in the file field". Nothing in
 * the suite noticed, because every other test mocked the whole module. The
 * assertions below pin the request SHAPE, not just that a call happened.
 */

import { File } from 'expo-file-system';
import { apiRequest } from '../../apiClient';
import { cloudStt } from '../cloudStt';

jest.mock('../../apiClient', () => ({
  apiRequest: jest.fn(),
}));

jest.mock('expo-file-system', () => ({
  File: jest.fn(),
}));

jest.mock('../micLock', () => ({
  getAudioFileMetadata: jest.fn(() => ({
    filename: 'dream.wav',
    mimeType: 'audio/wav',
  })),
}));


/**
 * React Native's FormData polyfill accepts only strings and {uri,name,type}
 * blobs, so it throws on the expo-file-system File the app really appends.
 * The app works because expo/fetch supplies a WinterCG FormData at runtime.
 * This recorder stands in for that so the test can assert the request SHAPE
 * our code builds, instead of the polyfill's accept/reject rules.
 */
class RecordingFormData {
  constructor() {
    this.entries = [];
  }

  append(name, value, filename) {
    this.entries.push({ name, value, filename });
  }

  get(name) {
    return this.entries.find((entry) => entry.name === name)?.value;
  }

  names() {
    return this.entries.map((entry) => entry.name);
  }
}

let OriginalFormData;

beforeAll(() => {
  OriginalFormData = global.FormData;
  global.FormData = RecordingFormData;
});

afterAll(() => {
  global.FormData = OriginalFormData;
});

function mockRecording({ exists = true, size = 64 * 1024, name = 'dream.wav' } = {}) {
  File.mockImplementation(() => ({ exists, size, name, type: 'audio/wav' }));
}

beforeEach(() => {
  jest.clearAllMocks();
  apiRequest.mockResolvedValue({ text: 'I walked through a purple forest.' });
});

describe('cloudStt.transcribeFile', () => {
  it('sends the audio as multipart form data in the "file" field', async () => {
    mockRecording();

    await cloudStt.transcribeFile({ uri: 'file:///tmp/dream.wav', durationMs: 4000 });

    expect(apiRequest).toHaveBeenCalledTimes(1);
    const [path, options] = apiRequest.mock.calls[0];
    expect(path).toBe('/api/transcribe');

    // The regression: options.formData must be present, or the backend gets
    // a POST with an empty body.
    expect(options.formData).toBeInstanceOf(RecordingFormData);
    expect(options.formData.names()).toContain('file');

    // The value must be the recording itself, and the filename must carry the
    // real extension so the backend's MIME allowlist sees it.
    const entry = options.formData.entries.find((item) => item.name === 'file');
    expect(entry.value).toMatchObject({ size: 64 * 1024, name: 'dream.wav' });
    expect(entry.filename).toBe('dream.wav');
  });

  it('includes the duration so the backend can validate it too', async () => {
    mockRecording();

    await cloudStt.transcribeFile({ uri: 'file:///tmp/dream.wav', durationMs: 4000 });

    const [, options] = apiRequest.mock.calls[0];
    expect(options.formData.get('durationSeconds')).toBe('4');
  });

  it('does not set Content-Type itself, so fetch can add the boundary', async () => {
    mockRecording();

    await cloudStt.transcribeFile({ uri: 'file:///tmp/dream.wav' });

    const [, options] = apiRequest.mock.calls[0];
    expect(options.headers).toBeUndefined();
  });

  it('allows a budget that covers upload time plus the backend model cap', async () => {
    mockRecording();

    await cloudStt.transcribeFile({ uri: 'file:///tmp/dream.wav' });

    const [, options] = apiRequest.mock.calls[0];
    // The backend caps the model at 90s and only starts that timer after the
    // upload finishes, so the client must wait longer than 90s.
    expect(options.timeoutMs).toBeGreaterThan(90_000);
  });

  it('refuses a missing recording without calling the backend', async () => {
    mockRecording({ exists: false });

    await expect(cloudStt.transcribeFile({ uri: 'file:///tmp/gone.wav' })).rejects.toThrow(
      /no longer available/i,
    );
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('refuses an oversized recording without spending an upload', async () => {
    mockRecording({ size: 25 * 1024 * 1024 });

    await expect(cloudStt.transcribeFile({ uri: 'file:///tmp/big.wav' })).rejects.toThrow(
      /over the 20 MB upload limit/i,
    );
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('rejects an over-length recording before uploading', async () => {
    mockRecording();

    await expect(
      cloudStt.transcribeFile({ uri: 'file:///tmp/long.wav', durationMs: 200_000 }),
    ).rejects.toThrow(/over the 185 second limit/i);
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('treats an empty transcription as a failure rather than a result', async () => {
    mockRecording();
    apiRequest.mockResolvedValue({ text: '   ' });

    await expect(cloudStt.transcribeFile({ uri: 'file:///tmp/silent.wav' })).rejects.toThrow(
      /came back empty/i,
    );
  });
});
