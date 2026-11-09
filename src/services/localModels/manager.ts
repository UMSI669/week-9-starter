import { Directory, File, Paths } from 'expo-file-system';
import { makeAbortError } from '../../utils/safeError';
import type { LocalModel } from './catalog';

/**
 * Models are stored under Caches/models so that gigabyte-sized weights are not
 * copied into iCloud device backups. iOS may purge caches under storage
 * pressure; status is re-checked before every use and the UI offers a
 * re-download, so a purge never causes a silent fallback to the cloud.
 */
const modelsDir = () => new Directory(Paths.cache, 'models');
export const modelFile = (model: LocalModel) => new File(modelsDir(), model.fileName);

export type ModelStatus = 'ready' | 'missing' | 'incomplete';

export function getModelStatus(model: LocalModel): ModelStatus {
  const file = modelFile(model);
  if (!file.exists) return 'missing';
  return (file.size ?? 0) >= model.minBytes ? 'ready' : 'incomplete';
}

export function deleteModel(model: LocalModel) {
  const file = modelFile(model);
  if (file.exists) file.delete();
}

export async function downloadModel(
  model: LocalModel,
  options: { onProgress?: (fraction: number | null) => void; signal?: AbortSignal } = {},
): Promise<void> {
  const dir = modelsDir();
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const free = Paths.availableDiskSpace;
  if (typeof free === 'number' && free > 0 && free < model.sizeBytes * 1.2) {
    throw new Error(`Not enough free storage. ${model.name} needs about ${Math.ceil(model.sizeBytes / 1e6)} MB.`);
  }
  deleteModel(model);
  if (options.signal?.aborted) throw makeAbortError('Download canceled.');

  const task = File.createDownloadTask(model.url, modelFile(model), {
    onProgress: ({ bytesWritten, totalBytes }) => {
      const written = Number(bytesWritten);
      const total = Number(totalBytes) || model.sizeBytes;
      options.onProgress?.(total > 0 ? Math.min(1, written / total) : null);
    },
  });
  const cancel = () => task.cancel();
  options.signal?.addEventListener('abort', cancel, { once: true });
  try {
    const result = await task.downloadAsync();
    if (options.signal?.aborted) throw makeAbortError('Download canceled.');
    if (!result?.exists || (result.size ?? 0) < model.minBytes) {
      throw new Error('The model download was incomplete. Please try again on Wi-Fi.');
    }
  } catch (error) {
    deleteModel(model);
    throw error;
  } finally {
    options.signal?.removeEventListener('abort', cancel);
    task.release();
  }
}
