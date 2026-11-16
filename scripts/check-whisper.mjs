#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`Usage: node scripts/check-whisper.mjs [audio-file]

Defaults to the project's Grocery List.m4a.
Put EXPO_PUBLIC_OPENROUTER_API_KEY in .env, or set OPENROUTER_API_KEY.
Optional: EXPO_PUBLIC_TRANSCRIPTION_MODEL (default: openai/whisper-large-v3-turbo)
Optional: EXPO_PUBLIC_OPENROUTER_BASE_URL (default: https://openrouter.ai/api/v1)

Uploads the audio to OpenRouter and makes one billable transcription request.
Exits with 0 for a nonempty transcript, or 1 on failure.`);
} else {
  try {
    await checkWhisper();
  } catch (error) {
    const key = process.env.OPENROUTER_API_KEY?.trim()
      || process.env.EXPO_PUBLIC_OPENROUTER_API_KEY?.trim();
    let message = error.name === 'TimeoutError'
      ? 'The transcription request timed out after 60 seconds.'
      : error.message;
    if (key) message = message.replaceAll(key, '[redacted]');
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  }
}

async function checkWhisper() {
  if (args.length > 1 || args[0]?.startsWith('-')) {
    throw new Error('Expected one optional audio-file path. Use --help for usage.');
  }

  const envPath = resolve(projectRoot, '.env');
  if (existsSync(envPath)) process.loadEnvFile(envPath);

  const apiKey = process.env.OPENROUTER_API_KEY?.trim()
    || process.env.EXPO_PUBLIC_OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('Missing API key. Set EXPO_PUBLIC_OPENROUTER_API_KEY in .env or OPENROUTER_API_KEY in your environment.');
  }

  const model = process.env.EXPO_PUBLIC_TRANSCRIPTION_MODEL?.trim()
    || 'openai/whisper-large-v3-turbo';
  const baseUrl = (process.env.EXPO_PUBLIC_OPENROUTER_BASE_URL?.trim()
    || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
  const audioPath = args[0]
    ? resolve(args[0])
    : resolve(projectRoot, 'Grocery List.m4a');
  const mimeTypes = {
    '.m4a': 'audio/mp4', '.mp4': 'audio/mp4', '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav', '.webm': 'audio/webm', '.ogg': 'audio/ogg',
    '.flac': 'audio/flac',
  };
  const mimeType = mimeTypes[extname(audioPath).toLowerCase()];
  if (!mimeType) throw new Error('Use an m4a, mp4, mp3, wav, webm, ogg, or flac audio file.');
  const audio = await readFile(audioPath);
  if (!audio.length) throw new Error('The audio file is empty.');

  const body = new FormData();
  body.append('file', new Blob([audio], { type: mimeType }), basename(audioPath));
  body.append('model', model);

  console.log(`Checking ${model} with ${basename(audioPath)} (${audio.length} bytes)...`);
  const start = Date.now();
  const response = await fetch(`${baseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    body,
    signal: AbortSignal.timeout(60_000),
  });

  const raw = await response.text();
  let result;
  try { result = JSON.parse(raw); } catch { /* Handle non-JSON errors below. */ }
  if (!response.ok) {
    const detail = result?.error?.message || result?.message;
    throw new Error(`OpenRouter returned HTTP ${response.status}${typeof detail === 'string' ? `: ${detail}` : '.'} Check the API key, account credits, and availability of model ${model}.`);
  }
  if (typeof result?.text !== 'string' || !result.text.trim()) {
    throw new Error('OpenRouter did not return a nonempty transcript in the text field.');
  }

  console.log(`PASS: Transcription completed in ${((Date.now() - start) / 1000).toFixed(1)}s.\n`);
  console.log(result.text.trim());
}
