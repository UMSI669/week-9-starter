/**
 * The dedicated card that react-native-view-shot captures as a PNG.
 *
 * Why this is a separate component from DreamCard:
 *  - the capture must contain the card only, never the screen chrome or the
 *    action buttons, so it is rendered on its own and measured on its own
 *  - the layout GROWS with long text instead of clipping it: no numberOfLines,
 *    no fixed height, no overflow hidden on text
 *  - it carries its own disclaimer, because the image travels further than
 *    the app does
 *  - it deliberately omits the raw transcript
 *
 * Emoji glyphs are drawn by the platform, so the same card looks slightly
 * different on iOS and Android. That is expected and is not something this
 * app can or should normalize.
 */

import { forwardRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { categoryEmoji, categoryLabel } from '../data/categories';
import { formatDreamDate } from '../services/formatDate';
import { accentFor, cardGradient } from '../services/visualSeed';
import { StarField } from './StarField';
import { colors, fontSizes, radii, spacing } from '../theme';

export const EXPORT_CARD_WIDTH = 340;

export const ExportCard = forwardRef(function ExportCard({ dream, width = EXPORT_CARD_WIDTH }, ref) {
  const [height, setHeight] = useState(0);
  const gradient = cardGradient(dream.visualSeed, dream.themes, dream.moods);
  const accent = accentFor(dream.visualSeed, dream.themes, dream.moods);
  const themes = (dream.themes || []).join(', ');
  const moods = (dream.moods || []).join(', ');

  return (
    <View
      ref={ref}
      // collapsable={false} keeps Android from flattening the view away, which
      // would make the capture come back empty.
      collapsable={false}
      onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
      style={[styles.card, { width }]}
    >
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <StarField seed={dream.visualSeed} width={width} height={height} starCount={13} />

        <View style={styles.scrim}>
          <Text style={styles.emoji}>{dream.emoji || '✨'}</Text>

          <Text style={styles.title}>{dream.title || 'Untitled dream'}</Text>

          <Text style={styles.date}>{formatDreamDate(dream.createdAt)}</Text>

          {dream.symbolLabel ? (
            <View style={[styles.symbolRow, { borderColor: accent }]}>
              <Text style={styles.symbolLabel}>Symbol: {dream.symbolLabel}</Text>
            </View>
          ) : null}

          {dream.interpretation ? (
            <Text style={styles.interpretation}>{dream.interpretation}</Text>
          ) : (
            <Text style={styles.interpretation}>
              {dream.summary || 'Saved as a transcript, with no reflection yet.'}
            </Text>
          )}

          {dream.reflectionQuestion ? (
            <Text style={styles.question}>{dream.reflectionQuestion}</Text>
          ) : null}

          <View style={styles.metaBlock}>
            <Text style={styles.meta}>
              {categoryEmoji(dream.primaryCategory)} {categoryLabel(dream.primaryCategory)}
            </Text>
            {themes ? <Text style={styles.meta}>Themes: {themes}</Text> : null}
            {moods ? <Text style={styles.meta}>Moods: {moods}</Text> : null}
          </View>

          {dream.isDemo ? (
            <Text style={styles.demoNotice}>Demo data — a sample shipped with the app.</Text>
          ) : null}

          <View style={styles.footer}>
            <Text style={styles.footerText}>Dream Decoder</Text>
            <Text style={styles.disclaimer}>a reflection, not a prediction</Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { borderRadius: radii.xl, overflow: 'hidden' },
  gradient: { borderColor: colors.borderStrong, borderRadius: radii.xl, borderWidth: 1 },
  scrim: {
    backgroundColor: 'rgba(16, 10, 36, 0.46)',
    borderRadius: radii.xl,
    gap: spacing.sm,
    padding: spacing.xl,
  },
  emoji: { fontSize: 46, lineHeight: 54 },
  title: {
    color: colors.textPrimary,
    fontSize: 23,
    fontWeight: '800',
    lineHeight: 29,
  },
  date: { color: colors.textSecondary, fontSize: fontSizes.small, fontWeight: '600' },
  symbolRow: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(16,10,36,0.5)',
    borderRadius: radii.sm,
    borderWidth: 1,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  symbolLabel: { color: colors.textPrimary, fontSize: fontSizes.small, fontWeight: '700' },
  interpretation: {
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    lineHeight: 23,
    marginTop: spacing.xs,
  },
  question: {
    color: colors.accent,
    fontSize: fontSizes.body,
    fontStyle: 'italic',
    lineHeight: 22,
  },
  metaBlock: { gap: 3, marginTop: spacing.sm },
  meta: { color: colors.textSecondary, fontSize: fontSizes.caption, fontWeight: '600' },
  demoNotice: {
    color: colors.warning,
    fontSize: fontSizes.caption,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  footer: {
    borderTopColor: 'rgba(196,181,253,0.28)',
    borderTopWidth: 1,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
  },
  footerText: { color: colors.textPrimary, fontSize: fontSizes.caption, fontWeight: '800' },
  disclaimer: { color: colors.textSecondary, fontSize: 11, marginTop: 1 },
});

export default ExportCard;
