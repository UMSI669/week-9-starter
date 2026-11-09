import type { AnalysisResult, MaskedSegment, ResearchCode, SupportingQuote, Theme } from '../../models/types';
import { newId, nowIso } from '../../utils/ids';

export class AnalysisShapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AnalysisShapeError';
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, field: string): string => {
  if (typeof v !== 'string') throw new AnalysisShapeError(`Field "${field}" must be a string.`);
  return v.trim();
};
const strArray = (v: unknown, field: string): string[] => {
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) {
    throw new AnalysisShapeError(`Field "${field}" must be an array of strings.`);
  }
  return (v as string[]).map((x) => x.trim());
};
const arr = (v: unknown, field: string): unknown[] => {
  if (!Array.isArray(v)) throw new AnalysisShapeError(`Field "${field}" must be an array.`);
  return v;
};

const normalizeQuote = (s: string) =>
  s
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/^["'\s.…]+|["'\s.…]+$/g, '')
    .toLowerCase();

/**
 * Validates the model's JSON against the expected shape and links everything
 * to real transcript segment ids. Unknown ids are dropped with a warning;
 * quotes that are not verbatim excerpts are kept but flagged.
 */
export function validateAnalysis(
  raw: string,
  masked: MaskedSegment[],
  meta: { model: string; sentFingerprint: string; usage?: AnalysisResult['usage'] },
): AnalysisResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    try {
      parsed = start !== -1 && end > start ? JSON.parse(raw.slice(start, end + 1)) : undefined;
    } catch {
      parsed = undefined;
    }
    if (parsed === undefined) throw new AnalysisShapeError('The model did not return valid JSON.');
  }
  if (!isObject(parsed)) throw new AnalysisShapeError('The model response is not a JSON object.');

  const warnings: string[] = [];
  const segmentIds = new Set(masked.map((s) => s.id));
  const textById = new Map(masked.map((s) => [s.id, normalizeQuote(s.text)]));

  const summary = str(parsed.summary, 'summary');

  const codeIdMap = new Map<string, string>();
  const codes: ResearchCode[] = arr(parsed.codes, 'codes').map((item, i) => {
    if (!isObject(item)) throw new AnalysisShapeError(`codes[${i}] must be an object.`);
    const modelId = str(item.id, `codes[${i}].id`) || `C${i + 1}`;
    const ids = strArray(item.segment_ids, `codes[${i}].segment_ids`);
    const valid = ids.filter((id) => segmentIds.has(id));
    if (valid.length < ids.length) {
      warnings.push(`Code "${str(item.label, 'label')}" referenced ${ids.length - valid.length} unknown segment id(s); they were removed.`);
    }
    const id = newId('code');
    codeIdMap.set(modelId, id);
    return {
      id,
      label: str(item.label, `codes[${i}].label`),
      description: str(item.description, `codes[${i}].description`),
      segmentIds: [...new Set(valid)],
      origin: 'ai',
      status: 'suggested',
    };
  });

  const mapCodeIds = (ids: string[], where: string) => {
    const mapped = ids.map((id) => codeIdMap.get(id)).filter((id): id is string => Boolean(id));
    if (mapped.length < ids.length) warnings.push(`${where} referenced unknown code id(s); they were removed.`);
    return [...new Set(mapped)];
  };

  const themes: Theme[] = arr(parsed.themes, 'themes').map((item, i) => {
    if (!isObject(item)) throw new AnalysisShapeError(`themes[${i}] must be an object.`);
    const title = str(item.title, `themes[${i}].title`);
    return {
      id: newId('theme'),
      title,
      description: str(item.description, `themes[${i}].description`),
      codeIds: mapCodeIds(strArray(item.code_ids, `themes[${i}].code_ids`), `Theme "${title}"`),
      origin: 'ai',
      status: 'suggested',
    };
  });

  const quotes: SupportingQuote[] = [];
  arr(parsed.quotes, 'quotes').forEach((item, i) => {
    if (!isObject(item)) throw new AnalysisShapeError(`quotes[${i}] must be an object.`);
    const segmentId = str(item.segment_id, `quotes[${i}].segment_id`);
    const text = str(item.text, `quotes[${i}].text`);
    if (!segmentIds.has(segmentId)) {
      warnings.push(`A quote referenced unknown segment "${segmentId}" and was removed.`);
      return;
    }
    const verbatim = (textById.get(segmentId) ?? '').includes(normalizeQuote(text));
    if (!verbatim) warnings.push(`A quote attributed to ${segmentId} is not a verbatim excerpt; review it before use.`);
    quotes.push({
      id: newId('quote'),
      segmentId,
      text,
      codeIds: mapCodeIds(strArray(item.code_ids, `quotes[${i}].code_ids`), `Quote from ${segmentId}`),
      verbatim,
    });
  });

  return {
    id: newId('analysis'),
    provider: 'openrouter',
    model: meta.model,
    createdAt: nowIso(),
    summary,
    codes,
    themes,
    quotes,
    warnings,
    sentFingerprint: meta.sentFingerprint,
    usage: meta.usage,
    editedByResearcher: false,
  };
}
