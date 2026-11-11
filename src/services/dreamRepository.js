/**
 * Durable dream storage. This module is the only writer of dream records.
 *
 * Redux holds a cache for the UI, but SQLite is the source of truth: every
 * mutation here writes to SQLite first and returns the stored row, so a
 * restart reloads exactly what was saved.
 *
 * Row <-> record mapping lives here: SQLite has no array type, so themes and
 * moods are stored as JSON text and parsed on the way out.
 */

import { DREAM_SCHEMA_VERSION, getDatabase } from './db';
import { createVisualSeed } from './visualSeed';
import { deviceTimeZone, nowIso } from './formatDate';
import { CATEGORY_KEYS, OTHER_CATEGORY_KEY, isValidCategory } from '../data/categories';

const DREAM_COLUMNS = [
  'id',
  'schemaVersion',
  'createdAt',
  'updatedAt',
  'capturedTimeZone',
  'originalTranscript',
  'transcript',
  'title',
  'summary',
  'symbolKey',
  'symbolLabel',
  'emoji',
  'interpretation',
  'reflectionQuestion',
  'primaryCategory',
  'themes',
  'moods',
  'visualSeed',
  'analysisStatus',
  'analysisModel',
  'isDemo',
];

export class StorageError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'StorageError';
    this.cause = cause;
  }
}

async function withDatabase(operation, failureMessage) {
  try {
    const db = await getDatabase();
    return await operation(db);
  } catch (error) {
    // Surfaced to the UI as a recoverable message; the original is kept for
    // the dev console but never shown raw to the user.
    if (__DEV__) console.warn('[dreamRepository]', failureMessage, error);
    throw new StorageError(failureMessage, error);
  }
}

export function createDreamId() {
  const random = Math.random().toString(36).slice(2, 10);
  return `dream_${Date.now().toString(36)}_${random}`;
}

function parseList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch (_error) {
    return [];
  }
}

export function rowToDream(row) {
  if (!row) return null;
  return {
    id: row.id,
    schemaVersion: Number(row.schemaVersion) || DREAM_SCHEMA_VERSION,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    capturedTimeZone: row.capturedTimeZone || null,
    originalTranscript: row.originalTranscript || '',
    transcript: row.transcript || '',
    title: row.title || '',
    summary: row.summary || '',
    symbolKey: row.symbolKey || '',
    symbolLabel: row.symbolLabel || '',
    emoji: row.emoji || '',
    interpretation: row.interpretation || '',
    reflectionQuestion: row.reflectionQuestion || '',
    primaryCategory: isValidCategory(row.primaryCategory)
      ? row.primaryCategory
      : OTHER_CATEGORY_KEY,
    themes: parseList(row.themes),
    moods: parseList(row.moods),
    visualSeed: row.visualSeed,
    analysisStatus: row.analysisStatus || 'none',
    analysisModel: row.analysisModel || null,
    isDemo: Number(row.isDemo) === 1,
  };
}

export function dreamToRow(dream) {
  return {
    id: dream.id,
    schemaVersion: dream.schemaVersion ?? DREAM_SCHEMA_VERSION,
    createdAt: dream.createdAt,
    updatedAt: dream.updatedAt,
    capturedTimeZone: dream.capturedTimeZone ?? null,
    originalTranscript: dream.originalTranscript ?? '',
    transcript: dream.transcript ?? '',
    title: dream.title ?? '',
    summary: dream.summary ?? '',
    symbolKey: dream.symbolKey ?? '',
    symbolLabel: dream.symbolLabel ?? '',
    emoji: dream.emoji ?? '',
    interpretation: dream.interpretation ?? '',
    reflectionQuestion: dream.reflectionQuestion ?? '',
    primaryCategory: isValidCategory(dream.primaryCategory)
      ? dream.primaryCategory
      : OTHER_CATEGORY_KEY,
    themes: JSON.stringify(Array.isArray(dream.themes) ? dream.themes : []),
    moods: JSON.stringify(Array.isArray(dream.moods) ? dream.moods : []),
    visualSeed: dream.visualSeed || createVisualSeed(),
    analysisStatus: dream.analysisStatus ?? 'none',
    analysisModel: dream.analysisModel ?? null,
    isDemo: dream.isDemo ? 1 : 0,
  };
}

