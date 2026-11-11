// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'coverage/*', 'server/node_modules/*', 'node_modules/*'],
  },
  {
    // Jest globals for the app's test suite.
    files: ['src/**/__tests__/**/*.js', 'src/**/*.test.js'],
    languageOptions: {
      globals: {
        afterAll: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        beforeEach: 'readonly',
        describe: 'readonly',
        expect: 'readonly',
        it: 'readonly',
        jest: 'readonly',
        test: 'readonly',
        // The secrets guard and the SQLite fake read from disk.
        __dirname: 'readonly',
        require: 'readonly',
        module: 'readonly',
        process: 'readonly',
      },
    },
  },
  {
    // The backend is plain Node ESM, not React Native. It has its own test
    // runner (node:test) and its own globals.
    files: ['server/**/*.js'],
    languageOptions: {
      sourceType: 'module',
      globals: {
        Buffer: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        AbortSignal: 'readonly',
        AbortController: 'readonly',
        FormData: 'readonly',
        Blob: 'readonly',
        Intl: 'readonly',
        globalThis: 'readonly',
        URL: 'readonly',
      },
    },
    rules: {
      // process.env is the whole point of a server config module.
      'no-undef': 'error',
      // Statements before imports are deliberate in the route tests: the
      // environment must be set before config.js reads it.
      'import/first': 'off',
    },
  },
]);
