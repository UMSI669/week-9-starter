/**
 * Local data models. Everything here is stored only on the device.
 *
 * Fields marked SENSITIVE may contain participant-identifying information and
 * must never be placed in a cloud payload, analytics event, or error log.
 */

export type ISODate = string;

export interface Project {
  id: string;
  name: string;
  /** Research question shown to the cloud model only if `shareContext` is true. */
  researchQuestion: string;
  /** Extra researcher-approved context (study goals, product area). */
  researchContext: string;
  shareContext: boolean;
  /**
   * SENSITIVE. Names / organizations the researcher knows must always be
   * masked in this project (e.g. the participant's employer).
   */
  knownIdentifiers: KnownIdentifier[];
  isDemo: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface KnownIdentifier {
  id: string;
  text: string;
  category: EntityCategory;
}

export type AudioKind = 'bundled-sample' | 'imported' | 'recorded';

export interface AudioRef {
  kind: AudioKind;
  /** Local file URI inside the app sandbox. SENSITIVE (path can embed a filename). */
  uri: string;
  /** Bundled demo sample id, when kind === 'bundled-sample'. */
  sampleId?: string;
  /** SENSITIVE. The original file name chosen by the researcher. Never uploaded. */
  originalFilename?: string;
  mimeType?: string;
  durationMs?: number;
  sizeBytes?: number;
}

export type TranscriptSource =
  | 'demo-sample'
  | 'apple-on-device'
  | 'whisper-on-device'
  | 'manual';

export interface TranscriptSegment {
  /** Stable id (seg_001…). Cloud results reference these ids. */
  id: string;
  startMs: number;
  endMs: number;
  /** Optional, researcher-entered. Automatic speaker identification is out of scope. */
  speaker?: string;
  /** SENSITIVE. Current (possibly corrected) original wording. */
  text: string;
  /** SENSITIVE. Text exactly as the recognizer produced it, kept for auditing corrections. */
  recognizedText: string;
  edited: boolean;
}

export type EntityCategory =
  | 'PERSON'
  | 'EMAIL'
  | 'PHONE'
  | 'ID'
  | 'ORG'
  | 'LOCATION'
  | 'ADDRESS'
  | 'URL'
  | 'DATE'
  | 'CONTEXT';

export type SpanSource = 'pattern' | 'known-identifier' | 'local-llm' | 'manual' | 'propagated';
export type SpanStatus = 'accepted' | 'rejected';

export interface RedactionSpan {
  id: string;
  segmentId: string;
  /** UTF-16 offsets into the segment's current `text`. */
  start: number;
  end: number;
  /** SENSITIVE. The original text being replaced. */
  text: string;
  category: EntityCategory;
  source: SpanSource;
  status: SpanStatus;
}

export type DetectorKind = 'patterns' | 'patterns+local-llm';

export interface RedactionState {
  spans: RedactionSpan[];
  /**
   * SENSITIVE identity mapping: normalized original value -> placeholder.
   * Keys are `${category}:${normalized}`. Kept stable across re-runs so that
   * [PERSON_01] keeps meaning the same person.
   */
  identityMap: Record<string, string>;
  detector: DetectorKind;
  localModelId?: string;
  detectedAt: ISODate;
  /** Fingerprint of the transcript the spans were computed against. */
  transcriptFingerprint: string;
  /** Set when the researcher approves the cloud-bound text. Cleared by any later edit. */
  reviewedAt: ISODate | null;
  reviewedFingerprint: string | null;
  stats?: { durationMs: number; chunks: number; llmEntities?: number };
}

export type SuggestionOrigin = 'ai' | 'researcher';
export type SuggestionStatus = 'suggested' | 'accepted' | 'rejected';

export interface ResearchCode {
  id: string;
  label: string;
  description: string;
  segmentIds: string[];
  origin: SuggestionOrigin;
  status: SuggestionStatus;
}

export interface Theme {
  id: string;
  title: string;
  description: string;
  codeIds: string[];
  origin: SuggestionOrigin;
  status: SuggestionStatus;
}

export interface SupportingQuote {
  id: string;
  segmentId: string;
  /** Masked quote text (as returned by the model, verified against the masked segment). */
  text: string;
  codeIds: string[];
  verbatim: boolean;
}

export interface AnalysisResult {
  id: string;
  provider: 'openrouter';
  model: string;
  createdAt: ISODate;
  summary: string;
  codes: ResearchCode[];
  themes: Theme[];
  quotes: SupportingQuote[];
  /** Validation notes (dropped unknown segment ids, non-verbatim quotes…). */
  warnings: string[];
  /** Fingerprint of the masked text that was sent. */
  sentFingerprint: string;
  usage?: { promptTokens?: number; completionTokens?: number; cost?: number };
  editedByResearcher: boolean;
}

export interface InterviewSession {
  id: string;
  projectId: string;
  /** Researcher-facing title. SENSITIVE (may contain names); never uploaded. */
  title: string;
  /** Pseudonymous label such as "P01". */
  participantLabel: string;
  isDemo: boolean;
  audio?: AudioRef;
  transcriptSource?: TranscriptSource;
  transcriptModel?: string;
  segments: TranscriptSegment[];
  redaction?: RedactionState;
  analysis?: AnalysisResult;
  researcherNotes: string;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface MaskedSegment {
  id: string;
  startMs: number;
  endMs: number;
  speaker?: string;
  text: string;
}
