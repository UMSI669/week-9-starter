/**
 * Bundled dream-symbol catalog — editorial reflection content.
 *
 * This is NOT science and NOT a dictionary of fixed meanings. There are no
 * research citations here because inventing them would be dishonest: these
 * entries are writing prompts drawn from common cultural associations, and
 * the catalog says so on screen. Every association is phrased tentatively.
 *
 * Shipped in the bundle so the Symbols screen works with no network.
 */

export const SYMBOL_CATALOG = [
  {
    key: 'water',
    label: 'Water',
    emoji: '🌊',
    aliases: ['ocean', 'sea', 'river', 'lake', 'rain', 'flood', 'swimming', 'waves'],
    associations: [
      'Water could reflect feeling — its depth, its movement, how much of it there is.',
      'Calm water might connect with steadiness; rough water with something unsettled.',
      'Being underwater may connect with feeling immersed, or with holding something in.',
    ],
    reflectionQuestion: 'What was the water doing, and how close to it were you?',
  },
  {
    key: 'flying',
    label: 'Flying',
    emoji: '🦅',
    aliases: ['flight', 'soaring', 'floating', 'levitating', 'wings'],
    associations: [
      'Flying could reflect a sense of possibility or release.',
      'Struggling to stay up might connect with effort that feels hard to sustain.',
      'Choosing where to go may connect with a feeling of control or of its absence.',
    ],
    reflectionQuestion: 'Were you steering, or being carried?',
  },
  {
    key: 'falling',
    label: 'Falling',
    emoji: '🪶',
    aliases: ['fall', 'dropping', 'tripping', 'cliff', 'plummeting'],
    associations: [
      'Falling could reflect a moment where footing felt uncertain.',
      'The fall ending safely might connect with a sense that things hold after all.',
      'Falling before waking is a very common sensation and need not mean anything alarming.',
    ],
    reflectionQuestion: 'What happened just before you started to fall?',
  },
  {
    key: 'doors',
    label: 'Doors',
    emoji: '🚪',
    aliases: ['door', 'gate', 'doorway', 'threshold', 'hallway', 'keys'],
    associations: [
      'A door could reflect a choice, a transition, or a boundary.',
      'A locked door might connect with something that feels out of reach right now.',
      'Many doors may connect with having options, or with not knowing which to take.',
    ],
    reflectionQuestion: 'Did you want to go through, and what was on the other side?',
  },
  {
    key: 'animals',
    label: 'Animals',
    emoji: '🐾',
    aliases: ['animal', 'dog', 'cat', 'bird', 'snake', 'horse', 'bear', 'insects'],
    associations: [
      'An animal could reflect an instinct, a quality, or a relationship you associate with it.',
      'The same animal carries very different associations across cultures and families.',
      'How the animal treated you may matter more than which animal it was.',
    ],
    reflectionQuestion: 'What does this animal mean to you personally?',
  },
  {
    key: 'being-chased',
    label: 'Being chased',
    emoji: '🏃',
    aliases: ['chase', 'chased', 'pursued', 'running away', 'escaping', 'hiding'],
    associations: [
      'Being chased could reflect something you would rather not turn and face yet.',
      'The pursuer is often vague, which might connect with a pressure rather than a person.',
      'Turning around in the dream may connect with a wish to understand what it is.',
    ],
    reflectionQuestion: 'If you had stopped running, what might you have seen?',
  },
  {
    key: 'school',
    label: 'School',
    emoji: '🏫',
    aliases: ['exam', 'test', 'classroom', 'teacher', 'homework', 'late for class', 'university'],
    associations: [
      'School could reflect evaluation — being measured, or measuring yourself.',
      'An exam you did not study for might connect with feeling unprepared somewhere else.',
      'These dreams often continue long after school ends, which may say more about pressure than about school.',
    ],
    reflectionQuestion: 'Where in waking life do you feel you are being graded?',
  },
  {
    key: 'houses',
    label: 'Houses',
    emoji: '🏡',
    aliases: ['house', 'home', 'rooms', 'apartment', 'childhood home', 'attic', 'basement'],
    associations: [
      'A house could reflect a sense of self, or of where you feel you belong.',
      'Rooms you have never seen might connect with parts of life that feel unexplored.',
      'A childhood home may connect with memory rather than with the building.',
    ],
    reflectionQuestion: 'Which room did you spend the most time in?',
  },
  {
    key: 'libraries',
    label: 'Libraries',
    emoji: '📚',
    aliases: ['library', 'books', 'archive', 'bookshelves', 'reading'],
    associations: [
      'A library could reflect curiosity, or a search for an answer you believe exists.',
      'Not finding the book might connect with a question that has no tidy answer yet.',
      'Quiet in a library may connect with wanting space to think.',
    ],
    reflectionQuestion: 'What were you hoping to find?',
  },
  {
    key: 'journeys',
    label: 'Journeys',
    emoji: '🧭',
    aliases: ['journey', 'travel', 'road', 'train', 'bus', 'airport', 'lost', 'map', 'path'],
    associations: [
      'A journey could reflect a sense of being between one thing and the next.',
      'Missing the train might connect with timing that feels outside your control.',
      'Not knowing the destination may connect with a decision still being made.',
    ],
    reflectionQuestion: 'Where did it feel like you were trying to get to?',
  },
];

