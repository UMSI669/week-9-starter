/**
 * An expo-sqlite stand-in backed by Node's own SQLite, so the persistence and
 * migration tests run real SQL against a real database instead of asserting
 * against a hand-written fake that could agree with a bug.
 *
 * Only the expo-sqlite surface dreamRepository and db.js actually use is
 * implemented.
 */

import { DatabaseSync } from 'node:sqlite';

const databases = new Map();

function wrap(db) {
  return {
    async execAsync(sql) {
      db.exec(sql);
    },
    async runAsync(sql, params) {
      const statement = db.prepare(sql);
      const result = Array.isArray(params)
        ? statement.run(...params)
        : statement.run(params || {});
      return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
    },
    async getFirstAsync(sql, params) {
      const statement = db.prepare(sql);
      const rows = Array.isArray(params)
        ? statement.all(...(params || []))
        : statement.all(params || {});
      return rows[0] ?? null;
    },
    async getAllAsync(sql, params) {
      const statement = db.prepare(sql);
      return Array.isArray(params) ? statement.all(...(params || [])) : statement.all(params || {});
    },
    async withTransactionAsync(callback) {
      db.exec('BEGIN');
      try {
        await callback();
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    /** Test-only escape hatch. */
    __raw: db,
  };
}

export async function openDatabaseAsync(name) {
  if (!databases.has(name)) {
    // ':memory:' per name, so each test file gets a clean database and nothing
    // touches the real device file.
    databases.set(name, wrap(new DatabaseSync(':memory:')));
  }
  return databases.get(name);
}

/** Drops every open database so a test can start from nothing. */
export function __resetAllDatabases() {
  databases.forEach((handle) => {
    try {
      handle.__raw.close();
    } catch (_error) {
      // Already closed.
    }
  });
  databases.clear();
}
