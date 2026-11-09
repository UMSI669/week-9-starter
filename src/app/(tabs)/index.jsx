/**
 * Home: the dream sky.
 *
 * Contents, in reading order:
 *   1. heading, with the moon button top-right (-> Symbols)
 *   2. a clearly labelled "Record a dream" button
 *   3. the interactive cloud map, or the list view, with a toggle
 *   4. the most recent dreams as cards
 *
 * Counts come from a selector over the Redux cache, which is refreshed from
 * SQLite on focus, so saving, re-categorising, or deleting a dream updates the
 * map immediately.
 */

import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
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
import { CloudMapListView, DreamCloudMap } from '../../components/DreamCloudMap';
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

const MAP_HEIGHT_RATIO = 0.46;
const MIN_MAP_HEIGHT = 260;
const RECENT_STAR_COUNT = 3;

export default function HomeScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { width, height, fontScale } = useWindowDimensions();

  const dreams = useSelector(selectDreams);
  const status = useSelector(selectDreamsStatus);
  const error = useSelector(selectDreamsError);
  const categories = useSelector(selectCategoryCounts);

  const [view, setView] = useState('map');
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });

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

  const mapStars = useMemo(
    () =>
      dreams.slice(0, RECENT_STAR_COUNT).map((dream) => ({
        id: dream.id,
        title: dream.title || 'Untitled',
        emoji: dream.emoji,
      })),
    [dreams],
  );

  const mapHeight = Math.max(MIN_MAP_HEIGHT, Math.round(height * MAP_HEIGHT_RATIO));
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

      <Button
        title="Record a dream"
        icon={'🎙️'}
        variant="record"
        onPress={() => router.push('/capture')}
        accessibilityHint="Opens the recording screen."
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
            <SectionTitle style={styles.flexTitle}>Dream clouds</SectionTitle>
            <ViewToggle value={view} onChange={setView} />
          </View>

          {view === 'map' ? (
            <View
              style={[styles.mapFrame, { height: mapHeight }]}
              onLayout={(event) => setMapSize(event.nativeEvent.layout)}
            >
              <DreamCloudMap
                categories={populated}
                recentDreams={mapStars}
                width={mapSize.width}
                height={mapSize.height}
                fontScale={fontScale}
                onSelectCategory={openCategory}
                onSelectDream={(star) => router.push(`/dream/${star.id}`)}
              />
            </View>
          ) : (
            <CloudMapListView categories={categories} onSelectCategory={openCategory} />
          )}

          <Text style={styles.mapHint}>
            {view === 'map'
              ? 'Bigger clouds hold more dreams. Tap one to see them.'
              : 'Every category, with its dream count. Tap one to see them.'}
          </Text>

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

          <View style={styles.cardList}>
            {recentDreams.map((dream) => (
              <DreamCard
                key={dream.id}
                dream={dream}
                compact
                onPress={() => router.push(`/dream/${dream.id}`)}
              />
            ))}
          </View>
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
        { key: 'map', label: 'Cloud map' },
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
  mapFrame: {
    backgroundColor: 'rgba(40,19,71,0.42)',
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  mapHint: { color: colors.textMuted, fontSize: fontSizes.caption, lineHeight: 17 },
  recentHeader: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  linkButton: {
    justifyContent: 'center',
    minHeight: touchTarget - 8,
    paddingHorizontal: spacing.sm,
  },
  linkText: { color: colors.accent, fontSize: fontSizes.body, fontWeight: '700' },
  cardList: { gap: spacing.md },
  pressed: { opacity: 0.72 },
});
