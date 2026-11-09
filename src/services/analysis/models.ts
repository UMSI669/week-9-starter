/**
 * Curated OpenRouter models for qualitative analysis. All support
 * `response_format: json_schema` (structured outputs) on OpenRouter.
 * Prices are USD per million tokens as listed by OpenRouter (Nov 2026) and are
 * shown only as guidance; the researcher's OpenRouter account is billed.
 *
 * A 60-minute interview is roughly 10–15k input tokens, so a Sonnet run costs
 * a few cents.
 */
export interface CloudModelOption {
  id: string;
  name: string;
  blurb: string;
  inputPerM: number;
  outputPerM: number;
}

export const CLOUD_MODELS: CloudModelOption[] = [
  {
    id: 'anthropic/claude-sonnet-5.5',
    name: 'Claude Sonnet 5.5',
    blurb: 'Recommended. Strong qualitative reasoning and reliable structured output at moderate cost.',
    inputPerM: 2,
    outputPerM: 10,
  },
  {
    id: 'anthropic/claude-haiku-5.5',
    name: 'Claude Haiku 5.5',
    blurb: 'Lowest cost. Good for a quick first pass or many short interviews.',
    inputPerM: 0.1,
    outputPerM: 0.5,
  },
  {
    id: 'anthropic/claude-opus-5.5',
    name: 'Claude Opus 5.5',
    blurb: 'Deepest synthesis for complex studies. Highest cost.',
    inputPerM: 4,
    outputPerM: 20,
  },
  {
    id: 'google/gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    blurb: 'Alternative provider with a long context window.',
    inputPerM: 1.5,
    outputPerM: 9,
  },
];

export const DEFAULT_CLOUD_MODEL = CLOUD_MODELS[0].id;

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export function isPlausibleModelId(id: string): boolean {
  return /^[a-z0-9][a-z0-9._-]*\/[a-zA-Z0-9._:-]+$/.test(id.trim());
}
