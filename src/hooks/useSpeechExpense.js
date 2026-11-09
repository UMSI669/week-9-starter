import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

function speechModule() {
  try { return require('expo-speech-recognition').ExpoSpeechRecognitionModule; }
  catch { return null; }
}

export function useSpeechExpense(onTranscript) {
  const [state, setState] = useState('idle');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const generation = useRef(0);
  const active = useRef(false);
  const subscriptions = useRef([]);
  const latest = useRef('');
  const mounted = useRef(true);
  const startup = useRef(false);

  const cleanup = useCallback((abort = false) => {
    generation.current += 1;
    subscriptions.current.forEach(item => item.remove());
    subscriptions.current = [];
    if (abort && active.current) { try { speechModule()?.abort(); } catch {} }
    active.current = false;
    startup.current = false;
  }, []);

  useEffect(() => () => { mounted.current = false; cleanup(true); }, [cleanup]);

  const start = useCallback(async () => {
    if (startup.current || active.current) return;
    cleanup(true);
    const token = generation.current;
    const module = speechModule();
    setError(''); setTranscript(''); latest.current = '';
    if (!module) { setError('Voice input needs a development build on iOS or Android. Use a supported browser or enter an expense manually.'); return; }
    startup.current = true;
    setState('starting');
    try {
      if (!module.isRecognitionAvailable()) throw new Error(Platform.OS === 'web' ? 'This browser does not support speech recognition. Try Chrome or Safari on a desktop, or use manual entry.' : 'Speech recognition is unavailable on this device. Use manual entry.');
      const permission = await module.requestPermissionsAsync();
      if (token !== generation.current || !mounted.current) return;
      if (!permission.granted) throw new Error('Microphone or speech recognition permission was denied. Use manual entry or enable permission in Settings.');
      // Permission dialogs can temporarily background iOS; wait for the app to be active.
      if (Platform.OS !== 'web' && AppState.currentState !== 'active') await new Promise(resolve => {
        const subscription = AppState.addEventListener('change', next => { if (next === 'active') { subscription.remove(); resolve(); } });
        setTimeout(() => { subscription.remove(); resolve(); }, 5000);
      });
      if (token !== generation.current || !mounted.current) return;
      subscriptions.current = [
        module.addListener('result', event => {
          if (token !== generation.current) return;
          const value = event.results?.[0]?.transcript?.trim() || '';
          if (value) { latest.current = value; setTranscript(value); }
        }),
        module.addListener('error', event => {
          if (token !== generation.current || event.error === 'aborted') return;
          setError(event.message || `Recognition failed: ${event.error || 'unknown error'}. Try again or use manual entry.`);
          setState('idle'); cleanup(true);
        }),
        module.addListener('end', () => {
          if (token !== generation.current) return;
          const finalText = latest.current;
          cleanup(); setState('idle');
          if (finalText) onTranscript(finalText);
          else setError('No speech was recognized. Try again or use manual entry.');
        }),
      ];
      active.current = true;
      module.start({ lang: 'en-US', interimResults: true, continuous: false, addsPunctuation: true, requiresOnDeviceRecognition: false });
      startup.current = false;
      setState('listening');
    } catch (e) {
      if (token === generation.current && mounted.current) { cleanup(true); setState('idle'); setError(e.message || 'Could not start listening.'); }
    }
  }, [cleanup, onTranscript]);

  const stop = useCallback(() => {
    if (!active.current) return;
    setState('processing');
    try { speechModule()?.stop(); }
    catch (e) { cleanup(true); setState('idle'); setError(e.message || 'Could not stop recording.'); }
  }, [cleanup]);

  return { state, transcript, error, start, stop };
}
