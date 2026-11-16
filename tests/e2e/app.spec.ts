import { test, expect, type Page } from '@playwright/test';

const endpointErrors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const errors: string[] = [];
  endpointErrors.set(page, errors);
  page.on('console', message => {
    const text = message.text();
    if (text.includes('Error encountered handling the endpoint')) errors.push(text);
  });
  page.on('pageerror', error => errors.push(error.message));
});
test.afterEach(({ page }) => {
  expect(endpointErrors.get(page), 'Browser runtime and RTK Query must not raise unexpected errors').toEqual([]);
});

const groceryItems = [
  { name: 'apple', quantity: 1, unit: '', category: 'Produce', emoji: '🍎', quantityInferred: true },
  { name: 'egg', quantity: 1, unit: '', category: 'Dairy', emoji: '🥚', quantityInferred: true },
  { name: 'milk', quantity: 2, unit: 'gal', category: 'Dairy', emoji: '🥛', quantityInferred: false },
  { name: 'bread', quantity: 1, unit: 'loaf', category: 'Bakery', emoji: '🍞', quantityInferred: false },
];
async function home(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('textbox', { name: 'Quick-add item name' })).toBeVisible();
  await expect(page.getByText('A fresh list for a fresh week', { exact: true })).toBeVisible();
}
async function quickAdd(page: Page, name: string) {
  await page.getByRole('textbox', { name: 'Quick-add item name' }).fill(name);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByRole('button', { name: `Edit ${name}`, exact: true })).toBeVisible();
}
async function record(page: Page) {
  await page.getByRole('button', { name: 'Record a shopping list' }).click();
  await page.getByRole('button', { name: 'Start recording', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Stop and make my list' })).toBeVisible();
  await page.waitForTimeout(1100);
  await page.getByRole('button', { name: 'Stop and make my list' }).click();
}
async function mockParser(page: Page, fail = false) {
  await page.route('**/api/format', async route => {
    const body = route.request().postDataJSON();
    expect(typeof body.transcript).toBe('string');
    expect(route.request().headers().authorization).toBeUndefined();
    await route.fulfill({ status: fail ? 503 : 200, contentType: 'application/json', body: JSON.stringify(fail ? { error: { message: 'Service unavailable' } } :
      { items: groceryItems }) });
  });
}

test('web formatting API is served by Expo and rejects invalid transcripts before calling Toolkit', async ({ request }) => {
  const response = await request.post('/api/format', { data: { transcript: '' } });
  expect(response.status()).toBe(400);
  expect(await response.json()).toEqual({ error: { message: 'The transcript is empty.' } });
});

test('manual list supports merge, check-off, view persistence, editing, and delete undo', async ({ page }) => {
  await home(page); await quickAdd(page, 'Milk');
  await page.getByRole('textbox', { name: 'Quick-add item name' }).fill('milk');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText('Milk already on your list, now 2', { exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Check Milk', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Check Milk', exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'grid view', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'grid view', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'Edit Milk', exact: true }).click();
  await page.getByRole('textbox', { name: 'Item name', exact: true }).fill('Oat milk');
  await page.getByRole('button', { name: 'Category: Dairy', exact: true }).click();
  await page.getByRole('button', { name: 'Unit: gal', exact: true }).click();
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit Oat milk', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Delete Oat milk', exact: true }).last().click();
  await expect(page.getByRole('button', { name: 'Undo deletion' })).toBeVisible();
  await page.getByRole('button', { name: 'Undo deletion' }).click();
  await expect(page.getByRole('button', { name: 'Edit Oat milk', exact: true })).toBeVisible();
});

test('voice pipeline uploads audio, reviews JSON, reparses edits, and saves with voice badges', async ({ page }) => {
  let uploads = 0;
  await page.route('https://openrouter.ai/api/v1/audio/transcriptions', async route => {
    uploads++;
    expect(route.request().headers()['content-type']).toContain('multipart/form-data');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: 'Make me a shopping list that includes apples, eggs, two gallons of milk, and a loaf of bread. Thank you.' }) });
  });
  await mockParser(page); await home(page); await record(page);
  await expect(page.getByRole('textbox', { name: 'Voice item 1 name', exact: true })).toHaveValue('apple');
  await expect(page.getByText('Quantity not heard · assumed 1', { exact: true })).toHaveCount(2);
  await page.getByRole('textbox', { name: 'Edit transcript' }).fill('Apples, eggs, two gallons of milk, a loaf of bread.');
  await expect(page.getByRole('button', { name: 'Save 4 items to this week' })).toBeDisabled();
  await page.getByRole('button', { name: 'Re-parse transcript' }).click();
  await expect(page.getByRole('button', { name: 'Save 4 items to this week' })).toBeEnabled();
  expect(uploads).toBe(1);
  await page.getByRole('button', { name: 'Remove voice item 2' }).click();
  await page.getByRole('button', { name: 'Save 3 items to this week' }).click();
  await expect(page.getByRole('button', { name: 'Edit milk', exact: true })).toBeVisible();
  await expect(page.getByText('voice', { exact: true })).toHaveCount(3);
});

