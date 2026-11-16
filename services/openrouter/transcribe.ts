import { fetch as expoFetch } from 'expo/fetch';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

export async function transcribeAudio(uri: string, signal?: AbortSignal) {
  const apiKey = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error('Add the Whisper API key to enable transcription.');
  const body = new FormData();
  if (Platform.OS === 'web') {
    const recording = await fetch(uri).then(response => response.blob());
    if (!recording.size) throw new Error('The recording is empty. Please record again.');
    const extension = recording.type.includes('mp4') ? 'm4a' : recording.type.includes('ogg') ? 'ogg' : 'webm';
    body.append('file', recording, `recording.${extension}`);
  } else {
    const file = new File(uri);
    if (!file.exists || !file.size) throw new Error('The recording is empty or unavailable. Please record again.');
    body.append('file', file as unknown as Blob);
  }
  body.append('model', process.env.EXPO_PUBLIC_TRANSCRIPTION_MODEL?.trim() || 'openai/whisper-large-v3-turbo');
  const baseUrl = (process.env.EXPO_PUBLIC_OPENROUTER_BASE_URL?.trim() || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
  const response = await expoFetch(`${baseUrl}/audio/transcriptions`, {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' }, body, signal,
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Transcription failed (HTTP ${response.status}). ${typeof result?.error?.message === 'string' ? result.error.message : 'Please retry.'}`);
  if (typeof result?.text !== 'string' || !result.text.trim()) throw new Error('No speech was heard. Please try a new recording.');
  return result.text.trim() as string;
}
