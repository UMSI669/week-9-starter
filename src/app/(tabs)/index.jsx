/**
 * Home: the dream sky.
 *
 * Contents, in reading order:
 *   1. heading, with the moon button top-right (-> Symbols)
 *   2. the categories, as a horizontal card row or the list view
 *   3. a clearly labelled "Record a dream" button
 *   4. the most recent dreams as cards
 *
 * The category block sits above the record button and is one fixed-height row,
 * so both stay on the first screen without scrolling. The cloud/word map that
 * used to live here was replaced by the card row: see CategoryCards.jsx for
 * why.
 *
 * Counts come from a selector over the Redux cache, which is refreshed from
 * SQLite on focus, so saving, re-categorising, or deleting a dream updates the
 * counts immediately.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import {
  loadDreams,
  selectCategoryCounts,
  selectDreams,
  selectDreamsError,
  selectDreamsStatus,
} from '../../store/dreamsSlice';
import { DreamCard } from '../../components/DreamCard';
import {
  CategoryCardRow,
  CategoryListView,
  SORT_MODES,
  SortControl,
} from '../../components/CategoryCards';
import { MoonPhaseButton } from '../../components/MoonPhaseButton';
import { StarField } from '../../components/StarField';
import {
  Button,
  Card,
  EmptyState,
  LoadingBlock,
  PageHeading,
  Screen,
  SectionTitle,
  StatusMessage,
} from '../../components/ui';
import { colors, fontSizes, radii, spacing, touchTarget } from '../../theme';

/**
 * One height for every card in the recent row, so the row reads as a row
 * rather than a ragged edge. It scales with the system font scale instead of
 * being a hard number, because a fixed height clips at large text sizes — and
 * clipping is the thing a fixed height was supposed to avoid.
 */
const RECENT_CARD_BASE_HEIGHT = 216;
const RECENT_CARD_WIDTH = 280;

