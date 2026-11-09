import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/**
 * Writes the export to a temporary file and opens the iOS share sheet. The
 * temporary copy is deleted afterwards; where the researcher sends it is their
 * explicit choice.
 */
export async function shareTextFile(fileName: string, content: string, mimeType: string) {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  const dir = new Directory(Paths.cache, 'exports');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const file = new File(dir, fileName);
  if (file.exists) file.delete();
  file.create();
  await file.write(content);
  try {
    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: 'Export interview' });
  } finally {
    try {
      file.delete();
    } catch {
      // ignore
    }
  }
}