test('failed transcription retains recording for retry; failed parser offers editable fallback', async ({ page }) => {
  let uploads = 0;
  await page.route('https://openrouter.ai/api/v1/audio/transcriptions', async route => {
    uploads++;
    await route.fulfill({ status: uploads === 1 ? 503 : 200, contentType: 'application/json', body: JSON.stringify(uploads === 1 ? { error: { message: 'Try again' } } : { text: 'Buy apples and two gallons of milk.' }) });
  });
  await mockParser(page, true); await home(page); await record(page);
  await expect(page.getByRole('button', { name: 'Retry transcription' })).toBeVisible();
  await page.getByRole('button', { name: 'Retry transcription' }).click();
  await expect(page.getByText(/Automatic formatting failed/)).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Voice item 1 name' })).toHaveValue('apple');
  await expect(page.getByRole('textbox', { name: 'Voice item 2 name' })).toHaveValue('milk');
  await page.getByRole('button', { name: 'Save 2 items to this week' }).click();
  await expect(page.getByRole('button', { name: 'Edit milk', exact: true })).toBeVisible();
});

test('Sunday rollover preserves history and carries unfinished items only once', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-07T23:59:00-05:00') });
  await home(page); await quickAdd(page, 'Milk'); await quickAdd(page, 'Egg');
  await page.getByRole('checkbox', { name: 'Check Egg', exact: true }).click();
  await page.clock.fastForward(120000);
  await expect(page.getByText('Nov 8 – Nov 14', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit Milk', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit Egg', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Edit Milk', exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Week history' }).click();
  await page.getByRole('button', { name: 'View week Nov 1 – Nov 7' }).click();
  await expect(page.getByText('Egg', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Copy 1 unchecked to this week' }).click();
  await page.getByRole('button', { name: 'Copy to this week', exact: true }).click();
  await expect(page.getByText('Milk already on your list, now 2', { exact: true })).toBeVisible();
});

test('manual list works offline and clear-data requires confirmation', async ({ page, context }) => {
  await home(page); await context.setOffline(true); await quickAdd(page, 'Apple');
  await page.getByRole('tab', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Clear all data', exact: true }).click();
  await expect(page.getByText('Clear all grocery data?', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('tab', { name: 'Home' }).click();
  await expect(page.getByRole('button', { name: 'Edit Apple', exact: true })).toBeVisible();
  await context.setOffline(false);
});

test('recording warns at 50 seconds and automatically stops at 60', async ({ page }) => {
  await page.clock.install();
  await page.route('https://openrouter.ai/api/v1/audio/transcriptions', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: 'Apple' }) }));
  await mockParser(page); await home(page);
  await page.getByRole('button', { name: 'Record a shopping list' }).click();
  await page.getByRole('button', { name: 'Start recording', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Stop and make my list' })).toBeVisible();
  await page.waitForTimeout(1200);
  await page.clock.fastForward(51000);
  await expect(page.getByText('10 seconds left. Wrapping up at 60 seconds.', { exact: true })).toBeVisible();
  await page.clock.fastForward(10000);
  await expect(page.getByRole('textbox', { name: 'Voice item 1 name' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Stop and make my list' })).toHaveCount(0);
});

test('backgrounding stops the microphone and retains audio without uploading', async ({ page }) => {
  let uploads = 0;
  await page.route('https://openrouter.ai/api/v1/audio/transcriptions', route => { uploads++; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: 'Apple' }) }); });
  await home(page);
  await page.getByRole('button', { name: 'Record a shopping list' }).click();
  await page.getByRole('button', { name: 'Start recording', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Stop and make my list' })).toBeVisible();
  await page.waitForTimeout(1000);
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect(page.getByRole('button', { name: 'Retry transcription' })).toBeVisible();
  expect(uploads).toBe(0);
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
});

test('denied microphone permission shows an actionable error', async ({ page }) => {
  await page.addInitScript(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Permission denied', 'NotAllowedError'); }; });
  await home(page);
  await page.getByRole('button', { name: 'Record a shopping list' }).click();
  await page.getByRole('button', { name: 'Start recording', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open microphone settings' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Stop and make my list' })).toHaveCount(0);
});

test('checkbox updates preserve list order and filtering keeps other items', async ({ page }) => {
  await home(page); await quickAdd(page, 'Apple'); await quickAdd(page, 'Banana');
  const apple = page.getByRole('button', { name: 'Edit Apple', exact: true });
  const banana = page.getByRole('button', { name: 'Edit Banana', exact: true });
  const checkbox = page.getByRole('checkbox', { name: 'Check Apple', exact: true });
  for (const checked of [true, false, true]) {
    await checkbox.click();
    await expect(checkbox).toHaveAttribute('aria-checked', String(checked));
    await expect(page.getByRole('button', { name: /^Edit (Apple|Banana)$/ }).first()).toHaveAttribute('aria-label', 'Edit Apple');
    await expect(banana).toBeVisible();
  }
  await page.reload();
  await expect(checkbox).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('button', { name: /^Edit (Apple|Banana)$/ }).first()).toHaveAttribute('aria-label', 'Edit Apple');
  await page.getByRole('textbox', { name: 'Search groceries' }).fill('Apple');
  await expect(apple).toBeVisible(); await expect(banana).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Search groceries' }).clear();
  await expect(banana).toBeVisible();
});