export default function HomeScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { width, fontScale } = useWindowDimensions();

  const dreams = useSelector(selectDreams);
  const status = useSelector(selectDreamsStatus);
  const error = useSelector(selectDreamsError);
  const categories = useSelector(selectCategoryCounts);

  const [view, setView] = useState('cards');
  const [sort, setSort] = useState(SORT_MODES.MOST);

  // Reload from SQLite whenever Home comes back into focus, so counts are
  // correct after a save, an edit, or a delete on another screen.
  useFocusEffect(
    useCallback(() => {
      dispatch(loadDreams());
    }, [dispatch]),
  );

  const populated = useMemo(
    () => categories.filter((category) => category.count > 0),
    [categories],
  );

  const recentDreams = useMemo(() => dreams.slice(0, 6), [dreams]);
  const recentCardHeight = Math.round(
    RECENT_CARD_BASE_HEIGHT * Math.min(Math.max(fontScale, 1), 2),
  );
  const totalDreams = dreams.length;

  const openCategory = (category) => {
    if (category.count === 0) return;
    router.push({ pathname: '/gallery', params: { category: category.key } });
  };

  return (
    <Screen>
      <PageHeading
        eyebrow="Dream Decoder"
        title="Your dream sky"
        description={
          totalDreams > 0
            ? `${totalDreams} ${totalDreams === 1 ? 'dream' : 'dreams'} saved on this device.`
            : 'Speak a dream when you wake up, review the text, and keep the card.'
        }
        right={<MoonPhaseButton onPress={() => router.push('/symbols')} />}
      />

      {error ? (
        <StatusMessage tone="error" announce>
          {error}
        </StatusMessage>
      ) : null}

      {status === 'loading' ? <LoadingBlock label="Opening your dream sky" /> : null}

      {status !== 'loading' && totalDreams === 0 ? (
        <Card>
          <View style={styles.emptySky}>
            <StarField seed="empty-sky" width={width - 72} height={120} starCount={11} />
            <EmptyState
              title="Your dream sky is waiting"
              body="Nothing is saved yet. Record a dream, or type one, and the first cloud will appear here."
            >
              <Button
                title="Record a dream"
                variant="primary"
                onPress={() => router.push('/capture')}
              />
            </EmptyState>
          </View>
        </Card>
      ) : null}

      {totalDreams > 0 ? (
        <>
          <View style={styles.viewToggleRow}>
            <SectionTitle style={styles.flexTitle}>Your themes</SectionTitle>
            <ViewToggle value={view} onChange={setView} />
          </View>

          <SortControl value={sort} onChange={setSort} />

          {view === 'cards' ? (
            <CategoryCardRow
              categories={populated}
              sort={sort}
              onSelectCategory={openCategory}
            />
          ) : (
            <CategoryListView categories={categories} sort={sort} onSelectCategory={openCategory} />
          )}

          <Text style={styles.mapHint}>
            {view === 'cards'
              ? 'Swipe sideways for more themes. Tap one to read those dreams.'
              : 'Every category, with its dream count. Tap one to read those dreams.'}
          </Text>

          {/* Recording stays directly under the themes and above the recent
              dreams, so it is reachable without scrolling on open. */}
          <Button
            title="Record a dream"
            icon={'🎙️'}
            variant="record"
            onPress={() => router.push('/capture')}
            accessibilityHint="Opens the recording screen."
          />

          <View style={styles.recentHeader}>
            <SectionTitle style={styles.flexTitle}>Recent dreams</SectionTitle>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="See all dreams"
              onPress={() => router.push('/gallery')}
              style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
            >
              <Text style={styles.linkText}>See all</Text>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            directionalLockEnabled
            contentContainerStyle={styles.recentRow}
          >
            {recentDreams.map((dream) => (
              <View
                key={dream.id}
                style={[styles.recentCardFrame, { height: recentCardHeight }]}
              >
                <DreamCard
                  dream={dream}
                  compact
                  fill
                  onPress={() => router.push(`/dream/${dream.id}`)}
                />
              </View>
            ))}
          </ScrollView>
        </>
      ) : null}

      <Button
        title="Settings"
        variant="ghost"
        onPress={() => router.push('/settings')}
        accessibilityHint="Transcription mode, backend status, and demo data."
      />
    </Screen>
  );
}

/** Two explicit buttons, each stating its own state. Not a colour-only switch. */
function ViewToggle({ value, onChange }) {
  return (
    <View style={styles.toggle} accessibilityRole="tablist">
      {[
        { key: 'cards', label: 'Cards' },
        { key: 'list', label: 'List view' },
      ].map((option) => {
        const selected = value === option.key;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.key)}
            style={({ pressed }) => [
              styles.toggleButton,
              selected && styles.toggleButtonSelected,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.toggleText, selected && styles.toggleTextSelected]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  emptySky: { overflow: 'hidden' },
  viewToggleRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  flexTitle: { flex: 1 },
  toggle: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 2,
  },
  toggleButton: {
    borderRadius: radii.pill,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: spacing.md,
  },
  toggleButtonSelected: {
    backgroundColor: 'rgba(196,181,253,0.2)',
    borderColor: colors.accent,
    borderWidth: 1,
  },
  toggleText: { color: colors.textSecondary, fontSize: fontSizes.caption, fontWeight: '700' },
  toggleTextSelected: { color: colors.textPrimary, fontWeight: '800' },
  mapHint: { color: colors.textMuted, fontSize: fontSizes.caption, lineHeight: 17 },
  recentHeader: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  linkButton: {
    justifyContent: 'center',
    minHeight: touchTarget - 8,
    paddingHorizontal: spacing.sm,
  },
  linkText: { color: colors.accent, fontSize: fontSizes.body, fontWeight: '700' },
  recentRow: { alignItems: 'flex-start', gap: spacing.md, paddingHorizontal: 2, paddingVertical: 2 },
  recentCardFrame: { width: RECENT_CARD_WIDTH },
  pressed: { opacity: 0.72 },
});
