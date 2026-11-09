import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import type { GroceryItem } from '../../utils/groceries';
import { colors, styles } from '../../theme';
import { useRemoveMutation, useToggleMutation } from '../../store/listApi';
import { useAppDispatch } from '../../store';
import { notice } from '../../store/uiSlice';
import { safeError } from '../../services/apiErrors';
import { IconButton } from '../common/ui';

export default function ItemRow({ item, drag, active = false, grid = false, readOnly = false }: {
  item: GroceryItem; drag?: () => void; active?: boolean; grid?: boolean; readOnly?: boolean;
}) {
  const [toggle, toggleState] = useToggleMutation(); const [remove, removeState] = useRemoveMutation(); const dispatch = useAppDispatch();
  const onToggle = async () => {
    try { await toggle(item.id).unwrap(); void Haptics.selectionAsync().catch(() => {}); }
    catch (error) { dispatch(notice({ text: safeError(error) })); }
  };
  const onRemove = async () => {
    try { const removed = await remove(item.id).unwrap(); dispatch(notice({ text: `${item.name} removed`, undo: removed })); }
    catch (error) { dispatch(notice({ text: safeError(error) })); }
  };
  const content = <View style={{ backgroundColor: active ? colors.peach : colors.white, borderWidth: 1, borderColor: colors.line,
    borderRadius: 17, padding: grid ? 14 : 12, flexDirection: grid ? 'column' : 'row', alignItems: grid ? 'stretch' : 'center', gap: 10, marginBottom: 8 }}>
    <View style={{ width: grid ? '100%' : 46, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <View style={{ width: 43, height: 43, borderRadius: 13, backgroundColor: item.checked ? '#F3F4F0' : colors.peach, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 23 }}>{item.emoji}</Text></View>
      {grid && !readOnly && <Pressable accessibilityRole="checkbox" accessibilityLabel={`Check ${item.name}`} aria-checked={Boolean(item.checked)} accessibilityState={{ checked: Boolean(item.checked) }} onPress={onToggle} disabled={toggleState.isLoading} style={{ padding: 8 }}><Ionicons name={item.checked ? 'checkbox' : 'square-outline'} size={24} color={item.checked ? colors.green : colors.muted} /></Pressable>}
    </View>
    <Pressable disabled={readOnly} accessibilityRole={readOnly ? undefined : 'button'} accessibilityLabel={`Edit ${item.name}`}
      onPress={() => router.push({ pathname: '/item', params: { id: item.id } })} style={{ flex: grid ? undefined : 1, gap: 5, minHeight: 44, justifyContent: 'center' }}>
      <Text numberOfLines={2} style={{ fontSize: 16, fontWeight: '600', color: item.checked ? colors.muted : colors.navy, textDecorationLine: item.checked ? 'line-through' : 'none' }}>{item.name}</Text>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <Text style={styles.small}>{item.quantity}{item.unit ? ` ${item.unit}` : ''} · {item.category}</Text>
        {item.source === 'voice' && <View style={{ backgroundColor: colors.peach, borderRadius: 5, paddingHorizontal: 5 }}><Text style={{ color: colors.orange, fontSize: 10, fontWeight: '700' }}>voice</Text></View>}
        {Boolean(item.carried_over) && <Text style={{ color: colors.green, fontSize: 10 }}>carried over</Text>}
      </View>
    </Pressable>
    {!grid && !readOnly && <Pressable accessibilityRole="checkbox" accessibilityLabel={`Check ${item.name}`} aria-checked={Boolean(item.checked)} accessibilityState={{ checked: Boolean(item.checked) }} onPress={onToggle} disabled={toggleState.isLoading} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={item.checked ? 'checkbox' : 'square-outline'} size={26} color={item.checked ? colors.green : colors.muted} />
    </Pressable>}
    {readOnly && <Ionicons name={item.checked ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={item.checked ? colors.green : colors.muted} />}
    {!grid && drag && <Pressable accessibilityRole="button" accessibilityLabel={`Reorder ${item.name}; hold and drag within its category`} onLongPress={drag} delayLongPress={180} disabled={active} style={{ minWidth: 32, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="reorder-two" size={24} color={colors.muted} /></Pressable>}
    {grid && !readOnly && <View style={styles.between}><Text style={styles.small}>Swipe to remove</Text><IconButton name="trash-outline" label={`Delete ${item.name}`} color={colors.red} onPress={onRemove} disabled={removeState.isLoading} /></View>}
  </View>;
  if (readOnly) return content;
  return <ReanimatedSwipeable overshootRight={false} renderRightActions={() => <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${item.name}`} onPress={onRemove} disabled={removeState.isLoading}
    style={{ backgroundColor: colors.red, width: 80, borderRadius: 16, marginBottom: 8, alignItems: 'center', justifyContent: 'center', gap: 6 }}><Ionicons name="trash-outline" color={colors.white} size={24} /><Text style={{ color: colors.white, fontSize: 11 }}>Delete</Text></Pressable>}>{content}</ReanimatedSwipeable>;
}
