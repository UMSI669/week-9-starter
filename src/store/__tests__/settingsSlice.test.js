/**
 * The transcription mode must adapt to what the build can actually do.
 * Defaulting to phone-native in Expo Go gives the user a record button that
 * always fails.
 */

import { jest } from '@jest/globals';

jest.mock('expo-sqlite', () => require('../../services/__tests__/sqliteFake'));

const sqliteFake = require('../../services/__tests__/sqliteFake');
const { resetDatabaseHandleForTests } = require('../../services/db');
const { writeSetting } = require('../../services/dreamRepository');
const speechModule = require('../../services/stt/speechModule');
const { configureStore } = require('@reduxjs/toolkit');
const settingsReducer = require('../settingsSlice').default;
const {
  loadSettings,
  setTranscriptionMode,
  selectTranscriptionMode,
  selectNativeSpeechAvailable,
  selectDowngradedFromPhone,
} = require('../settingsSlice');
const { TRANSCRIPTION_MODES } = require('../../services/stt');

function makeStore() {
  return configureStore({ reducer: { settings: settingsReducer } });
}

beforeEach(() => {
  sqliteFake.__resetAllDatabases();
  resetDatabaseHandleForTests();
  jest.restoreAllMocks();
});

describe('with native speech available (development build)', () => {
  beforeEach(() => {
    jest.spyOn(speechModule, 'isSpeechModuleAvailable').mockReturnValue(true);
  });

  it('defaults to phone transcription', async () => {
    const store = makeStore();
    await store.dispatch(loadSettings());
    expect(selectTranscriptionMode(store.getState())).toBe(TRANSCRIPTION_MODES.PHONE);
    expect(selectNativeSpeechAvailable(store.getState())).toBe(true);
    expect(selectDowngradedFromPhone(store.getState())).toBe(false);
  });

  it('honours a stored preference for cloud', async () => {
    await writeSetting('transcriptionMode', TRANSCRIPTION_MODES.CLOUD);
    const store = makeStore();
    await store.dispatch(loadSettings());
    expect(selectTranscriptionMode(store.getState())).toBe(TRANSCRIPTION_MODES.CLOUD);
  });
});

describe('without native speech (Expo Go, web, stale build)', () => {
  beforeEach(() => {
    jest.spyOn(speechModule, 'isSpeechModuleAvailable').mockReturnValue(false);
  });

  it('defaults to cloud transcription instead of a mode that cannot work', async () => {
    const store = makeStore();
    await store.dispatch(loadSettings());
    expect(selectTranscriptionMode(store.getState())).toBe(TRANSCRIPTION_MODES.CLOUD);
    expect(selectNativeSpeechAvailable(store.getState())).toBe(false);
  });

  it('downgrades a stored phone preference and reports that it did', async () => {
    await writeSetting('transcriptionMode', TRANSCRIPTION_MODES.PHONE);
    const store = makeStore();
    await store.dispatch(loadSettings());
    expect(selectTranscriptionMode(store.getState())).toBe(TRANSCRIPTION_MODES.CLOUD);
    expect(selectDowngradedFromPhone(store.getState())).toBe(true);
  });

  it('leaves a stored manual preference alone', async () => {
    await writeSetting('transcriptionMode', TRANSCRIPTION_MODES.MANUAL);
    const store = makeStore();
    await store.dispatch(loadSettings());
    expect(selectTranscriptionMode(store.getState())).toBe(TRANSCRIPTION_MODES.MANUAL);
    expect(selectDowngradedFromPhone(store.getState())).toBe(false);
  });
});

describe('changing the mode', () => {
  it('persists the choice and survives a reload', async () => {
    jest.spyOn(speechModule, 'isSpeechModuleAvailable').mockReturnValue(false);
    const store = makeStore();
    await store.dispatch(setTranscriptionMode(TRANSCRIPTION_MODES.MANUAL));
    expect(selectTranscriptionMode(store.getState())).toBe(TRANSCRIPTION_MODES.MANUAL);

    const reloaded = makeStore();
    await reloaded.dispatch(loadSettings());
    expect(selectTranscriptionMode(reloaded.getState())).toBe(TRANSCRIPTION_MODES.MANUAL);
  });

  it('ignores an invalid mode', async () => {
    const store = makeStore();
    await store.dispatch(setTranscriptionMode('telepathy'));
    expect(selectTranscriptionMode(store.getState())).toBe(TRANSCRIPTION_MODES.PHONE);
  });
});
