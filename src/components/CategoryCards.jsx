/**
 * Categories as a horizontally scrolling row of cards, plus the list view that
 * is its accessible alternative.
 *
 * This replaces the cloud/word-map on Home. The map sized each category by its
 * dream count and placed them by phyllotaxis, which was legible on paper but
 * read as decorative rather than useful, and it cost a tall block of screen
 * that pushed "Record a dream" below the fold. A fixed-height card row keeps
 * every category the same size, carries a reflection line that a floating
 * label had no room for, and leaves recording one tap away on open.
 *
 * Count is still shown, and the row is still ordered by it, so the "which
 * theme do I dream about most" question the map answered is still answered —
 * by reading order and a number rather than by area.
 */

import { memo, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fontSizes, glow, radii, spacing, touchTarget } from '../theme';

export const SORT_MODES = {
  MOST: 'most',
  FEWEST: 'fewest',
  ALPHABETICAL: 'alphabetical',
};

export const SORT_LABELS = {
  [SORT_MODES.MOST]: 'Most dreams',
  [SORT_MODES.FEWEST]: 'Fewest dreams',
  [SORT_MODES.ALPHABETICAL]: 'A–Z',
};

/**
 * Deterministic ordering. Equal counts always fall back to alphabetical, so
 * the row never reshuffles between renders.
 */
export function sortCategories(categories, mode = SORT_MODES.MOST) {
  const byName = (a, b) => a.label.localeCompare(b.label, 'en');
  return [...categories].sort((a, b) => {
    if (mode === SORT_MODES.ALPHABETICAL) return byName(a, b);
    if (a.count !== b.count) {
      return mode === SORT_MODES.FEWEST ? a.count - b.count : b.count - a.count;
    }
    return byName(a, b);
  });
}

function countLabel(count) {
  return `${count} ${count === 1 ? 'dream' : 'dreams'}`;
}

