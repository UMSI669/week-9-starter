import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { GroceryRepository, type Database } from '../services/db/repository';
import { blankDraft } from '../utils/groceries';

async function setup() {
  const sqlite = new DatabaseSync(':memory:');
  const driver: Database = {
    async execAsync(sql) { sqlite.exec(sql); },
    async runAsync(sql, ...params) { return sqlite.prepare(sql).run(...params); },
    async getFirstAsync<T>(sql: string, ...params: any[]) { return (sqlite.prepare(sql).get(...params) as T) || null; },
    async getAllAsync<T>(sql: string, ...params: any[]) { return sqlite.prepare(sql).all(...params) as T[]; },
  };
  let count = 0; let time = new Date(2026, 9, 31, 23, 59);
  const repo = new GroceryRepository(driver, () => `id-${++count}`, () => time);
  await repo.initialize();
  return { repo, sqlite, setDate: (date: Date) => { time = date; } };
}

test('same normalized name and unit adds quantities; different units remain separate', async () => {
  const { repo } = await setup();
  await repo.addOrMergeItems([{ ...blankDraft('Milk'), unit: 'gal', quantity: 2 }]);
  const result = await repo.addOrMergeItems([{ ...blankDraft(' MILK '), unit: 'gal', quantity: 1 }], 'voice');
  assert.equal(result.merged.length, 1);
  await repo.addOrMergeItems([{ ...blankDraft('Milk'), unit: 'oz', quantity: 8 }]);
  const snapshot = await repo.snapshot();
  assert.equal(snapshot.items.length, 2);
  assert.equal(snapshot.items.find(item => item.unit === 'gal')?.quantity, 3);
  assert.equal(snapshot.items.find(item => item.unit === 'gal')?.source, 'voice');
});
test('invalid multi-item saves roll back the complete transaction', async () => {
  const { repo } = await setup();
  await assert.rejects(repo.addOrMergeItems([blankDraft('Apple'), { ...blankDraft('Milk'), quantity: 0 }]));
  assert.equal((await repo.snapshot()).items.length, 0);
});
test('concurrent saves serialize without lost quantities', async () => {
  const { repo } = await setup();
  await Promise.all(Array.from({ length: 12 }, () => repo.addOrMergeItems([blankDraft('Milk')])));
  assert.equal((await repo.snapshot()).items[0].quantity, 12);
});
test('rollover copies only unchecked items once, even with concurrent foreground refreshes', async () => {
  const { repo, setDate } = await setup();
  await repo.addOrMergeItems([blankDraft('Milk'), blankDraft('Egg')]);
  const past = await repo.snapshot(); await repo.toggle(past.items.find(item => item.name === 'Egg')!.id);
  setDate(new Date(2026, 10, 1, 0, 0));
  const results = await Promise.all([repo.snapshot(), repo.snapshot(), repo.snapshot()]);
  for (const result of results) {
    assert.equal(result.weekId, '2026-11-01'); assert.equal(result.items.length, 1);
    assert.equal(result.items[0].name, 'Milk'); assert.equal(result.items[0].quantity, 1); assert.equal(result.carried, 1);
  }
  assert.equal((await repo.weekItems(past.weekId)).length, 2);
  assert.equal((await repo.history())[0].done, 1);
});
test('skipped weeks carry forward the most recent unfinished list only', async () => {
  const { repo, setDate } = await setup(); await repo.addOrMergeItems([blankDraft('Milk')]);
  setDate(new Date(2026, 11, 20));
  assert.equal((await repo.snapshot()).items[0].quantity, 1);
  assert.equal((await repo.snapshot()).items.length, 1);
});
test('check-off preserves order, undo preserves details, and renaming merges atomically', async () => {
  const { repo } = await setup(); await repo.addOrMergeItems([blankDraft('Apple'), blankDraft('Egg')]);
  const items = (await repo.snapshot()).items; const apple = items[0];
  await repo.toggle(apple.id); assert.equal((await repo.snapshot()).items[0].position, apple.position);
  const removed = await repo.remove(apple.id); await repo.restore(removed);
  assert.equal((await repo.snapshot()).items.find(item => item.id === apple.id)?.checked, 1);
  await repo.updateItem(apple.id, { ...blankDraft('Egg'), quantity: 3 });
  const merged = (await repo.snapshot()).items; assert.equal(merged.length, 1); assert.equal(merged[0].quantity, 4);
});
test('reorder stays within a complete category and cannot drop filtered-out rows', async () => {
  const { repo } = await setup(); await repo.addOrMergeItems([blankDraft('A'), blankDraft('B'), { ...blankDraft('C'), category: 'Produce' }]);
  const items = (await repo.snapshot()).items; const others = items.filter(item => item.category === 'Other');
  await assert.rejects(repo.reorder('Other', [others[0].id]));
  await assert.rejects(repo.reorder('Other', [others[0].id, items.find(item => item.category === 'Produce')!.id]));
  await repo.reorder('Other', others.map(item => item.id).reverse());
  assert.equal((await repo.snapshot()).items.find(item => item.id === others[1].id)?.position, 0);
});
test('undo after new item with the same name merges rather than failing uniqueness', async () => {
  const { repo } = await setup(); await repo.addOrMergeItems([blankDraft('Milk')]);
  const removed = await repo.remove((await repo.snapshot()).items[0].id);
  await repo.addOrMergeItems([{ ...blankDraft('Milk'), quantity: 2 }]); await repo.restore(removed);
  assert.equal((await repo.snapshot()).items[0].quantity, 3);
});
test('saved view and banner preference persist, and clear removes all data', async () => {
  const { repo } = await setup(); await repo.setSetting('view', 'grid');
  const week = await repo.snapshot(); await repo.setSetting(`banner:${week.weekId}`, 'true');
  assert.equal((await repo.snapshot()).view, 'grid'); assert.equal((await repo.snapshot()).bannerDismissed, true);
  await repo.clear(); assert.equal((await repo.snapshot()).view, 'list'); assert.equal((await repo.history()).length, 0);
});
test('copying a past week respects merges and leaves history unchanged', async () => {
  const { repo, setDate } = await setup(); await repo.addOrMergeItems([blankDraft('Milk'), blankDraft('Egg')]);
  const past = await repo.snapshot(); await repo.toggle(past.items[1].id);
  setDate(new Date(2026, 10, 8)); await repo.snapshot();
  const result = await repo.copyUnchecked(past.weekId);
  assert.equal(result.merged.length, 1); assert.equal((await repo.snapshot()).items[0].quantity, 2);
  assert.equal((await repo.weekItems(past.weekId))[0].quantity, 1);
});
