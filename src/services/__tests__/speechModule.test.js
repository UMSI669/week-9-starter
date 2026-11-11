/**
 * The native speech module must resolve optionally and never crash the app.
 *
 * Regression context: an earlier version wrapped
 * `require('expo-speech-recognition')` in try/catch. That does not work —
 * the package throws while Metro initializes it, and Metro reports
 * module-initialization failures to the global error handler regardless of
 * whether the rethrow is caught. Expo Go showed a red screen on launch:
 *
 *   Cannot find native module 'ExpoSpeechRecognition'
 *
 * The fix is requireOptionalNativeModule, which asks the native registry and
 * returns null without ever loading the failing package JS.
 */

import { jest } from '@jest/globals';

describe('when the native module is present', () => {
  beforeEach(() => jest.resetModules());

  it('returns the native module', () => {
    jest.doMock('expo-modules-core', () => ({
      requireOptionalNativeModule: () => ({ isRecognitionAvailable: () => true }),
    }));
    const { getSpeechModule, isSpeechModuleAvailable } = require('../stt/speechModule');
    expect(isSpeechModuleAvailable()).toBe(true);
    expect(getSpeechModule().isRecognitionAvailable()).toBe(true);
  });

  it('asks for the module by its registered native name', () => {
    const spy = jest.fn(() => ({}));
    jest.doMock('expo-modules-core', () => ({ requireOptionalNativeModule: spy }));
    require('../stt/speechModule').getSpeechModule();
    expect(spy).toHaveBeenCalledWith('ExpoSpeechRecognition');
  });

  it('caches the resolution', () => {
    const spy = jest.fn(() => ({}));
    jest.doMock('expo-modules-core', () => ({ requireOptionalNativeModule: spy }));
    const { getSpeechModule } = require('../stt/speechModule');
    getSpeechModule();
    getSpeechModule();
    getSpeechModule();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('when the native module is absent (Expo Go, web, stale build)', () => {
  beforeEach(() => jest.resetModules());

  it('returns null rather than throwing', () => {
    jest.doMock('expo-modules-core', () => ({ requireOptionalNativeModule: () => null }));
    const { getSpeechModule, isSpeechModuleAvailable } = require('../stt/speechModule');
    expect(() => getSpeechModule()).not.toThrow();
    expect(getSpeechModule()).toBeNull();
    expect(isSpeechModuleAvailable()).toBe(false);
  });

  it('survives an expo-modules-core version that throws anyway', () => {
    jest.doMock('expo-modules-core', () => ({
      requireOptionalNativeModule: () => {
        throw new Error("Cannot find native module 'ExpoSpeechRecognition'");
      },
    }));
    const { getSpeechModule, isSpeechModuleAvailable } = require('../stt/speechModule');
    expect(() => getSpeechModule()).not.toThrow();
    expect(isSpeechModuleAvailable()).toBe(false);
  });

  it('never loads the expo-speech-recognition package, which is what crashed', () => {
    const packageFactory = jest.fn(() => {
      throw new Error('should never be required');
    });
    jest.doMock('expo-modules-core', () => ({ requireOptionalNativeModule: () => null }));
    jest.doMock('expo-speech-recognition', packageFactory);
    require('../stt/speechModule').getSpeechModule();
    expect(packageFactory).not.toHaveBeenCalled();
  });

  it('offers a message naming Expo Go and both alternatives', () => {
    jest.doMock('expo-modules-core', () => ({ requireOptionalNativeModule: () => null }));
    const { SPEECH_MODULE_MISSING } = require('../stt/speechModule');
    expect(SPEECH_MODULE_MISSING).toMatch(/Expo Go/);
    expect(SPEECH_MODULE_MISSING).toMatch(/development build/);
    expect(SPEECH_MODULE_MISSING).toMatch(/cloud transcription/);
    expect(SPEECH_MODULE_MISSING).toMatch(/type your dream/);
  });
});
