/**
 * SQLite connection and schema migrations.
 *
 * Durability claim, stated precisely: dreams are written to a local SQLite
 * database file in the app's own sandbox. They survive app restarts and app
 * updates. They are NOT encrypted by this app, NOT backed up by this app, and
 * NOT synced anywhere. Deleting the app deletes the database. Device-level
 * backup (iCloud / Android backup) may or may not include it depending on
 * settings this app does not control.
 */

import * as SQLite from 'expo-sqlite';

export const DATABASE_NAME = 'dream-decoder.db';
export const DREAM_SCHEMA_VERSION = 1;

let databasePromise = null;

/**
 * Each migration moves the database from version N-1 to N. They run inside one
 * transaction per migration so a failure mid-way leaves the previous version
 * intact instead of a half-migrated database.
 */
const MIGRATIONS = [
  {
    version: 1,
    async up(db) {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS dreams (
          id TEXT PRIMARY KEY NOT NULL,
          schemaVersion INTEGER NOT NULL DEFAULT 1,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          capturedTimeZone TEXT,
          originalTranscript TEXT NOT NULL DEFAULT '',
          transcript TEXT NOT NULL DEFAULT '',
          title TEXT NOT NULL DEFAULT '',
          summary TEXT NOT NULL DEFAULT '',
          symbolKey TEXT NOT NULL DEFAULT '',
          symbolLabel TEXT NOT NULL DEFAULT '',
          emoji TEXT NOT NULL DEFAULT '',
          interpretation TEXT NOT NULL DEFAULT '',
          reflectionQuestion TEXT NOT NULL DEFAULT '',
          primaryCategory TEXT NOT NULL DEFAULT 'other',
          themes TEXT NOT NULL DEFAULT '[]',
          moods TEXT NOT NULL DEFAULT '[]',
          visualSeed TEXT NOT NULL,
          analysisStatus TEXT NOT NULL DEFAULT 'none',
          analysisModel TEXT,
          isDemo INTEGER NOT NULL DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_dreams_createdAt ON dreams (createdAt DESC);
        CREATE INDEX IF NOT EXISTS idx_dreams_category ON dreams (primaryCategory);

        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT
        );
      `);
    },
  },
];

export async function getDatabase() {
  if (!databasePromise) {
    databasePromise = openAndMigrate().catch((error) => {
      // Never cache a failed open: the next call should get a fresh attempt.
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

async function openAndMigrate() {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  await runMigrations(db);
  return db;
}

export async function runMigrations(db) {
  const row = await db.getFirstAsync('PRAGMA user_version;');
  let currentVersion = Number(row?.user_version ?? row?.['user_version'] ?? 0);

  for (const migration of MIGRATIONS) {
    if (migration.version <= currentVersion) continue;
    await db.withTransactionAsync(async () => {
      await migration.up(db);
    });
    // PRAGMA user_version does not accept a bound parameter.
    await db.execAsync(`PRAGMA user_version = ${migration.version};`);
    currentVersion = migration.version;
  }

  return currentVersion;
}

/** Test and recovery hook: forgets the cached handle without touching data. */
export function resetDatabaseHandleForTests() {
  databasePromise = null;
}

export default getDatabase;
