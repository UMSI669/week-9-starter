/**
 * A guard, not a formality.
 *
 * Everything EXPO_PUBLIC_* is compiled into the distributed app bundle. These
 * tests fail the build if a provider secret is ever introduced into client
 * configuration, or if the tracked example files stop being blank.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..', '..');

function read(relativePath) {
  return readFileSync(join(ROOT, relativePath), 'utf8');
}

/**
 * Every shipped source file. Test and mock directories are skipped: these very
 * assertions name the forbidden strings, so scanning them would always fail.
 */
function walk(directory, files = []) {
  readdirSync(directory).forEach((entry) => {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) {
      if (['node_modules', '.git', '__tests__', '__mocks__'].includes(entry)) return;
      walk(full, files);
    } else if (/\.(js|jsx|json)$/.test(entry)) {
      files.push(full);
    }
  });
  return files;
}

describe('client environment', () => {
  const example = read('.env.example');

  it('declares only a backend URL and a backend token', () => {
    const names = [...example.matchAll(/^([A-Z0-9_]+)=/gm)].map((match) => match[1]);
    expect(names.sort()).toEqual(['EXPO_PUBLIC_API_AUTH_TOKEN', 'EXPO_PUBLIC_API_BASE_URL']);
  });

  it('never mentions an OpenRouter key variable', () => {
    expect(example).not.toMatch(/EXPO_PUBLIC_OPENROUTER/);
    expect(example).not.toMatch(/OPENROUTER_API_KEY/);
  });

  it('ships with placeholders only, no real values', () => {
    const assignments = [...example.matchAll(/^[A-Z0-9_]+=(.*)$/gm)].map((match) =>
      match[1].trim(),
    );
    assignments.forEach((value) => {
      expect(value === '' || /YOUR_COMPUTER_LAN_IP/.test(value)).toBe(true);
    });
  });
});

describe('server environment example', () => {
  const example = read('server/.env.example');

  it('declares the OpenRouter key on the server side', () => {
    expect(example).toMatch(/^OPENROUTER_API_KEY=$/m);
  });

  it('is blank: every value is empty or a non-secret default', () => {
    const nonSecretDefaults = new Set([
      'OPENROUTER_BASE_URL',
      'PORT',
      'HOST',
      'OPENROUTER_APP_TITLE',
      'VERBOSE_LOGS',
    ]);
    [...example.matchAll(/^([A-Z0-9_]+)=(.*)$/gm)].forEach((match) => {
      const [, name, value] = match;
      if (nonSecretDefaults.has(name)) return;
      expect(value.trim()).toBe('');
    });
  });
});

describe('git hygiene', () => {
  const gitignore = read('.gitignore');

  it('ignores every .env file while keeping the example tracked', () => {
    expect(gitignore).toMatch(/^\.env$/m);
    expect(gitignore).toMatch(/^\.env\.\*$/m);
    expect(gitignore).toMatch(/^!\.env\.example$/m);
  });

  it('ignores the server .env too', () => {
    const serverIgnore = read('server/.gitignore');
    expect(serverIgnore).toMatch(/^\.env$/m);
    expect(serverIgnore).toMatch(/^!\.env\.example$/m);
  });
});

describe('source code', () => {
  const sources = walk(join(ROOT, 'src'));

  it('reads no OpenRouter key from the client environment, anywhere', () => {
    sources.forEach((file) => {
      const contents = readFileSync(file, 'utf8');
      expect(contents).not.toMatch(/EXPO_PUBLIC_OPENROUTER/);
      expect(contents).not.toMatch(/process\.env\.OPENROUTER_API_KEY/);
    });
  });

  it('contains no key-shaped literal', () => {
    sources.forEach((file) => {
      const contents = readFileSync(file, 'utf8');
      // A real OpenRouter key starts sk-or-v1-; the test files reference the
      // prefix only inside a regex or a redaction assertion.
      const literals = contents.match(/['"`]sk-or-v1-[A-Za-z0-9_-]{8,}['"`]/g) || [];
      expect(literals).toEqual([]);
    });
  });

  it('never calls OpenRouter directly from the app', () => {
    sources.forEach((file) => {
      const contents = readFileSync(file, 'utf8');
      expect(contents).not.toMatch(/https:\/\/openrouter\.ai/);
    });
  });

  it('points the app at its own backend routes', () => {
    const analysis = readFileSync(join(ROOT, 'src/services/dreamAnalysis.js'), 'utf8');
    expect(analysis).toContain('/api/dreams/analyze');
    const cloud = readFileSync(join(ROOT, 'src/services/stt/cloudStt.js'), 'utf8');
    expect(cloud).toContain('/api/transcribe');
  });
});

describe('app config', () => {
  it('contains no secrets in app.json', () => {
    const appConfig = read('app.json');
    expect(appConfig).not.toMatch(/sk-or-v1-/);
    expect(appConfig).not.toMatch(/OPENROUTER/i);
    expect(appConfig).not.toMatch(/apiKey/i);
  });
});
