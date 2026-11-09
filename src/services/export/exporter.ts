import type { InterviewSession, Project } from '../../models/types';
import { formatMs } from '../../utils/ids';
import { maskSegments } from '../privacy/placeholders';

export type ExportVariant = 'masked' | 'original';
export type ExportFormat = 'markdown' | 'json';

export interface ExportOptions {
  variant: ExportVariant;
  format: ExportFormat;
  includeTranscript: boolean;
  includeAnalysis: boolean;
}

function transcriptRows(session: InterviewSession, variant: ExportVariant) {
  if (variant === 'original') {
    return session.segments.map((s) => ({ id: s.id, startMs: s.startMs, endMs: s.endMs, speaker: s.speaker, text: s.text }));
  }
  return maskSegments(session.segments, session.redaction?.spans ?? [], session.redaction?.identityMap ?? {});
}

/**
 * Builds export content. The masked variant never includes original text, the
 * identity map, audio paths or file names. The original variant includes the
 * participant's real wording and is labeled as such.
 */
export function buildExport(project: Project, session: InterviewSession, options: ExportOptions): string {
  const rows = options.includeTranscript ? transcriptRows(session, options.variant) : [];
  const analysis = options.includeAnalysis ? session.analysis : undefined;
  const label = options.variant === 'masked' ? 'PSEUDONYMIZED (masked)' : 'ORIGINAL — contains identifying information';
  const title = options.variant === 'masked' ? session.participantLabel : session.title;

  if (options.format === 'json') {
    return JSON.stringify(
      {
        export: label,
        project: options.variant === 'masked' ? { researchQuestion: project.researchQuestion } : { name: project.name, researchQuestion: project.researchQuestion },
        session: { label: title, transcriptSource: session.transcriptSource, demo: session.isDemo },
        transcript: options.includeTranscript ? rows : undefined,
        analysis: analysis
          ? {
              model: analysis.model,
              createdAt: analysis.createdAt,
              summary: analysis.summary,
              codes: analysis.codes.filter((c) => c.status !== 'rejected'),
              themes: analysis.themes.filter((t) => t.status !== 'rejected'),
              quotes: analysis.quotes,
            }
          : undefined,
      },
      null,
      2,
    );
  }

  const lines: string[] = [];
  lines.push(`# ${title}`, '', `> ${label}`);
  if (session.isDemo) lines.push('>', '> Demo data: synthetic interview with a sample transcript.');
  lines.push('');
  if (project.researchQuestion) lines.push(`**Research question:** ${project.researchQuestion}`, '');
  if (options.includeTranscript) {
    lines.push('## Transcript', '');
    for (const row of rows) {
      lines.push(`**[${formatMs(row.startMs)}] ${row.speaker ? `${row.speaker}:` : ''}** ${row.text}  `, `<sub>${row.id}</sub>`, '');
    }
  }
  if (analysis) {
    const codeLabel = new Map(analysis.codes.map((c) => [c.id, c.label]));
    lines.push('## Analysis', '', `_Model: ${analysis.model} · ${analysis.createdAt.slice(0, 10)}_`, '', '### Summary', '', analysis.summary, '');
    lines.push('### Themes', '');
    for (const theme of analysis.themes.filter((t) => t.status !== 'rejected')) {
      lines.push(`- **${theme.title}** — ${theme.description}`);
      for (const codeId of theme.codeIds) lines.push(`  - ${codeLabel.get(codeId) ?? codeId}`);
    }
    lines.push('', '### Codes', '');
    for (const code of analysis.codes.filter((c) => c.status !== 'rejected')) {
      lines.push(`- **${code.label}** (${code.status}${code.origin === 'researcher' ? ', researcher' : ''}): ${code.description} — ${code.segmentIds.join(', ')}`);
    }
    lines.push('', '### Supporting quotes', '');
    for (const quote of analysis.quotes) {
      lines.push(`> "${quote.text}" — ${quote.segmentId}${quote.verbatim ? '' : ' (not verbatim)'}`, '');
    }
  }
  return lines.join('\n');
}

export function exportFileName(session: InterviewSession, options: ExportOptions): string {
  const base = (options.variant === 'masked' ? session.participantLabel : session.title)
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'session';
  return `${base}-${options.variant}.${options.format === 'json' ? 'json' : 'md'}`;
}
