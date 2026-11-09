import { Directory, File, Paths } from 'expo-file-system';
import type { InterviewSession, Project } from '../../models/types';

/**
 * All research data lives in <Documents>/vault inside the app sandbox, which
 * iOS protects with Data Protection while the device is locked. Nothing here
 * is synced by the app. iOS device backups (iCloud / encrypted Finder backups)
 * include app Documents — see README "Backups".
 *
 *   vault/data.json          projects + sessions (transcripts, spans, identity maps, analysis)
 *   vault/audio/<id>.<ext>   imported and recorded interview audio
 */
const SCHEMA_VERSION = 1;

export const vaultDir = new Directory(Paths.document, 'vault');
export const audioDir = new Directory(vaultDir, 'audio');
// File instances are mutated by move(), so create fresh ones for every operation.
const dataFile = () => new File(vaultDir, 'data.json');
const tempFile = () => new File(vaultDir, 'data.tmp.json');

export interface VaultData {
  version: number;
  projects: Project[];
  sessions: InterviewSession[];
  /** Non-secret preferences (model choices, privacy toggles). Never the API key. */
  settings?: Record<string, unknown>;
}

function ensureDirs() {
  if (!vaultDir.exists) vaultDir.create({ intermediates: true, idempotent: true });
  if (!audioDir.exists) audioDir.create({ intermediates: true, idempotent: true });
}

export async function loadVault(): Promise<VaultData> {
  ensureDirs();
  const file = dataFile();
  if (!file.exists) return { version: SCHEMA_VERSION, projects: [], sessions: [] };
  try {
    const parsed = JSON.parse(await file.text()) as Partial<VaultData>;
    return {
      version: SCHEMA_VERSION,
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      settings: typeof parsed.settings === 'object' && parsed.settings ? parsed.settings : undefined,
    };
  } catch {
    // Keep the unreadable file for manual recovery instead of overwriting it.
    const corrupt = new File(vaultDir, `data.corrupt-${Date.now()}.json`);
    dataFile().moveSync(corrupt);
    return { version: SCHEMA_VERSION, projects: [], sessions: [] };
  }
}

let writing: Promise<void> = Promise.resolve();

/** Serialized, write-then-rename save so a crash never leaves a half-written file. */
export function saveVault(data: Omit<VaultData, 'version'>): Promise<void> {
  const next = writing.then(async () => {
    ensureDirs();
    const json = JSON.stringify({ version: SCHEMA_VERSION, ...data });
    const temp = tempFile();
    if (temp.exists) temp.delete();
    temp.create();
    await temp.write(json);
    temp.moveSync(dataFile(), { overwrite: true });
  });
  // Keep the queue alive even if one write fails.
  writing = next.catch(() => undefined);
  return next;
}

export function deleteAudioFile(uri: string | undefined) {
  if (!uri || !uri.includes('/vault/audio/')) return; // never delete bundled assets
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Best effort; the vault wipe below removes leftovers.
  }
}

/** Removes every project, transcript, mapping and audio file. */
export function wipeVault() {
  if (vaultDir.exists) vaultDir.delete();
  ensureDirs();
}
