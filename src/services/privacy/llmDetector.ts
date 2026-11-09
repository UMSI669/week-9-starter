import type { EntityCategory, TranscriptSegment } from '../../models/types';
import { NAME_STOPWORDS, type SpanCandidate } from './patterns';

/**
 * Model-agnostic local LLM entity detector. The actual llama.rn context is
 * injected as `complete`, so this file stays free of native imports (and is
 * unit-testable / safe in Expo Go).
 */

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type LlmComplete = (
  messages: LlmMessage[],
  options: { jsonSchema: object; maxTokens: number; signal?: AbortSignal },
) => Promise<string>;

export const LLM_CATEGORIES: EntityCategory[] = [
  'PERSON', 'ORG', 'LOCATION', 'ADDRESS', 'PHONE', 'EMAIL', 'ID', 'DATE', 'URL', 'CONTEXT',
];

export const ENTITY_SCHEMA = {
  type: 'object',
  properties: {
    entities: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          segment_id: { type: 'string' },
          text: { type: 'string' },
          category: { type: 'string', enum: LLM_CATEGORIES },
        },
        required: ['segment_id', 'text', 'category'],
      },
    },
  },
  required: ['entities'],
} as const;

export const DETECTOR_SYSTEM_PROMPT = `You detect personally identifying details in research interview transcripts so they can be pseudonymized.
Return JSON only, matching the schema. Copy every entity EXACTLY as it is written in the transcript (same spelling and capitalization).
Categories:
- PERSON: names of people (first, last, nicknames). Not roles like "my doctor".
- ORG: named employers, companies, schools, hospitals, clinics, agencies.
- LOCATION: named cities, neighborhoods, streets, buildings, landmarks.
- ADDRESS: street addresses.
- PHONE, EMAIL, URL, ID (patient/account/employee/student numbers), DATE (birth dates or specific dates tied to the person).
- CONTEXT: rare details that could identify the participant on their own (for example "the only pediatric surgeon in town").
Do not return generic words, pronouns, product categories, or common nouns. If nothing is identifying, return {"entities": []}.`;

export interface Chunk {
  segments: TranscriptSegment[];
  chars: number;
}

/** Groups whole segments into prompt-sized chunks (small models have short contexts). */
export function chunkSegments(segments: TranscriptSegment[], maxChars = 1400): Chunk[] {
  const chunks: Chunk[] = [];
  let current: Chunk = { segments: [], chars: 0 };
  for (const segment of segments) {
    const size = segment.text.length + segment.id.length + 4;
    if (current.segments.length > 0 && current.chars + size > maxChars) {
      chunks.push(current);
      current = { segments: [], chars: 0 };
    }
    current.segments.push(segment);
    current.chars += size;
  }
  if (current.segments.length > 0) chunks.push(current);
  return chunks;
}

export function buildChunkPrompt(chunk: Chunk, knownEntities: string[]): string {
  const known = knownEntities.length
    ? `Entities already found earlier in this interview (also mark them again if they appear): ${knownEntities.slice(0, 40).join('; ')}\n\n`
    : '';
  const lines = chunk.segments.map((s) => `[${s.id}] ${s.text}`).join('\n');
  return `${known}Transcript:\n${lines}`;
}

interface RawEntity {
  segment_id?: unknown;
  text?: unknown;
  category?: unknown;
}

/** Parses model output defensively (small models sometimes wrap JSON in prose). */
export function parseEntities(output: string): RawEntity[] {
  const start = output.indexOf('{');
  const end = output.lastIndexOf('}');
  if (start === -1 || end <= start) return [];
  try {
    const parsed = JSON.parse(output.slice(start, end + 1)) as { entities?: unknown };
    return Array.isArray(parsed.entities) ? (parsed.entities as RawEntity[]) : [];
  } catch {
    return [];
  }
}

/**
 * Converts model entities to spans. Entities that do not literally occur in
 * the chunk are discarded, so a hallucinating model can never inject text.
 */
export function locateEntities(chunk: Chunk, entities: RawEntity[]): SpanCandidate[] {
  const out: SpanCandidate[] = [];
  for (const entity of entities) {
    if (typeof entity.text !== 'string' || typeof entity.category !== 'string') continue;
    const text = entity.text.trim();
    const category = entity.category.toUpperCase() as EntityCategory;
    if (!LLM_CATEGORIES.includes(category)) continue;
    if (text.length < 2 || NAME_STOPWORDS.has(text.toLowerCase())) continue;
    const preferred = chunk.segments.find((s) => s.id === entity.segment_id);
    const ordered = preferred ? [preferred, ...chunk.segments.filter((s) => s !== preferred)] : chunk.segments;
    for (const segment of ordered) {
      let index = segment.text.indexOf(text);
      if (index === -1) index = segment.text.toLowerCase().indexOf(text.toLowerCase());
      if (index === -1) continue;
      out.push({
        segmentId: segment.id,
        start: index,
        end: index + text.length,
        text: segment.text.slice(index, index + text.length),
        category,
        source: 'local-llm',
      });
      break;
    }
  }
  return out;
}

export interface LlmDetectionProgress {
  chunkIndex: number;
  chunkCount: number;
}

export async function detectWithLlm(options: {
  segments: TranscriptSegment[];
  complete: LlmComplete;
  seedEntities?: string[];
  maxChars?: number;
  signal?: AbortSignal;
  onProgress?: (progress: LlmDetectionProgress) => void;
}): Promise<{ spans: SpanCandidate[]; chunks: number }> {
  const chunks = chunkSegments(options.segments, options.maxChars);
  const known = new Set(options.seedEntities ?? []);
  const spans: SpanCandidate[] = [];
  for (let i = 0; i < chunks.length; i += 1) {
    if (options.signal?.aborted) {
      const error = new Error('Detection canceled.');
      error.name = 'AbortError';
      throw error;
    }
    options.onProgress?.({ chunkIndex: i, chunkCount: chunks.length });
    const output = await options.complete(
      [
        { role: 'system', content: DETECTOR_SYSTEM_PROMPT },
        { role: 'user', content: buildChunkPrompt(chunks[i], [...known]) },
      ],
      { jsonSchema: ENTITY_SCHEMA, maxTokens: 512, signal: options.signal },
    );
    const located = locateEntities(chunks[i], parseEntities(output));
    for (const span of located) known.add(span.text);
    spans.push(...located);
  }
  options.onProgress?.({ chunkIndex: chunks.length, chunkCount: chunks.length });
  return { spans, chunks: chunks.length };
}
