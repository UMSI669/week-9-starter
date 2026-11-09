import { cleanDraft, normalizeName, type GroceryDraft, type GroceryItem, type Week } from '../../utils/groceries';
import { getWeekId } from '../../utils/week';

type Bind = string | number | null;
export interface Database {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: Bind[]): Promise<unknown>;
  getFirstAsync<T>(sql: string, ...params: Bind[]): Promise<T | null>;
  getAllAsync<T>(sql: string, ...params: Bind[]): Promise<T[]>;
}
export interface Snapshot { weekId: string; items: GroceryItem[]; carried: number; view: 'list' | 'grid'; bannerDismissed: boolean; }
export interface MergeResult { merged: string[]; added: number; }

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS weeks (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, rolled_over_at TEXT);
CREATE TABLE IF NOT EXISTS items (
 id TEXT PRIMARY KEY, week_id TEXT NOT NULL REFERENCES weeks(id), name TEXT NOT NULL, name_key TEXT NOT NULL,
 quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 9999), unit TEXT NOT NULL DEFAULT '',
 category TEXT NOT NULL, emoji TEXT NOT NULL, quantityInferred INTEGER NOT NULL DEFAULT 0,
 checked INTEGER NOT NULL DEFAULT 0, position INTEGER NOT NULL DEFAULT 0,
 source TEXT NOT NULL DEFAULT 'manual', carried_over INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(week_id, name_key, unit));
