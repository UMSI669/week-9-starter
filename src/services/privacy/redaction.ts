import type {
  EntityCategory,
  KnownIdentifier,
  RedactionSpan,
  RedactionState,
  TranscriptSegment,
} from '../../models/types';
import { fingerprint, newId, nowIso } from '../../utils/ids';
import { detectWithLlm, type LlmComplete, type LlmDetectionProgress } from './llmDetector';
import { detectKnownIdentifiers, detectPatternSpans, findWholeWord, type SpanCandidate } from './patterns';
import { assignPlaceholders, maskSegments } from './placeholders';
import { mergeCandidates, propagateEntities, reconcileSpans, spanKey } from './spans';

export function transcriptFingerprint(segments: TranscriptSegment[]): string {
  return fingerprint(segments.map((s) => `${s.id}\u0001${s.speaker ?? ''}\u0001${s.text}`).join('\u0002'));
}

export interface DetectionOptions {
  segments: TranscriptSegment[];
  knownIdentifiers: KnownIdentifier[];
  previous?: RedactionState;
  /** Supplied only in a development build with a downloaded local model. */
  llm?: { complete: LlmComplete; modelId: string };
  signal?: AbortSignal;
  onProgress?: (progress: LlmDetectionProgress) => void;
}

/**
 * Runs the privacy pipeline: TypeScript patterns + known identifiers
 * (+ optional local LLM) -> transcript-wide propagation -> overlap resolution
 * -> stable placeholders. Researcher decisions from a previous run (rejected
 * spans, manual spans) are preserved.
 */
export async function runDetection(options: DetectionOptions): Promise<RedactionState> {
  const startedAt = Date.now();
  const { segments, previous } = options;

  const candidates: SpanCandidate[] = [
    ...detectPatternSpans(segments),
    ...detectKnownIdentifiers(segments, options.knownIdentifiers),
  ];

  let chunks = 0;
  let llmEntities: number | undefined;
  if (options.llm) {
    const seeds = [...new Set(candidates.map((c) => c.text))];
    const result = await detectWithLlm({
      segments,
      complete: options.llm.complete,
      seedEntities: seeds,
      signal: options.signal,
      onProgress: options.onProgress,
    });
    chunks = result.chunks;
    llmEntities = result.spans.length;
    candidates.push(...result.spans);
  }

  const previousSpans = previous ? reconcileSpans(segments, previous.spans) : [];
  const manual = previousSpans.filter((s) => s.source === 'manual');
  const rejected = previousSpans.filter((s) => s.status === 'rejected');
  const rejectedKeys = new Set(rejected.map(spanKey));
  const rejectedTexts = new Set(
    rejected.filter((s) => s.source === 'manual' || s.source === 'propagated').map((s) => s.text.toLowerCase()),
  );

  candidates.push(...manual);
  const propagated = propagateEntities(segments, candidates, rejectedTexts);
  const merged = mergeCandidates([...candidates, ...propagated]);

  const previousById = new Map(previousSpans.map((s) => [spanKey(s), s]));
  const spans: RedactionSpan[] = merged.map((candidate) => {
    const prior = previousById.get(spanKey(candidate));
    return {
      id: prior?.id ?? newId('span'),
      segmentId: candidate.segmentId,
      start: candidate.start,
      end: candidate.end,
      text: candidate.text,
      category: candidate.category,
      source: candidate.source,
      status: rejectedKeys.has(spanKey(candidate)) ? 'rejected' : (prior?.status ?? 'accepted'),
    };
  });

  const identityMap = assignPlaceholders(spans, previous?.identityMap ?? {});

  return {
    spans,
    identityMap,
    detector: options.llm ? 'patterns+local-llm' : 'patterns',
    localModelId: options.llm?.modelId,
    detectedAt: nowIso(),
    transcriptFingerprint: transcriptFingerprint(segments),
    reviewedAt: null,
    reviewedFingerprint: null,
    stats: { durationMs: Date.now() - startedAt, chunks, llmEntities },
  };
}

/** Adds a researcher-specified phrase as manual spans everywhere it appears. */
export function addManualPhrase(
  state: RedactionState,
  segments: TranscriptSegment[],
  phrase: string,
  category: EntityCategory,
): { state: RedactionState; added: number } {
  const current = reconcileSpans(segments, state.spans);
  const additions: RedactionSpan[] = [];
  for (const segment of segments) {
    for (const hit of findWholeWord(segment.text, phrase)) {
      additions.push({
        id: newId('span'),
        segmentId: segment.id,
        start: hit.start,
        end: hit.end,
        text: segment.text.slice(hit.start, hit.end),
        category,
        source: 'manual',
        status: 'accepted',
      });
    }
  }
  if (additions.length === 0) return { state, added: 0 };
  const spans = mergeCandidates([...current, ...additions]);
  return {
    state: {
      ...state,
      spans,
      identityMap: assignPlaceholders(spans, state.identityMap),
      reviewedAt: null,
      reviewedFingerprint: null,
    },
    added: additions.filter((a) => spans.includes(a)).length,
  };
}

export function setSpanStatus(state: RedactionState, spanIds: string[], status: RedactionSpan['status']): RedactionState {
  const ids = new Set(spanIds);
  const spans = state.spans.map((s) => (ids.has(s.id) ? { ...s, status } : s));
  return {
    ...state,
    spans,
    identityMap: assignPlaceholders(spans, state.identityMap),
    reviewedAt: null,
    reviewedFingerprint: null,
  };
}

export function setSpanCategory(state: RedactionState, spanIds: string[], category: EntityCategory): RedactionState {
  const ids = new Set(spanIds);
  const spans = state.spans.map((s) => (ids.has(s.id) ? { ...s, category } : s));
  return {
    ...state,
    spans,
    identityMap: assignPlaceholders(spans, state.identityMap),
    reviewedAt: null,
    reviewedFingerprint: null,
  };
}

/** Fingerprint of the exact cloud-bound text; approval is valid only while it matches. */
export function reviewFingerprint(segments: TranscriptSegment[], redaction: Pick<RedactionState, 'spans' | 'identityMap'>): string {
  return fingerprint(JSON.stringify(maskSegments(segments, redaction.spans, redaction.identityMap)));
}

export function isApproved(segments: TranscriptSegment[], redaction: RedactionState | undefined): boolean {
  return Boolean(redaction?.reviewedAt && redaction.reviewedFingerprint === reviewFingerprint(segments, redaction));
}
