import { buildAnalysisRequest } from '../analysis/payload';
import { requestAnalysis, AnalysisError } from '../analysis/openRouter';
import { SAMPLE_GROUND_TRUTH } from '../privacy/evaluation';
import { runDetection } from '../privacy/redaction';
import { makeProject, makeSession, sampleSegments } from '../__fixtures__/fixtures';

const privacy = { denyDataCollection: true, requireZdr: true };

async function detectedSession() {
  const segments = sampleSegments('clinic-scheduling');
  const redaction = await runDetection({ segments, knownIdentifiers: [] });
  return makeSession(segments, { redaction });
}

describe('network payload boundary', () => {
  it('contains only masked text, segment ids and approved context', async () => {
    const session = await detectedSession();
    const request = buildAnalysisRequest({ project: makeProject(), session, model: 'anthropic/claude-sonnet-5.5', privacy });
    const wire = JSON.stringify(request.body);

    for (const identifier of SAMPLE_GROUND_TRUTH['clinic-scheduling']) {
      expect(wire.toLowerCase()).not.toContain(identifier.toLowerCase());
    }
    // Never the title, project name, notes, audio path, file name or identity map.
    expect(wire).not.toContain(session.title);
    expect(wire).not.toContain('Riverside study');
    expect(wire).not.toContain(session.researcherNotes);
    expect(wire).not.toContain('file://');
    expect(wire).not.toContain('.m4a');
    expect(wire).not.toContain('PERSON:');
    for (const key of Object.keys(session.redaction!.identityMap)) expect(wire).not.toContain(key);

    expect(wire).toContain('seg_001');
    expect(wire).toContain('[PERSON_01]');
    expect(wire).toContain('How do people book appointments?');
    expect(request.leaks).toEqual([]);
    expect(request.body.provider).toEqual({ data_collection: 'deny', zdr: true, require_parameters: true });
  });

  it('omits research context unless the researcher approved sharing it', async () => {
    const session = await detectedSession();
    const request = buildAnalysisRequest({ project: makeProject({ shareContext: false }), session, model: 'm/x', privacy });
    expect(JSON.stringify(request.body)).not.toContain('How do people book appointments?');
  });

  it('masks identifiers that appear in the research context', async () => {
    const session = await detectedSession();
    const request = buildAnalysisRequest({
      project: makeProject({ researchContext: 'Recruited through Riverside Community Hospital.' }),
      session,
      model: 'm/x',
      privacy,
    });
    expect(JSON.stringify(request.body)).not.toContain('Riverside Community Hospital');
  });

  it('replaces non-role speaker labels', async () => {
    const segments = sampleSegments('clinic-scheduling').map((s, i) => (i === 1 ? { ...s, speaker: 'Maria' } : s));
    const redaction = await runDetection({ segments, knownIdentifiers: [] });
    const request = buildAnalysisRequest({ project: makeProject(), session: makeSession(segments, { redaction }), model: 'm/x', privacy });
    expect(request.masked[1].speaker).toBe('Speaker');
    expect(request.masked[0].speaker).toBe('Interviewer');
  });

  it('reports a leak when an identifier is typed in after detection and refuses to send', async () => {
    const session = await detectedSession();
    const segments = session.segments.map((s) => (s.id === 'seg_010' ? { ...s, text: `${s.text} Bye Maria Delgado!` } : s));
    const request = buildAnalysisRequest({ project: makeProject(), session: { ...session, segments }, model: 'm/x', privacy });
    expect(request.leaks.length).toBeGreaterThan(0);

    const fetchSpy = jest.fn();
    (globalThis as any).fetch = fetchSpy;
    await expect(requestAnalysis({ apiKey: 'sk-or-test-123456', request })).rejects.toBeInstanceOf(AnalysisError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('OpenRouter client error handling', () => {
  const okSession = detectedSession();

  function mockFetch(status: number, body: unknown, headers: Record<string, string> = {}) {
    (globalThis as any).fetch = jest.fn(async () => ({
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
      text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    }));
  }

  it.each([
    [401, 'auth'],
    [402, 'credits'],
    [429, 'rate-limit'],
    [503, 'provider'],
  ])('maps HTTP %i to %s', async (status, kind) => {
    const request = buildAnalysisRequest({ project: makeProject(), session: await okSession, model: 'm/x', privacy });
    mockFetch(status, { error: { message: 'nope' } }, { 'retry-after': '12' });
    await expect(requestAnalysis({ apiKey: 'sk-or-test-123456', request })).rejects.toMatchObject({ kind });
  });

  it('maps privacy-routing failures', async () => {
    const request = buildAnalysisRequest({ project: makeProject(), session: await okSession, model: 'm/x', privacy });
    mockFetch(404, { error: { message: 'No endpoints found matching your data policy' } });
    await expect(requestAnalysis({ apiKey: 'sk-or-test-123456', request })).rejects.toMatchObject({ kind: 'privacy-routing' });
  });

  it('requires an API key', async () => {
    const request = buildAnalysisRequest({ project: makeProject(), session: await okSession, model: 'm/x', privacy });
    await expect(requestAnalysis({ apiKey: null, request })).rejects.toMatchObject({ kind: 'missing-key' });
  });

  it('returns validated analysis on success', async () => {
    const request = buildAnalysisRequest({ project: makeProject(), session: await okSession, model: 'm/x', privacy });
    mockFetch(200, {
      model: 'anthropic/claude-sonnet-5.5',
      choices: [
        {
          finish_reason: 'stop',
          message: {
            content: JSON.stringify({
              summary: 'Booking by phone is unreliable.',
              codes: [{ id: 'C1', label: 'Phone booking friction', description: 'd', segment_ids: ['seg_003', 'seg_999'] }],
              themes: [{ id: 'T1', title: 'Time scarcity', description: 'd', code_ids: ['C1'] }],
              quotes: [{ segment_id: 'seg_009', text: 'I just want to book in under a minute', code_ids: ['C1'] }],
            }),
          },
        },
      ],
      usage: { prompt_tokens: 1000, completion_tokens: 200, cost: 0.004 },
    });
    const result = await requestAnalysis({ apiKey: 'sk-or-test-123456', request });
    expect(result.codes[0].segmentIds).toEqual(['seg_003']);
    expect(result.themes[0].codeIds).toEqual([result.codes[0].id]);
    expect(result.quotes[0].verbatim).toBe(true);
    expect(result.warnings.length).toBe(1);
  });

  it('times out', async () => {
    const request = buildAnalysisRequest({ project: makeProject(), session: await okSession, model: 'm/x', privacy });
    (globalThis as any).fetch = jest.fn(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')))),
    );
    await expect(requestAnalysis({ apiKey: 'sk-or-test-123456', request, timeoutMs: 20 })).rejects.toMatchObject({ kind: 'timeout' });
  });

  it('can be canceled', async () => {
    const request = buildAnalysisRequest({ project: makeProject(), session: await okSession, model: 'm/x', privacy });
    (globalThis as any).fetch = jest.fn(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')))),
    );
    const controller = new AbortController();
    const promise = requestAnalysis({ apiKey: 'sk-or-test-123456', request, signal: controller.signal });
    controller.abort();
    await expect(promise).rejects.toMatchObject({ kind: 'canceled' });
  });
});
