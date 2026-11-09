import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { decodeExpenses, STORAGE_KEY } from '../lib/expense';

export function useExpenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingUndo, setPendingUndo] = useState(null);
  const current = useRef([]);
  const queue = useRef(Promise.resolve());
  const undoTimer = useRef(null);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      const items = decodeExpenses(raw);
      if (mounted) { current.current = items; setExpenses(items); setLoading(false); }
    }).catch(e => { if (mounted) { setError(e.message || 'Could not load saved expenses.'); setLoading(false); } });
    return () => { mounted = false; if (undoTimer.current) clearTimeout(undoTimer.current); };
  }, []);

  const mutate = useCallback((makeNext) => {
    const operation = queue.current.then(async () => {
      if (loading || error) throw new Error(error || 'Expenses are still loading.');
      const next = makeNext(current.current);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      current.current = next;
      setExpenses(next);
      return next;
    });
    queue.current = operation.catch(() => {});
    return operation;
  }, [loading, error]);

  const save = useCallback(expense => mutate(items => [expense, ...items].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))), [mutate]);

  const remove = useCallback(async id => {
    const target = current.current.find(item => item.id === id);
    if (!target) throw new Error('Expense was not found.');
    await mutate(items => items.filter(item => item.id !== id));
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setPendingUndo(target);
    undoTimer.current = setTimeout(() => { setPendingUndo(null); undoTimer.current = null; }, 5000);
  }, [mutate]);

  const undo = useCallback(async () => {
    if (!pendingUndo) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = null;
    await mutate(items => items.some(item => item.id === pendingUndo.id) ? items : [...items, pendingUndo].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)));
    setPendingUndo(null);
  }, [mutate, pendingUndo]);

  return { expenses, loading, error, pendingUndo, save, remove, undo };
}
