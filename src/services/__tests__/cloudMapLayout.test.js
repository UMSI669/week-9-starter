/**
 * Cloud-map layout tests. The layout is a pure function, so every property
 * that matters on screen can be asserted without rendering anything.
 */

import {
  DEFAULT_LAYOUT_OPTIONS,
  MIN_TOUCH_TARGET,
  chipSize,
  fontSizeForCount,
  layoutCloudMap,
  sortCategoriesForMap,
} from '../cloudMapLayout';

const WIDTH = 360;
const HEIGHT = 420;

function categories(counts) {
  return Object.entries(counts).map(([label, count]) => ({
    key: label.toLowerCase().replace(/\s+/g, '-'),
    label,
    emoji: '✨',
    count,
  }));
}

const SAMPLE = categories({
  Adventure: 4,
  Relationships: 3,
  'School & Work': 3,
  'Nature & Animals': 2,
  'Flying & Falling': 2,
  Mystery: 1,
  'Everyday Life': 1,
});

describe('ordering', () => {
  it('puts the biggest category first', () => {
    const sorted = sortCategoriesForMap(SAMPLE);
    expect(sorted[0].label).toBe('Adventure');
  });

  it('breaks equal counts alphabetically, so order never changes between renders', () => {
    const sorted = sortCategoriesForMap(SAMPLE).map((item) => item.label);
    expect(sorted).toEqual([
      'Adventure',
      'Relationships',
      'School & Work',
      'Flying & Falling',
      'Nature & Animals',
      'Everyday Life',
      'Mystery',
    ]);
  });

  it('gives the same order no matter how the input is shuffled', () => {
    const shuffled = [...SAMPLE].reverse();
    expect(sortCategoriesForMap(shuffled).map((c) => c.key)).toEqual(
      sortCategoriesForMap(SAMPLE).map((c) => c.key),
    );
  });

  it('does not mutate its input', () => {
    const input = [...SAMPLE];
    const before = input.map((c) => c.key);
    sortCategoriesForMap(input);
    expect(input.map((c) => c.key)).toEqual(before);
  });
});

describe('sizing', () => {
  const { minFontSize, maxFontSize } = DEFAULT_LAYOUT_OPTIONS;

  it('gives the largest count the maximum size', () => {
    expect(fontSizeForCount(10, 10, minFontSize, maxFontSize)).toBe(maxFontSize);
  });

  it('never drops below the minimum readable size', () => {
    expect(fontSizeForCount(1, 500, minFontSize, maxFontSize)).toBeGreaterThanOrEqual(minFontSize);
    expect(fontSizeForCount(0, 500, minFontSize, maxFontSize)).toBeGreaterThanOrEqual(minFontSize);
  });

  it('is sublinear, so a huge category cannot dwarf a small one proportionally', () => {
    // 100x the dreams must not mean anything like 100x the type size.
    const big = fontSizeForCount(100, 100, minFontSize, maxFontSize);
    const small = fontSizeForCount(1, 100, minFontSize, maxFontSize);
    expect(big / small).toBeLessThan(2.5);
    // Square-root growth: four times the count is twice the size *above* the floor.
    const quarter = fontSizeForCount(25, 100, minFontSize, maxFontSize);
    expect(quarter - minFontSize).toBeCloseTo((big - minFontSize) / 2, 5);
  });

  it('is monotonic in the count', () => {
    let previous = 0;
    for (const count of [1, 2, 5, 9, 20, 44, 90]) {
      const size = fontSizeForCount(count, 90, minFontSize, maxFontSize);
      expect(size).toBeGreaterThanOrEqual(previous);
      previous = size;
    }
  });

  it('is bounded on both ends for any input', () => {
    for (const [count, max] of [[0, 0], [1, 1], [7, 3], [-5, 10], [1000, 1000]]) {
      const size = fontSizeForCount(count, max, minFontSize, maxFontSize);
      expect(size).toBeGreaterThanOrEqual(minFontSize);
      expect(size).toBeLessThanOrEqual(maxFontSize);
    }
  });
});

