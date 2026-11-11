/**
 * Points the app at this computer's current LAN address.
 *
 * Why this exists: iOS App Transport Security blocks plain HTTP to PUBLIC
 * addresses. Expo's generated Info.plist sets NSAllowsLocalNetworking, which
 * exempts private ranges only (10.x, 172.16-31.x, 192.168.x, 169.254.x,
 * localhost). On a campus or corporate network your computer often has a
 * public address, and the app then fails with:
 *
 *   "The resource could not be loaded because the App Transport Security
 *    policy requires the use of a secure connection"
 *
 * This script finds the active address, says whether ATS will permit it, and
 * rewrites only the EXPO_PUBLIC_API_BASE_URL line in .env. It never touches
 * any other line, so the access token is left exactly as it is.
 *
 *   npm run set-ip          # detect and write
 *   npm run set-ip -- 172.20.10.2   # force a specific address
 */

import { networkInterfaces } from 'node:os';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const PORT = 3000;
const ENV_PATH = new URL('../.env', import.meta.url);

function isPrivate(ip) {
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    a === 127
  );
}

function detectAddresses() {
  const found = [];
  const interfaces = networkInterfaces();
  for (const [name, addresses] of Object.entries(interfaces)) {
    for (const address of addresses || []) {
      if (address.family !== 'IPv4' || address.internal) continue;
      found.push({ name, ip: address.address });
    }
  }
  return found;
}

const forced = process.argv[2];
const candidates = detectAddresses();

if (candidates.length === 0 && !forced) {
  console.error('No external IPv4 address found. Are you connected to a network?');
  process.exit(1);
}

// Prefer a private address, because that is the one ATS will allow over HTTP.
const preferred =
  candidates.find((candidate) => isPrivate(candidate.ip)) || candidates[0] || null;
const chosen = forced || preferred.ip;

console.log('Interfaces found:');
candidates.forEach((candidate) => {
  const tag = isPrivate(candidate.ip) ? 'private' : 'PUBLIC';
  const mark = candidate.ip === chosen ? '->' : '  ';
  console.log(`  ${mark} ${candidate.name.padEnd(8)} ${candidate.ip.padEnd(16)} ${tag}`);
});
console.log('');

if (!isPrivate(chosen) && !forced) {
  // Refuse rather than warn. Writing a public address guarantees an iOS ATS
  // failure, and on a campus network client isolation usually blocks the
  // phone from reaching this computer at all. Writing it would only produce a
  // confusing timeout later.
  console.error(
    `REFUSING to write ${chosen}: it is a PUBLIC address.\n\n` +
      '  iOS App Transport Security blocks plain HTTP to public addresses, and campus or\n' +
      '  corporate Wi-Fi usually blocks phone-to-laptop traffic entirely.\n\n' +
      '  Put your phone on Personal Hotspot and join this computer to it, then run this\n' +
      '  again. You will get a private address that works with no config change.\n\n' +
      `  To write it anyway (for an Android device on the same network):\n` +
      `    npm run set-ip -- ${chosen}\n`,
  );
  process.exit(1);
}

if (!isPrivate(chosen)) {
  console.warn(
    `Writing PUBLIC address ${chosen} because you asked for it explicitly.\n` +
      '  iOS will block plain HTTP to this. Android has no such restriction.\n',
  );
} else {
  console.log(`${chosen} is a private address, so iOS will allow plain HTTP to it.\n`);
}

if (!existsSync(ENV_PATH)) {
  console.error('.env does not exist. Copy it from .env.example first.');
  process.exit(1);
}

const url = `http://${chosen}:${PORT}`;
const contents = readFileSync(ENV_PATH, 'utf8');
const line = `EXPO_PUBLIC_API_BASE_URL=${url}`;

// Replace only this one key. Every other line, including the token, is untouched.
const updated = /^EXPO_PUBLIC_API_BASE_URL=.*$/m.test(contents)
  ? contents.replace(/^EXPO_PUBLIC_API_BASE_URL=.*$/m, line)
  : `${contents.replace(/\n*$/, '\n')}${line}\n`;

if (updated === contents) {
  console.log(`.env already points at ${url}`);
} else {
  writeFileSync(ENV_PATH, updated);
  console.log(`.env updated: EXPO_PUBLIC_API_BASE_URL=${url}`);
}

console.log('\nNow restart Metro so it picks up the change (no native rebuild needed):');
console.log('  npx expo start --dev-client --clear');
