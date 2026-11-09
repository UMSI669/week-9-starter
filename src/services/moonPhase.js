/**
 * Local lunar-phase calculation — no network, no API key, no location.
 *
 * Implements the truncated Meeus series for the Moon's and Sun's apparent
 * ecliptic longitudes (Astronomical Algorithms, 2nd ed., ch. 25 and ch. 47).
 * The elongation between them gives the phase angle, which gives both the
 * illuminated fraction and the waxing/waning direction.
 *
 * Accuracy: the truncated series lands within a few hundredths of a day of
 * the true new/full moon instants (verified in __tests__/moonPhase.test.js
 * against solar- and lunar-eclipse times, which are new and full moons).
 * That is far more than enough to name a phase, and far less than
 * observatory precision. The UI must call it approximate.
 *
 * Phase is a geocentric quantity: it does not depend on the observer's
 * position on Earth, so no location permission is needed. Only the
 * apparent left/right orientation of a crescent depends on latitude, and
 * this app does not claim to show that.
 */

const DEG = Math.PI / 180;
const JD_UNIX_EPOCH = 2440587.5;
const MS_PER_DAY = 86400000;
const SYNODIC_MONTH_DAYS = 29.530588861;

export const PHASE_NAMES = [
  'New Moon',
  'Waxing Crescent',
  'First Quarter',
  'Waxing Gibbous',
  'Full Moon',
  'Waning Gibbous',
  'Last Quarter',
  'Waning Crescent',
];

function normalizeDegrees(value) {
  const wrapped = value % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

function sinDeg(degrees) {
  return Math.sin(degrees * DEG);
}

export function toJulianDay(timestampMs) {
  return timestampMs / MS_PER_DAY + JD_UNIX_EPOCH;
}

/** Apparent geocentric ecliptic longitude of the Sun, in degrees. */
function sunLongitude(centuriesSinceJ2000) {
  const t = centuriesSinceJ2000;
  const meanLongitude = 280.46646 + 36000.76983 * t + 0.0003032 * t * t;
  const meanAnomaly = 357.52911 + 35999.05029 * t - 0.0001537 * t * t;
  const equationOfCenter =
    (1.914602 - 0.004817 * t - 0.000014 * t * t) * sinDeg(meanAnomaly) +
    (0.019993 - 0.000101 * t) * sinDeg(2 * meanAnomaly) +
    0.000289 * sinDeg(3 * meanAnomaly);
  return normalizeDegrees(meanLongitude + equationOfCenter);
}

/** Apparent geocentric ecliptic longitude of the Moon, in degrees. */
function moonLongitude(centuriesSinceJ2000) {
  const t = centuriesSinceJ2000;
  const meanLongitude = 218.3164477 + 481267.88123421 * t - 0.0015786 * t * t;
  const elongation = 297.8501921 + 445267.1114034 * t - 0.0018819 * t * t;
  const sunAnomaly = 357.5291092 + 35999.0502909 * t - 0.0001536 * t * t;
  const moonAnomaly = 134.9633964 + 477198.8675055 * t + 0.0087414 * t * t;
  const latitudeArgument = 93.272095 + 483202.0175233 * t - 0.0036539 * t * t;

  const d = elongation;
  const m = sunAnomaly;
  const mp = moonAnomaly;
  const f = latitudeArgument;

  const correction =
    6.288774 * sinDeg(mp) +
    1.274027 * sinDeg(2 * d - mp) +
    0.658314 * sinDeg(2 * d) +
    0.213618 * sinDeg(2 * mp) -
    0.185116 * sinDeg(m) -
    0.114332 * sinDeg(2 * f) +
    0.058793 * sinDeg(2 * d - 2 * mp) +
    0.057066 * sinDeg(2 * d - m - mp) +
    0.053322 * sinDeg(2 * d + mp) +
    0.045758 * sinDeg(2 * d - m) -
    0.040923 * sinDeg(m - mp) -
    0.03472 * sinDeg(d) -
    0.030383 * sinDeg(m + mp) +
    0.015327 * sinDeg(2 * d - 2 * f) -
    0.012528 * sinDeg(mp + 2 * f) +
    0.01098 * sinDeg(mp - 2 * f) +
    0.010675 * sinDeg(4 * d - mp) +
    0.010034 * sinDeg(3 * mp) +
    0.008548 * sinDeg(4 * d - 2 * mp) -
    0.007888 * sinDeg(2 * d + m - mp) -
    0.006766 * sinDeg(2 * d + m) -
    0.005163 * sinDeg(d - mp) +
    0.004987 * sinDeg(d + m) +
    0.004036 * sinDeg(2 * d - m + mp) +
    0.003994 * sinDeg(2 * d + 2 * mp) +
    0.003861 * sinDeg(4 * d) +
    0.003665 * sinDeg(2 * d - 3 * mp) -
    0.002689 * sinDeg(m - 2 * mp) -
    0.002602 * sinDeg(2 * d - mp + 2 * f) +
    0.002390 * sinDeg(2 * d - m - 2 * mp) -
    0.002348 * sinDeg(d + mp) +
    0.002236 * sinDeg(2 * d - 2 * m) -
    0.002120 * sinDeg(m + 2 * mp) -
    0.002069 * sinDeg(2 * m);

  return normalizeDegrees(meanLongitude + correction);
}

/**
 * Phase angle in degrees: the Moon's elongation from the Sun.
 * 0 = new, 90 = first quarter, 180 = full, 270 = last quarter.
 */
export function moonElongationDegrees(timestampMs) {
  const t = (toJulianDay(timestampMs) - 2451545.0) / 36525;
  return normalizeDegrees(moonLongitude(t) - sunLongitude(t));
}

export function phaseNameFromElongation(elongationDegrees) {
  const elongation = normalizeDegrees(elongationDegrees);
  // Eight 45-degree bands centred on the eight named phases, so that the
  // four exact phases each own a 22.5-degree window around their instant.
  const index = Math.floor((elongation + 22.5) / 45) % 8;
  return PHASE_NAMES[index];
}

/**
 * @param {Date|number} [when] Defaults to now.
 * @returns {{
 *   timestamp: number,
 *   elongation: number,
 *   phaseName: string,
 *   illumination: number,
 *   waxing: boolean,
 *   age: number,
 *   accessibilityLabel: string
 * }}
 */
export function getMoonPhase(when = Date.now()) {
  const timestamp = when instanceof Date ? when.getTime() : Number(when);
  if (!Number.isFinite(timestamp)) {
    throw new TypeError('getMoonPhase needs a Date or a millisecond timestamp.');
  }

  const elongation = moonElongationDegrees(timestamp);
  const illumination = (1 - Math.cos(elongation * DEG)) / 2;
  const waxing = elongation < 180;
  const phaseName = phaseNameFromElongation(elongation);

  return {
    timestamp,
    elongation,
    phaseName,
    illumination,
    waxing,
    // Approximate days since the preceding new moon.
    age: (elongation / 360) * SYNODIC_MONTH_DAYS,
    accessibilityLabel: `Dream symbols and interpretations. Current moon: ${phaseName}.`,
  };
}

/**
 * Fraction of the disc that the lit terminator covers, 0..1, used by the SVG
 * mask. Returns how far the lit edge has swept across the disc.
 */
export function terminatorOffset(elongationDegrees) {
  return Math.cos(normalizeDegrees(elongationDegrees) * DEG);
}

/** A stable key that changes when the local calendar date changes. */
export function localDateKey(when = Date.now()) {
  const date = when instanceof Date ? when : new Date(when);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export default getMoonPhase;
