import type { DraftSegment } from './segmenter';

export type EngineId = 'apple-on-device' | 'whisper-on-device';

export interface EngineAvailability {
  available: boolean;
  reason?: string;
}

export interface TranscribeOptions {
  uri: string;
  durationMs?: number;
  signal?: AbortSignal;
  onProgress?: (fraction: number | null) => void;
  onPartial?: (text: string) => void;
  /** Local model id, for engines that use a downloadable model. */
  modelId?: string;
}

export interface TranscribeResult {
  segments: DraftSegment[];
  model: string;
  approximateTimestamps: boolean;
}

/**
 * Every engine here is LOCAL. If an engine is unavailable or fails, it throws
 * and the UI stops; no engine falls back to uploading audio.
 */
export interface TranscriptionEngine {
  id: EngineId;
  name: string;
  description: string;
  checkAvailability(modelId?: string): Promise<EngineAvailability>;
  transcribeFile(options: TranscribeOptions): Promise<TranscribeResult>;
}
