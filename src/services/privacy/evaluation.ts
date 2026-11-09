import type { MaskedSegment, RedactionSpan, TranscriptSegment } from '../../models/types';
import { findWholeWord } from './patterns';

/**
 * Ground-truth identifiers for the SYNTHETIC sample interviews. Used by the
 * on-device benchmark and unit tests to measure missed identifiers.
 */
export const SAMPLE_GROUND_TRUTH: Record<string, string[]> = {
  'clinic-scheduling': [
    'Maria Delgado', 'Riverside Community Hospital', 'Ann Arbor', '734-555-0142', 'Leo', '48213977', 'Patel',
    'maria.delgado@example.com',
  ],
  'transit-commute': [
    'James Okafor', 'Packard Street', 'Blake Transit Center', 'Northwind Logistics', 'Susan Reyes', 'Priya',
    '313-555-0187', 'james.okafor@example.com',
  ],
};

export interface RedactionEvaluation {
  expected: number;
  missed: string[];
  recall: number;
  /** Fraction of non-identifier characters preserved exactly (meaning preservation proxy). */
  preservedRatio: number;
}

export function evaluateRedaction(
  original: TranscriptSegment[],
  masked: MaskedSegment[],
  spans: RedactionSpan[],
  expected: string[],
): RedactionEvaluation {
  const maskedText = masked.map((s) => s.text).join('\n');
  const missed = expected.filter((value) => findWholeWord(maskedText, value).length > 0);
  const originalChars = original.reduce((sum, s) => sum + s.text.length, 0) || 1;
  const maskedChars = spans.filter((s) => s.status === 'accepted').reduce((sum, s) => sum + (s.end - s.start), 0);
  return {
    expected: expected.length,
    missed,
    recall: expected.length ? (expected.length - missed.length) / expected.length : 1,
    preservedRatio: 1 - maskedChars / originalChars,
  };
}
