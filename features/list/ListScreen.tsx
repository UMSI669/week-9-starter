import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CATEGORIES, CATEGORY_EMOJI, blankDraft, type GroceryItem } from '../../utils/groceries';
import { weekLabel } from '../../utils/week';
import { useAddMutation, useSettingMutation, useSnapshotQuery } from '../../store/listApi';
import { useAppDispatch } from '../../store';
import { notice } from '../../store/uiSlice';
import { safeError } from '../../services/apiErrors';
import { colors, styles } from '../../theme';
import { BrandHeader, Button, EmptyState, ErrorState, IconButton, Screen } from '../common/ui';
import ItemRow from './ItemRow';

export default function ListScreen({ grouped = false }: { grouped?: boolean }) {
  const { data, error, isLoading, refetch } = useSnapshotQuery();
  const [search, setSearch] = useState(''); const [category, setCategory] = useState('All'); const [quickName, setQuickName] = useState('');
  const [add, addState] = useAddMutation(); const [setting] = useSettingMutation(); const dispatch = useAppDispatch();
  const items = data?.items || [];
  const done = items.filter(item => item.checked).length;
  const visible = items.filter(item => (category === 'All' || item.category === category) && item.name.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) || a.position - b.position || a.created_at.localeCompare(b.created_at));
  const saveSetting = async (key: string, value: string) => { try { await setting({ key, value }).unwrap(); } catch (err) { dispatch(notice({ text: safeError(err) })); } };
  const quickAdd = async () => {
    if (!quickName.trim()) return;
    try { const result = await add({ items: [blankDraft(quickName)] }).unwrap(); setQuickName(''); dispatch(notice({ text: result.merged[0] || 'Added to this week' })); }
    catch (err) { dispatch(notice({ text: safeError(err) })); }
  };
  const renderList = (list: GroceryItem[]) => <View>{list.map(item => <ItemRow key={item.id} item={item} />)}</View>;

  return <Screen scroll={false}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <BrandHeader right={<IconButton name="time-outline" label="Week history" onPress={() => router.push('/history')} />} />
      <View style={{ gap: 8 }}><Text style={styles.eyebrow}>{grouped ? 'EVERYTHING IN ITS PLACE' : 'A LITTLE LESS TO REMEMBER'}</Text><Text style={styles.title}>{grouped ? 'Your shopping list' : 'This week’s pantry'}</Text><Text style={styles.subtitle}>{data ? weekLabel(data.weekId) : 'Your Sunday-to-Saturday shopping list'}</Text></View>
      <View style={[styles.card, { backgroundColor: colors.navy, borderColor: colors.navy, gap: 14 }]}>
        <View style={styles.between}><View><Text style={{ color: '#C5D1D2', fontSize: 12, marginBottom: 5 }}>THIS WEEK</Text><Text style={{ color: colors.white, fontSize: 23, fontWeight: '700' }}>{done} <Text style={{ color: '#C5D1D2', fontSize: 15, fontWeight: '400' }}>of {items.length} done</Text></Text></View><View style={{ width: 45, height: 45, borderRadius: 16, backgroundColor: '#304750', justifyContent: 'center', alignItems: 'center' }}><Ionicons name={items.length && done === items.length ? 'checkmark' : 'basket-outline'} size={25} color="#FFC59B" /></View></View>
        <View accessibilityRole="progressbar" aria-valuemin={0} aria-valuemax={items.length || 1} aria-valuenow={done} accessibilityValue={{ min: 0, max: items.length || 1, now: done }} style={{ backgroundColor: '#3E5057', height: 6, borderRadius: 4, overflow: 'hidden' }}><View style={{ width: `${items.length ? done / items.length * 100 : 0}%`, backgroundColor: '#FFC59B', height: '100%' }} /></View>
        <Text style={{ color: '#C5D1D2', fontSize: 12 }}>{items.length && done === items.length ? 'All set. Enjoy the week ahead.' : `${items.length - done} items left to pick up`}</Text>
      </View>
      {data && data.carried > 0 && !data.bannerDismissed && <View style={[styles.card, { backgroundColor: colors.greenLight, borderColor: '#D2E6D7', flexDirection: 'row', alignItems: 'center' }]}><Ionicons name="refresh-outline" size={22} color={colors.green} /><Text style={{ flex: 1, color: colors.green, lineHeight: 20 }}>{data.carried} items carried over from last week.</Text><IconButton name="close" label="Dismiss carried-over notice" onPress={() => void saveSetting(`banner:${data.weekId}`, 'true')} color={colors.green} /></View>}
      {!grouped && <View style={[styles.card, { backgroundColor: colors.peach, borderColor: '#F6DCC9', flexDirection: 'row', alignItems: 'center' }]}><View style={{ flex: 1, gap: 5 }}><Text style={{ color: colors.navy, fontWeight: '700', fontSize: 16 }}>Say it. We’ll list it.</Text><Text style={styles.small}>Speak your groceries in one go.</Text></View><IconButton name="mic" label="Record a shopping list" onPress={() => router.navigate('/voice')} color={colors.orange} /></View>}
      <View style={[styles.input, { flexDirection: 'row', alignItems: 'center', paddingVertical: 0, gap: 10 }]}><Ionicons name="search-outline" color={colors.muted} size={20} /><TextInput accessibilityLabel="Search groceries" placeholder="Find something on your list" placeholderTextColor={colors.muted} value={search} onChangeText={setSearch} style={{ flex: 1, color: colors.navy, fontSize: 15, minHeight: 50 }} /></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
        {['All', ...CATEGORIES].map(value => <Pressable key={value} accessibilityRole="button" accessibilityLabel={`Filter ${value}`} aria-selected={category === value} accessibilityState={{ selected: category === value }} onPress={() => setCategory(value)} style={[styles.chip, category === value && styles.chipActive]}><Text style={[styles.chipText, category === value && { color: colors.white }]}>{value}</Text></Pressable>)}
      </ScrollView>
      <View style={styles.between}><Text style={styles.section}>{grouped ? 'By category' : 'On your list'} <Text style={{ color: colors.muted, fontSize: 14, fontWeight: '400' }}>({visible.length})</Text></Text>
        {!grouped && <View style={[styles.row, { gap: 0, backgroundColor: '#EEEAE4', borderRadius: 12 }]}>{(['list', 'grid'] as const).map(view => <Pressable key={view} accessibilityRole="button" accessibilityLabel={`${view} view`} aria-selected={data?.view === view} accessibilityState={{ selected: data?.view === view }} onPress={() => void saveSetting('view', view)} style={{ padding: 12, backgroundColor: data?.view === view ? colors.white : 'transparent', borderRadius: 11 }}><Ionicons name={view === 'list' ? 'list-outline' : 'grid-outline'} size={19} color={colors.navy} /></Pressable>)}</View>}
      </View>
      {isLoading ? <ActivityIndicator size="large" color={colors.orange} /> : error ? <ErrorState message={safeError(error)} retry={() => void refetch()} /> : visible.length === 0 ? <EmptyState title={items.length ? 'No matching groceries' : 'A fresh list for a fresh week'} message={items.length ? 'Try a different search or category.' : 'Add your first item below, or tap the mic and say what you need.'} /> : grouped ?
        CATEGORIES.filter(cat => visible.some(item => item.category === cat)).map(cat => <View key={cat} style={{ gap: 12 }}><View style={styles.between}><Text style={{ fontSize: 16, fontWeight: '700', color: colors.navy }}>{CATEGORY_EMOJI[cat]}  {cat}</Text><Text style={styles.small}>{visible.filter(item => item.category === cat && item.checked).length}/{visible.filter(item => item.category === cat).length} done</Text></View>{renderList(visible.filter(item => item.category === cat))}</View>) :
        data?.view === 'grid' ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{visible.map(item => <View key={item.id} style={{ width: '48%', flexGrow: 1, maxWidth: '50%' }}><ItemRow item={item} grid /></View>)}</View> : renderList(visible)}
      {visible.length > 1 && (grouped || data?.view === 'list') && !search.trim() && <Text style={[styles.small, { textAlign: 'center' }]}>Swipe left to delete.</Text>}
      <Button title="Add an item with details" secondary icon="add-outline" onPress={() => router.push('/item')} />
    </ScrollView>
    <View style={{ borderTopWidth: 1, borderColor: colors.line, backgroundColor: colors.cream, paddingHorizontal: 18, paddingVertical: 12 }}><View style={[styles.row, { maxWidth: 738, width: '100%', alignSelf: 'center', gap: 8 }]}>
      <TextInput accessibilityLabel="Quick-add item name" placeholder="Add a quick item…" placeholderTextColor={colors.muted} value={quickName} onChangeText={setQuickName} onSubmitEditing={quickAdd} returnKeyType="done" maxLength={120} style={[styles.input, { flex: 1 }]} />
      <Button title="Add" onPress={quickAdd} disabled={!quickName.trim() || !data} busy={addState.isLoading} />
    </View></View>
  </Screen>;
}
