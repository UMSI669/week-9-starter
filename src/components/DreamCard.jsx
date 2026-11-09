/**
 * A glowing dream card for the gallery.
 *
 * All artwork is deterministic from the dream's persisted `visualSeed`: the
 * gradient, the accent, and the constellation. No image service is involved,
 * and the card looks identical after every restart.
 *
 * Readability: gradient lightness is capped in visualSeed.js, and the text
 * sits on a translucent dark scrim, so the foreground keeps its contrast no
 * matter which hue the seed produced.
 */

import { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { categoryEmoji, categoryLabel } from '../data/categories';
import { formatDreamDateShort } from '../services/formatDate';
import { accentFor, cardGradient } from '../services/visualSeed';
import { DemoBadge, Tag } from './ui';
import { StarField } from './StarField';
import { colors, fontSizes, glow, radii, spacing } from '../theme';

export const DreamCard = memo(function DreamCard({ dream, onPress, compact = false }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const gradient = cardGradient(dream.visualSeed, dream.themes, dream.moods);
  const accent = accentFor(dream.visualSeed, dream.themes, dream.moods);
  const date = formatDreamDateShort(dream.createdAt);
  const tags = [...(dream.themes || []).slice(0, 3), ...(dream.moods || []).slice(0, 2)];

  const preview = (dream.interpretation || dream.summary || dream.transcript || '').trim();
  const hasInterpretation = Boolean(dream.interpretation);

  // One label covering the whole card, so a screen reader reads it as a single
  // meaningful item rather than seven disconnected fragments.
  const accessibilityLabel = [
    dream.title || 'Untitled dream',
    dream.isDemo ? 'Demo data.' : '',
    `Symbol: ${dream.symbolLabel || 'none recorded'}.`,
    `Category: ${categoryLabel(dream.primaryCategory)}.`,
    date ? `Recorded ${date}.` : '',
    hasInterpretation ? `Reflection: ${dream.interpretation}` : 'Transcript only, no reflection yet.',
    tags.length ? `Tags: ${tags.join(', ')}.` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Opens this dream."
      onPress={onPress}
      onLayout={(event) => setSize(event.nativeEvent.layout)}
      style={({ pressed }) => [styles.wrapper, glow('md', accent), pressed && styles.pressed]}
    >
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <StarField
          seed={dream.visualSeed}
          width={size.width}
          height={size.height}
          starCount={compact ? 6 : 10}
          opacity={0.75}
        />

        <View style={styles.scrim}>
          <View style={styles.topRow}>
            <Text
              accessibilityElementsHidden
              importantForAccessibility="no"
              style={styles.emoji}
            >
              {dream.emoji || '✨'}
            </Text>
            <View style={styles.titleBlock}>
              <Text style={styles.title} numberOfLines={2}>
                {dream.title || 'Untitled dream'}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {dream.symbolLabel ? `${dream.symbolLabel} · ` : ''}
                {date}
              </Text>
            </View>
          </View>

          {dream.isDemo ? <DemoBadge /> : null}

          {preview ? (
            <Text style={styles.preview} numberOfLines={compact ? 2 : 3}>
              {hasInterpretation ? preview : `Transcript only — ${preview}`}
            </Text>
          ) : null}

          <View style={styles.tagRow}>
            <View style={[styles.categoryPill, { borderColor: accent }]}>
              <Text
                accessibilityElementsHidden
                importantForAccessibility="no"
                style={styles.categoryEmoji}
              >
                {categoryEmoji(dream.primaryCategory)}
              </Text>
              <Text style={styles.categoryText}>{categoryLabel(dream.primaryCategory)}</Text>
            </View>
            {tags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: radii.lg,
    // Android clips the gradient to the border radius only with overflow hidden.
    overflow: 'hidden',
  },
  pressed: { opacity: 0.85 },
  gradient: { borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1 },
  scrim: {
    backgroundColor: 'rgba(16, 10, 36, 0.42)',
    borderRadius: radii.lg,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  topRow: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md },
  emoji: { fontSize: 30, lineHeight: 36 },
  titleBlock: { flex: 1, gap: 2 },
  title: { color: colors.textPrimary, fontSize: fontSizes.bodyLarge, fontWeight: '800' },
  meta: { color: colors.textSecondary, fontSize: fontSizes.caption, fontWeight: '600' },
  preview: { color: colors.textPrimary, fontSize: fontSizes.body, lineHeight: 21, opacity: 0.95 },
  tagRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 },
  categoryPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(16,10,36,0.45)',
    borderRadius: radii.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  categoryEmoji: { fontSize: fontSizes.caption },
  categoryText: { color: colors.textPrimary, fontSize: fontSizes.caption, fontWeight: '700' },
});

export default DreamCard;
