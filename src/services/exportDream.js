/**
 * Export: text to the clipboard or the share sheet, and a PNG of the card.
 *
 * Honesty rules this module enforces:
 *  - opening a share sheet is NOT proof anyone received anything, so every
 *    result says "shareSheetOpened", never "sent"
 *  - "Save image" only reports success when the media library actually
 *    confirms the save
 *  - a denied photo permission is reported as denied, and sharing stays
 *    available because it needs no permission
 *  - temporary capture files are deleted once they are no longer needed
 */

import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import { Directory, File, Paths } from 'expo-file-system';
import { buildDreamExportText } from './dreamExportText';

const EXPORT_DIRECTORY_NAME = 'dream-exports';

/**
 * react-native-view-shot is a third-party native module. Whether a given
 * client has it depends on how that client was built, and Expo Go ships a
 * fixed module set that this project cannot change.
 *
 * Because this file is imported during app startup (the root layout clears
 * stale exports), a static import of a missing native module would crash the
 * whole app at launch. Resolving it lazily turns that into one unavailable
 * feature: PNG export reports itself as unsupported, and text export,
 * recording, storage, and everything else keep working.
 */
let captureRefImpl;

function getCaptureRef() {
  if (captureRefImpl !== undefined) return captureRefImpl;
  try {
    captureRefImpl = require('react-native-view-shot').captureRef ?? null;
  } catch (_error) {
    captureRefImpl = null;
  }
  return captureRefImpl;
}

/** True when this build can render a card to PNG. */
export function isImageExportAvailable() {
  return getCaptureRef() !== null;
}

export const IMAGE_EXPORT_UNAVAILABLE =
  'Saving a dream card as an image needs a development build \u2014 Expo Go does not include the ' +
  'screenshot module. Copy text and Share text both work here.';

export class ExportError extends Error {
  constructor(message, code = 'export_failed') {
    super(message);
    this.name = 'ExportError';
    this.code = code;
  }
}

/** Writes the readable text format to the clipboard. */
export async function copyDreamText(dream) {
  const text = buildDreamExportText(dream);
  try {
    await Clipboard.setStringAsync(text);
    return { ok: true, text };
  } catch (_error) {
    throw new ExportError('Could not write to the clipboard.', 'clipboard_failed');
  }
}

/**
 * Opens the native share sheet with the text.
 * Resolves with shareSheetOpened — whether anyone received it is unknowable.
 */
export async function shareDreamText(dream) {
  const text = buildDreamExportText(dream);
  const { Share } = await import('react-native');
  try {
    const result = await Share.share({ message: text });
    return {
      ok: true,
      shareSheetOpened: true,
      dismissed: result?.action === Share.dismissedAction,
    };
  } catch (_error) {
    throw new ExportError('The share sheet could not be opened.', 'share_failed');
  }
}

function exportDirectory() {
  const directory = new Directory(Paths.cache, EXPORT_DIRECTORY_NAME);
  if (!directory.exists) directory.create({ intermediates: true });
  return directory;
}

/**
 * Captures the ExportCard view as a PNG.
 *
 * @param {object} input
 * @param {import('react').RefObject} input.viewRef Ref on the ExportCard only,
 *        never the screen, so buttons cannot end up in the image.
 * @param {object} input.dream
 * @returns {Promise<{uri: string, file: File}>}
 */
export async function captureDreamCard({ viewRef, dream }) {
  if (!viewRef?.current) {
    throw new ExportError('The card is not ready to capture yet.', 'not_ready');
  }

  // One frame of breathing room so fonts and the final layout have settled;
  // capturing mid-layout is what produces clipped or blank images.
  await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 60)));

  const captureRef = getCaptureRef();
  if (!captureRef) {
    throw new ExportError(IMAGE_EXPORT_UNAVAILABLE, 'capture_unavailable');
  }

  let tempUri;
  try {
    tempUri = await captureRef(viewRef, {
      format: 'png',
      quality: 1,
      result: 'tmpfile',
      // 2x for a crisp image on modern screens.
      pixelRatio: 2,
    });
  } catch (_error) {
    throw new ExportError(
      'The card image could not be rendered. Try again, or export the text instead.',
      'capture_failed',
    );
  }

  const safeTitle = (dream.title || 'dream')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'dream';

  try {
    const source = new File(tempUri);
    const destination = new File(exportDirectory(), `${safeTitle}-${Date.now()}.png`);
    // copy() is asynchronous in SDK 58; copySync() is the blocking variant.
    // Awaiting it is what guarantees the file exists before its URI is used.
    await source.copy(destination);
    // The view-shot temp file has served its purpose.
    try {
      if (source.exists) source.delete();
    } catch (_error) {
      // Best-effort: the OS clears its own temp directory anyway.
    }
    return { uri: destination.uri, file: destination };
  } catch (_error) {
    // Fall back to the raw capture rather than failing the whole export.
    return { uri: tempUri, file: new File(tempUri) };
  }
}

/**
 * Opens the native share sheet for a captured PNG.
 * `shareSheetOpened: true` means exactly that and nothing more.
 */
export async function shareDreamImage(uri) {
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new ExportError('Sharing is not available on this device.', 'sharing_unavailable');
  }

  try {
    await Sharing.shareAsync(uri, {
      mimeType: 'image/png',
      dialogTitle: 'Share dream card',
      UTI: 'public.png',
    });
    return { ok: true, shareSheetOpened: true };
  } catch (_error) {
    throw new ExportError('The share sheet could not be opened.', 'share_failed');
  }
}

/**
 * Saves the PNG to the photo library. Permission is requested here, at the
 * moment of the action, and only this permission.
 *
 * @returns {Promise<{ok: true} | never>} Throws with code 'permission_denied'
 *          when the user declines; the caller keeps sharing available.
 */
export async function saveDreamImageToPhotos(uri) {
  let permission;
  try {
    permission = await MediaLibrary.requestPermissionsAsync(true);
  } catch (_error) {
    throw new ExportError(
      'This build cannot access the photo library. You can still share the image.',
      'media_library_unavailable',
    );
  }

  if (!permission.granted) {
    throw new ExportError(
      permission.canAskAgain
        ? 'Permission to save photos was declined, so the image was not saved. You can still share it.'
        : 'Photo access is turned off for Dream Decoder in system settings, so the image was not saved. You can still share it.',
      'permission_denied',
    );
  }

  try {
    // SDK 58 replaced createAssetAsync with the Asset class. Asset.create
    // returns the saved asset, and its id is the proof the save happened.
    const asset = await MediaLibrary.Asset.create(uri);
    if (!asset?.id) {
      throw new Error('no asset returned');
    }
    return { ok: true, assetId: asset.id };
  } catch (_error) {
    throw new ExportError(
      'The image could not be saved to your photo library. You can still share it.',
      'save_failed',
    );
  }
}

/**
 * Removes a finished export file. Called when the export sheet closes, so the
 * cache does not accumulate PNGs the user has moved on from.
 */
export function cleanUpExportFile(uri) {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch (_error) {
    // Cleanup is best-effort; the cache directory is reclaimable by the OS.
  }
}

/** Clears every leftover export, used on app start. */
export function cleanUpAllExports() {
  try {
    const directory = new Directory(Paths.cache, EXPORT_DIRECTORY_NAME);
    if (directory.exists) directory.delete();
  } catch (_error) {
    // Best-effort.
  }
}

export { buildDreamExportText };
