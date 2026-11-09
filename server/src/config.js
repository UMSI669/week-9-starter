/**
 * Server configuration. The OpenRouter key is read here and nowhere else,
 * and never leaves this process in a response, a log line, or an error.
 */

import 'dotenv/config';

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function list(value) {
  return text(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const apiKey = text(process.env.OPENROUTER_API_KEY);
const analysisModel = text(process.env.OPENROUTER_ANALYSIS_MODEL);
const transcriptionModel = text(process.env.OPENROUTER_TRANSCRIPTION_MODEL);

export const config = {
  port: Number(process.env.PORT) || 3000,
  host: text(process.env.HOST) || '0.0.0.0',
  authToken: text(process.env.API_AUTH_TOKEN),

  openRouter: {
    apiKey,
    baseUrl: (text(process.env.OPENROUTER_BASE_URL) || 'https://openrouter.ai/api/v1').replace(
      /\/+$/,
      '',
    ),
    analysisModel,
    transcriptionModel,
    appTitle: text(process.env.OPENROUTER_APP_TITLE) || 'Dream Decoder',
    siteUrl: text(process.env.OPENROUTER_SITE_URL),
    /**
     * Whether to send a strict JSON schema with the analysis request.
     *
     * Structured-output support varies by model and by the provider serving
     * it, and a model that does not support it may reject the request
     * outright. Set OPENROUTER_STRUCTURED_OUTPUTS=off to fall back to
     * prompt-only JSON, which this server parses and validates just as
     * strictly. Server-side validation runs either way.
     */
    structuredOutputs: text(process.env.OPENROUTER_STRUCTURED_OUTPUTS).toLowerCase() !== 'off',
  },

  /**
   * Model allowlist. A client may only ask for a model named here, so a
   * compromised or curious client cannot turn this into an open proxy to
   * every model in the catalog.
   */
  allowedModels: Array.from(
    new Set([...list(process.env.OPENROUTER_ALLOWED_MODELS), analysisModel, transcriptionModel]),
  ).filter(Boolean),

  limits: {
    maxTranscriptChars: 6000,
    maxRequestBytes: 32 * 1024,
    maxAudioBytes: 20 * 1024 * 1024,
    minAudioBytes: 1024,
    maxAudioSeconds: 185,
    analysisTimeoutMs: 45_000,
    transcriptionTimeoutMs: 90_000,
  },

  rateLimits: {
    analyze: { windowMs: 10 * 60_000, max: 20 },
    transcribe: { windowMs: 10 * 60_000, max: 10 },
  },

  verboseLogs: text(process.env.VERBOSE_LOGS) === '1',
};

export function analysisConfigured() {
  return Boolean(config.openRouter.apiKey && config.openRouter.analysisModel);
}

export function transcriptionConfigured() {
  return Boolean(config.openRouter.apiKey && config.openRouter.transcriptionModel);
}

/**
 * Safe to return to a client: says what is configured without ever saying
 * what the key is. Model IDs are not secrets.
 */
export function configurationStatus() {
  return {
    service: 'dream-decoder-server',
    analysis: {
      configured: analysisConfigured(),
      model: config.openRouter.analysisModel || null,
      missing: [
        config.openRouter.apiKey ? null : 'OPENROUTER_API_KEY',
        config.openRouter.analysisModel ? null : 'OPENROUTER_ANALYSIS_MODEL',
      ].filter(Boolean),
    },
    transcription: {
      configured: transcriptionConfigured(),
      model: config.openRouter.transcriptionModel || null,
      missing: [
        config.openRouter.apiKey ? null : 'OPENROUTER_API_KEY',
        config.openRouter.transcriptionModel ? null : 'OPENROUTER_TRANSCRIPTION_MODEL',
      ].filter(Boolean),
    },
    allowedModels: config.allowedModels,
    structuredOutputs: config.openRouter.structuredOutputs,
    limits: {
      maxTranscriptChars: config.limits.maxTranscriptChars,
      maxAudioBytes: config.limits.maxAudioBytes,
      maxAudioSeconds: config.limits.maxAudioSeconds,
    },
  };
}

/**
 * Fatal misconfiguration checks. Called at startup so a mistake is a refusal
 * to boot rather than a surprise in production.
 */
export function startupProblems() {
  const problems = [];
  if (!config.authToken) {
    problems.push(
      'API_AUTH_TOKEN is not set. This server binds to the local network so a phone can reach ' +
        'it, so it refuses to run without an access token. Generate one with:\n' +
        '  node -e "console.log(require(\'node:crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  } else if (config.authToken.length < 24) {
    problems.push('API_AUTH_TOKEN is too short. Use at least 24 characters.');
  }
  return problems;
}

export default config;
