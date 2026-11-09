import type { InterviewSession, MaskedSegment, Project, RedactionSpan } from '../../models/types';
import { fingerprint } from '../../utils/ids';
import { findWholeWord } from '../privacy/patterns';
import { findLeaks, maskSegments, placeholderFor, type LeakFinding } from '../privacy/placeholders';

export const ANALYSIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'codes', 'themes', 'quotes'],
  properties: {
    summary: { type: 'string', description: '3-6 sentence summary of the interview, using placeholders as-is.' },
    codes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'label', 'description', 'segment_ids'],
        properties: {
          id: { type: 'string', description: 'Short id such as C1' },
          label: { type: 'string' },
          description: { type: 'string' },
          segment_ids: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    themes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'title', 'description', 'code_ids'],
        properties: {
          id: { type: 'string', description: 'Short id such as T1' },
          title: { type: 'string' },
          description: { type: 'string' },
          code_ids: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    quotes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['segment_id', 'text', 'code_ids'],
        properties: {
          segment_id: { type: 'string' },
          text: { type: 'string', description: 'Exact excerpt copied from that segment.' },
          code_ids: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
} as const;

export const ANALYSIS_SYSTEM_PROMPT = `You are an experienced UX researcher doing qualitative analysis of one interview transcript.
The transcript has been pseudonymized: bracketed placeholders such as [PERSON_01] or [ORG_02] replace identifying details. Keep placeholders exactly as written, never guess who they are, and never invent identifying details.
Produce:
- summary: a concise, neutral summary of what the participant said.
- codes: 4-12 descriptive research codes. Each code cites the segment ids (e.g. "seg_004") that support it.
- themes: 2-5 higher-level themes, each grouping related code ids.
- quotes: 3-8 short supporting quotes. Copy each quote verbatim from a single segment and give that segment id.
Only use segment ids that appear in the transcript. Respond with JSON matching the schema.`;

const SAFE_SPEAKER = /^(interviewer|participant|moderator|researcher|facilitator|speaker\s?\d*|p\d{1,3}|r\d{1,3}|[a-z])$/i;

export function sanitizeSpeaker(speaker: string | undefined): string | undefined {
  if (!speaker) return undefined;
  const trimmed = speaker.trim();
  return SAFE_SPEAKER.test(trimmed) ? trimmed : 'Speaker';
}

/** Masks researcher-authored free text (research context) with the session's identity map. */
export function maskFreeText(text: string, spans: RedactionSpan[], identityMap: Record<string, string>): string {
  let result = text;
  const accepted = spans
    .filter((s) => s.status === 'accepted')
    .sort((a, b) => b.text.length - a.text.length);
  const seen = new Set<string>();
  for (const span of accepted) {
    if (seen.has(span.text.toLowerCase())) continue;
    seen.add(span.text.toLowerCase());
    const hits = findWholeWord(result, span.text).reverse();
    for (const hit of hits) {
      result = result.slice(0, hit.start) + placeholderFor(span, identityMap) + result.slice(hit.end);
    }
  }
  return result;
}

export interface PrivacyOptions {
  denyDataCollection: boolean;
  requireZdr: boolean;
}

export interface AnalysisRequest {
  /** Exact JSON body POSTed to OpenRouter. This is what the review screen shows. */
  body: {
    model: string;
    messages: { role: 'system' | 'user'; content: string }[];
    response_format: { type: 'json_schema'; json_schema: { name: string; strict: boolean; schema: typeof ANALYSIS_SCHEMA } };
    provider: { data_collection: 'allow' | 'deny'; zdr?: boolean; require_parameters: boolean };
    temperature: number;
    max_tokens: number;
  };
  masked: MaskedSegment[];
  sentFingerprint: string;
  leaks: LeakFinding[];
}

/**
 * Builds the ONLY data that leaves the device: masked segment text, segment
 * ids, coarse timestamps, sanitized speaker roles and (optionally) masked
 * research context. Audio, file names, session titles, original text and the
 * identity map are never read here.
 */
export function buildAnalysisRequest(params: {
  project: Pick<Project, 'researchQuestion' | 'researchContext' | 'shareContext'>;
  session: Pick<InterviewSession, 'segments' | 'redaction'>;
  model: string;
  privacy: PrivacyOptions;
}): AnalysisRequest {
  const { project, session } = params;
  const spans = session.redaction?.spans ?? [];
  const identityMap = session.redaction?.identityMap ?? {};
  const masked = maskSegments(session.segments, spans, identityMap).map((segment) => ({
    ...segment,
    speaker: sanitizeSpeaker(segment.speaker),
  }));

  const transcript = masked.map((segment) => ({
    id: segment.id,
    t: Math.round(segment.startMs / 1000),
    ...(segment.speaker ? { speaker: segment.speaker } : {}),
    text: segment.text,
  }));

  const context = project.shareContext
    ? {
        research_question: maskFreeText(project.researchQuestion.trim(), spans, identityMap) || undefined,
        study_context: maskFreeText(project.researchContext.trim(), spans, identityMap) || undefined,
      }
    : undefined;

  const userContent = JSON.stringify({ ...(context ? { research_context: context } : {}), transcript });

  const leaks = findLeaks(
    [...masked, { id: 'research_context', startMs: 0, endMs: 0, text: context ? JSON.stringify(context) : '' }],
    spans,
  );

  return {
    body: {
      model: params.model,
      messages: [
        { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'interview_analysis', strict: true, schema: ANALYSIS_SCHEMA },
      },
      provider: {
        data_collection: params.privacy.denyDataCollection ? 'deny' : 'allow',
        ...(params.privacy.requireZdr ? { zdr: true } : {}),
        require_parameters: true,
      },
      temperature: 0.2,
      max_tokens: 6000,
    },
    masked,
    sentFingerprint: fingerprint(userContent),
    leaks,
  };
}
