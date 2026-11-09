import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { POST } from '../app/api/format+api';
import { parseGroceriesOnWeb } from '../services/umgpt/parser';
import { blankDraft } from '../utils/groceries';

function serverKey(t: TestContext) {
  const previous = process.env.UMGPT_API_KEY;
  process.env.UMGPT_API_KEY = 'test-server-key';
  t.after(() => {
    if (previous === undefined) delete process.env.UMGPT_API_KEY;
    else process.env.UMGPT_API_KEY = previous;
  });
}
function request(body: unknown) {
  return new Request('http://localhost/api/format', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

test('web formatting sends only a transcript to its own origin and validates returned items', async () => {
  const fetcher: typeof fetch = async (url, options) => {
    assert.equal(url, '/api/format');
    assert.equal(new Headers(options?.headers).get('Authorization'), null);
    assert.deepEqual(JSON.parse(String(options?.body)), { transcript: 'Milk' });
    return Response.json({ items: [blankDraft('Milk')] });
  };
  assert.deepEqual(await parseGroceriesOnWeb('Milk', undefined, fetcher), [blankDraft('Milk')]);
  await assert.rejects(parseGroceriesOnWeb('Milk', undefined, async () => Response.json({ items: [{ name: 'Milk' }] })), /invalid|missing/);
  await assert.rejects(parseGroceriesOnWeb('Milk', undefined, async () => Response.json({ error: { message: 'Try again' } }, { status: 502 })), /Try again/);
});

test('web API authenticates upstream server-side, uses strict JSON schema, and returns grocery items', async t => {
  serverKey(t);
  t.mock.method(globalThis, 'fetch', async (url: RequestInfo | URL, options?: RequestInit) => {
    assert.equal(url, 'https://api.toolkit.umgpt.umich.edu/v1/responses');
    assert.equal(new Headers(options?.headers).get('Authorization'), 'Bearer test-server-key');
    const body = JSON.parse(String(options?.body));
    assert.equal(body.text.format.strict, true);
    assert.equal(body.input[1].content, 'Milk');
    return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ items: [blankDraft('Milk')] }) }] }] });
  });
  const response = await POST(request({ transcript: 'Milk' }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), { items: [blankDraft('Milk')] });
});

test('invalid and oversized web transcripts cannot generate upstream requests', async t => {
  const upstream = t.mock.method(globalThis, 'fetch', async () => assert.fail('Invalid input must not reach Toolkit.'));
  for (const body of [{}, { transcript: '' }, { transcript: 12 }, { transcript: 'a'.repeat(12001) }]) {
    assert.equal((await POST(request(body))).status, 400);
  }
  assert.equal(upstream.mock.callCount(), 0);
});

test('web API rejects invalid model responses and redacts server credentials in upstream errors', async t => {
  serverKey(t);
  t.mock.method(globalThis, 'fetch', async () => Response.json({ status: 'completed', output: [] }));
  assert.equal((await POST(request({ transcript: 'Milk' }))).status, 502);
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Invalid credential test-server-key'); });
  const response = await POST(request({ transcript: 'Milk' }));
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: { message: 'Invalid credential [redacted]' } });
});
