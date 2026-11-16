import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import { GroceryRepository, type Database } from './repository';

let pending: Promise<GroceryRepository> | undefined;
export function getRepository() {
  if (!pending) {
    pending = (async () => {
      const db = await SQLite.openDatabaseAsync('pantry-week.db');
      const repo = new GroceryRepository(db as Database, () => Crypto.randomUUID());
      await repo.initialize();
      return repo;
    })().catch(error => { pending = undefined; throw error; });
  }
  return pending;
}
