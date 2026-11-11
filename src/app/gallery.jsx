/**
 * The dream gallery: newest first, filterable by primary category, searchable
 * over title, transcript, symbol, and tags.
 *
 * Reached from Home's "See all" and from tapping a category card, which passes
 * ?category=<key>.
 *
 * Layout: the category filter is a single horizontal line of chips that scrolls
 * sideways, so it costs one row of height no matter how many categories exist.
 * The dreams themselves are always a vertical list below it — a column is the
 * faster thing to scan, and a horizontal deck of them collided with the filter
 * row.
 */

import { useCallback, useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
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

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              directionalLockEnabled
              style={styles.filterScroll}
              contentContainerStyle={styles.filterRow}
            >
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
            </ScrollView>

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
  // One line, never wrapping. The row is allowed to run past both screen edges
  // so a chip can sit half off-screen and show there is more to scroll to.
  filterRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 2,
  },
  filterScroll: { marginHorizontal: -spacing.lg },
  count: { color: colors.accent, fontSize: fontSizes.body, fontWeight: '700' },
  sortNote: { color: colors.textMuted, fontSize: fontSizes.caption },
  separator: { height: spacing.md },
});
