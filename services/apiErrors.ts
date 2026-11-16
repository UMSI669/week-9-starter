export function safeError(error: unknown, fallback = 'Something went wrong. Please try again.') {
  let message = error instanceof Error ? error.message : typeof error === 'string' ? error :
    error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' ? error.message : fallback;
  for (const key of [process.env.EXPO_PUBLIC_OPENROUTER_API_KEY, process.env.EXPO_PUBLIC_UMGPT_API_KEY, process.env.UMGPT_API_KEY, process.env.EXPO_PUBLIC_OPENAI_API_KEY]) {
    if (key) message = message.replaceAll(key, '[redacted]');
  }
  return message.replace(/Incorrect API key provided:[^.\n]+/gi, 'Incorrect API key provided: [redacted]')
    .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [redacted]').replace(/https?:\/\/[^\s"']+/gi, '[service URL]').slice(0, 500);
}