CREATE INDEX IF NOT EXISTS items_week ON items(week_id, category, position);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
PRAGMA user_version = 1;`;

// Serialize reads and writes so a foreground rollover cannot race a save or undo.
export class GroceryRepository {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private db: Database, private id: () => string, private now: () => Date = () => new Date()) {}
  private exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const work = this.queue.then(operation);
    this.queue = work.catch(() => undefined);
    return work;
  }
  private async transaction<T>(work: () => Promise<T>) {
    await this.db.execAsync('BEGIN IMMEDIATE');
    try { const result = await work(); await this.db.execAsync('COMMIT'); return result; }
    catch (error) { await this.db.execAsync('ROLLBACK'); throw error; }
  }
  initialize() {
    return this.exclusive(async () => {
      await this.db.execAsync('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
      const version = await this.db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
      if ((version?.user_version || 0) > 1) throw new Error('This database needs a newer version of the app.');
      await this.transaction(() => this.db.execAsync(SCHEMA));
    });
  }
  private async currentWeek() {
    const weekId = getWeekId(this.now());
    const timestamp = this.now().toISOString();
    await this.db.runAsync('INSERT OR IGNORE INTO weeks(id, created_at) VALUES (?, ?)', weekId, timestamp);
    const previous = await this.db.getFirstAsync<Week>('SELECT * FROM weeks WHERE id < ? ORDER BY id DESC LIMIT 1', weekId);
    if (previous && !previous.rolled_over_at) {
      const unchecked = await this.db.getAllAsync<GroceryItem>('SELECT * FROM items WHERE week_id = ? AND checked = 0 ORDER BY position', previous.id);
      for (const item of unchecked) await this.addOne(weekId, item, item.source, 1);
      await this.db.runAsync('UPDATE weeks SET rolled_over_at = ? WHERE id < ? AND rolled_over_at IS NULL', timestamp, weekId);
    }
    return weekId;
  }
  private async addOne(weekId: string, raw: GroceryDraft, source: 'manual' | 'voice', carried = 0) {
    const draft = cleanDraft(raw);
    const nameKey = normalizeName(draft.name);
    const existing = await this.db.getFirstAsync<GroceryItem>('SELECT * FROM items WHERE week_id = ? AND name_key = ? AND unit = ?', weekId, nameKey, draft.unit);
    const timestamp = this.now().toISOString();
    if (existing) {
      if (existing.quantity + draft.quantity > 9999) throw new Error(`The total quantity for ${draft.name} exceeds 9999.`);
      await this.db.runAsync('UPDATE items SET quantity = ?, checked = 0, updated_at = ?, source = ?, carried_over = ?, quantityInferred = ? WHERE id = ?',
        existing.quantity + draft.quantity, timestamp, existing.source === 'voice' || source === 'voice' ? 'voice' : 'manual',
        existing.carried_over || carried, existing.quantityInferred && draft.quantityInferred ? 1 : 0, existing.id);
      return `${existing.name} already on your list, now ${existing.quantity + draft.quantity}`;
    }
    const last = await this.db.getFirstAsync<{ position: number }>('SELECT COALESCE(MAX(position), -1) AS position FROM items WHERE week_id = ? AND category = ?', weekId, draft.category);
    await this.db.runAsync('INSERT INTO items(id, week_id, name, name_key, quantity, unit, category, emoji, quantityInferred, position, source, carried_over, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      this.id(), weekId, draft.name, nameKey, draft.quantity, draft.unit, draft.category, draft.emoji,
      draft.quantityInferred ? 1 : 0, (last?.position ?? -1) + 1, source, carried, timestamp, timestamp);
    return null;
  }
  snapshot(): Promise<Snapshot> {
    return this.exclusive(() => this.transaction(async () => {
      const weekId = await this.currentWeek();
      const items = await this.db.getAllAsync<GroceryItem>('SELECT * FROM items WHERE week_id = ? ORDER BY position, created_at', weekId);
      const view = await this.db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = 'view'");
      const dismissed = await this.db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', `banner:${weekId}`);
      return { weekId, items, carried: items.filter(item => item.carried_over).length, view: view?.value === 'grid' ? 'grid' : 'list', bannerDismissed: dismissed?.value === 'true' };
    }));
  }
  addOrMergeItems(drafts: GroceryDraft[], source: 'manual' | 'voice' = 'manual'): Promise<MergeResult> {
    return this.exclusive(() => this.transaction(async () => {
      const weekId = await this.currentWeek(); const merged: string[] = []; let added = 0;
      for (const draft of drafts) { const message = await this.addOne(weekId, draft, source); if (message) merged.push(message); else added++; }
      return { merged, added };
    }));
  }
  updateItem(id: string, raw: GroceryDraft) {
    return this.exclusive(() => this.transaction(async () => {
      const weekId = await this.currentWeek();
      const item = await this.db.getFirstAsync<GroceryItem>('SELECT * FROM items WHERE id = ? AND week_id = ?', id, weekId);
      if (!item) throw new Error('This item is no longer in the current week.');
      const draft = cleanDraft(raw); const nameKey = normalizeName(draft.name);
      const target = await this.db.getFirstAsync<GroceryItem>('SELECT * FROM items WHERE week_id = ? AND name_key = ? AND unit = ? AND id != ?', weekId, nameKey, draft.unit, id);
      if (target) {
        const message = await this.addOne(weekId, draft, item.source, item.carried_over);
        await this.db.runAsync('DELETE FROM items WHERE id = ?', id);
        return { merged: message ? [message] : [], added: 0 };
      }
      const last = await this.db.getFirstAsync<{ position: number }>('SELECT COALESCE(MAX(position), -1) AS position FROM items WHERE week_id = ? AND category = ?', weekId, draft.category);
      await this.db.runAsync('UPDATE items SET name = ?, name_key = ?, quantity = ?, unit = ?, category = ?, emoji = ?, quantityInferred = ?, position = ?, updated_at = ? WHERE id = ?',
        draft.name, nameKey, draft.quantity, draft.unit, draft.category, draft.emoji, draft.quantityInferred ? 1 : 0,
        item.category === draft.category ? item.position : (last?.position ?? -1) + 1, this.now().toISOString(), id);
      return { merged: [], added: 0 };
    }));
  }
  toggle(id: string) {
    return this.exclusive(() => this.transaction(async () => {
      const weekId = await this.currentWeek();
      await this.db.runAsync('UPDATE items SET checked = 1 - checked, updated_at = ? WHERE id = ? AND week_id = ?', this.now().toISOString(), id, weekId);
    }));
  }
  remove(id: string) {
    return this.exclusive(() => this.transaction(async () => {
      const weekId = await this.currentWeek();
      const item = await this.db.getFirstAsync<GroceryItem>('SELECT * FROM items WHERE id = ? AND week_id = ?', id, weekId);
      if (!item) throw new Error('This item is no longer in the current week.');
      await this.db.runAsync('DELETE FROM items WHERE id = ?', id); return item;
    }));
  }
  restore(item: GroceryItem) {
    return this.exclusive(() => this.transaction(async () => {
      const weekId = await this.currentWeek();
      const existing = await this.db.getFirstAsync<GroceryItem>('SELECT * FROM items WHERE week_id = ? AND name_key = ? AND unit = ?', weekId, item.name_key, item.unit);
      if (existing || weekId !== item.week_id) { await this.addOne(weekId, item, item.source, item.carried_over); return; }
      await this.db.runAsync('INSERT INTO items(id, week_id, name, name_key, quantity, unit, category, emoji, quantityInferred, checked, position, source, carried_over, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        item.id, item.week_id, item.name, item.name_key, item.quantity, item.unit, item.category, item.emoji,
        Number(item.quantityInferred), item.checked, item.position, item.source, item.carried_over, item.created_at, item.updated_at);
    }));
  }
  reorder(category: string, ids: string[]) {
    return this.exclusive(() => this.transaction(async () => {
      const weekId = await this.currentWeek();
      const actual = await this.db.getAllAsync<{ id: string }>('SELECT id FROM items WHERE week_id = ? AND category = ?', weekId, category);
      if (new Set(ids).size !== ids.length || ids.length !== actual.length || actual.some(item => !ids.includes(item.id))) {
        throw new Error('The list changed. Please try reordering again.');
      }
      for (let index = 0; index < ids.length; index++) await this.db.runAsync('UPDATE items SET position = ? WHERE id = ?', index, ids[index]);
    }));
  }
  setSetting(key: string, value: string) {
    return this.exclusive(async () => { await this.db.runAsync('INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value); });
  }
  history() {
    return this.exclusive(() => this.db.getAllAsync<Week>('SELECT w.*, COUNT(i.id) AS total, COALESCE(SUM(i.checked), 0) AS done FROM weeks w LEFT JOIN items i ON i.week_id = w.id WHERE w.id < ? GROUP BY w.id ORDER BY w.id DESC', getWeekId(this.now())));
  }
  weekItems(weekId: string) {
    return this.exclusive(() => this.db.getAllAsync<GroceryItem>('SELECT * FROM items WHERE week_id = ? ORDER BY category, position', weekId));
  }
  copyUnchecked(weekId: string) {
    return this.exclusive(() => this.transaction(async () => {
      const current = await this.currentWeek();
      if (weekId >= current) throw new Error('Choose a past week to copy.');
      const items = await this.db.getAllAsync<GroceryItem>('SELECT * FROM items WHERE week_id = ? AND checked = 0 ORDER BY position', weekId);
      const merged: string[] = []; let added = 0;
      for (const item of items) { const message = await this.addOne(current, item, item.source); if (message) merged.push(message); else added++; }
      return { merged, added };
    }));
  }
  recent() {
    return this.exclusive(() => this.db.getAllAsync<GroceryItem>('SELECT * FROM (SELECT *, ROW_NUMBER() OVER (PARTITION BY name_key, unit ORDER BY updated_at DESC) AS rank FROM items) WHERE rank = 1 ORDER BY updated_at DESC LIMIT 8'));
  }
  clear() {
    return this.exclusive(() => this.transaction(() => this.db.execAsync('DELETE FROM items; DELETE FROM weeks; DELETE FROM settings;')));
  }
}
