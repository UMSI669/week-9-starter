import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useHistoryQuery } from '../../store/listApi';
import { weekLabel } from '../../utils/week';
import { safeError } from '../../services/apiErrors';
import { colors, styles } from '../../theme';
import { BackHeader, EmptyState, ErrorState, Screen } from '../common/ui';
export default function HistoryScreen() {
  const { data, isLoading, error, refetch } = useHistoryQuery();
  return <Screen><BackHeader title="Week history" onBack={() => router.back()} /><View style={{ gap: 8 }}><Text style={styles.eyebrow}>THE WEEKS BEHIND YOU</Text><Text style={styles.title}>A little pantry history</Text><Text style={styles.subtitle}>Past lists, ready when you need them again.</Text></View>
    {isLoading ? <ActivityIndicator /> : error ? <ErrorState message={safeError(error)} retry={() => void refetch()} /> : !data?.length ? <EmptyState title="Your history starts here" message="When a new week begins, your past list will appear here. Unchecked items carry over automatically." icon="time-outline" /> : data.map(week => <Pressable key={week.id} accessibilityRole="button" accessibilityLabel={`View week ${weekLabel(week.id)}`} onPress={() => router.push({ pathname: '/history/[id]', params: { id: week.id } })} style={[styles.card, styles.between]}><View style={{ gap: 7 }}><Text style={styles.section}>{weekLabel(week.id)}</Text><Text style={styles.small}>{week.id.slice(0, 4)} · {week.done} of {week.total} done · {week.total - week.done} unchecked</Text></View><Ionicons name="chevron-forward" size={22} color={colors.muted} /></Pressable>)}
  </Screen>;
}
