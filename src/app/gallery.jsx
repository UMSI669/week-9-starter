/**
 * The dream gallery: newest first, filterable by primary category, searchable
 * over title, transcript, symbol, and tags.
 *
 * Reached from Home's "See all" and from tapping a category cloud, which
 * passes ?category=<key>.
 */

import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import {
  loadDreams,
  selectCategoryCounts,
  selectDreams,
  selectDreamsStatus,
} from '../store/dreamsSlice';
import { categoryLabel } from '../data/categories';
import { DreamCard } from '../components/DreamCard';
import {
  Button,
  Chip,
  EmptyState,
  Input,
  LoadingBlock,
  NightBackground,
  SectionTitle,
} from '../components/ui';
import { colors, fontSizes, spacing } from '../theme';

export default function GalleryScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const params = useLocalSearchParams();

  const dreams = useSelector(selectDreams);
  const status = useSelector(selectDreamsStatus);
  const categories = useSelector(selectCategoryCounts);

  const [category, setCategory] = useState(
    typeof params.category === 'string' ? params.category : null,
  );
  const [search, setSearch] = useState('');

  useFocusEffect(
    useCallback(() => {
      dispatch(loadDreams());
    }, [dispatch]),
  );

  const term = search.trim().toLowerCase();

  const filtered = useMemo(
    () =>
      dreams.filter((dream) => {
        if (category && dream.primaryCategory !== category) return false;
        if (!term) return true;
        return (
          dream.title.toLowerCase().includes(term) ||
          dream.transcript.toLowerCase().includes(term) ||
          dream.symbolLabel.toLowerCase().includes(term) ||
          dream.themes.some((tag) => tag.includes(term)) ||
          dream.moods.some((tag) => tag.includes(term))
        );
      }),
    [dreams, category, term],
  );

  const populated = useMemo(
    () => categories.filter((item) => item.count > 0),
    [categories],
  );

  return (
    <NightBackground>
      <FlatList
        data={filtered}
        keyExtractor={(dream) => dream.id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.header}>
            <Input
              value={search}
              onChangeText={setSearch}
              placeholder="Search titles, transcripts, tags"
              accessibilityLabel="Search dreams"
              autoCorrect={false}
              clearButtonMode="while-editing"
              returnKeyType="search"
            />

            <View style={styles.filterRow}>
              <Chip
                label="All"
                count={dreams.length}
                selected={!category}
                onPress={() => setCategory(null)}
                accessibilityLabel={`All categories, ${dreams.length} dreams`}
              />
              {populated.map((item) => (
                <Chip
                  key={item.key}
                  label={item.label}
                  emoji={item.emoji}
                  count={item.count}
                  selected={category === item.key}
                  onPress={() => setCategory(category === item.key ? null : item.key)}
                  accessibilityLabel={`${item.label}, ${item.count} ${item.count === 1 ? 'dream' : 'dreams'}`}
                />
              ))}
            </View>

            <SectionTitle>
              {category ? categoryLabel(category) : 'All dreams'}
              {'  '}
              <Text style={styles.count}>
                {filtered.length} {filtered.length === 1 ? 'dream' : 'dreams'}
              </Text>
            </SectionTitle>
            <Text style={styles.sortNote}>Newest first.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <DreamCard dream={item} onPress={() => router.push(`/dream/${item.id}`)} />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          status === 'loading' ? (
            <LoadingBlock label="Loading dreams" />
          ) : (
            <EmptyState
              title={term || category ? 'Nothing matches that' : 'Your dream sky is waiting'}
              body={
                term || category
                  ? 'Try a different search, or clear the filters.'
                  : 'Record a dream and it will appear here.'
              }
            >
              {term || category ? (
                <Button
                  title="Clear filters"
                  variant="secondary"
                  onPress={() => {
                    setSearch('');
                    setCategory(null);
                  }}
                />
              ) : (
                <Button title="Record a dream" onPress={() => router.push('/capture')} />
              )}
            </EmptyState>
          )
        }
      />
    </NightBackground>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { gap: spacing.md, marginBottom: spacing.md },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  count: { color: colors.accent, fontSize: fontSizes.body, fontWeight: '700' },
  sortNote: { color: colors.textMuted, fontSize: fontSizes.caption },
  separator: { height: spacing.md },
});
