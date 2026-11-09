import type { AnalysisResult } from '../../models/types';
import { safeErrorMessage } from '../../utils/safeError';
import { OPENROUTER_BASE_URL } from './models';
import type { AnalysisRequest } from './payload';
import { AnalysisShapeError, validateAnalysis } from './validate';

export type AnalysisErrorKind =
  | 'missing-key'
  | 'auth'
  | 'credits'
  | 'rate-limit'
  | 'timeout'
  | 'canceled'
  | 'offline'
  | 'privacy-routing'
  | 'provider'
  | 'truncated'
  | 'invalid-response';

export class AnalysisError extends Error {
  kind: AnalysisErrorKind;
  retryAfterSeconds?: number;
  constructor(kind: AnalysisErrorKind, message: string, retryAfterSeconds?: number) {
    super(message);
    this.name = 'AnalysisError';
    this.kind = kind;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export const DEFAULT_TIMEOUT_MS = 180_000;

function headers(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    // Optional OpenRouter attribution headers. They contain no user data.
    'X-Title': 'Interview Lens (SI 669)',
  };
}

function mapHttpError(status: number, providerMessage: string, retryAfter: string | null): AnalysisError {
  const detail = safeErrorMessage(providerMessage, '');
  if (status === 401 || status === 403) {
    return new AnalysisError('auth', 'OpenRouter rejected the API key. Check it in Settings.');
  }
  if (status === 402) {
    return new AnalysisError('credits', 'Your OpenRouter account has insufficient credits for this request.');
  }
  if (status === 408) return new AnalysisError('timeout', 'The provider timed out. Try again or pick a faster model.');
  if (status === 429) {
    const seconds = retryAfter ? Number.parseInt(retryAfter, 10) : undefined;
    return new AnalysisError(
      'rate-limit',
      `Rate limited by OpenRouter.${seconds ? ` Try again in about ${seconds} s.` : ' Wait a moment and try again.'}`,
      Number.isFinite(seconds) ? seconds : undefined,
    );
  }
  if (status === 404 && /data policy|zdr|zero data|no endpoints/i.test(providerMessage)) {
    return new AnalysisError(
      'privacy-routing',
      'No provider for this model satisfies your privacy settings (no data collection / ZDR). Choose another model or relax the setting.',
    );
  }
  return new AnalysisError('provider', `The provider returned an error (${status}). ${detail}`.trim());
}

async function postJson(url: string, apiKey: string, body: unknown, signal: AbortSignal) {
  try {
    return await fetch(url, { method: 'POST', headers: headers(apiKey), body: JSON.stringify(body), signal });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new AnalysisError('offline', 'Could not reach OpenRouter. Check your connection; nothing was sent.');
  }
}

/**
 * Sends the reviewed, masked request directly to OpenRouter over HTTPS and
 * validates the structured response.
 */
export async function requestAnalysis(params: {
  apiKey: string | null;
  request: AnalysisRequest;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<AnalysisResult> {
  if (!params.apiKey) throw new AnalysisError('missing-key', 'Add your OpenRouter API key in Settings first.');
  if (params.request.leaks.length > 0) {
    throw new AnalysisError('invalid-response', 'Unmasked identifiers remain in the cloud-bound text. Re-run privacy review.');
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, params.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  params.signal?.addEventListener('abort', onAbort, { once: true });

  try {
    const response = await postJson(
      `${OPENROUTER_BASE_URL}/chat/completions`,
      params.apiKey,
      params.request.body,
      controller.signal,
    );
    const text = await response.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }

    if (!response.ok) {
      throw mapHttpError(response.status, json?.error?.message ?? '', response.headers.get('retry-after'));
    }
    if (json?.error) {
      const code = Number(json.error.code) || 502;
      throw mapHttpError(code, String(json.error.message ?? ''), null);
    }

    const choice = json?.choices?.[0];
    const content: unknown = choice?.message?.content;
    if (choice?.finish_reason === 'length') {
      throw new AnalysisError('truncated', 'The response was cut off. Try a model with a larger output limit.');
    }
    if (typeof content !== 'string' || !content.trim()) {
      throw new AnalysisError('invalid-response', 'The provider returned an empty response.');
    }

    return validateAnalysis(content, params.request.masked, {
      model: typeof json.model === 'string' ? json.model : params.request.body.model,
      sentFingerprint: params.request.sentFingerprint,
      usage: {
        promptTokens: json.usage?.prompt_tokens,
        completionTokens: json.usage?.completion_tokens,
        cost: typeof json.usage?.cost === 'number' ? json.usage.cost : undefined,
      },
    });
  } catch (error) {
    if (error instanceof AnalysisError) throw error;
    if (error instanceof AnalysisShapeError) {
      throw new AnalysisError('invalid-response', `The model's analysis did not match the expected format: ${error.message}`);
    }
    if (controller.signal.aborted) {
      throw timedOut
        ? new AnalysisError('timeout', 'The analysis request timed out. Nothing was saved; try again.')
        : new AnalysisError('canceled', 'Analysis canceled.');
    }
    throw new AnalysisError('provider', safeErrorMessage(error, 'The analysis request failed.'));
  } finally {
    clearTimeout(timer);
    params.signal?.removeEventListener('abort', onAbort);
  }
}

/** Checks an API key without sending any research data. */
export async function verifyApiKey(apiKey: string): Promise<{ label?: string; limitRemaining?: number | null }> {
  let response: Response;
  try {
    response = await fetch(`${OPENROUTER_BASE_URL}/key`, { headers: headers(apiKey) });
  } catch {
    throw new AnalysisError('offline', 'Could not reach OpenRouter.');
  }
  if (!response.ok) throw mapHttpError(response.status, '', response.headers.get('retry-after'));
  const json: any = await response.json().catch(() => ({}));
  return { label: json?.data?.label, limitRemaining: json?.data?.limit_remaining ?? null };
}
