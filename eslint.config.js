const { defineConfig } = require('eslint/config');
const expo = require('eslint-config-expo/flat');
module.exports = defineConfig([expo, { ignores: ['dist/**', 'web-build/**', 'test-results/**', 'playwright-report/**'] }]);
