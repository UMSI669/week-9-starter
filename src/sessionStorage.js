import AsyncStorage from '@react-native-async-storage/async-storage';
import { sortRecentSessions } from './quiz';

const STORAGE_KEY = '@kids-times-tables/sessions-v1';

function isSession(value) {
  return Boolean(
    value &&
    typeof value.id === 'string' &&
    typeof value.completedAt === 'string' &&
    !Number.isNaN(Date.parse(value.completedAt)) &&
    ['Easy', 'Medium', 'Hard'].includes(value.difficulty) &&
    Number.isInteger(value.correct) &&
    value.correct >= 0 &&
    Number.isInteger(value.incorrect) &&
    value.incorrect >= 0,
  );
}

export async function loadSessions() {
  try {
    const savedValue = await AsyncStorage.getItem(STORAGE_KEY);
    if (!savedValue) return [];

    const parsed = JSON.parse(savedValue);
    if (!Array.isArray(parsed)) return [];
    return sortRecentSessions(parsed.filter(isSession));
  } catch {
    return [];
  }
}

export async function saveSession(session) {
  if (!isSession(session)) throw new Error('The completed session is invalid.');
  const savedValue = await AsyncStorage.getItem(STORAGE_KEY);
  let sessions = [];
  if (savedValue) {
    try {
      const parsed = JSON.parse(savedValue);
      if (Array.isArray(parsed)) sessions = sortRecentSessions(parsed.filter(isSession));
    } catch {
      sessions = [];
    }
  }
  const nextSessions = [session, ...sessions.filter((item) => item.id !== session.id)];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextSessions));
}
