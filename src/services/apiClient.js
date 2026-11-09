/**
 * Client for THIS project's backend. Never talks to OpenRouter directly.
 *
 * The app holds two values: the backend URL and a shared bearer token for
 * that backend. There is deliberately no provider key here. Everything
 * EXPO_PUBLIC_* is compiled into the distributed bundle and is readable by
 * anyone who has the app, so a provider secret in this file would be a
 * published secret.
 *
 * The bearer token below is a development access gate for a backend on your
 * own network, not user authentication, and it is in the bundle too. A real
 * deployment needs per-user auth on the server.
 *
 * Transport note: this uses expo/fetch rather than the global fetch, because
 * React Native's FormData only understands strings and {uri, name, type}
 * objects. The audio upload appends an expo-file-system `File` (which is a
 * Blob), and only expo/fetch handles that correctly. The class reference
 * repository uses expo/fetch for the same reason.
 */

import { fetch as expoFetch } from 'expo/fetch';

const rawBaseUrl = (process.env.EXPO_PUBLIC_API_BASE_URL || '').trim();

export const apiConfig = {
  baseUrl: rawBaseUrl.replace(/\/+$/, ''),
  authToken: (process.env.EXPO_PUBLIC_API_AUTH_TOKEN || '').trim(),
};

export function getMissingApiConfig() {
  const missing = [];
  if (!apiConfig.baseUrl) missing.push('EXPO_PUBLIC_API_BASE_URL');
  if (!apiConfig.authToken) missing.push('EXPO_PUBLIC_API_AUTH_TOKEN');
  if (/YOUR_COMPUTER_LAN_IP/i.test(apiConfig.baseUrl)) missing.push('EXPO_PUBLIC_API_BASE_URL');
  return Array.from(new Set(missing));
}

export function isApiConfigured() {
  return getMissingApiConfig().length === 0;
}

/** True when the URL would only ever resolve to the phone itself. */
export function usesLocalhost() {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(apiConfig.baseUrl);
}

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'network_error' } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const NOT_CONFIGURED_MESSAGE =
  'This app has no backend URL yet. Add EXPO_PUBLIC_API_BASE_URL and ' +
  'EXPO_PUBLIC_API_AUTH_TOKEN to .env, then restart the dev server. ' +
  'You can still record, type, edit, and save dreams without it.';

/**
 * @param {string} path
 * @param {object} [options]
 * @param {object} [options.json] JSON body.
 * @param {FormData} [options.formData] Multipart body; Content-Type is left
 *        unset on purpose so fetch can add the boundary.
 * @param {number} [options.timeoutMs]
 * @param {AbortSignal} [options.signal]
 */
export async function apiRequest(path, { json, formData, timeoutMs = 60_000, signal } = {}) {
  if (!isApiConfigured()) {
    throw new ApiError(NOT_CONFIGURED_MESSAGE, { code: 'not_configured' });
  }
  if (usesLocalhost()) {
    throw new ApiError(
      'The backend URL points at localhost, which on a phone means the phone itself. ' +
        'Use your computer’s network address in EXPO_PUBLIC_API_BASE_URL.',
      { code: 'bad_base_url' },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const onExternalAbort = () => controller.abort();
  signal?.addEventListener('abort', onExternalAbort, { once: true });

  let response;
  try {
    response = await expoFetch(`${apiConfig.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${apiConfig.authToken}`,
        ...(json ? { 'Content-Type': 'application/json' } : null),
      },
      body: json ? JSON.stringify(json) : formData,
      signal: controller.signal,
    });
  } catch (_networkError) {
    if (signal?.aborted) {
      const aborted = new ApiError('Canceled.', { code: 'aborted' });
      aborted.name = 'AbortError';
      throw aborted;
    }
    if (controller.signal.aborted) {
      throw new ApiError(
        'The backend did not respond in time. Your dream is still here — nothing was lost.',
        { code: 'timeout' },
      );
    }
    throw new ApiError(
      'Could not reach the backend. Check that it is running, that the phone and computer are ' +
        'on the same network, and that the firewall allows the connection.',
      { code: 'unreachable' },
    );
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onExternalAbort);
  }

  const bodyText = await response.text();
  let body = null;
  try {
    body = JSON.parse(bodyText);
  } catch (_error) {
    body = null;
  }

  if (!response.ok) {
    throw new ApiError(body?.message || `The backend returned ${response.status}.`, {
      status: response.status,
      code: body?.error || 'server_error',
    });
  }

  if (!body || typeof body !== 'object') {
    throw new ApiError('The backend returned an unexpected response.', {
      status: response.status,
      code: 'bad_response',
    });
  }

  return body;
}

/** Reads the backend's configuration status. Used by the Settings screen. */
export async function fetchBackendStatus({ timeoutMs = 8000 } = {}) {
  if (!isApiConfigured()) {
    return { reachable: false, reason: 'not_configured', missing: getMissingApiConfig() };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const response = await expoFetch(`${apiConfig.baseUrl}/api/health`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) return { reachable: false, reason: `http_${response.status}` };
    const body = await response.json();
    return { reachable: true, ...body };
  } catch (_error) {
    return { reachable: false, reason: 'unreachable' };
  }
}

export default apiRequest;
