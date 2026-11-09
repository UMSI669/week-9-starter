import type { InterviewSession } from '../models/types';

export function sessionStatus(session: InterviewSession): { label: string; tone: 'info' | 'warning' | 'success' | 'demo' } {
  if (session.analysis) return { label: 'Analyzed', tone: 'success' };
  if (session.redaction?.reviewedAt) return { label: 'Reviewed', tone: 'success' };
  if (session.redaction) return { label: 'Needs review', tone: 'warning' };
  if (session.segments.length) return { label: 'Transcribed', tone: 'info' };
  if (session.audio) return { label: 'Audio only', tone: 'info' };
  return { label: 'Empty', tone: 'warning' };
}
