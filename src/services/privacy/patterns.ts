import type { EntityCategory, KnownIdentifier, SpanSource, TranscriptSegment } from '../../models/types';

/** A detected sensitive span before ids / statuses are assigned. */
export interface SpanCandidate {
  segmentId: string;
  start: number;
  end: number;
  text: string;
  category: EntityCategory;
  source: SpanSource;
}

/**
 * Capitalized words that commonly start sentences or follow "I'm" and must not
 * be mistaken for names by the simplified heuristics.
 */
export const NAME_STOPWORDS = new Set(
  [
    'i', 'im', 'a', 'an', 'the', 'so', 'sure', 'just', 'not', 'really', 'honestly', 'actually', 'well', 'yes',
    'yeah', 'no', 'okay', 'ok', 'and', 'but', 'or', 'then', 'like', 'also', 'still', 'here', 'there', 'that',
    'this', 'it', 'its', 'my', 'our', 'we', 'you', 'he', 'she', 'they', 'his', 'her', 'their', 'happy', 'glad',
    'sorry', 'good', 'great', 'fine', 'thanks', 'thank', 'hello', 'hi', 'monday', 'tuesday', 'wednesday',
    'thursday', 'friday', 'saturday', 'sunday', 'doctor', 'nurse', 'mom', 'dad', 'god', 'last', 'next', 'every',
    'usually', 'always', 'never', 'maybe', 'probably', 'definitely', 'from', 'with', 'about', 'going', 'trying',
    'pretty', 'kind', 'interviewer', 'participant', 'speaker', 'one', 'two', 'three', 'four', 'five',
  ],
);

const NAME = String.raw`[A-Z][a-zA-Z]+(?:[-'’][A-Z][a-zA-Z]+)?`;
const FULL_NAME = String.raw`${NAME}(?:\s+${NAME}){0,2}`;
const MONTH = String.raw`(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)`;
const STREET_SUFFIX = String.raw`(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Way|Place|Pl|Parkway|Pkwy|Highway|Hwy)`;
const ORG_SUFFIX = String.raw`(?:Hospital|Clinic|University|College|School|Academy|Inc|LLC|Ltd|Corp|Corporation|Company|Co|Bank|Credit Union|Logistics|Group|Labs?|Center|Centre|Foundation|Institute|Agency|Associates|Partners|Technologies|Systems|Health|Healthcare|Pharmacy|Church|Department|Studios?|Consulting|Industries|Motors|Airlines|Insurance)`;

interface PatternRule {
  category: EntityCategory;
  regex: RegExp;
  /** Capture group holding the sensitive part (0 = whole match). */
  group?: number;
  /** Return false to discard a match. */
  accept?: (value: string) => boolean;
}

const acceptName = (value: string) => {
  const first = value.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '') ?? '';
  return first.length > 1 && !NAME_STOPWORDS.has(first);
};

