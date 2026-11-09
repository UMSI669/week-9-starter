/**
 * Route tests. The OpenRouter client is injected as a stub, so these run
 * offline, need no key, and cost nothing. Paid integration is opt-in and
 * lives in src/openRouter.paid.test.js.
 */

process.env.API_AUTH_TOKEN = process.env.API_AUTH_TOKEN || 'test-token-abcdefghijklmnopqrstuvwxyz';
process.env.OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || 'sk-or-v1-test-key-not-real';
process.env.OPENROUTER_ANALYSIS_MODEL =
  process.env.OPENROUTER_ANALYSIS_MODEL || 'test/analysis-model';
process.env.OPENROUTER_TRANSCRIPTION_MODEL =
  process.env.OPENROUTER_TRANSCRIPTION_MODEL || 'test/transcription-model';

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const { createApp } = await import('./app.js');
const { config } = await import('./config.js');

const TOKEN = config.authToken;

let server;
let stopLimiters;
let baseUrl;
let calls;
let nextAnalysis;
let nextTranscription;

before(async () => {
  const app = createApp({
    dependencies: {
      async analyzeDream({ transcript, model }) {
        calls.push({ kind: 'analyze', transcript, model });
        if (nextAnalysis instanceof Error) throw nextAnalysis;
        return (
          nextAnalysis || {
            title: 'Stub Dream',
            summary: 'A stubbed summary.',
            interpretation: 'This could reflect a stub.',
            reflectionQuestion: 'What is a stub?',
            primaryCategory: 'mystery',
            themes: ['testing'],
            moods: ['calm'],
            symbol: { key: 'stub', label: 'Stub', emoji: '\u{1F9EA}' },
            analysisModel: model,
          }
        );
      },
      async transcribeAudio({ buffer, filename, mimeType, model }) {
        calls.push({ kind: 'transcribe', bytes: buffer.length, filename, mimeType, model });
        if (nextTranscription instanceof Error) throw nextTranscription;
        return nextTranscription || { text: 'a stubbed transcript', language: 'en', model };
      },
    },
  });

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  // Rate limiters are per-process; clear them between tests.
  const { analyzeLimiter, transcribeLimiter } = app.locals.limiters;
  globalThis.__resetLimiters = () => {
    analyzeLimiter.reset();
    transcribeLimiter.reset();
  };
  stopLimiters = () => {
    analyzeLimiter.stop();
    transcribeLimiter.stop();
  };
});

after(async () => {
  stopLimiters?.();
  // fetch keeps HTTP connections alive, which would hold the event loop open
  // after the last test; drop them explicitly so the runner can exit.
  server?.closeAllConnections?.();
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  calls = [];
  nextAnalysis = null;
  nextTranscription = null;
  globalThis.__resetLimiters?.();
});

