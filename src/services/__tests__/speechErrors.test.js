/**
 * Every speech failure must produce a message that says what went wrong AND
 * what the user can do instead. A raw native string is a bug.
 */

import { TYPE_INSTEAD, describeSpeechError } from '../stt/speechErrors';

describe('recognizer initialization failures', () => {
  // The exact string iOS produces on the Simulator.
  const variants = [
    'Failed to initialize recognizer',
    'failed to initialize recognizer',
    'Error: failed to initialise recognizer',
    'recognizer is nil',
    'Speech recognizer unavailable',
    'recognizer not available',
  ];

  it.each(variants)('explains %s in terms of the Simulator', (raw) => {
    const message = describeSpeechError(raw);
    expect(message).toMatch(/Simulator/);
    expect(message).toMatch(/physical iPhone/);
    expect(message).toContain(TYPE_INSTEAD);
  });

  it('accepts an Error as well as a string', () => {
    expect(describeSpeechError(new Error('failed to initialize recognizer'))).toMatch(/Simulator/);
  });
});

describe('audio session failures', () => {
  it.each([
    'AVAudioSession activation failed',
    'The audio engine could not start',
    'no audio input device',
  ])('explains %s and offers typing', (raw) => {
    const message = describeSpeechError(raw);
    expect(message).toMatch(/microphone could not be opened/i);
    expect(message).toContain(TYPE_INSTEAD);
  });
});

describe('permission failures', () => {
  it.each(['not-allowed', 'Microphone permission denied', 'permission was not granted'])(
    'explains %s and offers typing',
    (raw) => {
      expect(describeSpeechError(raw)).toContain(TYPE_INSTEAD);
    },
  );
});

describe('fallbacks', () => {
  it('passes through an unrecognised message rather than inventing one', () => {
    expect(describeSpeechError('Some brand new error')).toBe('Some brand new error');
  });

  it('never returns an empty string', () => {
    [null, undefined, '', '   ', new Error('')].forEach((value) => {
      expect(describeSpeechError(value).length).toBeGreaterThan(0);
    });
  });

  it('always offers an alternative for the failures it recognises', () => {
    ['failed to initialize recognizer', 'AVAudioSession error', 'permission denied'].forEach(
      (raw) => expect(describeSpeechError(raw)).toContain(TYPE_INSTEAD),
    );
  });
});
