/**
 * Dates are stored as UTC ISO strings and shown with local conventions.
 * Tests pass an explicit locale and zone so they do not depend on the machine.
 */

import {
  deviceTimeZone,
  formatDreamDate,
  formatDreamDateShort,
  formatDuration,
  nowIso,
} from '../formatDate';

describe('long format', () => {
  it('uses local conventions for the given locale', () => {
    const value = '2026-03-14T06:58:00.000Z';
    expect(formatDreamDate(value, { locale: 'en-US', timeZone: 'UTC' })).toBe('March 14, 2026');
    expect(formatDreamDate(value, { locale: 'en-GB', timeZone: 'UTC' })).toBe('14 March 2026');
    expect(formatDreamDate(value, { locale: 'de-DE', timeZone: 'UTC' })).toBe('14. März 2026');
    expect(formatDreamDate(value, { locale: 'ja-JP', timeZone: 'UTC' })).toBe('2026年3月14日');
  });

  it('respects the time zone, which can change the calendar day', () => {
    const lateNightUtc = '2026-03-14T02:30:00.000Z';
    expect(formatDreamDate(lateNightUtc, { locale: 'en-US', timeZone: 'UTC' })).toBe(
      'March 14, 2026',
    );
    expect(
      formatDreamDate(lateNightUtc, { locale: 'en-US', timeZone: 'America/Detroit' }),
    ).toBe('March 13, 2026');
    expect(formatDreamDate(lateNightUtc, { locale: 'en-US', timeZone: 'Asia/Tokyo' })).toBe(
      'March 14, 2026',
    );
  });

  it('can include a time', () => {
    const value = formatDreamDate('2026-03-14T06:58:00.000Z', {
      locale: 'en-US',
      timeZone: 'UTC',
      withTime: true,
    });
    expect(value).toContain('March 14, 2026');
    expect(value).toMatch(/6:58/);
  });
});

describe('short format', () => {
  it('abbreviates the month', () => {
    expect(
      formatDreamDateShort('2026-03-14T06:58:00.000Z', { locale: 'en-US', timeZone: 'UTC' }),
    ).toBe('Mar 14, 2026');
  });
});

describe('inputs', () => {
  it('accepts an ISO string, a timestamp, and a Date equally', () => {
    const iso = '2026-03-14T06:58:00.000Z';
    const options = { locale: 'en-US', timeZone: 'UTC' };
    const expected = 'March 14, 2026';
    expect(formatDreamDate(iso, options)).toBe(expected);
    expect(formatDreamDate(new Date(iso).getTime(), options)).toBe(expected);
    expect(formatDreamDate(new Date(iso), options)).toBe(expected);
  });

  it('returns an empty string for anything unusable instead of throwing', () => {
    [null, undefined, '', '   ', 'not a date', NaN, {}].forEach((value) => {
      expect(formatDreamDate(value)).toBe('');
      expect(formatDreamDateShort(value)).toBe('');
    });
  });
});

describe('helpers', () => {
  it('nowIso returns a UTC ISO timestamp', () => {
    expect(nowIso()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('deviceTimeZone returns an IANA zone or null, never a crash', () => {
    const zone = deviceTimeZone();
    expect(zone === null || typeof zone === 'string').toBe(true);
  });

  it('formats a recording duration as minutes and seconds', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(5_400)).toBe('0:05');
    expect(formatDuration(65_000)).toBe('1:05');
    expect(formatDuration(180_000)).toBe('3:00');
    expect(formatDuration(-10)).toBe('0:00');
    expect(formatDuration(null)).toBe('0:00');
    expect(formatDuration('nonsense')).toBe('0:00');
  });
});
