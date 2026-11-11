/**
 * Pure, deterministic layout for the Home dream-cloud map.
 *
 * Nothing here touches React, Dimensions, or Math.random: the caller passes
 * the measured width and height, and the same inputs always produce the same
 * output. That is what keeps clouds from jumping on every render.
 *
 * Sizing is bounded and sublinear (square root of the share of the biggest
 * count), so a category with 200 dreams cannot swallow the screen while a
 * category with 1 dream stays readable.
 */

export const MIN_TOUCH_TARGET = 48;

export const DEFAULT_LAYOUT_OPTIONS = {
  minFontSize: 15,
  maxFontSize: 34,
  gap: 10,
  /** The canvas may grow to this multiple of the visible height, then scroll. */
  maxHeightScale: 2.2,
  /** Phyllotaxis candidate positions tried per node before giving up. */
  attempts: 900,
  /**
   * A single cloud may not exceed this share of the canvas width. Without a
   * cap, a long label at the maximum font size ("Nature & Animals" at 34pt)
   * produces a chip almost as wide as the screen, the clouds can only stack
   * vertically, and the map stops being a map.
   */
  maxWidthShare: 0.86,
};

/**
 * Stable ordering: most dreams first, then alphabetically by label so equal
 * counts never swap places between renders or devices.
 */
export function sortCategoriesForMap(categories) {
  return [...categories].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return String(a.label).localeCompare(String(b.label), 'en');
  });
}

/**
 * Bounded sublinear size. The largest category always gets maxFontSize; a
 * category with a single dream never drops below minFontSize.
 */
export function fontSizeForCount(count, maxCount, minFontSize, maxFontSize) {
  if (maxCount <= 0) return minFontSize;
  const share = Math.max(0, Math.min(1, count / maxCount));
  return minFontSize + (maxFontSize - minFontSize) * Math.sqrt(share);
}

/**
 * Largest font size at which a label's chip still fits the width budget,
 * never going below minFontSize. This is what keeps a long category name from
 * monopolising a row while leaving short names free to grow.
 */
export function fitFontSize(label, preferredFontSize, maxWidth, minFontSize, options = {}) {
  let fontSize = preferredFontSize;
  while (fontSize > minFontSize && chipSize(label, fontSize, options).width > maxWidth) {
    fontSize -= 0.5;
  }
  return Math.max(minFontSize, fontSize);
}

/**
 * Chip box for a label at a font size. Estimated from character count because
 * measuring text off-thread is not available synchronously in React Native;
 * the estimate is deliberately generous so real text cannot overflow its box.
 * Honors the platform minimum touch target in both axes.
 */
export function chipSize(label, fontSize, { emoji = true, fontScale = 1 } = {}) {
  const scaledFont = fontSize * fontScale;
  const glyphWidth = scaledFont * 0.58;
  const emojiWidth = emoji ? scaledFont * 1.45 : 0;
  const horizontalPadding = 30;
  const verticalPadding = 22;

  return {
    width: Math.max(
      MIN_TOUCH_TARGET,
      Math.round(String(label).length * glyphWidth + emojiWidth + horizontalPadding),
    ),
    height: Math.max(MIN_TOUCH_TARGET, Math.round(scaledFont * 1.35 + verticalPadding)),
  };
}

function overlaps(a, b, gap) {
  return (
    a.x < b.x + b.width + gap &&
    a.x + a.width + gap > b.x &&
    a.y < b.y + b.height + gap &&
    a.y + a.height + gap > b.y
  );
}

const GOLDEN_ANGLE = 2.399963229728653;

/**
 * Deterministic phyllotaxis search for a non-overlapping slot. This is what
 * gives the map its organic, scattered look.
 *
 * It is a preference, not a guarantee: a wide chip in a narrow canvas leaves
 * only a thin band of legal x values that the spiral may never land in. When
 * that happens the caller falls back to findGridSlot.
 */
function findSpiralSlot({
  size,
  placed,
  width,
  maxY,
  centerX,
  centerY,
  gap,
  attempts,
  seedOffset,
  radiusStep,
}) {
  for (let k = 0; k < attempts; k += 1) {
    const index = k + seedOffset;
    const radius = radiusStep * Math.sqrt(index);
    const angle = index * GOLDEN_ANGLE;
    const x = Math.round(centerX + radius * Math.cos(angle) - size.width / 2);
    const y = Math.round(centerY + radius * Math.sin(angle) - size.height / 2);
    const candidate = { x, y, width: size.width, height: size.height };
    if (fits(candidate, placed, width, maxY, gap)) return candidate;
  }
  return null;
}

/**
 * Exhaustive deterministic scan: top to bottom, left to right, on a coarse
 * step. Guarantees a slot whenever one geometrically exists, which is what
 * makes "every populated category is placed" a property rather than a hope.
 */
