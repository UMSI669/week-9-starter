/**
 * Primary categories. Exactly one per dream.
 *
 * The list itself lives in shared/categories.json so the Expo app and the
 * backend validator read the same bytes and cannot drift. Additional themes
 * and moods are free-form tags, not categories.
 */

import categoryData from '../../shared/categories.json';

export const CATEGORIES = categoryData.categories;

export const CATEGORY_KEYS = CATEGORIES.map((category) => category.key);

export const CATEGORY_LABELS = CATEGORIES.map((category) => category.label);

export const OTHER_CATEGORY_KEY = 'other';

const byKey = new Map(CATEGORIES.map((category) => [category.key, category]));
const byLabel = new Map(
  CATEGORIES.map((category) => [category.label.toLowerCase(), category]),
);

export function getCategory(key) {
  return byKey.get(key) || null;
}

export function categoryLabel(key) {
  return byKey.get(key)?.label || 'Other';
}

export function categoryEmoji(key) {
  return byKey.get(key)?.emoji || '✨';
}

/**
 * Accepts either a key ("school-work") or a human label ("School & Work").
 * Returns null for anything unknown — callers decide whether to fall back,
 * and the AI validator rejects rather than guessing.
 */
export function normalizeCategory(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (byKey.has(trimmed)) return trimmed;
  const matched = byLabel.get(trimmed.toLowerCase());
  return matched ? matched.key : null;
}

export function isValidCategory(value) {
  return typeof value === 'string' && byKey.has(value);
}

export default CATEGORIES;
