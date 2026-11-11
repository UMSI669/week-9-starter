/**
 * Lunar-phase tests against fixed reference dates.
 *
 * The references are solar and lunar eclipses, which are new and full moons by
 * definition, plus the new moon used as a worked example in Meeus's
 * Astronomical Algorithms. Eclipse times are published to the minute, so they
 * are the most trustworthy fixed points available without a key or a network.
 */

import {
  PHASE_NAMES,
  getMoonPhase,
  localDateKey,
  moonElongationDegrees,
  phaseNameFromElongation,
  toJulianDay,
} from '../moonPhase';

/** Greatest-eclipse times in UTC. */
const NEW_MOONS = [
  ['2000-01-06T18:14:00Z', 'Meeus worked example'],
  ['2017-08-21T18:26:00Z', 'total solar eclipse, North America'],
  ['2024-04-08T18:17:00Z', 'total solar eclipse, North America'],
  ['2023-10-14T17:59:00Z', 'annular solar eclipse, Americas'],
];

const FULL_MOONS = [
  ['2000-01-21T04:44:00Z', 'total lunar eclipse'],
  ['2019-01-21T05:12:00Z', 'total lunar eclipse'],
  ['2025-03-14T06:58:00Z', 'total lunar eclipse'],
  ['2025-09-07T18:11:00Z', 'total lunar eclipse'],
];

describe('Julian day conversion', () => {
  it('converts the J2000.0 epoch exactly', () => {
    expect(toJulianDay(Date.UTC(2000, 0, 1, 12, 0, 0))).toBeCloseTo(2451545.0, 6);
  });

  it('converts the Unix epoch exactly', () => {
    expect(toJulianDay(0)).toBeCloseTo(2440587.5, 6);
  });
});

describe('fixed reference dates', () => {
  it.each(NEW_MOONS)('names %s a new moon (%s)', (iso) => {
    const phase = getMoonPhase(new Date(iso));
    expect(phase.phaseName).toBe('New Moon');
    // At a solar eclipse the illuminated fraction is essentially zero.
    expect(phase.illumination).toBeLessThan(0.0005);
  });

  it.each(FULL_MOONS)('names %s a full moon (%s)', (iso) => {
    const phase = getMoonPhase(new Date(iso));
    expect(phase.phaseName).toBe('Full Moon');
    expect(phase.illumination).toBeGreaterThan(0.9995);
  });

  it('places every reference new moon within half a degree of elongation zero', () => {
    NEW_MOONS.forEach(([iso]) => {
      const elongation = moonElongationDegrees(new Date(iso).getTime());
      const distance = Math.min(elongation, 360 - elongation);
      expect(distance).toBeLessThan(0.5);
    });
  });

  it('places every reference full moon within half a degree of elongation 180', () => {
    FULL_MOONS.forEach(([iso]) => {
      expect(Math.abs(moonElongationDegrees(new Date(iso).getTime()) - 180)).toBeLessThan(0.5);
    });
  });
});

describe('waxing and waning', () => {
  const newMoon = new Date('2024-04-08T18:17:00Z').getTime();
  const day = 86400000;

  it('is waxing in the first half of the cycle and waning in the second', () => {
    expect(getMoonPhase(newMoon + 3 * day).waxing).toBe(true);
    expect(getMoonPhase(newMoon + 7 * day).waxing).toBe(true);
    expect(getMoonPhase(newMoon + 11 * day).waxing).toBe(true);
    expect(getMoonPhase(newMoon + 18 * day).waxing).toBe(false);
    expect(getMoonPhase(newMoon + 22 * day).waxing).toBe(false);
    expect(getMoonPhase(newMoon + 27 * day).waxing).toBe(false);
  });

  it('walks through the phases in order across one synodic month', () => {
    const seen = [];
    for (let days = 0; days < 29.5; days += 0.25) {
      const name = getMoonPhase(newMoon + days * day).phaseName;
      if (seen[seen.length - 1] !== name) seen.push(name);
    }
    expect(seen).toEqual([
      'New Moon',
      'Waxing Crescent',
      'First Quarter',
      'Waxing Gibbous',
      'Full Moon',
      'Waning Gibbous',
      'Last Quarter',
      'Waning Crescent',
      'New Moon',
    ]);
  });

  it('reaches about half illumination at the quarters', () => {
    const firstQuarter = getMoonPhase(newMoon + 7.4 * day);
    expect(firstQuarter.illumination).toBeGreaterThan(0.45);
    expect(firstQuarter.illumination).toBeLessThan(0.62);
    expect(firstQuarter.waxing).toBe(true);
  });
});

describe('phase naming', () => {
  it('gives each of the eight phases a 45-degree band centred on its instant', () => {
    expect(phaseNameFromElongation(0)).toBe('New Moon');
    expect(phaseNameFromElongation(90)).toBe('First Quarter');
    expect(phaseNameFromElongation(180)).toBe('Full Moon');
    expect(phaseNameFromElongation(270)).toBe('Last Quarter');
    expect(phaseNameFromElongation(45)).toBe('Waxing Crescent');
    expect(phaseNameFromElongation(135)).toBe('Waxing Gibbous');
    expect(phaseNameFromElongation(225)).toBe('Waning Gibbous');
    expect(phaseNameFromElongation(315)).toBe('Waning Crescent');
  });

  it('wraps around 360 degrees without a gap', () => {
    expect(phaseNameFromElongation(359.9)).toBe('New Moon');
    expect(phaseNameFromElongation(360)).toBe('New Moon');
    expect(phaseNameFromElongation(-10)).toBe('New Moon');
    expect(PHASE_NAMES).toHaveLength(8);
  });
});

describe('accessibility label', () => {
  it('matches the specified wording', () => {
    const phase = getMoonPhase(new Date('2025-03-14T06:58:00Z'));
    expect(phase.accessibilityLabel).toBe(
      'Dream symbols and interpretations. Current moon: Full Moon.',
    );
  });
});

describe('inputs', () => {
  it('accepts a Date or a millisecond timestamp identically', () => {
    const iso = '2024-04-08T18:17:00Z';
    expect(getMoonPhase(new Date(iso)).elongation).toBe(
      getMoonPhase(new Date(iso).getTime()).elongation,
    );
  });

  it('rejects something that is not a time', () => {
    expect(() => getMoonPhase('not a date')).toThrow(TypeError);
    expect(() => getMoonPhase(NaN)).toThrow(TypeError);
  });
});

describe('date key', () => {
  it('changes when the local calendar date changes', () => {
    const morning = new Date(2026, 0, 15, 9, 0, 0);
    const evening = new Date(2026, 0, 15, 23, 30, 0);
    const nextDay = new Date(2026, 0, 16, 0, 30, 0);
    expect(localDateKey(morning)).toBe(localDateKey(evening));
    expect(localDateKey(nextDay)).not.toBe(localDateKey(morning));
    expect(localDateKey(morning)).toBe('2026-01-15');
  });
});
