import { nativeAiAvailable } from '../runtime';
import { getLocalModel } from '../localModels/catalog';
import { getModelStatus, modelFile } from '../localModels/manager';
import { makeAbortError } from '../../utils/safeError';
import type { LlmComplete } from './llmDetector';

/**
 * llama.rn bridge (development build only). The native module is required
 * lazily inside this function so Expo Go never loads it.
 */
export interface LocalLlm {
  modelId: string;
  complete: LlmComplete;
  release: () => Promise<void>;
}

export async function loadLocalLlm(modelId: string, onLoadProgress?: (fraction: number) => void): Promise<LocalLlm> {
  if (!nativeAiAvailable) throw new Error('Local Qwen/Llama masking requires a development build.');
  const model = getLocalModel(modelId);
  if (!model || model.kind !== 'llm') throw new Error('Unknown local model.');
  if (getModelStatus(model) !== 'ready') throw new Error(`Download ${model.name} in Settings first.`);

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { initLlama } = require('llama.rn') as typeof import('llama.rn');
  const context = await initLlama(
    {
      model: modelFile(model).uri,
      n_ctx: model.contextSize ?? 4096,
      n_batch: 512,
      n_gpu_layers: 99, // Metal on iOS; llama.cpp falls back to CPU if unsupported
      use_mlock: false,
    },
    (progress) => onLoadProgress?.(progress / 100),
  );

  const complete: LlmComplete = async (messages, options) => {
    if (options.signal?.aborted) throw makeAbortError('Detection canceled.');
    const stop = () => void context.stopCompletion();
    options.signal?.addEventListener('abort', stop, { once: true });
    try {
      const result = await context.completion({
        messages,
        n_predict: options.maxTokens,
        temperature: 0,
        enable_thinking: false,
        response_format: { type: 'json_schema', json_schema: { strict: true, schema: options.jsonSchema } },
      });
      if (options.signal?.aborted) throw makeAbortError('Detection canceled.');
      return result.content || result.text || '';
    } finally {
      options.signal?.removeEventListener('abort', stop);
    }
  };

  return { modelId, complete, release: () => context.release() };
}