describe('chip boxes', () => {
  it('always meets the minimum touch target in both axes', () => {
    const tiny = chipSize('A', 8);
    expect(tiny.width).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    expect(tiny.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  });

  it('grows with the label and with the device text scale', () => {
    expect(chipSize('Nature & Animals', 20).width).toBeGreaterThan(chipSize('Mystery', 20).width);
    expect(chipSize('Mystery', 20, { fontScale: 2 }).height).toBeGreaterThan(
      chipSize('Mystery', 20).height,
    );
  });
});

describe('placement', () => {
  const result = layoutCloudMap({ categories: SAMPLE, width: WIDTH, height: HEIGHT });

  it('places every populated category', () => {
    expect(result.nodes).toHaveLength(SAMPLE.length);
    expect(result.overflow).toHaveLength(0);
  });

  it('is deterministic: identical inputs give identical positions', () => {
    const again = layoutCloudMap({ categories: SAMPLE, width: WIDTH, height: HEIGHT });
    expect(again.nodes.map((n) => [n.key, n.x, n.y, n.fontSize])).toEqual(
      result.nodes.map((n) => [n.key, n.x, n.y, n.fontSize]),
    );
  });

  it('keeps every node inside the canvas width', () => {
    result.nodes.forEach((node) => {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x + node.width).toBeLessThanOrEqual(WIDTH);
      expect(node.y).toBeGreaterThanOrEqual(0);
    });
  });

  it('leaves a gap between every pair of touch targets', () => {
    const { gap } = DEFAULT_LAYOUT_OPTIONS;
    for (let i = 0; i < result.nodes.length; i += 1) {
      for (let j = i + 1; j < result.nodes.length; j += 1) {
        const a = result.nodes[i];
        const b = result.nodes[j];
        const separated =
          a.x + a.width + gap <= b.x ||
          b.x + b.width + gap <= a.x ||
          a.y + a.height + gap <= b.y ||
          b.y + b.height + gap <= a.y;
        expect(separated).toBe(true);
      }
    }
  });

  it('gives the biggest category the biggest font and rank zero', () => {
    const biggest = result.nodes.find((node) => node.key === 'adventure');
    expect(biggest.rank).toBe(0);
    expect(Math.max(...result.nodes.map((n) => n.fontSize))).toBe(biggest.fontSize);
  });

  it('skips categories with no dreams entirely', () => {
    const withEmpty = layoutCloudMap({
      categories: [...SAMPLE, { key: 'other', label: 'Other', emoji: '✨', count: 0 }],
      width: WIDTH,
      height: HEIGHT,
    });
    expect(withEmpty.nodes.find((node) => node.key === 'other')).toBeUndefined();
  });
});

describe('dream stars', () => {
  it('places recent dreams without overlapping any category control', () => {
    const { gap } = DEFAULT_LAYOUT_OPTIONS;
    const result = layoutCloudMap({
      categories: SAMPLE,
      recentDreams: [
        { id: 'a', title: 'One' },
        { id: 'b', title: 'Two' },
        { id: 'c', title: 'Three' },
      ],
      width: WIDTH,
      height: HEIGHT,
    });

    result.dreamStars.forEach((star) => {
      result.nodes.forEach((node) => {
        const separated =
          star.x + star.width + gap <= node.x ||
          node.x + node.width + gap <= star.x ||
          star.y + star.height + gap <= node.y ||
          node.y + node.height + gap <= star.y;
        expect(separated).toBe(true);
      });
    });
  });

  it('drops a star rather than covering a category when there is no room', () => {
    const crowded = layoutCloudMap({
      categories: SAMPLE,
      recentDreams: Array.from({ length: 40 }, (_, index) => ({
        id: `d${index}`,
        title: `Dream ${index}`,
      })),
      width: 240,
      height: 240,
    });
    expect(crowded.dreamStars.length).toBeLessThan(40);
    expect(crowded.nodes.length).toBeGreaterThan(0);
  });
});