export const CategoryCardRow = memo(function CategoryCardRow({
  categories,
  sort = SORT_MODES.MOST,
  onSelectCategory,
}) {
  const sorted = useMemo(() => sortCategories(categories, sort), [categories, sort]);

  if (sorted.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      // Without this the row steals vertical drags from the page scroll.
      directionalLockEnabled
    >
      {sorted.map((category) => {
        const empty = category.count === 0;
        return (
          <Pressable
            key={category.key}
            accessibilityRole="button"
            accessibilityLabel={`${category.label}, ${countLabel(category.count)}`}
            accessibilityHint={empty ? 'No dreams in this category yet.' : 'Opens these dreams.'}
            accessibilityState={{ disabled: empty }}
            disabled={empty}
            onPress={() => onSelectCategory?.(category)}
            style={({ pressed }) => [
              styles.card,
              !empty && glow('sm', colors.accent),
              empty && styles.cardEmpty,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.cardTop}>
              <Text
                accessibilityElementsHidden
                importantForAccessibility="no"
                style={styles.emoji}
              >
                {category.emoji}
              </Text>
              <View
                accessibilityElementsHidden
                importantForAccessibility="no"
                style={styles.countPill}
              >
                <Text style={styles.countText}>{category.count}</Text>
              </View>
            </View>

            <Text
              accessibilityElementsHidden
              importantForAccessibility="no"
              style={styles.label}
              numberOfLines={2}
            >
              {category.label}
            </Text>

            {category.blurb ? (
              <Text
                accessibilityElementsHidden
                importantForAccessibility="no"
                style={styles.blurb}
                numberOfLines={3}
              >
                {category.blurb}
              </Text>
            ) : null}

            <Text
              accessibilityElementsHidden
              importantForAccessibility="no"
              style={styles.countCaption}
            >
              {empty ? 'Nothing yet' : countLabel(category.count)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
});

/**
 * The accessible alternative to the card row: one row per category, every
 * category including the empty ones, with its count. Same sort order as the
 * row, so switching views does not reorder anything.
 */
export function CategoryListView({ categories, sort = SORT_MODES.MOST, onSelectCategory }) {
  const sorted = useMemo(() => sortCategories(categories, sort), [categories, sort]);

  return (
    <View style={styles.list}>
      {sorted.map((category) => {
        const empty = category.count === 0;
        return (
          <Pressable
            key={category.key}
            accessibilityRole="button"
            accessibilityLabel={`${category.label}, ${countLabel(category.count)}`}
            accessibilityHint={empty ? 'No dreams in this category yet.' : 'Opens these dreams.'}
            accessibilityState={{ disabled: empty }}
            disabled={empty}
            onPress={() => onSelectCategory?.(category)}
            style={({ pressed }) => [
              styles.listRow,
              empty && styles.cardEmpty,
              pressed && styles.pressed,
            ]}
          >
            <Text
              accessibilityElementsHidden
              importantForAccessibility="no"
              style={styles.listEmoji}
            >
              {category.emoji}
            </Text>
            <View style={styles.listTextBlock}>
              <Text
                accessibilityElementsHidden
                importantForAccessibility="no"
                style={styles.label}
              >
                {category.label}
              </Text>
              {category.blurb ? (
                <Text
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                  style={styles.blurb}
                  numberOfLines={2}
                >
                  {category.blurb}
                </Text>
              ) : null}
            </View>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no"
              style={styles.countPill}
            >
              <Text style={styles.countText}>{category.count}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Two explicit buttons per option, each stating its own state. */
export function SortControl({ value, onChange, modes }) {
  const options = modes || [SORT_MODES.MOST, SORT_MODES.FEWEST];
  return (
    <View style={styles.sortRow} accessibilityRole="radiogroup">
      {options.map((mode) => {
        const selected = value === mode;
        return (
          <Pressable
            key={mode}
            accessibilityRole="radio"
            accessibilityLabel={`Sort by ${SORT_LABELS[mode]}`}
            accessibilityState={{ selected, checked: selected }}
            onPress={() => onChange(mode)}
            style={({ pressed }) => [
              styles.sortButton,
              selected && styles.sortButtonSelected,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.sortText, selected && styles.sortTextSelected]}>
              {selected ? '✓ ' : ''}
              {SORT_LABELS[mode]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const CARD_WIDTH = 168;

const styles = StyleSheet.create({
  row: { gap: spacing.md, paddingHorizontal: 2, paddingVertical: 2 },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.xs,
    justifyContent: 'flex-start',
    minHeight: 168,
    padding: spacing.md,
    width: CARD_WIDTH,
  },
  cardEmpty: { opacity: 0.55 },
  cardTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  emoji: { fontSize: 28, lineHeight: 34 },
  countPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(196,181,253,0.16)',
    borderColor: colors.accent,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minWidth: 30,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  countText: { color: colors.textPrimary, fontSize: fontSizes.caption, fontWeight: '800' },
  label: { color: colors.textPrimary, fontSize: fontSizes.bodyLarge, fontWeight: '800' },
  blurb: { color: colors.textSecondary, fontSize: fontSizes.caption, lineHeight: 17 },
  countCaption: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    fontWeight: '700',
    marginTop: 'auto',
  },
  list: { gap: spacing.sm },
  listRow: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: touchTarget,
    padding: spacing.md,
  },
  listEmoji: { fontSize: 26, lineHeight: 32 },
  listTextBlock: { flex: 1, gap: 2 },
  sortRow: { flexDirection: 'row', gap: spacing.xs },
  sortButton: {
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: touchTarget - 10,
    paddingHorizontal: spacing.sm,
  },
  sortButtonSelected: {
    backgroundColor: 'rgba(196,181,253,0.2)',
    borderColor: colors.accent,
  },
  sortText: { color: colors.textSecondary, fontSize: fontSizes.caption, fontWeight: '700' },
  sortTextSelected: { color: colors.textPrimary, fontWeight: '800' },
  pressed: { opacity: 0.72 },
});

export default CategoryCardRow;
