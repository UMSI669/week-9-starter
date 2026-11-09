import { validateAnalysis } from '../analysis/validate';
import { chunkSegments, detectWithLlm, locateEntities, parseEntities } from '../privacy/llmDetector';
import { runDetection } from '../privacy/redaction';
import { groupTokens, splitTextEvenly } from '../transcription/segmenter';
import { makeSession, sampleSegments } from '../__fixtures__/fixtures';
import dataReducer, { dataActions } from '../../store/dataSlice';

const masked = [
  { id: 'seg_001', startMs: 0, endMs: 1, text: 'I call [ORG_01] every morning.' },
  { id: 'seg_002', startMs: 1, endMs: 2, text: 'It never works.' },
];

describe('validateAnalysis', () => {
  it('rejects malformed shapes', () => {
    expect(() => validateAnalysis('not json', masked, { model: 'm', sentFingerprint: 'f' })).toThrow();
    expect(() => validateAnalysis(JSON.stringify({ summary: 1, codes: [], themes: [], quotes: [] }), masked, { model: 'm', sentFingerprint: 'f' })).toThrow(/summary/);
  });

  it('flags non-verbatim quotes and drops unknown segments', () => {
    const result = validateAnalysis(
      JSON.stringify({
        summary: 's',
        codes: [],
        themes: [],
        quotes: [
          { segment_id: 'seg_001', text: '“I call [ORG_01] every morning.”', code_ids: [] },
          { segment_id: 'seg_002', text: 'It always works', code_ids: [] },
          { segment_id: 'seg_404', text: 'x', code_ids: [] },
        ],
      }),
      masked,
      { model: 'm', sentFingerprint: 'f' },
    );
    expect(result.quotes.map((q) => q.verbatim)).toEqual([true, false]);
    expect(result.warnings).toHaveLength(2);
  });
});

describe('local LLM detector (model injected)', () => {
  const segments = sampleSegments('transit-commute');

  it('chunks long transcripts on segment boundaries', () => {
    const chunks = chunkSegments(segments, 300);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.flatMap((c) => c.segments).map((s) => s.id)).toEqual(segments.map((s) => s.id));
  });

  it('parses JSON wrapped in prose and discards hallucinated entities', () => {
    const chunk = { segments: segments.slice(0, 3), chars: 0 };
    const entities = parseEntities('Sure! {"entities":[{"segment_id":"seg_002","text":"Northwind Logistics","category":"ORG"},{"segment_id":"seg_002","text":"Gotham City","category":"LOCATION"}]}');
    const spans = locateEntities(chunk, entities);
    expect(spans.map((s) => s.text)).toEqual(['Northwind Logistics']);
  });

  it('passes known entities forward so later chunks stay consistent', async () => {
    const prompts: string[] = [];
    const complete = jest.fn(async (messages: { content: string }[]) => {
      prompts.push(messages[1].content);
      return JSON.stringify({ entities: [{ segment_id: 'seg_002', text: 'Okafor', category: 'PERSON' }] });
    });
    const result = await detectWithLlm({ segments, complete, maxChars: 300 });
    expect(complete).toHaveBeenCalledTimes(result.chunks);
    expect(prompts[1]).toContain('Okafor');
  });

  it('integrates with the pipeline and records detector stats', async () => {
    const complete = async () => JSON.stringify({ entities: [{ segment_id: 'seg_006', text: 'ride share', category: 'CONTEXT' }] });
    const state = await runDetection({ segments, knownIdentifiers: [], llm: { complete, modelId: 'fake' } });
    expect(state.detector).toBe('patterns+local-llm');
    expect(state.spans.some((s) => s.source === 'local-llm' && s.text === 'ride share')).toBe(true);
  });
});

describe('segmenter', () => {
  it('groups word timestamps into sentences and pauses', () => {
    const words = 'Hello there this is a long enough sentence for one segment of text.'.split(' ');
    const tokens = [
      ...words.map((w, i) => ({ text: w, startMs: i * 300, endMs: i * 300 + 250 })),
      { text: 'After', startMs: 10_000, endMs: 10_300 },
      { text: 'pause.', startMs: 10_300, endMs: 10_600 },
    ];
    const segments = groupTokens(tokens);
    expect(segments).toHaveLength(2);
    expect(segments[1]).toEqual({ startMs: 10_000, endMs: 10_600, text: 'After pause.' });
  });

  it('spreads untimed text across the duration', () => {
    const segments = splitTextEvenly('One sentence that is reasonably long here. Another sentence that is long enough too.', 10_000);
    expect(segments[segments.length - 1].endMs).toBeLessThanOrEqual(10_000);
  });
});

describe('store invariants', () => {
  it('editing a segment clears the privacy review', async () => {
    const segments = sampleSegments('clinic-scheduling');
    const redaction = await runDetection({ segments, knownIdentifiers: [] });
    let state = dataReducer(undefined, dataActions.hydrated({ projects: [], sessions: [makeSession(segments, { redaction })] }));
    state = dataReducer(state, dataActions.redactionReviewed({ id: 'sess_test', fingerprint: 'x' }));
    expect(state.sessions.sess_test.redaction?.reviewedAt).not.toBeNull();
    state = dataReducer(state, dataActions.segmentEdited({ id: 'sess_test', segmentId: 'seg_002', changes: { text: 'changed' } }));
    expect(state.sessions.sess_test.redaction?.reviewedAt).toBeNull();
    expect(state.sessions.sess_test.segments[1].edited).toBe(true);
    expect(state.sessions.sess_test.segments[1].recognizedText).not.toBe('changed');
  });

  it('new segments never reuse ids', () => {
    const segments = sampleSegments('clinic-scheduling');
    let state = dataReducer(undefined, dataActions.hydrated({ projects: [], sessions: [makeSession(segments)] }));
    state = dataReducer(state, dataActions.segmentDeleted({ id: 'sess_test', segmentId: 'seg_005' }));
    state = dataReducer(state, dataActions.segmentAdded({ id: 'sess_test', afterSegmentId: 'seg_004' }));
    const ids = state.sessions.sess_test.segments.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('seg_011');
  });
});
