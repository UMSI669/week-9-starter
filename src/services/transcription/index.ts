import { appleSpeechEngine } from './appleSpeech';
import type { EngineId, TranscriptionEngine } from './types';
import { whisperEngine } from './whisper';

export const ENGINES: Record<EngineId, TranscriptionEngine> = {
  'apple-on-device': appleSpeechEngine,
  'whisper-on-device': whisperEngine,
};

export type { EngineId, TranscriptionEngine } from './types';
