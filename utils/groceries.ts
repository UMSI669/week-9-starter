export const CATEGORIES = ['Produce', 'Dairy', 'Pantry', 'Meat', 'Bakery', 'Frozen', 'Household', 'Other'] as const;
export const UNITS = ['', 'pcs', 'bag', 'gal', 'oz', 'lb', 'tub', 'pack', 'loaf'] as const;
export type Category = typeof CATEGORIES[number];
export type Unit = typeof UNITS[number];
export const CATEGORY_EMOJI: Record<Category, string> = {
  Produce: '🥬', Dairy: '🥛', Pantry: '🥫', Meat: '🥩', Bakery: '🍞',
  Frozen: '🧊', Household: '🧹', Other: '🛒',
};
export interface GroceryDraft {
  name: string; quantity: number; unit: Unit; category: Category;
  emoji: string; quantityInferred: boolean;
}
export interface GroceryItem extends GroceryDraft {
  id: string; week_id: string; name_key: string; checked: number; position: number;
  source: 'manual' | 'voice'; carried_over: number; created_at: string; updated_at: string;
}
export interface Week {
  id: string; created_at: string; rolled_over_at: string | null;
  total: number; done: number;
}

export function normalizeName(value: string) {
  return value.normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ');
}

export function cleanDraft(value: GroceryDraft): GroceryDraft {
  const name = value.name.trim().replace(/\s+/g, ' ');
  if (!name || name.length > 120) throw new Error('Enter an item name between 1 and 120 characters.');
  if (!Number.isSafeInteger(value.quantity) || value.quantity < 1 || value.quantity > 9999) {
    throw new Error('Quantity must be a whole number between 1 and 9999.');
  }
  if (!CATEGORIES.includes(value.category) || !UNITS.includes(value.unit)) {
    throw new Error('Choose a valid category and unit.');
  }
  return { name, quantity: value.quantity, unit: value.unit, category: value.category,
    emoji: value.emoji?.trim() || CATEGORY_EMOJI[value.category], quantityInferred: Boolean(value.quantityInferred) };
}

export function blankDraft(name = ''): GroceryDraft {
  return { name, quantity: 1, unit: '', category: 'Other', emoji: '🛒', quantityInferred: false };
}

export function validateGroceries(value: unknown): GroceryDraft[] {
  if (!value || typeof value !== 'object' || !('items' in value) || !Array.isArray(value.items)) {
    throw new Error('The parser returned an invalid grocery list.');
  }
  if (value.items.length > 100) throw new Error('Please record fewer than 100 items at a time.');
  return value.items.map((item: unknown) => {
    if (!item || typeof item !== 'object') throw new Error('The parser returned an invalid item.');
    const draft = item as GroceryDraft;
    if (typeof draft.name !== 'string' || typeof draft.emoji !== 'string' || typeof draft.quantityInferred !== 'boolean') {
      throw new Error('The parser returned missing or invalid item fields.');
    }
    return cleanDraft(draft);
  });
}

const numberWords: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  couple: 2, dozen: 12,
};
const unitWords: Record<string, Unit> = {
  piece: 'pcs', pieces: 'pcs', pcs: 'pcs', bag: 'bag', bags: 'bag',
  gallon: 'gal', gallons: 'gal', gal: 'gal', ounce: 'oz', ounces: 'oz', oz: 'oz',
  pound: 'lb', pounds: 'lb', lb: 'lb', tub: 'tub', tubs: 'tub', pack: 'pack',
  packs: 'pack', loaf: 'loaf', loaves: 'loaf',
};
export function singularName(name: string) {
  const exceptions: Record<string, string> = { eggs: 'egg', apples: 'apple', tomatoes: 'tomato', potatoes: 'potato',
    berries: 'berry', strawberries: 'strawberry', blueberries: 'blueberry', loaves: 'loaf' };
  const words = name.split(' ');
  const last = words[words.length - 1];
  words[words.length - 1] = exceptions[last] || (/s$/.test(last) && !/(ss|us|is)$/.test(last) ? last.slice(0, -1) : last);
  return words.join(' ');
}

// Only recover explicit list fragments. Review is required before saving this fallback.
export function fallbackGroceries(transcript: string): GroceryDraft[] {
  const text = transcript.toLowerCase()
    .replace(/\b(?:thank you|thanks|please)\b[.!]?/g, '')
    .replace(/^.*?\b(?:includes?|containing|with)\s+/i, '')
    .replace(/^(?:make (?:me )?(?:a )?(?:shopping|grocery) list|(?:i )?(?:need|want)|add|buy|pick up)\s*/i, '');
  return text.split(/[,;\n]|\band\b|[.!]/).map(part => part.trim()).filter(Boolean).slice(0, 100).flatMap(part => {
    const match = part.match(/^(\d+|a couple(?: of)?|a dozen(?: of)?|couple(?: of)?|dozen(?: of)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(.+)$/);
    let name = match ? match[2] : part;
    const countWord = match?.[1].replace(/^a /, '').replace(/ of$/, '');
    const quantity = countWord ? (numberWords[countWord] || Number(countWord)) : 1;
    let unit: Unit = '';
    const unitMatch = name.match(/^(\w+)\s+(?:of\s+)?(.+)$/);
    if (unitMatch && unitWords[unitMatch[1]]) { unit = unitWords[unitMatch[1]]; name = unitMatch[2]; }
    name = singularName(name.replace(/^(?:some|the)\s+/, '').trim());
    if (!name || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 9999) return [];
    return [{ name: name.slice(0, 120), quantity, unit, category: 'Other' as Category, emoji: '🛒', quantityInferred: !match }];
  });
}
