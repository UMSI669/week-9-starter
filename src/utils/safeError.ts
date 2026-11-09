/**
 * Error messages are shown in the UI only. The app has no analytics or remote
 * logging; this helper additionally strips credentials, URLs and file paths so
 * a message copied into a bug report cannot leak them.
 */
const secrets = new Set<string>();

export function registerSecret(value: string | null | undefined) {
  if (value && value.length >= 8) secrets.add(value);
}

export function forgetSecrets() {
  secrets.clear();
}

export function safeErrorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  let message = error instanceof Error ? error.message : typeof error === 'string' ? error : fallback;
  if (!message) message = fallback;
  for (const secret of secrets) message = message.split(secret).join('[redacted]');
  return message
    .replace(/sk-or-[A-Za-z0-9_-]+/g, '[redacted key]')
    .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [redacted]')
    .replace(/https?:\/\/[^\s"']+/gi, '[url]')
    .replace(/file:\/\/[^\s"']+/gi, '[local file]')
    .slice(0, 400);
}

export function makeAbortError(message = 'Canceled.'): Error {
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

export const isAbortError = (error: unknown) => error instanceof Error && error.name === 'AbortError';
