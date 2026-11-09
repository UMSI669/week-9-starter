import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DREAM_CATEGORIES } from '../data/dreamCategories';

const STORAGE_KEY = '@dream-journal/entries-v1';

function validEntry(entry) {
  return entry && typeof entry.id === 'string' && typeof entry.text === 'string' &&
    typeof entry.createdAt === 'string';
}

export function useDreamJournal() {
  const [dreams, setDreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const dreamsRef = useRef([]);
  const pending = useRef(Promise.resolve());
  const loadRef = useRef(Promise.resolve());
  const loadErrorRef = useRef(null);

  useEffect(() => {
    let active = true;
    loadRef.current = AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!active) return;
        const parsed = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(parsed)) throw new Error('Saved dreams are in an unexpected format.');
        dreamsRef.current = parsed.filter(validEntry);
        setDreams(dreamsRef.current);
      })
      .catch((caught) => {
        const message = caught?.message || 'Could not load saved dreams.';
        loadErrorRef.current = message;
        if (active) setError(message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const changeDreams = useCallback((change) => {
    const operation = pending.current.then(() => loadRef.current).then(async () => {
      if (loadErrorRef.current) throw new Error(loadErrorRef.current);
      const next = change(dreamsRef.current);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      dreamsRef.current = next;
      setDreams(next);
      setError(null);
    });
    pending.current = operation.catch(() => {});
    return operation;
  }, []);

  const addDream = useCallback((entry) => {
    const text = entry.text?.trim();
    if (!text) return Promise.reject(new Error('Add some dream text before saving.'));
    const dream = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      text,
      createdAt: entry.createdAt || new Date().toISOString(),
      category: DREAM_CATEGORIES.includes(entry.category) ? entry.category : 'Uncategorized',
    };
    return changeDreams((current) => [dream, ...current]);
  }, [changeDreams]);

  const updateDream = useCallback((id, changes) => changeDreams((current) => {
    const text = changes.text?.trim();
    if (!text) throw new Error('A dream cannot be empty.');
    if (!DREAM_CATEGORIES.includes(changes.category)) throw new Error('Choose a valid category.');
    return current.map((dream) => dream.id === id ? { ...dream, text, category: changes.category } : dream);
  }), [changeDreams]);

  const deleteDream = useCallback((id) => changeDreams((current) => {
    if (!current.some((dream) => dream.id === id)) throw new Error('This dream could not be found.');
    return current.filter((dream) => dream.id !== id);
  }), [changeDreams]);

  return { dreams, loading, error, addDream, updateDream, deleteDream };
}
