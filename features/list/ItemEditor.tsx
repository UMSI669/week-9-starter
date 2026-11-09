import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CATEGORIES, UNITS, CATEGORY_EMOJI, blankDraft, type GroceryDraft } from '../../utils/groceries';
import { useAddMutation, useRecentQuery, useSnapshotQuery, useUpdateMutation } from '../../store/listApi';
import { useAppDispatch } from '../../store';
import { notice } from '../../store/uiSlice';
import { safeError } from '../../services/apiErrors';
import { styles } from '../../theme';
import { BackHeader, Button, ChoiceChips, ErrorState, QuantityStepper, Screen } from '../common/ui';

export default function ItemEditor() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, isLoading, error, refetch } = useSnapshotQuery(); const { data: recent } = useRecentQuery();
  const [edited, setDraft] = useState<GroceryDraft | null>(null); const [message, setMessage] = useState('');
  const savedItem = data?.items.find(item => item.id === id);
  const draft = edited || (savedItem ? { ...savedItem, quantityInferred: Boolean(savedItem.quantityInferred) } : blankDraft());
  const [add, addState] = useAddMutation(); const [update, updateState] = useUpdateMutation(); const dispatch = useAppDispatch();
  const save = async () => {
    setMessage('');
    try {
      const result = id ? await update({ id, item: draft }).unwrap() : await add({ items: [draft] }).unwrap();
      for (const text of result.merged) dispatch(notice({ text }));
      if (!result.merged.length) dispatch(notice({ text: id ? 'Item updated' : 'Added to this week' }));
      router.back();
    } catch (err) { setMessage(safeError(err)); }
  };
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><Screen>
    <BackHeader title={id ? 'Edit item' : 'Add an item'} onBack={() => router.back()} />
    <View style={{ gap: 7 }}><Text style={styles.eyebrow}>MAKE ROOM FOR THE GOOD STUFF</Text><Text style={styles.title}>{id ? 'A little adjustment' : 'What do you need?'}</Text><Text style={styles.subtitle}>Keep your list just the way you like it.</Text></View>
    {isLoading ? <ActivityIndicator /> : error ? <ErrorState message={safeError(error)} retry={() => void refetch()} /> : <>
      <View style={styles.card}><Text style={{ fontSize: 48, textAlign: 'center' }}>{draft.emoji}</Text>
        <View><Text style={styles.label}>Item name</Text><TextInput accessibilityLabel="Item name" style={styles.input} value={draft.name} onChangeText={name => setDraft({ ...draft, name })} placeholder="e.g. Apple" maxLength={120} autoFocus={!id} /></View>
        <View><Text style={styles.label}>Quantity</Text><QuantityStepper value={draft.quantity} onChange={quantity => setDraft({ ...draft, quantity, quantityInferred: false })} /></View>
        <ChoiceChips values={UNITS} label="Unit" value={draft.unit} onChange={unit => setDraft({ ...draft, unit })} />
        <ChoiceChips values={CATEGORIES} label="Category" value={draft.category} onChange={category => setDraft({ ...draft, category, emoji: CATEGORY_EMOJI[category] })} />
      </View>
      {message ? <Text style={styles.error}>{message}</Text> : null}
      {id && data && !savedItem && <Text style={styles.error}>This item is no longer in the current week.</Text>}
      <Button title={id ? 'Save changes' : 'Add to this week'} onPress={save} disabled={!draft.name.trim() || !data || Boolean(id && !data.items.some(item => item.id === id))} busy={addState.isLoading || updateState.isLoading} />
      {!id && Boolean(recent?.length) && <View style={{ gap: 12 }}><Text style={styles.section}>Recently added</Text><View style={{ gap: 7 }}>{recent?.map(item => <Button key={item.id} title={`${item.emoji} ${item.name} · ${item.quantity}${item.unit ? ` ${item.unit}` : ''}`} secondary onPress={() => setDraft({ name: item.name, quantity: item.quantity, unit: item.unit, category: item.category, emoji: item.emoji, quantityInferred: false })} />)}</View></View>}
    </>}
  </Screen></KeyboardAvoidingView>;
}
