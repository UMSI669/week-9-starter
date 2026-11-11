/**
 * OPT-IN PAID TEST. This one really calls OpenRouter and really costs money.
 *
 * It lives outside the `*.test.js` naming that `npm test` discovers, so it can
 * only run when you ask for it:
 *   cd server && npm run test:paid
 *
 * It skips itself unless RUN_PAID_TESTS=1 and a key and analysis model are
 * configured, so CI and routine development never bill anything.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analysisConfigured, config } from '../config.js';
import { analyzeDream } from '../openRouter.js';

const enabled = process.env.RUN_PAID_TESTS === '1' && analysisConfigured();

test(
  'analyzes a short test dream against the real OpenRouter API (billable)',
  { skip: enabled ? false : 'Set RUN_PAID_TESTS=1 and configure server/.env to run this.' },
  async () => {
    const result = await analyzeDream({
      transcript:
        'I dreamed I was walking through a purple forest and found a glowing door.',
      model: config.openRouter.analysisModel,
    });

    assert.ok(result.title.length >= 1 && result.title.length <= 60);
    assert.ok(result.summary.length >= 1 && result.summary.length <= 240);
    assert.ok(result.interpretation.length >= 1 && result.interpretation.length <= 500);
    assert.ok(result.themes.length >= 1 && result.themes.length <= 5);
    assert.ok(result.moods.length >= 1 && result.moods.length <= 3);
    assert.ok(result.symbol.key && result.symbol.label && result.symbol.emoji);
    assert.ok(result.analysisModel);

    console.log('\nReal model output:\n', JSON.stringify(result, null, 2));
  },
);
