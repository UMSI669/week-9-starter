/**
 * Access gate, rate limiting, and error sanitizing.
 *
 * The rate limiter is in-memory, which means it is per-process. That is
 * honest for a single development server; a multi-instance deployment would
 * need a shared store, and this file says so rather than pretending.
 */

import { timingSafeEqual } from 'node:crypto';
import { config } from './config.js';

export function requireAuth(request, response, next) {
  const header = request.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  const presented = match ? match[1].trim() : '';

  if (!presented || !safeEquals(presented, config.authToken)) {
    response.status(401).json({
      error: 'unauthorized',
      message: 'A valid bearer token is required. Check EXPO_PUBLIC_API_AUTH_TOKEN in the app.',
    });
    return;
  }

  next();
}

function safeEquals(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Fixed-window counter keyed by client. Returns 429 with Retry-After.
 * Billable calls are never retried automatically anywhere in this server, so
 * a 429 is a real stop, not a nudge to try again immediately.
 */
export function createRateLimiter({ windowMs, max, name }) {
  const buckets = new Map();

  // Keeps the map from growing without bound on a long-running process.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, windowMs).unref?.();

  function middleware(request, response, next) {
    const key = clientKey(request);
    const now = Date.now();
    let bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    response.set('X-RateLimit-Limit', String(max));
    response.set('X-RateLimit-Remaining', String(Math.max(0, max - bucket.count)));

    if (bucket.count > max) {
      const retryAfterSeconds = Math.ceil((bucket.resetAt - now) / 1000);
      response.set('Retry-After', String(retryAfterSeconds));
      response.status(429).json({
        error: 'rate_limited',
        message: `Too many ${name} requests. Try again in ${retryAfterSeconds} seconds.`,
        retryAfterSeconds,
      });
      return;
    }

    next();
  }

  middleware.reset = () => buckets.clear();
  middleware.stop = () => clearInterval(sweep);
  return middleware;
}

function clientKey(request) {
  const header = request.get('authorization') || '';
  // Only a short fingerprint of the token, never the token itself.
  const tokenTail = header.slice(-8);
  return `${request.ip || 'unknown'}|${tokenTail}`;
}

const SECRET_PATTERNS = [
  /sk-or-v1-[A-Za-z0-9_-]+/g,
  /Bearer\s+[^\s"']+/gi,
  /sk-[A-Za-z0-9_-]{16,}/g,
];

/**
 * Strips anything that looks like a credential, plus the real key and token if
 * they somehow appear, and truncates. Used on every message leaving the
 * process, including log lines.
 */
export function sanitizeMessage(input, fallback = 'The request could not be completed.') {
  let message = typeof input === 'string' ? input : input instanceof Error ? input.message : '';
  if (!message) message = fallback;

  if (config.openRouter.apiKey) {
    message = message.split(config.openRouter.apiKey).join('[redacted]');
  }
  if (config.authToken) {
    message = message.split(config.authToken).join('[redacted]');
  }
  SECRET_PATTERNS.forEach((pattern) => {
    message = message.replace(pattern, '[redacted]');
  });

  return message.slice(0, 400);
}

/** Final error handler. Nothing reaches the client unsanitized. */
export function errorHandler(error, request, response, _next) {
  const status = Number(error?.status) || 500;
  const code = error?.code || (status === 400 ? 'bad_request' : 'server_error');

  console.error(
    `[error] ${request.method} ${request.path} -> ${status}: ${sanitizeMessage(error)}`,
  );

  if (response.headersSent) return;
  response.status(status).json({
    error: code,
    message: sanitizeMessage(error?.expose ? error.message : null, defaultMessage(status)),
  });
}

function defaultMessage(status) {
  if (status === 413) return 'That request was too large.';
  if (status === 400) return 'That request was not valid.';
  if (status === 502) return 'The analysis service did not return a usable result.';
  if (status === 504) return 'The analysis service took too long to respond.';
  return 'The request could not be completed.';
}

export function httpError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.expose = true;
  return error;
}