/**
 * Shown for any symbol the AI returns that is not in the catalog, so an
 * unknown symbol reflects gracefully instead of crashing or going blank.
 */
export const GENERAL_SYMBOL_ENTRY = {
  key: '__general__',
  label: 'A symbol of your own',
  emoji: '✨',
  aliases: [],
  isGeneral: true,
  associations: [
    'This symbol is not in the bundled catalog, which is normal — dream images are personal.',
    'Its associations could come from your own memory, culture, language, or the day before.',
    'What it means here might be different from what it would mean in anyone else’s dream.',
  ],
  reflectionQuestion: 'What is the first thing this image reminds you of?',
};

export const CATALOG_DISCLAIMER =
  'These are editorial reflection prompts, not research findings. Dream symbols have no universal fixed meaning, and personal and cultural context matter more than any list.';

const byKey = new Map(SYMBOL_CATALOG.map((entry) => [entry.key, entry]));

const aliasIndex = new Map();
SYMBOL_CATALOG.forEach((entry) => {
  aliasIndex.set(entry.key, entry);
  aliasIndex.set(entry.label.toLowerCase(), entry);
  entry.aliases.forEach((alias) => aliasIndex.set(alias.toLowerCase(), entry));
});

/** Exact key/label/alias match only. Returns null when nothing matches. */
export function findSymbolEntry(key) {
  if (typeof key !== 'string') return null;
  const normalized = key.trim().toLowerCase();
  if (!normalized) return null;
  return aliasIndex.get(normalized) || byKey.get(key.trim()) || null;
}

/**
 * Always returns something displayable: the catalog entry when known,
 * otherwise the general reflection entry carrying the dream's own label.
 */
export function resolveSymbolEntry(key, label, emoji) {
  const matched = findSymbolEntry(key) || findSymbolEntry(label);
  if (matched) return matched;
  return {
    ...GENERAL_SYMBOL_ENTRY,
    label: label || GENERAL_SYMBOL_ENTRY.label,
    emoji: emoji || GENERAL_SYMBOL_ENTRY.emoji,
  };
}

/** Case-insensitive search over name, aliases, and association text. */
export function searchSymbols(query) {
  const trimmed = String(query || '').trim().toLowerCase();
  if (!trimmed) return SYMBOL_CATALOG;
  return SYMBOL_CATALOG.filter((entry) => {
    if (entry.label.toLowerCase().includes(trimmed)) return true;
    if (entry.key.includes(trimmed)) return true;
    if (entry.aliases.some((alias) => alias.includes(trimmed))) return true;
    return entry.associations.some((text) => text.toLowerCase().includes(trimmed));
  });
}

export default SYMBOL_CATALOG;
