import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppDispatch, useAppSelector } from '../../store';
import { dismissNotice, notice } from '../../store/uiSlice';
import { useRestoreMutation } from '../../store/listApi';
import { colors } from '../../theme';
import { safeError } from '../../services/apiErrors';
export default function ToastHost() {
  const current = useAppSelector(state => state.ui.notices[0]);
  const dispatch = useAppDispatch(); const [restore] = useRestoreMutation();
  const insets = useSafeAreaInsets(); const [undoing, setUndoing] = useState(false);
  useEffect(() => {
    if (!current || undoing) return;
    const timeout = setTimeout(() => dispatch(dismissNotice()), current.undo ? 7000 : 4000);
    return () => clearTimeout(timeout);
  }, [current, dispatch, undoing]);
  if (!current) return null;
  const undo = async () => {
    if (!current.undo || undoing) return;
    setUndoing(true);
    try { await restore(current.undo).unwrap(); dispatch(dismissNotice()); dispatch(notice({ text: 'Item restored' })); }
    catch (error) { dispatch(dismissNotice()); dispatch(notice({ text: safeError(error) })); }
    finally { setUndoing(false); }
  };
  return <View pointerEvents="box-none" style={{ position: 'absolute', left: 18, right: 18, bottom: insets.bottom + 84, zIndex: 100 }}>
    <View style={{ backgroundColor: colors.navy, padding: 15, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 10, maxWidth: 650, width: '100%', alignSelf: 'center' }}>
      <Text accessibilityLiveRegion="polite" style={{ color: colors.white, flex: 1, fontSize: 14, lineHeight: 20 }}>{current.text}</Text>
      {current.undo && <Pressable accessibilityRole="button" accessibilityLabel="Undo deletion" disabled={undoing} onPress={undo} style={{ padding: 12 }}><Text style={{ color: '#FFC59B', fontWeight: '700' }}>{undoing ? 'Restoring…' : 'Undo'}</Text></Pressable>}
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss message" onPress={() => dispatch(dismissNotice())} style={{ padding: 10 }}><Text style={{ color: colors.white, fontSize: 20 }}>×</Text></Pressable>
    </View>
  </View>;
}
