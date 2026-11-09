import { evaluateRedaction, SAMPLE_GROUND_TRUTH } from '../privacy/evaluation';
import { detectPatternSpans } from '../privacy/patterns';
import { assignPlaceholders, maskSegments, placeholderFor } from '../privacy/placeholders';
import { addManualPhrase, runDetection, setSpanStatus } from '../privacy/redaction';
import { reconcileSpans } from '../privacy/spans';
import { sampleSegments } from '../__fixtures__/fixtures';

describe('pattern detection on synthetic interviews', () => {
  it.each(Object.keys(SAMPLE_GROUND_TRUTH))('masks every known identifier in %s', async (id) => {
    const segments = sampleSegments(id);
    const state = await runDetection({ segments, knownIdentifiers: [] });
    const masked = maskSegments(segments, state.spans, state.identityMap);
    const evaluation = evaluateRedaction(segments, masked, state.spans, SAMPLE_GROUND_TRUTH[id]);
    expect(evaluation.missed).toEqual([]);
    // The participant's wording should remain overwhelmingly intact.
    expect(evaluation.preservedRatio).toBeGreaterThan(0.85);
  });

  it('detects structured identifiers', () => {
    const spans = detectPatternSpans([
      {
        id: 'seg_001',
        startMs: 0,
        endMs: 1,
        text: 'Email me at a.b@example.org or call (313) 555-0100. My SSN is 123-45-6789, born March 3rd, 1984.',
        recognizedText: '',
        edited: false,
      },
    ]);
    const byCategory = Object.fromEntries(spans.map((s) => [s.text, s.category]));
    expect(byCategory['a.b@example.org']).toBe('EMAIL');
    expect(byCategory['(313) 555-0100']).toBe('PHONE');
    expect(byCategory['123-45-6789']).toBe('ID');
    expect(byCategory['March 3rd, 1984']).toBe('DATE');
  });

  it('does not treat ordinary capitalized words as names', () => {
    const spans = detectPatternSpans([
      { id: 'seg_001', startMs: 0, endMs: 1, text: "I'm Not sure. Honestly, I'm Happy with it. Sure.", recognizedText: '', edited: false },
    ]);
    expect(spans.filter((s) => s.category === 'PERSON')).toEqual([]);
  });
});

describe('placeholders', () => {
  it('maps a full name and later first-name mentions to the same placeholder', async () => {
    const segments = [
      { id: 'seg_001', startMs: 0, endMs: 1, text: 'My name is Maria Delgado.', recognizedText: '', edited: false },
      { id: 'seg_002', startMs: 1, endMs: 2, text: 'Everyone calls Maria the scheduler.', recognizedText: '', edited: false },
      { id: 'seg_003', startMs: 2, endMs: 3, text: 'My son Leo and Maria went together.', recognizedText: '', edited: false },
    ];
    const state = await runDetection({ segments, knownIdentifiers: [] });
    const masked = maskSegments(segments, state.spans, state.identityMap);
    expect(masked[0].text).toBe('My name is [PERSON_01].');
    expect(masked[1].text).toBe('Everyone calls [PERSON_01] the scheduler.');
    expect(masked[2].text).toBe('My son [PERSON_02] and [PERSON_01] went together.');
  });

  it('keeps placeholders stable across re-detection and edits', async () => {
    const segments = sampleSegments('transit-commute');
    const first = await runDetection({ segments, knownIdentifiers: [] });
    const edited = segments.map((s) => (s.id === 'seg_002' ? { ...s, text: `Well, ${s.text}` } : s));
    const second = await runDetection({ segments: edited, knownIdentifiers: [], previous: first });
    for (const [key, placeholder] of Object.entries(first.identityMap)) {
      expect(second.identityMap[key]).toBe(placeholder);
    }
  });

  it('never renumbers existing assignments', () => {
    const map = assignPlaceholders(
      [{ id: 'a', segmentId: 's', start: 0, end: 4, text: 'Zoey', category: 'PERSON', source: 'manual', status: 'accepted' }],
      { 'PERSON:anna': '[PERSON_03]' },
    );
    expect(map['PERSON:zoey']).toBe('[PERSON_04]');
    expect(map['PERSON:anna']).toBe('[PERSON_03]');
  });
});

describe('masking preserves wording', () => {
  it('changes only the replaced spans', async () => {
    const segments = sampleSegments('clinic-scheduling');
    const state = await runDetection({ segments, knownIdentifiers: [] });
    const masked = maskSegments(segments, state.spans, state.identityMap);
    masked.forEach((m, i) => {
      // Rebuild the original by substituting each placeholder back in order.
      const spans = state.spans.filter((s) => s.segmentId === m.id && s.status === 'accepted').sort((a, b) => a.start - b.start);
      let rebuilt = m.text;
      let from = 0;
      for (const span of spans) {
        const placeholder = placeholderFor(span, state.identityMap);
        const at = rebuilt.indexOf(placeholder, from);
        rebuilt = rebuilt.slice(0, at) + span.text + rebuilt.slice(at + placeholder.length);
        from = at + span.text.length;
      }
      expect(rebuilt).toBe(segments[i].text);
    });
  });

  it('respects researcher rejections and manual phrases', async () => {
    const segments = sampleSegments('clinic-scheduling');
    let state = await runDetection({ segments, knownIdentifiers: [] });
    const annArbor = state.spans.find((s) => s.text === 'Ann Arbor');
    expect(annArbor).toBeDefined();
    state = setSpanStatus(state, [annArbor!.id], 'rejected');
    ({ state } = addManualPhrase(state, segments, 'surgery prep', 'CONTEXT'));
    const masked = maskSegments(segments, state.spans, state.identityMap).map((m) => m.text).join(' ');
    expect(masked).toContain('Ann Arbor');
    expect(masked).toContain('[CONTEXT_01]');
    // Rejection survives a re-run.
    const rerun = await runDetection({ segments, knownIdentifiers: [], previous: state });
    expect(rerun.spans.find((s) => s.text === 'Ann Arbor')?.status).toBe('rejected');
  });

  it('masks project-level known identifiers', async () => {
    const segments = [{ id: 'seg_001', startMs: 0, endMs: 1, text: 'We use the Acme portal daily.', recognizedText: '', edited: false }];
    const state = await runDetection({ segments, knownIdentifiers: [{ id: 'k', text: 'acme', category: 'ORG' }] });
    expect(maskSegments(segments, state.spans, state.identityMap)[0].text).toBe('We use the [ORG_01] portal daily.');
  });

  it('re-anchors spans after edits and drops spans whose text was removed', () => {
    const segments = [{ id: 'seg_001', startMs: 0, endMs: 1, text: 'Hi, I am with Bob.', recognizedText: '', edited: true }];
    const spans = reconcileSpans(segments, [
      { id: 'a', segmentId: 'seg_001', start: 0, end: 3, text: 'Bob', category: 'PERSON', source: 'pattern', status: 'accepted' },
      { id: 'b', segmentId: 'seg_001', start: 0, end: 5, text: 'Alice', category: 'PERSON', source: 'pattern', status: 'accepted' },
    ]);
    expect(spans).toHaveLength(1);
    expect(spans[0].start).toBe(14);
  });
});