function analyze(body, { token = TOKEN } = {}) {
  return fetch(`${baseUrl}/api/dreams/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : null),
    },
    body: JSON.stringify(body),
  });
}

function wavBuffer(bytes = 4096) {
  // Minimal RIFF header so the payload is plausibly a WAV file.
  const buffer = Buffer.alloc(bytes);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(bytes - 8, 4);
  buffer.write('WAVEfmt ', 8, 'ascii');
  return buffer;
}

function transcribeRequest({ buffer = wavBuffer(), mimeType = 'audio/wav', filename = 'dream.wav', fields = {}, token = TOKEN } = {}) {
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mimeType }), filename);
  Object.entries(fields).forEach(([key, value]) => form.append(key, String(value)));
  return fetch(`${baseUrl}/api/transcribe`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    // Content-Type is intentionally not set: fetch adds it with the boundary.
    body: form,
  });
}

/* ------------------------------------ health ----------------------------------- */

test('health reports configuration status and never leaks the key', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.analysis.configured, true);
  assert.equal(body.analysis.model, 'test/analysis-model');

  const serialized = JSON.stringify(body);
  assert.ok(!serialized.includes(config.openRouter.apiKey));
  assert.ok(!serialized.includes(config.authToken));
  assert.ok(!/sk-or-v1-/.test(serialized));
});

/* ------------------------------------- auth ------------------------------------ */

test('analyze requires a bearer token', async () => {
  const response = await analyze({ transcript: 'a dream' }, { token: null });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, 'unauthorized');
  assert.equal(calls.length, 0);
});

test('analyze rejects a wrong token', async () => {
  const response = await analyze({ transcript: 'a dream' }, { token: 'not-the-token' });
  assert.equal(response.status, 401);
  assert.equal(calls.length, 0);
});

test('transcribe requires a bearer token', async () => {
  const response = await transcribeRequest({ token: null });
  assert.equal(response.status, 401);
  assert.equal(calls.length, 0);
});

/* ------------------------------------ analyze ---------------------------------- */

test('analyze returns the validated card fields', async () => {
  const response = await analyze({ transcript: 'I was in a floating library.' });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.analysis.title, 'Stub Dream');
  assert.equal(body.analysis.primaryCategory, 'mystery');
  assert.equal(calls[0].model, 'test/analysis-model');
  assert.equal(calls[0].transcript, 'I was in a floating library.');
});

test('analyze rejects an empty or missing transcript', async () => {
  for (const body of [{}, { transcript: '' }, { transcript: '    ' }, { transcript: 42 }]) {
    const response = await analyze(body);
    assert.equal(response.status, 400, JSON.stringify(body));
  }
  assert.equal(calls.length, 0);
});

test('analyze rejects an over-long transcript before calling the model', async () => {
  const response = await analyze({ transcript: 'x'.repeat(config.limits.maxTranscriptChars + 1) });
  assert.equal(response.status, 413);
  assert.equal((await response.json()).error, 'transcript_too_long');
  assert.equal(calls.length, 0);
});

test('analyze refuses a model outside the allowlist', async () => {
  const response = await analyze({ transcript: 'a dream', model: 'someone/expensive-model' });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'model_not_allowed');
  assert.equal(calls.length, 0);
});

test('analyze accepts an allowlisted model', async () => {
  const response = await analyze({ transcript: 'a dream', model: 'test/analysis-model' });
  assert.equal(response.status, 200);
  assert.equal(calls[0].model, 'test/analysis-model');
});

test('an upstream failure is sanitized and does not retry', async () => {
  const error = new Error('Bearer sk-or-v1-abcdef123456 was rejected by https://openrouter.ai/x');
  error.status = 502;
  error.code = 'upstream_error';
  error.expose = true;
  nextAnalysis = error;

  const response = await analyze({ transcript: 'a dream' });
  assert.equal(response.status, 502);
  const body = await response.json();
  assert.ok(!body.message.includes('sk-or-v1-abcdef123456'));
  assert.match(body.message, /\[redacted\]/);
  // Exactly one upstream attempt: billable calls are never auto-retried.
  assert.equal(calls.length, 1);
});

test('an unexpected error does not leak its message to the client', async () => {
  nextAnalysis = new Error('ECONNREFUSED to 10.0.0.5 with key sk-or-v1-secret');
  const response = await analyze({ transcript: 'a dream' });
  assert.equal(response.status, 500);
  const body = await response.json();
  assert.ok(!body.message.includes('sk-or-v1-secret'));
  assert.ok(!body.message.includes('10.0.0.5'));
});

test('analyze is rate limited', async () => {
  const limit = config.rateLimits.analyze.max;
  for (let i = 0; i < limit; i += 1) {
    const ok = await analyze({ transcript: `dream ${i}` });
    assert.equal(ok.status, 200, `request ${i}`);
  }
  const blocked = await analyze({ transcript: 'one too many' });
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get('retry-after')) > 0);
  assert.equal(calls.length, limit);
});

/* ----------------------------------- transcribe -------------------------------- */

test('transcribe accepts a multipart upload and returns text', async () => {
  const response = await transcribeRequest();
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.text, 'a stubbed transcript');
  assert.equal(calls[0].mimeType, 'audio/wav');
  assert.equal(calls[0].filename, 'dream.wav');
  assert.equal(calls[0].model, 'test/transcription-model');
});

test('transcribe rejects a missing file', async () => {
  const form = new FormData();
  form.append('model', 'test/transcription-model');
  const response = await fetch(`${baseUrl}/api/transcribe`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: form,
  });
  assert.equal(response.status, 400);
  assert.equal(calls.length, 0);
});

test('transcribe rejects audio too small to hold speech', async () => {
  const response = await transcribeRequest({ buffer: Buffer.alloc(64) });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'audio_too_short');
  assert.equal(calls.length, 0);
});

test('transcribe rejects an unsupported media type', async () => {
  const response = await transcribeRequest({ mimeType: 'application/pdf', filename: 'x.pdf' });
  assert.equal(response.status, 415);
  assert.equal((await response.json()).error, 'unsupported_audio');
  assert.equal(calls.length, 0);
});

test('transcribe rejects a declared duration over the limit', async () => {
  const response = await transcribeRequest({ fields: { durationSeconds: 400 } });
  assert.equal(response.status, 413);
  assert.equal((await response.json()).error, 'audio_too_long');
  assert.equal(calls.length, 0);
});

test('transcribe accepts a duration inside the limit', async () => {
  const response = await transcribeRequest({ fields: { durationSeconds: 120 } });
  assert.equal(response.status, 200);
  assert.equal(calls.length, 1);
});

test('transcribe refuses a model outside the allowlist', async () => {
  const response = await transcribeRequest({ fields: { model: 'someone/expensive-model' } });
  assert.equal(response.status, 400);
  assert.equal(calls.length, 0);
});

/* ------------------------------------ routing ---------------------------------- */

test('unknown routes 404 as JSON', async () => {
  const response = await fetch(`${baseUrl}/api/v1/chat/completions`, { method: 'POST' });
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, 'not_found');
});
