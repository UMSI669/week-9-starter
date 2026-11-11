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
import { Tag } from './ui';
import { StarField } from './StarField';
import { colors, fontSizes, glow, radii, spacing } from '../theme';

/**
 * @param {object} props
 * @param {object} props.dream
 * @param {Function} [props.onPress]
 * @param {boolean} [props.compact]
 * @param {number|null} [props.previewLines] Lines of reflection to show.
 *        `null` shows all of it. Defaults to 2 when compact, else 3. The
 *        detail screen passes null, because clipping the reflection there
 *        left no way to read the rest.
 * @param {boolean} [props.fill] Stretch to the height of the parent and pin the
 *        tag row to the bottom. Used by the horizontal rows, where cards of
 *        different text lengths otherwise end up ragged.
 */
export const DreamCard = memo(function DreamCard({
  dream,
  onPress,
  compact = false,
  previewLines,
  fill = false,
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const gradient = cardGradient(dream.visualSeed, dream.themes, dream.moods);
  const accent = accentFor(dream.visualSeed, dream.themes, dream.moods);
  const date = formatDreamDateShort(dream.createdAt);
  const tags = compact ? [] : [...(dream.themes || []).slice(0, 3), ...(dream.moods || []).slice(0, 2)];

  const preview = (dream.interpretation || dream.summary || dream.transcript || '').trim();
  const hasInterpretation = Boolean(dream.interpretation);
  const lines = previewLines === undefined ? (compact ? 2 : 3) : previewLines;
  const clamped = typeof lines === 'number';

  // One label covering the whole card, so a screen reader reads it as a single
  // meaningful item rather than seven disconnected fragments.
  const accessibilityLabel = [
    dream.title || 'Untitled dream',
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
      accessibilityRole={onPress ? 'button' : 'summary'}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={onPress ? 'Opens this dream.' : undefined}
      onPress={onPress}
      disabled={!onPress}
      onLayout={(event) => setSize(event.nativeEvent.layout)}
      style={({ pressed }) => [
        styles.wrapper,
        fill && styles.wrapperFill,
        glow('md', accent),
        pressed && styles.pressed,
      ]}
    >
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradient, fill && styles.gradientFill]}
      >
        <StarField
          seed={dream.visualSeed}
          width={size.width}
          height={size.height}
          starCount={compact ? 6 : 10}
          opacity={0.75}
        />

        <View style={[styles.scrim, fill && styles.scrimFill]}>
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

          {preview ? (
            <>
              <Text style={styles.preview} numberOfLines={clamped ? lines : undefined}>
                {hasInterpretation ? preview : `Transcript only — ${preview}`}
              </Text>
              {/* An explicit affordance, because a clipped paragraph gives the
                  reader no way to know there is more. Shown only when the text
                  is long enough to actually be cut. */}
              {clamped && onPress && preview.length > lines * 42 ? (
                <Text style={styles.readMore}>Tap to read all</Text>
              ) : null}
            </>
          ) : null}

          <View
            style={[
              styles.tagRow,
              fill && styles.tagRowFill,
              compact && styles.tagRowSingleLine,
            ]}
          >
            <View style={[styles.categoryPill, { borderColor: accent }]}>
              <Text
                accessibilityElementsHidden
                importantForAccessibility="no"
                style={styles.categoryEmoji}
              >
                {categoryEmoji(dream.primaryCategory)}
              </Text>
              <Text numberOfLines={1} style={styles.categoryText}>
                {categoryLabel(dream.primaryCategory)}
              </Text>
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
  wrapperFill: { flex: 1 },
  pressed: { opacity: 0.85 },
  gradient: { borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1 },
  gradientFill: { flex: 1 },
  scrim: {
    backgroundColor: 'rgba(16, 10, 36, 0.42)',
    borderRadius: radii.lg,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  scrimFill: { flex: 1, paddingBottom: spacing.md },
  // marginTop:auto pushes the tags to the bottom edge, so every card in a row
  // lines its tags up regardless of how long its title or reflection ran.
  tagRowFill: { marginTop: 'auto' },
  topRow: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md },
  emoji: { fontSize: 30, lineHeight: 36 },
  titleBlock: { flex: 1, gap: 2 },
  title: { color: colors.textPrimary, fontSize: fontSizes.bodyLarge, fontWeight: '800' },
  meta: { color: colors.textSecondary, fontSize: fontSizes.caption, fontWeight: '600' },
  preview: { color: colors.textPrimary, fontSize: fontSizes.body, lineHeight: 21, opacity: 0.95 },
  readMore: { color: colors.accent, fontSize: fontSizes.caption, fontWeight: '700' },
  tagRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 },
  // In a fixed-height card the row gets one line and must not wrap off the
  // bottom edge, so the pill shrinks and its label truncates cleanly instead.
  tagRowSingleLine: { flexWrap: 'nowrap' },
  categoryPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(16,10,36,0.45)',
    borderRadius: radii.sm,
    borderWidth: 1,
    flexDirection: 'row',
    flexShrink: 1,
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  categoryEmoji: { fontSize: fontSizes.caption },
  categoryText: { color: colors.textPrimary, fontSize: fontSizes.caption, fontWeight: '700' },
});

export default DreamCard;
