/**
 * Dates are stored as UTC ISO strings and displayed with local conventions.
 *
 * The capture time is the dream's date and is retained through every edit —
 * `updatedAt` moves, `createdAt` never does.
 */

/**
 * @param {string|number} value UTC ISO string or ms timestamp.
 * @param {object} [options]
 * @param {string} [options.locale] Overrides the device locale (tests pass this).
 * @param {string} [options.timeZone] Overrides the device zone (tests pass this).
 * @param {boolean} [options.withTime]
 */
export function formatDreamDate(value, { locale, timeZone, withTime = false } = {}) {
  const date = toDate(value);
  if (!date) return '';

  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'long',
      ...(withTime ? { timeStyle: 'short' } : null),
      ...(timeZone ? { timeZone } : null),
    }).format(date);
  } catch (_error) {
    // Intl can throw on an unsupported locale or zone on older devices.
    return date.toDateString();
  }
}

export function formatDreamDateShort(value, { locale, timeZone } = {}) {
  const date = toDate(value);
  if (!date) return '';
  try {
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      ...(timeZone ? { timeZone } : null),
    }).format(date);
  } catch (_error) {
    return date.toDateString();
  }
}

export function nowIso() {
  return new Date().toISOString();
}

/** Device IANA zone when the platform exposes one, otherwise null. */
export function deviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch (_error) {
    return null;
  }
}

export function formatDuration(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor((Number(milliseconds) || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function toDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const fromNumber = new Date(value);
    return Number.isNaN(fromNumber.getTime()) ? null : fromNumber;
  }
  if (typeof value === 'string' && value.trim()) {
    const fromString = new Date(value);
    return Number.isNaN(fromString.getTime()) ? null : fromString;
  }
  return null;
}

export default formatDreamDate;
