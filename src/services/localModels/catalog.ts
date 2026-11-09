/**
 * On-device models (development build only). Sizes were verified against the
 * Hugging Face files. Choices:
 *
 * Speech-to-text (whisper.rn, English-only ".en" models, Q5_1 quantized):
 *  - base.en: default. Clearly better than tiny on conversational interview
 *    speech while still running faster than real time on an A14.
 *  - tiny.en: fastest / smallest, for long recordings on the oldest phones.
 *  - small.en: best accuracy, for iPhone 15 Pro-class devices.
 *
 * Sensitive-span detection (llama.rn, GGUF Q4_K_M):
 *  - Qwen2.5 1.5B Instruct: default. Reliable JSON/schema following and good
 *    entity recall for its size; ~1.1 GB fits the 4 GB RAM baseline.
 *  - Qwen2.5 0.5B Instruct: fallback for benchmarking on the oldest supported
 *    iPhone or very long transcripts (lower recall; patterns still run).
 *  - Llama 3.2 1B Instruct: alternative family for comparison.
 */

export type LocalModelKind = 'whisper' | 'llm';

export interface LocalModel {
  id: string;
  kind: LocalModelKind;
  name: string;
  fileName: string;
  url: string;
  sizeBytes: number;
  /** Downloads smaller than this are treated as truncated. */
  minBytes: number;
  description: string;
  recommended?: boolean;
  /** llama.rn context size used for chunked detection. */
  contextSize?: number;
}

const HF = 'https://huggingface.co';

export const LOCAL_MODELS: LocalModel[] = [
  {
    id: 'whisper-base.en-q5_1',
    kind: 'whisper',
    name: 'Whisper base.en (Q5_1)',
    fileName: 'ggml-base.en-q5_1.bin',
    url: `${HF}/ggerganov/whisper.cpp/resolve/main/ggml-base.en-q5_1.bin?download=true`,
    sizeBytes: 59_721_011,
    minBytes: 55_000_000,
    description: 'Recommended balance of accuracy and speed for English interviews.',
    recommended: true,
  },
  {
    id: 'whisper-tiny.en-q5_1',
    kind: 'whisper',
    name: 'Whisper tiny.en (Q5_1)',
    fileName: 'ggml-tiny.en-q5_1.bin',
    url: `${HF}/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en-q5_1.bin?download=true`,
    sizeBytes: 32_166_155,
    minBytes: 30_000_000,
    description: 'Fastest and smallest; more recognition errors.',
  },
  {
    id: 'whisper-small.en-q5_1',
    kind: 'whisper',
    name: 'Whisper small.en (Q5_1)',
    fileName: 'ggml-small.en-q5_1.bin',
    url: `${HF}/ggerganov/whisper.cpp/resolve/main/ggml-small.en-q5_1.bin?download=true`,
    sizeBytes: 190_098_681,
    minBytes: 180_000_000,
    description: 'Most accurate; slower. Best on recent Pro iPhones.',
  },
  {
    id: 'qwen2.5-1.5b-instruct-q4_k_m',
    kind: 'llm',
    name: 'Qwen2.5 1.5B Instruct (Q4_K_M)',
    fileName: 'qwen2.5-1.5b-instruct-q4_k_m.gguf',
    url: `${HF}/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf?download=true`,
    sizeBytes: 1_117_320_736,
    minBytes: 1_100_000_000,
    description: 'Recommended for sensitive-span detection.',
    recommended: true,
    contextSize: 4096,
  },
  {
    id: 'qwen2.5-0.5b-instruct-q4_k_m',
    kind: 'llm',
    name: 'Qwen2.5 0.5B Instruct (Q4_K_M)',
    fileName: 'qwen2.5-0.5b-instruct-q4_k_m.gguf',
    url: `${HF}/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf?download=true`,
    sizeBytes: 491_400_032,
    minBytes: 480_000_000,
    description: 'Smallest and fastest; lower recall. Use on older iPhones.',
    contextSize: 4096,
  },
  {
    id: 'llama-3.2-1b-instruct-q4_k_m',
    kind: 'llm',
    name: 'Llama 3.2 1B Instruct (Q4_K_M)',
    fileName: 'Llama-3.2-1B-Instruct-Q4_K_M.gguf',
    url: `${HF}/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf?download=true`,
    sizeBytes: 807_694_464,
    minBytes: 790_000_000,
    description: 'Alternative model family for comparison.',
    contextSize: 4096,
  },
];

export const DEFAULT_WHISPER_MODEL = 'whisper-base.en-q5_1';
export const DEFAULT_LLM_MODEL = 'qwen2.5-1.5b-instruct-q4_k_m';

export const getLocalModel = (id: string | undefined) => LOCAL_MODELS.find((m) => m.id === id);

export const formatBytes = (bytes: number) =>
  bytes >= 1e9 ? `${(bytes / 1e9).toFixed(2)} GB` : `${Math.round(bytes / 1e6)} MB`;
