import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseGroceries } from '../services/umgpt/parser';
import { safeError } from '../services/apiErrors';

async function main() {
  if (process.argv.includes('--help')) {
    console.log('Usage: npm run check:parser -- [transcript]\nDefaults to the verified Grocery List.m4a transcript. Makes one billable U-M GPT Toolkit request.');
    return;
  }
  const envFile = resolve(import.meta.dirname, '../.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const transcript = process.argv.slice(2).join(' ') || 'Make me a shopping list that includes apples, eggs, two gallons of milk, and a loaf of bread. Thank you.';
  const model = process.env.EXPO_PUBLIC_PARSER_MODEL?.trim() || 'gpt-6-luna';
  const key = process.env.UMGPT_API_KEY?.trim() || process.env.EXPO_PUBLIC_UMGPT_API_KEY?.trim() || '';
  const baseUrl = process.env.EXPO_PUBLIC_UMGPT_BASE_URL?.trim() || 'https://api.toolkit.umgpt.umich.edu/v1';
  console.log(`Checking grocery JSON formatting with ${model}...`);
  const started = Date.now();
  const items = await parseGroceries(transcript, key, model, AbortSignal.timeout(60_000), fetch, baseUrl);
  console.log(`PASS: Valid grocery JSON returned in ${((Date.now() - started) / 1000).toFixed(1)}s.\n`);
  console.log(JSON.stringify({ items }, null, 2));
}
main().catch(error => { console.error(`FAIL: ${safeError(error)}`); process.exitCode = 1; });