function findGridSlot({ size, placed, width, maxY, gap, step = 4 }) {
  for (let y = 0; y + size.height <= maxY; y += step) {
    for (let x = 0; x + size.width <= width; x += step) {
      const candidate = { x, y, width: size.width, height: size.height };
      if (fits(candidate, placed, width, maxY, gap)) return candidate;
    }
  }
  return null;
}

function fits(candidate, placed, width, maxY, gap) {
  if (candidate.x < 0 || candidate.y < 0) return false;
  if (candidate.x + candidate.width > width) return false;
  if (candidate.y + candidate.height > maxY) return false;
  for (let i = 0; i < placed.length; i += 1) {
    if (overlaps(candidate, placed[i], gap)) return false;
  }
  return true;
}

/** Spiral first for the look, grid second for the guarantee. */
function findSlot(input) {
  return findSpiralSlot(input) || findGridSlot(input);
}

/**
 * @param {object} input
 * @param {{key:string,label:string,emoji?:string,count:number}[]} input.categories
 * @param {{id:string,title:string,emoji?:string}[]} [input.recentDreams]
 *        Small dream stars that fill leftover space. They are placed last and
 *        are dropped rather than allowed to cover a category control.
 * @param {number} input.width  Measured canvas width in points.
 * @param {number} input.height Measured canvas height in points.
 * @param {number} [input.fontScale] Device text-scaling factor.
 * @param {object} [input.options]
 * @returns {{
 *   nodes: object[],
 *   dreamStars: object[],
 *   overflow: {key:string,label:string,count:number}[],
 *   contentHeight: number,
 *   maxCount: number
 * }}
 */
export function layoutCloudMap({
  categories = [],
  recentDreams = [],
  width,
  height,
  fontScale = 1,
  options = {},
}) {
  const config = { ...DEFAULT_LAYOUT_OPTIONS, ...options };
  const canvasWidth = Math.max(160, Math.floor(width || 0));
  const canvasHeight = Math.max(200, Math.floor(height || 0));
  const maxY = Math.floor(canvasHeight * config.maxHeightScale);
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight * 0.44;

  const populated = sortCategoriesForMap(categories.filter((item) => item.count > 0));
  const maxCount = populated.reduce((max, item) => Math.max(max, item.count), 0);

  const placed = [];
  const nodes = [];
  const overflow = [];

  const maxChipWidth = Math.floor(canvasWidth * config.maxWidthShare);
  // Sized so `attempts` phyllotaxis points spread across roughly the visible
  // canvas instead of bunching into a small central disc.
  const radiusStep = Math.max(
    7.5,
    Math.sqrt((canvasWidth * canvasHeight) / (Math.PI * config.attempts)),
  );

  populated.forEach((category, index) => {
    const preferredFontSize = fontSizeForCount(
      category.count,
      maxCount,
      config.minFontSize,
      config.maxFontSize,
    );
    // Rank still determines the preferred size, so the biggest category is
    // still the biggest cloud among labels of similar length; the width cap
    // only prevents a long label from eating the whole row.
    const fontSize = fitFontSize(
      category.label,
      preferredFontSize,
      maxChipWidth,
      config.minFontSize,
      { emoji: true, fontScale },
    );
    const size = chipSize(category.label, fontSize, { emoji: true, fontScale });
    const slot = findSlot({
      size,
      placed,
      width: canvasWidth,
      maxY,
      centerX,
      centerY,
      gap: config.gap,
      attempts: config.attempts,
      radiusStep,
      // The first (largest) node starts dead centre; later nodes start further
      // out so the search does not retrace the whole spiral every time.
      seedOffset: index === 0 ? 0 : 1,
    });

    if (!slot) {
      overflow.push({ key: category.key, label: category.label, count: category.count });
      return;
    }

    placed.push(slot);
    nodes.push({
      ...category,
      ...slot,
      fontSize: Math.round(fontSize),
      // Decorative float phase, derived from the key so it never re-randomizes.
      floatPhase: (hashKey(category.key) % 1000) / 1000,
      rank: index,
    });
  });

  const dreamStars = [];
  recentDreams.forEach((dream, index) => {
    const size = { width: Math.max(MIN_TOUCH_TARGET, 108), height: MIN_TOUCH_TARGET };
    const slot = findSlot({
      size,
      placed,
      width: canvasWidth,
      maxY,
      centerX,
      centerY,
      gap: config.gap,
      attempts: config.attempts,
      radiusStep,
      seedOffset: 40 + index * 7,
    });
    if (!slot) return;
    placed.push(slot);
    dreamStars.push({ ...dream, ...slot, floatPhase: (hashKey(dream.id) % 1000) / 1000 });
  });

  const contentHeight = placed.reduce(
    (max, box) => Math.max(max, box.y + box.height),
    Math.min(canvasHeight, maxY),
  );

  return {
    nodes,
    dreamStars,
    overflow,
    contentHeight: Math.ceil(contentHeight + 16),
    maxCount,
  };
}

function hashKey(value) {
  let hash = 0;
  const text = String(value);
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) % 100000;
  }
  return hash;
}

export default layoutCloudMap;
