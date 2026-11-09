/**
 * Primary categories, read from the same shared/categories.json the Expo app
 * imports. Reading one file in both places is what keeps the AI validator and
 * the app's category pickers from drifting apart.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const sharedPath = join(here, '..', '..', 'shared', 'categories.json');

const data = JSON.parse(readFileSync(sharedPath, 'utf8'));

export const CATEGORIES = data.categories;
export const CATEGORY_KEYS = CATEGORIES.map((category) => category.key);
export const CATEGORY_LABELS = CATEGORIES.map((category) => category.label);

const byKey = new Map(CATEGORIES.map((category) => [category.key, category]));
const byLabel = new Map(CATEGORIES.map((category) => [category.label.toLowerCase(), category]));

/** Accepts a key or a human label. Returns null for anything unknown. */
export function normalizeCategory(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (byKey.has(trimmed)) return trimmed;
  return byLabel.get(trimmed.toLowerCase())?.key || null;
}

export default CATEGORIES;
