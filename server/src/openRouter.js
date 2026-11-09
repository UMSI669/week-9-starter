/**
 * OpenRouter client.
 *
 * Text analysis   -> POST {baseUrl}/chat/completions
 * Transcription   -> POST {baseUrl}/audio/transcriptions   (optional)
 *
 * These are two independent model choices. No model is assumed to do both.
 *
 * There is no automatic retry anywhere in this file. Both calls may be
 * billable, and silently repeating a billable call is how a bug becomes an
 * invoice. A failure is returned to the caller, who can decide.
 */

import { config } from './config.js';
import { ANALYSIS_JSON_SCHEMA, parseModelJson, validateAnalysis } from './validateAnalysis.js';
import { CATEGORY_LABELS } from './categories.js';
import { SYSTEM_PROMPT, buildUserMessage } from './prompts.js';
import { httpError, sanitizeMessage } from './middleware.js';

function authHeaders() {
  const headers = {
    Authorization: `Bearer ${config.openRouter.apiKey}`,
    'X-Title': config.openRouter.appTitle,
  };
  if (config.openRouter.siteUrl) headers['HTTP-Referer'] = config.openRouter.siteUrl;
  return headers;
}

/**
 * @param {object} input
 * @param {string} input.transcript The reviewed dream text.
 * @param {string} input.model      Already checked against the allowlist.
 */
export async function analyzeDream({ transcript, model }) {
  const body = {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserMessage({ transcript, categoryLabels: CATEGORY_LABELS }) },
    ],
    temperature: 0.7,
    max_tokens: 700,
    // A strict JSON schema when the selected model supports structured
    // outputs. Server-side validation runs either way, because support varies
    // by model and by the provider serving it, and "strict" is a request, not
    // a promise.
    ...(config.openRouter.structuredOutputs
      ? { response_format: { type: 'json_schema', json_schema: ANALYSIS_JSON_SCHEMA } }
      : null),
  };

  const started = Date.now();
  let response;
  try {
    response = await fetch(`${config.openRouter.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(config.limits.analysisTimeoutMs),
    });
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      throw httpError(504, 'upstream_timeout', 'The analysis service took too long to respond.');
    }
    throw httpError(
      502,
      'upstream_unreachable',
      'The analysis service could not be reached. Check the backend’s network access.',
    );
  }

  const responseText = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(responseText);
  } catch (_error) {
    payload = null;
  }

  if (!response.ok) {
    // A 400 about response_format means the chosen model cannot do structured
    // outputs. Say so precisely and name the switch, rather than retrying:
    // the retry would be a second billable call the operator did not ask for.
    if (response.status === 400 && mentionsResponseFormat(payload)) {
      throw httpError(
        502,
        'model_lacks_structured_outputs',
        'That model does not support structured JSON outputs. Either choose a model that does, ' +
          'or set OPENROUTER_STRUCTURED_OUTPUTS=off in server/.env to use prompt-only JSON ' +
          '(the server still validates every field).',
      );
    }
    throw upstreamError(response.status, payload);
  }

  const content = payload?.choices?.[0]?.message?.content;
  const parsed = parseModelJson(typeof content === 'string' ? content : '');
  if (!parsed.ok) {
    logAnalysis({ model, transcript, started, outcome: 'unparseable' });
    throw httpError(
      502,
      'invalid_model_output',
      'The model did not return usable JSON. Nothing was saved. You can try again, or save the transcript on its own.',
    );
  }

  const validated = validateAnalysis(parsed.value);
  if (!validated.ok) {
    logAnalysis({ model, transcript, started, outcome: 'invalid', errors: validated.errors });
    throw httpError(
      502,
      'invalid_model_output',
      `The model’s reflection did not pass validation (${validated.errors[0]}). Nothing was saved.`,
    );
  }

  logAnalysis({ model, transcript, started, outcome: 'ok' });

  return {
    ...validated.value,
    analysisModel: typeof payload?.model === 'string' ? payload.model : model,
  };
}

/**
 * @param {object} input
 * @param {Buffer} input.buffer
 * @param {string} input.filename
 * @param {string} input.mimeType
 * @param {string} input.model Already checked against the allowlist.
 */
export async function transcribeAudio({ buffer, filename, mimeType, model }) {
  const formData = new FormData();
  // Letting FormData/fetch own the Content-Type is deliberate: setting
  // multipart/form-data by hand omits the boundary and the upload fails.
  formData.append('file', new Blob([buffer], { type: mimeType }), filename);
  formData.append('model', model);

  const started = Date.now();
  let response;
  try {
    response = await fetch(`${config.openRouter.baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: { ...authHeaders(), Accept: 'application/json' },
      body: formData,
      signal: AbortSignal.timeout(config.limits.transcriptionTimeoutMs),
    });
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      throw httpError(
        504,
        'upstream_timeout',
        'The transcription service took too long to respond.',
      );
    }
    throw httpError(
      502,
      'upstream_unreachable',
      'The transcription service could not be reached.',
    );
  }

  const responseText = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(responseText);
  } catch (_error) {
    payload = null;
  }

  if (!response.ok) throw upstreamError(response.status, payload);

  if (typeof payload?.text !== 'string' || !payload.text.trim()) {
    throw httpError(
      502,
      'invalid_model_output',
      'The transcription service returned no text. The recording may have been silent.',
    );
  }

  if (config.verboseLogs) {
    console.log(
      `[transcribe] model=${model} bytes=${buffer.length} chars=${payload.text.length} ms=${Date.now() - started}`,
    );
  }

  return {
    text: payload.text.trim(),
    language: typeof payload.language === 'string' ? payload.language : null,
    model: typeof payload.model === 'string' ? payload.model : model,
  };
}

function mentionsResponseFormat(payload) {
  const message = `${payload?.error?.message || ''} ${payload?.message || ''}`.toLowerCase();
  return (
    message.includes('response_format') ||
    message.includes('json_schema') ||
    message.includes('structured output')
  );
}

function upstreamError(status, payload) {
  const providerMessage = sanitizeMessage(
    payload?.error?.message || payload?.message || '',
    'The service returned an error.',
  );

  if (status === 401 || status === 403) {
    return httpError(
      502,
      'upstream_auth',
      'The backend’s OpenRouter credentials were rejected. Check OPENROUTER_API_KEY on the server.',
    );
  }
  if (status === 402) {
    return httpError(
      502,
      'upstream_billing',
      'OpenRouter reported a credit or billing problem for this account.',
    );
  }
  if (status === 404) {
    return httpError(
      502,
      'upstream_model',
      'OpenRouter does not recognize that model ID. Check the configured model names.',
    );
  }
  if (status === 429) {
    return httpError(
      503,
      'upstream_rate_limited',
      'OpenRouter rate-limited this request. Wait a moment before trying again.',
    );
  }
  return httpError(502, 'upstream_error', `The service returned an error: ${providerMessage}`);
}

/** Lengths and timings only. Dream text and audio are never logged. */
function logAnalysis({ model, transcript, started, outcome, errors }) {
  if (!config.verboseLogs && outcome === 'ok') return;
  const detail = errors?.length ? ` first_error="${sanitizeMessage(errors[0])}"` : '';
  console.log(
    `[analyze] model=${model} chars=${transcript.length} ms=${Date.now() - started} outcome=${outcome}${detail}`,
  );
}
