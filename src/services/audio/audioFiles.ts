import { Asset } from 'expo-asset';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import type { AudioRef } from '../../models/types';
import { getSample } from '../../data/samples';
import { audioDir } from '../storage/vault';

const AUDIO_TYPES = ['audio/*', 'audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac'];

const extensionOf = (name: string) => {
  const match = name.toLowerCase().match(/\.([a-z0-9]{2,5})$/);
  return match ? match[1] : 'm4a';
};

/**
 * Lets the researcher import an interview recording and copies it into the
 * vault under a neutral name (<sessionId>.<ext>). The original file name is
 * kept only as local metadata and never leaves the device.
 */
export async function importAudioFile(sessionId: string): Promise<AudioRef | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: AUDIO_TYPES,
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const picked = result.assets[0];
  const source = new File(picked.uri);
  if (!source.exists || (source.size ?? 0) === 0) throw new Error('The selected file is empty or unreadable.');
  if (picked.mimeType && !picked.mimeType.startsWith('audio/')) {
    throw new Error('Please choose an audio file (WAV, M4A, MP3).');
  }
  const ext = extensionOf(picked.name);
  const destination = new File(audioDir, `${sessionId}.${ext}`);
  if (destination.exists) destination.delete();
  source.copySync(destination);
  try {
    source.delete(); // remove the picker's cache copy
  } catch {
    // ignore
  }
  return {
    kind: 'imported',
    uri: destination.uri,
    originalFilename: picked.name,
    mimeType: picked.mimeType ?? (ext === 'wav' ? 'audio/wav' : 'audio/mp4'),
    sizeBytes: destination.size ?? undefined,
  };
}

/** Moves a finished recording from the recorder's location into the vault. */
export function storeRecording(sessionId: string, recordingUri: string, durationMs: number): AudioRef {
  const source = new File(recordingUri);
  if (!source.exists) throw new Error('The recording file could not be found.');
  const ext = extensionOf(recordingUri);
  const destination = new File(audioDir, `${sessionId}.${ext}`);
  if (destination.exists) destination.delete();
  source.moveSync(destination);
  return {
    kind: 'recorded',
    uri: destination.uri,
    mimeType: ext === 'wav' ? 'audio/wav' : 'audio/mp4',
    durationMs,
    sizeBytes: destination.size ?? undefined,
  };
}

export function sampleAudioRef(sampleId: string): AudioRef {
  const sample = getSample(sampleId);
  return {
    kind: 'bundled-sample',
    uri: '',
    sampleId,
    mimeType: 'audio/wav',
    durationMs: sample?.durationMs,
  };
}

/** Source usable by expo-audio's player. */
export function playerSource(audio: AudioRef | undefined): number | { uri: string } | null {
  if (!audio) return null;
  if (audio.kind === 'bundled-sample') return getSample(audio.sampleId)?.asset ?? null;
  return audio.uri ? { uri: audio.uri } : null;
}

/** Local file URI for on-device transcription (bundled assets are resolved to a file first). */
export async function localFileUri(audio: AudioRef): Promise<string> {
  if (audio.kind === 'bundled-sample') {
    const sample = getSample(audio.sampleId);
    if (!sample) throw new Error('Bundled sample not found.');
    const asset = Asset.fromModule(sample.asset);
    await asset.downloadAsync();
    if (!asset.localUri) throw new Error('The bundled sample could not be resolved to a local file.');
    return asset.localUri;
  }
  const file = new File(audio.uri);
  if (!file.exists) throw new Error('The audio file is missing from local storage.');
  return audio.uri;
}

export const isWav = (audio: AudioRef) =>
  audio.kind === 'bundled-sample' || audio.mimeType?.includes('wav') || audio.uri.toLowerCase().endsWith('.wav');