describe('edge cases', () => {
  it('handles a single category', () => {
    const result = layoutCloudMap({
      categories: categories({ Mystery: 1 }),
      width: WIDTH,
      height: HEIGHT,
    });
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].fontSize).toBe(DEFAULT_LAYOUT_OPTIONS.maxFontSize);
    expect(result.maxCount).toBe(1);
  });

  it('handles categories that all have the same count', () => {
    const equal = categories({ Adventure: 2, Mystery: 2, Nature: 2, School: 2 });
    const result = layoutCloudMap({ categories: equal, width: WIDTH, height: HEIGHT });
    const sizes = new Set(result.nodes.map((node) => node.fontSize));
    expect(sizes.size).toBe(1);
    expect(result.nodes.map((n) => n.label)).toEqual([
      'Adventure',
      'Mystery',
      'Nature',
      'School',
    ]);
  });

  it('handles no dreams at all', () => {
    const result = layoutCloudMap({ categories: categories({ Other: 0 }), width: WIDTH, height: HEIGHT });
    expect(result.nodes).toHaveLength(0);
    expect(result.maxCount).toBe(0);
  });

  it('handles a missing or zero measurement without throwing', () => {
    expect(() => layoutCloudMap({ categories: SAMPLE, width: 0, height: 0 })).not.toThrow();
    expect(() => layoutCloudMap({ categories: SAMPLE })).not.toThrow();
  });

  it('grows the canvas and reports overflow instead of shrinking labels', () => {
    const many = categories(
      Object.fromEntries(
        Array.from({ length: 24 }, (_, index) => [`Category Number ${index}`, index + 1]),
      ),
    );
    const result = layoutCloudMap({ categories: many, width: 300, height: 200 });
    // Either the canvas grew so the view can scroll, or the extras were
    // reported as overflow for the list view. Never a sub-minimum font size.
    expect(result.contentHeight).toBeGreaterThanOrEqual(200);
    result.nodes.forEach((node) => {
      expect(node.fontSize).toBeGreaterThanOrEqual(DEFAULT_LAYOUT_OPTIONS.minFontSize);
    });
    expect(result.nodes.length + result.overflow.length).toBe(many.length);
  });

  it('scales text with the device font scale without overlapping', () => {
    const { gap } = DEFAULT_LAYOUT_OPTIONS;
    const result = layoutCloudMap({
      categories: SAMPLE,
      width: WIDTH,
      height: HEIGHT,
      fontScale: 1.8,
    });
    for (let i = 0; i < result.nodes.length; i += 1) {
      for (let j = i + 1; j < result.nodes.length; j += 1) {
        const a = result.nodes[i];
        const b = result.nodes[j];
        const separated =
          a.x + a.width + gap <= b.x ||
          b.x + b.width + gap <= a.x ||
          a.y + a.height + gap <= b.y ||
          b.y + b.height + gap <= a.y;
        expect(separated).toBe(true);
      }
    }
  });
});

describe('count updates', () => {
  it('re-ranks when a category gains a dream', () => {
    const before = layoutCloudMap({ categories: SAMPLE, width: WIDTH, height: HEIGHT });
    expect(before.nodes[0].key).toBe('adventure');

    const after = layoutCloudMap({
      categories: SAMPLE.map((item) =>
        item.key === 'mystery' ? { ...item, count: 9 } : item,
      ),
      width: WIDTH,
      height: HEIGHT,
    });
    expect(after.nodes[0].key).toBe('mystery');
    expect(after.maxCount).toBe(9);
  });

  it('removes a category from the map when its last dream is deleted', () => {
    const after = layoutCloudMap({
      categories: SAMPLE.map((item) => (item.key === 'mystery' ? { ...item, count: 0 } : item)),
      width: WIDTH,
      height: HEIGHT,
    });
    expect(after.nodes.find((node) => node.key === 'mystery')).toBeUndefined();
    expect(after.nodes).toHaveLength(SAMPLE.length - 1);
  });
});
