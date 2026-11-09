import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCopyMutation, useWeekItemsQuery } from '../../store/listApi';
import { useAppDispatch } from '../../store';
import { notice } from '../../store/uiSlice';
import { CATEGORIES, CATEGORY_EMOJI } from '../../utils/groceries';
import { weekLabel } from '../../utils/week';
import { safeError } from '../../services/apiErrors';
import { styles } from '../../theme';
import { BackHeader, Button, ConfirmDialog, EmptyState, ErrorState, Screen } from '../common/ui';
import ItemRow from '../list/ItemRow';
export default function PastWeekScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const { data, isLoading, error, refetch } = useWeekItemsQuery(id);
  const [copy, copyState] = useCopyMutation(); const [confirm, setConfirm] = useState(false); const dispatch = useAppDispatch();
  const unchecked = data?.filter(item => !item.checked).length || 0;
  const onCopy = async () => {
    setConfirm(false);
    try { const result = await copy(id).unwrap(); dispatch(notice({ text: `${result.added} new items copied to this week` })); for (const text of result.merged) dispatch(notice({ text })); }
    catch (err) { dispatch(notice({ text: safeError(err) })); }
  };
  return <Screen><BackHeader title="Past week" onBack={() => router.back()} /><View style={{ gap: 8 }}><Text style={styles.eyebrow}>FROM THE ARCHIVE</Text><Text style={styles.title}>{weekLabel(id)}</Text><Text style={styles.subtitle}>{id.slice(0, 4)} · {data?.filter(item => item.checked).length || 0} of {data?.length || 0} done. This past list is read-only.</Text></View>
    {isLoading ? <ActivityIndicator /> : error ? <ErrorState message={safeError(error)} retry={() => void refetch()} /> : !data?.length ? <EmptyState title="Nothing on this list" message="This week had no saved grocery items." /> : CATEGORIES.filter(category => data.some(item => item.category === category)).map(category => <View key={category} style={{ gap: 12 }}><Text style={styles.section}>{CATEGORY_EMOJI[category]} {category}</Text>{data.filter(item => item.category === category).map(item => <ItemRow key={item.id} item={item} readOnly />)}</View>)}
    <Button title={`Copy ${unchecked} unchecked to this week`} onPress={() => setConfirm(true)} disabled={!unchecked} busy={copyState.isLoading} icon="copy-outline" />
    <ConfirmDialog visible={confirm} title="Copy unchecked items?" message="Items with the same name and unit already in this week will have their quantities added together." confirmLabel="Copy to this week" onCancel={() => setConfirm(false)} onConfirm={onCopy} />
  </Screen>;
}
