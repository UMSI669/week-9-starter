/**
 * Home's interactive dream-cloud map.
 *
 * Layout comes from the pure, deterministic layoutCloudMap() in
 * src/services/cloudMapLayout.js: positions are recomputed only when the
 * measured size, the counts, or the text scale change — never on every render,
 * and never from Math.random.
 *
 * The floating animation is decoration. It is skipped entirely when Reduce
 * Motion is on, it never moves a touch target far enough to matter (±4pt),
 * and no information depends on it.
 *
 * A labelled list view with the same names and counts is always reachable, and
 * is what crowded maps fall back to rather than shrinking text below 15pt.
 */

import { memo, useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { layoutCloudMap } from '../services/cloudMapLayout';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { colors, fontSizes, glow, radii, spacing, touchTarget } from '../theme';

const FLOAT_DISTANCE = 4;

export function DreamCloudMap({
  categories,
  recentDreams = [],
  width,
  height,
  fontScale = 1,
  onSelectCategory,
  onSelectDream,
}) {
  const reduceMotion = useReduceMotion();

  const layout = useMemo(
    () =>
      layoutCloudMap({
        categories,
        recentDreams,
        width,
        height,
        fontScale,
      }),
    [categories, recentDreams, width, height, fontScale],
  );

  if (!width || !height) return null;

  return (
    <ScrollView
      // Crowded maps scroll rather than shrink; contentHeight comes from the
      // layout, which may exceed the visible height.
      style={{ height }}
      contentContainerStyle={{ height: layout.contentHeight }}
      showsVerticalScrollIndicator={layout.contentHeight > height}
    >
      <View style={{ height: layout.contentHeight, width }}>
        {layout.nodes.map((node) => (
          <CloudNode
            key={node.key}
            node={node}
            reduceMotion={reduceMotion}
            onPress={() => onSelectCategory?.(node)}
          />
        ))}
        {layout.dreamStars.map((star) => (
          <DreamStar
            key={star.id}
            star={star}
            reduceMotion={reduceMotion}
            onPress={() => onSelectDream?.(star)}
          />
        ))}
      </View>
    </ScrollView>
  );
}

/** Hook-per-node so each cloud has its own independent, stable float phase. */
const CloudNode = memo(function CloudNode({ node, reduceMotion, onPress }) {
  const offset = useFloat(node.floatPhase, reduceMotion);

  return (
    <Animated.View
      style={[
        styles.node,
        {
          left: node.x,
          top: node.y,
          width: node.width,
          height: node.height,
          transform: [{ translateY: offset }],
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${node.label}, ${node.count} ${node.count === 1 ? 'dream' : 'dreams'}`}
        accessibilityHint="Opens the dreams in this category."
        onPress={onPress}
        style={({ pressed }) => [
          styles.cloud,
          glow(node.rank === 0 ? 'lg' : 'md'),
          // The largest cloud also gets a thicker border, so size is not the
          // only way to tell which category is biggest.
          node.rank === 0 && styles.cloudPrimary,
          pressed && styles.pressed,
        ]}
      >
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={[styles.cloudEmoji, { fontSize: Math.max(14, node.fontSize * 0.8) }]}
        >
          {node.emoji}
        </Text>
        <View style={styles.cloudTextBlock}>
          <Text
            accessibilityElementsHidden
            importantForAccessibility="no"
            numberOfLines={1}
            style={[styles.cloudLabel, { fontSize: node.fontSize }]}
          >
            {node.label}
          </Text>
          <Text
            accessibilityElementsHidden
            importantForAccessibility="no"
            style={styles.cloudCount}
          >
            {node.count}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
});

const DreamStar = memo(function DreamStar({ star, reduceMotion, onPress }) {
  const offset = useFloat(star.floatPhase + 0.5, reduceMotion);

  return (
    <Animated.View
      style={[
        styles.node,
        {
          left: star.x,
          top: star.y,
          width: star.width,
          height: star.height,
          transform: [{ translateY: offset }],
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Recent dream: ${star.title}`}
        accessibilityHint="Opens this dream."
        onPress={onPress}
        style={({ pressed }) => [styles.star, pressed && styles.pressed]}
      >
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={styles.starEmoji}
        >
          {star.emoji || '⭐'}
        </Text>
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no"
          numberOfLines={1}
          style={styles.starLabel}
        >
          {star.title}
        </Text>
      </Pressable>
    </Animated.View>
  );
});

function useFloat(phase, reduceMotion) {
  // Held in state, not a ref: the interpolation is read during render, and a
  // ref read during render is not safe under the React compiler.
  const [value] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduceMotion) {
      // Park at rest and run nothing at all.
      value.setValue(0);
      return undefined;
    }

    const duration = 3200 + Math.round(phase * 2600);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [phase, reduceMotion, value]);

  return value.interpolate({
    inputRange: [0, 1],
    outputRange: [-FLOAT_DISTANCE, FLOAT_DISTANCE],
  });
}

/** The accessible alternative to the map. Same names, same counts, no motion. */
export function CloudMapListView({ categories, onSelectCategory }) {
  const sorted = useMemo(
    () =>
      [...categories].sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.label.localeCompare(b.label, 'en');
      }),
    [categories],
  );

  return (
    <View style={styles.list}>
      {sorted.map((category) => (
        <Pressable
          key={category.key}
          accessibilityRole="button"
          accessibilityLabel={`${category.label}, ${category.count} ${category.count === 1 ? 'dream' : 'dreams'}`}
          accessibilityHint={
            category.count > 0 ? 'Opens the dreams in this category.' : 'No dreams yet.'
          }
          onPress={() => onSelectCategory?.(category)}
          style={({ pressed }) => [styles.listRow, pressed && styles.pressed]}
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
              style={styles.listLabel}
            >
              {category.label}
            </Text>
            {category.blurb ? (
              <Text
                accessibilityElementsHidden
                importantForAccessibility="no"
                style={styles.listBlurb}
                numberOfLines={2}
              >
                {category.blurb}
              </Text>
            ) : null}
          </View>
          <Text
            accessibilityElementsHidden
            importantForAccessibility="no"
            style={styles.listCount}
          >
            {category.count}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  node: { position: 'absolute' },
  cloud: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.borderStrong,
    borderRadius: radii.pill,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  cloudPrimary: {
    backgroundColor: colors.cardElevated,
    borderColor: colors.accent,
    borderWidth: 2,
  },
  cloudEmoji: { lineHeight: undefined },
  cloudTextBlock: { alignItems: 'flex-start' },
  cloudLabel: { color: colors.textPrimary, fontWeight: '800' },
  cloudCount: { color: colors.accent, fontSize: fontSizes.caption, fontWeight: '700' },
  star: {
    alignItems: 'center',
    backgroundColor: 'rgba(37,24,61,0.88)',
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 5,
    minHeight: touchTarget,
    paddingHorizontal: spacing.sm,
  },
  starEmoji: { fontSize: fontSizes.body },
  starLabel: { color: colors.textSecondary, flex: 1, fontSize: 11, fontWeight: '600' },
  pressed: { opacity: 0.72 },
  list: { gap: spacing.sm },
  listRow: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: touchTarget + 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  listEmoji: { fontSize: 22 },
  listTextBlock: { flex: 1, gap: 2 },
  listLabel: { color: colors.textPrimary, fontSize: fontSizes.body, fontWeight: '700' },
  listBlurb: { color: colors.textSecondary, fontSize: fontSizes.caption, lineHeight: 16 },
  listCount: {
    color: colors.accent,
    fontSize: fontSizes.bodyLarge,
    fontWeight: '800',
    minWidth: 28,
    textAlign: 'right',
  },
});

export default DreamCloudMap;
