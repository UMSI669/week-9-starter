process.env.API_AUTH_TOKEN = 'middleware-test-token-0123456789abc';
process.env.OPENROUTER_API_KEY = 'sk-or-v1-middleware-secret-value';

import { test } from 'node:test';
import assert from 'node:assert/strict';

const { sanitizeMessage } = await import('./middleware.js');
const { startupProblems, configurationStatus } = await import('./config.js');

test('sanitizeMessage removes the configured OpenRouter key', () => {
  const message = sanitizeMessage('Auth failed for sk-or-v1-middleware-secret-value here');
  assert.ok(!message.includes('sk-or-v1-middleware-secret-value'));
  assert.ok(message.includes('[redacted]'));
});

test('sanitizeMessage removes the configured auth token', () => {
  const message = sanitizeMessage('Token middleware-test-token-0123456789abc rejected');
  assert.ok(!message.includes('middleware-test-token-0123456789abc'));
});

test('sanitizeMessage removes bearer headers and key-shaped strings it has never seen', () => {
  const message = sanitizeMessage('Bearer sk-or-v1-some-other-key-entirely failed');
  assert.ok(!message.includes('sk-or-v1-some-other-key-entirely'));
});

test('sanitizeMessage truncates and falls back for empty input', () => {
  assert.equal(sanitizeMessage('x'.repeat(900)).length, 400);
  assert.equal(sanitizeMessage(''), 'The request could not be completed.');
  assert.equal(sanitizeMessage(null, 'fallback'), 'fallback');
});

test('a configured server reports no startup problems', () => {
  assert.deepEqual(startupProblems(), []);
});

test('configurationStatus never contains the key', () => {
  const serialized = JSON.stringify(configurationStatus());
  assert.ok(!serialized.includes('sk-or-v1-middleware-secret-value'));
  assert.ok(!serialized.includes('middleware-test-token-0123456789abc'));
});