export const PATTERN_RULES: PatternRule[] = [
  { category: 'EMAIL', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { category: 'URL', regex: /\b(?:https?:\/\/|www\.)[^\s,;)]+[^\s,;).!?]/gi },
  { category: 'ID', regex: /\b\d{3}-\d{2}-\d{4}\b/g },
  {
    category: 'PHONE',
    regex: /(?:\+?1[\s.-]?)?(?:\(\d{3}\)\s?|\b\d{3}[\s.-])\d{3}[\s.-]\d{4}\b/g,
  },
  { category: 'PHONE', regex: /\+\d{1,3}(?:[\s.-]?\d{2,4}){2,4}\b/g },
  {
    category: 'ID',
    regex: /\b(?:MRN|SSN|ID|patient ID|member ID|employee ID|student ID|account|case|policy|license|passport|badge)\s*(?:number|no\.?|#)?\s*(?:is\s+)?[:#]?\s*([A-Z]{0,3}\d[A-Z0-9-]{3,})\b/gi,
    group: 1,
  },
  { category: 'ID', regex: /\b\d{7,}\b/g },
  {
    category: 'DATE',
    regex: new RegExp(String.raw`\b${MONTH}\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+(?:19|20)\d{2}\b`, 'g'),
  },
  {
    category: 'DATE',
    regex: new RegExp(String.raw`\b\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?${MONTH}\.?,?\s+(?:19|20)\d{2}\b`, 'g'),
  },
  { category: 'DATE', regex: /\b\d{1,2}\/\d{1,2}\/(?:19|20)?\d{2}\b/g },
  {
    category: 'ADDRESS',
    regex: new RegExp(String.raw`\b\d{1,5}\s+(?:[A-Z][a-z]+\s){1,3}${STREET_SUFFIX}\b\.?`, 'g'),
  },
  {
    category: 'PERSON',
    regex: new RegExp(String.raw`\b(?:Mr|Mrs|Ms|Mx|Miss|Dr|Doctor|Prof|Professor|Nurse|Coach)\.?\s+(${FULL_NAME})`, 'g'),
    group: 1,
    accept: acceptName,
  },
  {
    category: 'PERSON',
    regex: new RegExp(String.raw`\b(?:[Mm]y name is|[Mm]y name's|I'm|I am|[Tt]his is|[Cc]all me|[Nn]amed|[Cc]alled)\s+(${FULL_NAME})`, 'g'),
    group: 1,
    accept: acceptName,
  },
  {
    category: 'PERSON',
    regex: new RegExp(
      String.raw`\b(?:[Mm]y|[Oo]ur|[Hh]is|[Hh]er|[Tt]heir)\s+(?:son|daughter|kid|child|wife|husband|partner|spouse|fianc[eé]e?|boyfriend|girlfriend|mom|mother|dad|father|brother|sister|friend|neighbou?r|manager|boss|supervisor|coworker|co-worker|colleague|doctor|therapist|teacher|cousin|aunt|uncle|grandma|grandmother|grandpa|grandfather|roommate|landlord|caseworker)\s*,?\s+(${FULL_NAME})`,
      'g',
    ),
    group: 1,
    accept: acceptName,
  },
  {
    category: 'ORG',
    regex: new RegExp(String.raw`\b(?:[A-Z][A-Za-z&'’-]+\s+){1,4}${ORG_SUFFIX}\b`, 'g'),
    accept: (value) => !NAME_STOPWORDS.has(value.split(/\s+/)[0].toLowerCase()),
  },
  {
    category: 'LOCATION',
    regex: new RegExp(String.raw`\b(?:[A-Z][a-z]+\s){1,2}${STREET_SUFFIX}\b`, 'g'),
  },
  {
    category: 'LOCATION',
    regex: /\b(?:live in|living in|lives in|lived in|I'm from|from|moved to|move to|based in|grew up in|born in|near|downtown)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/g,
    group: 1,
    accept: (value) => !NAME_STOPWORDS.has(value.split(/\s+/)[0].toLowerCase()),
  },
];

/** Removes a trailing possessive ("Patel's" -> "Patel") and surrounding punctuation. */
function trimEntity(text: string, start: number): { text: string; start: number } {
  let value = text;
  let offset = start;
  const leading = value.match(/^[\s"'“‘]+/);
  if (leading) {
    value = value.slice(leading[0].length);
    offset += leading[0].length;
  }
  value = value.replace(/(?:['’]s)?[\s.,;:!?"'”’]*$/, '');
  if (value.endsWith(')') && !value.includes('(')) value = value.slice(0, -1);
  return { text: value, start: offset };
}

export function detectPatternSpans(segments: TranscriptSegment[]): SpanCandidate[] {
  const out: SpanCandidate[] = [];
  for (const segment of segments) {
    for (const rule of PATTERN_RULES) {
      rule.regex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = rule.regex.exec(segment.text)) !== null) {
        if (match[0].length === 0) {
          rule.regex.lastIndex += 1;
          continue;
        }
        const group = rule.group ?? 0;
        const raw = match[group];
        if (!raw) continue;
        const rawStart = group === 0 ? match.index : match.index + match[0].indexOf(raw);
        const trimmed = trimEntity(raw, rawStart);
        if (trimmed.text.length < 2) continue;
        if (rule.accept && !rule.accept(trimmed.text)) continue;
        out.push({
          segmentId: segment.id,
          start: trimmed.start,
          end: trimmed.start + trimmed.text.length,
          text: trimmed.text,
          category: rule.category,
          source: 'pattern',
        });
      }
    }
  }
  return out;
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Finds whole-word, case-insensitive occurrences of `needle` in `haystack`. */
export function findWholeWord(haystack: string, needle: string): { start: number; end: number }[] {
  const trimmed = needle.trim();
  if (!trimmed) return [];
  const pattern = escapeRegExp(trimmed).replace(/\s+/g, '\\s+');
  const regex = new RegExp(`(?<![\\p{L}\\p{N}_])${pattern}(?![\\p{L}\\p{N}_])`, 'giu');
  const results: { start: number; end: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(haystack)) !== null) {
    results.push({ start: match.index, end: match.index + match[0].length });
  }
  return results;
}

export function detectKnownIdentifiers(
  segments: TranscriptSegment[],
  identifiers: KnownIdentifier[],
): SpanCandidate[] {
  const out: SpanCandidate[] = [];
  for (const identifier of identifiers) {
    for (const segment of segments) {
      for (const hit of findWholeWord(segment.text, identifier.text)) {
        out.push({
          segmentId: segment.id,
          start: hit.start,
          end: hit.end,
          text: segment.text.slice(hit.start, hit.end),
          category: identifier.category,
          source: 'known-identifier',
        });
      }
    }
  }
  return out;
}
