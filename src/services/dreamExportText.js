/**
 * Pure text export. Kept separate from exportDream.js so the format can be
 * tested without the clipboard, the share sheet, or the photo library.
 *
 * The raw transcript is never included: an exported card is meant to be
 * shareable, and the transcript is the most personal part of the record.
 */

import { categoryLabel } from '../data/categories';
import { formatDreamDate } from './formatDate';

export const EXPORT_DISCLAIMER = 'Dream Decoder — a reflection, not a prediction.';

/**
 * [Title] [Emoji]
 * [Localized date]
 * Symbol: [Symbol label]
 * [Interpretation]
 * Themes: [Comma-separated themes]
 * Dream Decoder — a reflection, not a prediction.
 *
 * @param {object} dream
 * @param {object} [options] `locale` and `timeZone` are for tests; production
 *                           passes nothing and gets device conventions.
 */
export function buildDreamExportText(dream, options = {}) {
  if (!dream) return '';
  const lines = [];

  const title = (dream.title || 'Untitled dream').trim();
  const emoji = (dream.emoji || '').trim();
  lines.push(emoji ? `${title} ${emoji}` : title);

  const date = formatDreamDate(dream.createdAt, options);
  if (date) lines.push(date);

  const symbolLabel = (dream.symbolLabel || '').trim();
  if (symbolLabel) lines.push(`Symbol: ${symbolLabel}`);

  const category = dream.primaryCategory ? categoryLabel(dream.primaryCategory) : '';
  if (category) lines.push(`Category: ${category}`);

  const interpretation = (dream.interpretation || '').trim();
  if (interpretation) {
    lines.push('');
    lines.push(interpretation);
  }

  const reflectionQuestion = (dream.reflectionQuestion || '').trim();
  if (reflectionQuestion) lines.push(`Reflection: ${reflectionQuestion}`);

  const themes = normalizeList(dream.themes);
  if (themes.length > 0) {
    lines.push('');
    lines.push(`Themes: ${themes.join(', ')}`);
  }

  const moods = normalizeList(dream.moods);
  if (moods.length > 0) lines.push(`Moods: ${moods.join(', ')}`);

  if (dream.isDemo) {
    lines.push('');
    lines.push('(Demo data — this dream shipped with the app as a sample.)');
  }

  lines.push('');
  lines.push(EXPORT_DISCLAIMER);

  return lines.join('\n');
}

function normalizeList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

export default buildDreamExportText;
