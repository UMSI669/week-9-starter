/**
 * Card artwork must be a pure function of the persisted seed, or a card would
 * look different every time it is drawn.
 */

import {
  accentFor,
  cardGradient,
  constellation,
  createRandom,
  createVisualSeed,
  hashSeed,
} from '../visualSeed';

describe('seeded randomness', () => {
  it('gives the same sequence for the same seed', () => {
    const a = createRandom('seed-1');
    const b = createRandom('seed-1');
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('gives different sequences for different seeds', () => {
    expect(createRandom('seed-1')()).not.toBe(createRandom('seed-2')());
  });

  it('stays inside [0, 1)', () => {
    const random = createRandom('range-check');
    for (let i = 0; i < 500; i += 1) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('hashes deterministically', () => {
    expect(hashSeed('abc')).toBe(hashSeed('abc'));
    expect(hashSeed('abc')).not.toBe(hashSeed('abd'));
  });

  it('creates distinct new seeds', () => {
    const seeds = new Set(Array.from({ length: 50 }, () => createVisualSeed()));
    expect(seeds.size).toBe(50);
  });
});

describe('gradients', () => {
  it('is identical for the same seed and tags', () => {
    expect(cardGradient('demo-library-01', ['exploration'], ['curious'])).toEqual(
      cardGradient('demo-library-01', ['exploration'], ['curious'])
    );
  });

  it('returns three stops', () => {
    expect(cardGradient('x').length).toBe(3);
  });

  it('keeps every stop dark enough for light text', () => {
    ['a', 'b', 'demo-fox-11', 'demo-storm-12'].forEach((seed) => {
      cardGradient(seed, ['water'], ['calm']).forEach((stop) => {
        const lightness = Number(stop.match(/,\s*(\d+)%\)$/)[1]);
        expect(lightness).toBeLessThanOrEqual(34);
      });
    });
  });

  it('changes when the moods change, so cards are visually distinct', () => {
    expect(cardGradient('same-seed', [], ['calm'])).not.toEqual(
      cardGradient('same-seed', [], ['joyful']),
    );
  });

  it('produces a readable accent for the same seed every time', () => {
    expect(accentFor('seed', ['water'], ['calm'])).toBe(accentFor('seed', ['water'], ['calm']));
  });
});

describe('constellations', () => {
  it('is identical for the same seed', () => {
    expect(constellation('seed-a', 9)).toEqual(constellation('seed-a', 9));
  });

  it('keeps every star inside the card', () => {
    const { stars } = constellation('bounds', 18);
    stars.forEach((star) => {
      expect(star.x).toBeGreaterThanOrEqual(0);
      expect(star.x).toBeLessThanOrEqual(1);
      expect(star.y).toBeGreaterThanOrEqual(0);
      expect(star.y).toBeLessThanOrEqual(1);
      expect(star.r).toBeGreaterThan(0);
      expect(star.o).toBeGreaterThan(0);
      expect(star.o).toBeLessThanOrEqual(1);
    });
  });

  it('clamps the star count to something drawable', () => {
    expect(constellation('x', 1).stars.length).toBe(3);
    expect(constellation('x', 500).stars.length).toBe(18);
  });

  it('draws lines only between real stars', () => {
    const { stars, lines } = constellation('lines', 12);
    const points = new Set(stars.map((star) => `${star.x},${star.y}`));
    lines.forEach((line) => {
      expect(points.has(`${line.x1},${line.y1}`)).toBe(true);
      expect(points.has(`${line.x2},${line.y2}`)).toBe(true);
    });
  });
});
