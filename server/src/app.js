/**
 * Express application. Exported separately from the listener so tests can
 * exercise routes without opening a port.
 *
 * Routes are project-defined, not OpenRouter routes:
 *   GET  /api/health              configuration status, no secrets
 *   POST /api/dreams/analyze      reviewed transcript -> validated card fields
 *   POST /api/transcribe          audio -> text  (only when enabled)
 */

import express from 'express';
import multer from 'multer';
import {
  analysisConfigured,
  config,
  configurationStatus,
  transcriptionConfigured,
} from './config.js';
import { createRateLimiter, errorHandler, httpError, requireAuth } from './middleware.js';
import { analyzeDream, transcribeAudio } from './openRouter.js';

const ALLOWED_AUDIO_TYPES = new Set([
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/mpeg',
  'audio/webm',
  'audio/ogg',
  'audio/aac',
]);

export function createApp({ dependencies = {} } = {}) {
  const analyze = dependencies.analyzeDream || analyzeDream;
  const transcribe = dependencies.transcribeAudio || transcribeAudio;

  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  const analyzeLimiter = createRateLimiter({ ...config.rateLimits.analyze, name: 'analysis' });
  const transcribeLimiter = createRateLimiter({
    ...config.rateLimits.transcribe,
    name: 'transcription',
  });

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.limits.maxAudioBytes, files: 1, fields: 6 },
  });

  app.get('/api/health', (request, response) => {
    response.json({ ok: true, ...configurationStatus() });
  });

  app.post(
    '/api/dreams/analyze',
    requireAuth,
    analyzeLimiter,
    express.json({ limit: config.limits.maxRequestBytes }),
    async (request, response, next) => {
      try {
        if (!analysisConfigured()) {
          throw httpError(
            503,
            'not_configured',
            'The backend has no OpenRouter analysis model configured. Set OPENROUTER_API_KEY and OPENROUTER_ANALYSIS_MODEL in server/.env.',
          );
        }

        const transcript = typeof request.body?.transcript === 'string'
          ? request.body.transcript.trim()
          : '';

        if (!transcript) {
          throw httpError(400, 'bad_request', 'A non-empty transcript is required.');
        }
        if (transcript.length > config.limits.maxTranscriptChars) {
          throw httpError(
            413,
            'transcript_too_long',
            `That transcript is ${transcript.length} characters. The limit is ${config.limits.maxTranscriptChars}.`,
          );
        }

        const model = resolveModel(request.body?.model, config.openRouter.analysisModel);
        const result = await analyze({ transcript, model });
        response.json({ ok: true, analysis: result });
      } catch (error) {
        next(error);
      }
    },
  );

  app.post(
    '/api/transcribe',
    requireAuth,
    transcribeLimiter,
    (request, response, next) => {
      if (!transcriptionConfigured()) {
        next(
          httpError(
            503,
            'not_configured',
            'Cloud transcription is not enabled on this backend. Set OPENROUTER_TRANSCRIPTION_MODEL in server/.env, or use phone transcription.',
          ),
        );
        return;
      }
      next();
    },
    (request, response, next) => {
      // Timing starts before multer reads the body, so a slow upload can be
      // told apart from a slow model when a request times out.
      request.receivedAt = Date.now();
      console.log('[transcribe] request received, reading upload...');
      upload.single('file')(request, response, (error) => {
        if (!error) {
          const bytes = request.file?.size ?? 0;
          console.log(
            `[transcribe] upload complete: ${(bytes / 1024 / 1024).toFixed(2)} MB in ` +
              `${Date.now() - request.receivedAt} ms`,
          );
          next();
          return;
        }
        if (error.code === 'LIMIT_FILE_SIZE') {
          next(
            httpError(
              413,
              'audio_too_large',
              `That recording is larger than the ${Math.round(config.limits.maxAudioBytes / 1024 / 1024)} MB limit.`,
            ),
          );
          return;
        }
        next(httpError(400, 'bad_request', 'The audio upload could not be read.'));
      });
    },
    async (request, response, next) => {
      try {
        const file = request.file;
        if (!file || !file.buffer?.length) {
          throw httpError(400, 'bad_request', 'An audio file is required in the "file" field.');
        }
        if (file.buffer.length < config.limits.minAudioBytes) {
          throw httpError(
            400,
            'audio_too_short',
            'That recording is too small to contain speech. Try recording again.',
          );
        }

        const mimeType = (file.mimetype || '').split(';')[0].toLowerCase();
        if (!ALLOWED_AUDIO_TYPES.has(mimeType)) {
          throw httpError(
            415,
            'unsupported_audio',
            `This backend does not accept "${mimeType || 'unknown'}" audio.`,
          );
        }

        const durationSeconds = Number(request.body?.durationSeconds);
        if (Number.isFinite(durationSeconds) && durationSeconds > config.limits.maxAudioSeconds) {
          throw httpError(
            413,
            'audio_too_long',
            `That recording is ${Math.round(durationSeconds)} seconds. The limit is ${config.limits.maxAudioSeconds}.`,
          );
        }

        const model = resolveModel(request.body?.model, config.openRouter.transcriptionModel);
        const modelStartedAt = Date.now();
        console.log(`[transcribe] calling model ${model}...`);
        const result = await transcribe({
          buffer: file.buffer,
          filename: file.originalname || 'dream.wav',
          mimeType,
          model,
        });
        console.log(
          `[transcribe] model replied in ${Date.now() - modelStartedAt} ms ` +
            `(total ${Date.now() - request.receivedAt} ms)`,
        );
        response.json({ ok: true, ...result });
      } catch (error) {
        next(error);
      }
    },
  );

  app.use((request, response) => {
    response.status(404).json({ error: 'not_found', message: 'No such route.' });
  });

  app.use(errorHandler);

  app.locals.limiters = { analyzeLimiter, transcribeLimiter };
  return app;
}

/**
 * A client may only name a model from the allowlist. Anything else is a 400,
 * so this endpoint can never become an unrestricted OpenRouter proxy.
 */
function resolveModel(requested, fallback) {
  if (requested === undefined || requested === null || requested === '') return fallback;
  const model = String(requested).trim();
  if (!config.allowedModels.includes(model)) {
    throw httpError(
      400,
      'model_not_allowed',
      'That model is not in this backend’s allowlist.',
    );
  }
  return model;
}

export default createApp;