/**
 * Builds a complete record from a draft. The id, dates, time zone, and
 * visualSeed come from application code, never from AI output.
 */
export function buildDreamRecord(draft = {}) {
  const createdAt = draft.createdAt || nowIso();
  return {
    id: draft.id || createDreamId(),
    schemaVersion: DREAM_SCHEMA_VERSION,
    createdAt,
    updatedAt: draft.updatedAt || createdAt,
    capturedTimeZone: draft.capturedTimeZone ?? deviceTimeZone(),
    originalTranscript: draft.originalTranscript ?? draft.transcript ?? '',
    transcript: draft.transcript ?? '',
    title: draft.title ?? '',
    summary: draft.summary ?? '',
    symbolKey: draft.symbolKey ?? '',
    symbolLabel: draft.symbolLabel ?? '',
    emoji: draft.emoji ?? '',
    interpretation: draft.interpretation ?? '',
    reflectionQuestion: draft.reflectionQuestion ?? '',
    primaryCategory: isValidCategory(draft.primaryCategory)
      ? draft.primaryCategory
      : OTHER_CATEGORY_KEY,
    themes: Array.isArray(draft.themes) ? draft.themes : [],
    moods: Array.isArray(draft.moods) ? draft.moods : [],
    visualSeed: draft.visualSeed || createVisualSeed(),
    analysisStatus: draft.analysisStatus ?? 'none',
    analysisModel: draft.analysisModel ?? null,
    isDemo: Boolean(draft.isDemo),
  };
}

const INSERT_SQL = `INSERT OR REPLACE INTO dreams (${DREAM_COLUMNS.join(', ')})
  VALUES (${DREAM_COLUMNS.map((column) => `$${column}`).join(', ')})`;

function bindParams(row) {
  const params = {};
  DREAM_COLUMNS.forEach((column) => {
    params[`$${column}`] = row[column];
  });
  return params;
}

export async function saveDream(draft) {
  const record = buildDreamRecord(draft);
  return withDatabase(async (db) => {
    await db.runAsync(INSERT_SQL, bindParams(dreamToRow(record)));
    return record;
  }, 'Could not save this dream to local storage.');
}

export async function saveManyDreams(drafts) {
  const records = drafts.map((draft) => buildDreamRecord(draft));
  return withDatabase(async (db) => {
    await db.withTransactionAsync(async () => {
      for (const record of records) {
        await db.runAsync(INSERT_SQL, bindParams(dreamToRow(record)));
      }
    });
    return records;
  }, 'Could not save these dreams to local storage.');
}

/**
 * Applies a partial change. `createdAt`, `visualSeed`, and `originalTranscript`
 * are never overwritten by an edit: the dream's date and its artwork are fixed
 * at capture time, and the original transcription is kept as a separate record
 * of what was actually heard.
 */
export async function updateDream(id, changes) {
  return withDatabase(async (db) => {
    const existingRow = await db.getFirstAsync('SELECT * FROM dreams WHERE id = ?', [id]);
    if (!existingRow) throw new Error(`No dream with id ${id}`);
    const existing = rowToDream(existingRow);

    const merged = {
      ...existing,
      ...changes,
      id: existing.id,
      createdAt: existing.createdAt,
      visualSeed: existing.visualSeed,
      originalTranscript: existing.originalTranscript,
      schemaVersion: DREAM_SCHEMA_VERSION,
      updatedAt: nowIso(),
      isDemo: existing.isDemo,
    };

    await db.runAsync(INSERT_SQL, bindParams(dreamToRow(merged)));
    return merged;
  }, 'Could not save your changes to local storage.');
}

