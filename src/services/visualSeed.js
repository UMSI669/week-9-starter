/**
 * Deterministic card artwork. No AI image service, no network.
 *
 * A dream's `visualSeed` is created once at save time and persisted, so a card
 * looks the same forever — across restarts, edits, and re-interpretations.
 * Everything here is a pure function of (seed, themes, moods).
 */

import { colors } from '../theme';

/** xmur3 string hash -> 32-bit integer, then mulberry32 PRNG. */
export function hashSeed(input) {
  let h = 1779033703 ^ String(input).length;
  for (let i = 0; i < String(input).length; i += 1) {
    h = Math.imul(h ^ String(input).charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

export function createRandom(seed) {
  let state = hashSeed(seed);
  return function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Creates a fresh seed for a new dream. Persisted; never recomputed. */
export function createVisualSeed() {
  const random = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${random}`;
}

/**
 * Mood -> hue anchor. Moods carry the warmth of a card; themes nudge it.
 * Every value stays in the deep-violet family so the night atmosphere holds.
 */
const MOOD_HUES = {
  calm: 212,
  peaceful: 205,
  hopeful: 268,
  curious: 258,
  joyful: 290,
  playful: 296,
  nostalgic: 318,
  wistful: 322,
  tender: 330,
  anxious: 252,
  uneasy: 248,
  afraid: 240,
  tense: 244,
  sad: 228,
  lonely: 232,
  confused: 275,
  awe: 282,
  powerful: 300,
  free: 272,
  trapped: 236,
};

const THEME_HUE_SHIFT = {
  water: -14,
  flight: 10,
  flying: 10,
  falling: -10,
  nature: -6,
  animals: -4,
  school: 6,
  work: 4,
  friendship: 16,
  family: 14,
  love: 20,
  exploration: 8,
  journey: 8,
  mystery: 12,
  home: -8,
  memory: 18,
};

function hueFor(seed, themes = [], moods = []) {
  const random = createRandom(`${seed}:hue`);
  const moodHues = moods
    .map((mood) => MOOD_HUES[String(mood).toLowerCase().trim()])
    .filter((hue) => typeof hue === 'number');

  const base =
    moodHues.length > 0
      ? moodHues.reduce((sum, hue) => sum + hue, 0) / moodHues.length
      : 258 + random() * 44 - 22;

  const shift = themes
    .map((t) => THEME_HUE_SHIFT[String(t).toLowerCase().trim()] || 0)
    .reduce((sum, value) => sum + value, 0);

  const jitter = random() * 16 - 8;
  return ((base + shift + jitter) % 360 + 360) % 360;
}

/**
 * Hard ceiling on gradient lightness. Above this, #F7F2FF body text starts to
 * lose its contrast margin on the card, so no seed is allowed past it.
 */
const MAX_GRADIENT_LIGHTNESS = 34;

function hsl(hue, saturation, lightness) {
  const clampedLightness = Math.min(MAX_GRADIENT_LIGHTNESS, Math.max(0, lightness));
  return `hsl(${Math.round(hue)}, ${Math.round(Math.min(100, Math.max(0, saturation)))}%, ${Math.round(clampedLightness)}%)`;
}

/**
 * Three gradient stops, dark enough that #F7F2FF body text keeps a contrast
 * ratio above 7:1 on every stop. Lightness is clamped to
 * MAX_GRADIENT_LIGHTNESS, so no seed can produce a washed-out card.
 */
export function cardGradient(seed, themes = [], moods = []) {
  const hue = hueFor(seed, themes, moods);
  const random = createRandom(`${seed}:grad`);
  const saturation = 36 + random() * 20;
  const lightness = 15 + random() * 7;
  return [
    hsl(hue, saturation, lightness),
    hsl((hue + 22) % 360, saturation + 6, lightness + 7),
    hsl((hue + 44) % 360, saturation + 2, lightness + 13),
  ];
}

export function accentFor(seed, themes = [], moods = []) {
  const hue = hueFor(seed, themes, moods);
  // The accent is a glow and border colour on a dark surface, so it is
  // deliberately light and is not subject to the gradient ceiling.
  return `hsl(${Math.round((hue + 30) % 360)}, 72%, 82%)`;
}

/**
 * Seeded constellation: stars plus thin lines joining each star to the nearest
 * previously placed star, so the figure always reads as one shape.
 *
 * @returns {{stars: {x:number,y:number,r:number,o:number}[], lines: {x1:number,y1:number,x2:number,y2:number}[]}}
 *          Coordinates are fractions of width/height (0..1).
 */
export function constellation(seed, starCount = 9) {
  const random = createRandom(`${seed}:stars`);
  const stars = [];
  const count = Math.max(3, Math.min(18, starCount));

  for (let i = 0; i < count; i += 1) {
    // Stratify horizontally so stars spread instead of clumping.
    const band = i / count;
    const x = 0.08 + band * 0.84 + (random() - 0.5) * 0.09;
    const y = 0.12 + random() * 0.76;
    stars.push({
      x: Math.min(0.96, Math.max(0.04, x)),
      y: Math.min(0.94, Math.max(0.06, y)),
      r: 0.9 + random() * 1.7,
      o: 0.45 + random() * 0.5,
    });
  }

  const lines = [];
  for (let i = 1; i < stars.length; i += 1) {
    let nearest = 0;
    let bestDistance = Infinity;
    for (let j = 0; j < i; j += 1) {
      const dx = stars[i].x - stars[j].x;
      const dy = stars[i].y - stars[j].y;
      const distance = dx * dx + dy * dy;
      if (distance < bestDistance) {
        bestDistance = distance;
        nearest = j;
      }
    }
    // Skip the longest hops; a constellation is sparse, not a mesh.
    if (bestDistance < 0.16) {
      lines.push({
        x1: stars[i].x,
        y1: stars[i].y,
        x2: stars[nearest].x,
        y2: stars[nearest].y,
      });
    }
  }

  return { stars, lines };
}

export const fallbackGradient = [colors.card, colors.cardElevated, colors.gradientSecondary];

export default {
  createVisualSeed,
  cardGradient,
  accentFor,
  constellation,
  createRandom,
  hashSeed,
};