export async function getDream(id) {
  return withDatabase(async (db) => {
    const row = await db.getFirstAsync('SELECT * FROM dreams WHERE id = ?', [id]);
    return rowToDream(row);
  }, 'Could not read this dream from local storage.');
}

/**
 * @param {object} [query]
 * @param {string|null} [query.category] Primary-category key filter.
 * @param {string} [query.search] Matches title, transcript, themes, and moods.
 */
export async function listDreams({ category = null, search = '' } = {}) {
  return withDatabase(async (db) => {
    const clauses = [];
    const params = [];

    if (category && CATEGORY_KEYS.includes(category)) {
      clauses.push('primaryCategory = ?');
      params.push(category);
    }

    const term = String(search || '').trim();
    if (term) {
      const like = `%${term.toLowerCase()}%`;
      clauses.push(
        '(LOWER(title) LIKE ? OR LOWER(transcript) LIKE ? OR LOWER(themes) LIKE ?' +
          ' OR LOWER(moods) LIKE ? OR LOWER(symbolLabel) LIKE ?)',
      );
      params.push(like, like, like, like, like);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = await db.getAllAsync(
      `SELECT * FROM dreams ${where} ORDER BY createdAt DESC, id DESC`,
      params,
    );
    return rows.map(rowToDream);
  }, 'Could not load your dreams from local storage.');
}

export async function countDreamsByCategory() {
  return withDatabase(async (db) => {
    const rows = await db.getAllAsync(
      'SELECT primaryCategory AS key, COUNT(*) AS count FROM dreams GROUP BY primaryCategory',
    );
    const counts = {};
    CATEGORY_KEYS.forEach((key) => {
      counts[key] = 0;
    });
    rows.forEach((row) => {
      const key = isValidCategory(row.key) ? row.key : OTHER_CATEGORY_KEY;
      counts[key] = (counts[key] || 0) + Number(row.count);
    });
    return counts;
  }, 'Could not count your dreams.');
}

export async function deleteDream(id) {
  return withDatabase(async (db) => {
    const row = await db.getFirstAsync('SELECT * FROM dreams WHERE id = ?', [id]);
    const removed = rowToDream(row);
    await db.runAsync('DELETE FROM dreams WHERE id = ?', [id]);
    // Returned so the caller can offer Undo by re-inserting the same record,
    // including its original id, dates, and visualSeed.
    return removed;
  }, 'Could not delete this dream.');
}

export async function deleteDemoDreams() {
  return withDatabase(async (db) => {
    const result = await db.runAsync('DELETE FROM dreams WHERE isDemo = 1');
    return result.changes ?? 0;
  }, 'Could not remove the demo dreams.');
}

export async function countDemoDreams() {
  return withDatabase(async (db) => {
    const row = await db.getFirstAsync('SELECT COUNT(*) AS count FROM dreams WHERE isDemo = 1');
    return Number(row?.count) || 0;
  }, 'Could not check for demo dreams.');
}

export async function countDreams() {
  return withDatabase(async (db) => {
    const row = await db.getFirstAsync('SELECT COUNT(*) AS count FROM dreams');
    return Number(row?.count) || 0;
  }, 'Could not count your dreams.');
}

/* ---------------------------------- settings --------------------------------- */

export async function readSetting(key, fallback = null) {
  return withDatabase(async (db) => {
    const row = await db.getFirstAsync('SELECT value FROM app_settings WHERE key = ?', [key]);
    return row?.value ?? fallback;
  }, 'Could not read app settings.');
}

export async function writeSetting(key, value) {
  return withDatabase(async (db) => {
    await db.runAsync(
      'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
      [key, value === null || value === undefined ? null : String(value)],
    );
    return value;
  }, 'Could not save app settings.');
}

export default {
  saveDream,
  saveManyDreams,
  updateDream,
  getDream,
  listDreams,
  deleteDream,
  countDreamsByCategory,
  countDreams,
  readSetting,
  writeSetting,
};
