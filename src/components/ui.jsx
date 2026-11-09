/**
 * Shared interface primitives.
 *
 * Rules these enforce so individual screens cannot forget them:
 *  - every control is at least 48x48 (iOS needs 44pt, Android 48dp)
 *  - selection and focus are shown by border, weight, and a check mark,
 *    never by glow alone
 *  - text uses platform fonts, so nothing renders blank offline
 *  - layouts use flex and padding, not browser CSS assumptions
 */

import { forwardRef } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSizes, glow, gradients, radii, spacing, touchTarget } from '../theme';

/** Full-screen night gradient. Decorative, so it is hidden from screen readers. */
export function NightBackground({ children, style }) {
  return (
    <LinearGradient
      colors={gradients.screen}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={[styles.fill, style]}
    >
      {children}
    </LinearGradient>
  );
}

export function Screen({ children, scroll = true, contentStyle, edges = ['top', 'left', 'right'] }) {
  return (
    <NightBackground>
      <SafeAreaView style={styles.fill} edges={edges}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={[styles.scrollContent, contentStyle]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.fill, contentStyle]}>{children}</View>
        )}
      </SafeAreaView>
    </NightBackground>
  );
}

export function PageHeading({ eyebrow, title, description, right }) {
  return (
    <View style={styles.headingRow}>
      <View style={styles.headingText}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text accessibilityRole="header" style={styles.heading}>
          {title}
        </Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function Card({ children, style, glowIntensity = 'sm' }) {
  return <View style={[styles.card, glow(glowIntensity), style]}>{children}</View>;
}

export function SectionTitle({ children, style }) {
  return (
    <Text accessibilityRole="header" style={[styles.sectionTitle, style]}>
      {children}
    </Text>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  busy = false,
  icon,
  accessibilityLabel,
  accessibilityHint,
  style,
}) {
  const isDisabled = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy }}
      disabled={isDisabled}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.button,
        variantStyles[variant]?.container,
        isDisabled && styles.buttonDisabled,
        pressed && !isDisabled && styles.buttonPressed,
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={variantStyles[variant]?.spinner || colors.textPrimary} /> : null}
      {!busy && icon ? <Text style={styles.buttonIcon}>{icon}</Text> : null}
      <Text style={[styles.buttonText, variantStyles[variant]?.text]} numberOfLines={2}>
        {title}
      </Text>
    </Pressable>
  );
}

const variantStyles = {
  primary: {
    container: { backgroundColor: colors.accentStrong, borderColor: colors.accent, borderWidth: 1 },
    text: { color: '#1B0E38' },
    spinner: '#1B0E38',
  },
  secondary: {
    container: { backgroundColor: colors.cardElevated, borderColor: colors.borderStrong, borderWidth: 1 },
    text: { color: colors.textPrimary },
  },
  ghost: {
    container: { backgroundColor: 'transparent', borderColor: colors.border, borderWidth: 1 },
    text: { color: colors.textSecondary },
  },
  danger: {
    container: { backgroundColor: 'rgba(255,179,190,0.14)', borderColor: colors.danger, borderWidth: 1 },
    text: { color: colors.danger },
  },
  record: {
    container: {
      backgroundColor: colors.accentStrong,
      borderColor: colors.accent,
      borderWidth: 2,
      minHeight: 60,
    },
    text: { color: '#1B0E38', fontSize: fontSizes.bodyLarge, fontWeight: '800' },
    spinner: '#1B0E38',
  },
};

/**
 * Status line. `tone` sets the colour, but the text always says what happened,
 * so colour is never the only signal. `announce` makes screen readers speak
 * the change, which is how recording and save progress is reported.
 */
export function StatusMessage({ children, tone = 'info', announce = false, style }) {
  const toneStyle =
    tone === 'success'
      ? styles.statusSuccess
      : tone === 'error'
        ? styles.statusError
        : tone === 'warning'
          ? styles.statusWarning
          : styles.statusInfo;

  return (
    <View
      accessibilityLiveRegion={announce ? 'polite' : 'none'}
      accessibilityRole={tone === 'error' ? 'alert' : undefined}
      style={[styles.status, toneStyle, style]}
    >
      <Text style={styles.statusText}>{children}</Text>
    </View>
  );
}

export function FieldLabel({ children, hint }) {
  return (
    <View style={styles.fieldLabelBlock}>
      <Text style={styles.fieldLabel}>{children}</Text>
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

export const Input = forwardRef(function Input(
  { multiline = false, style, minHeight, ...rest },
  ref,
) {
  return (
    <TextInput
      ref={ref}
      style={[
        styles.input,
        multiline && styles.inputMultiline,
        minHeight ? { minHeight } : null,
        style,
      ]}
      multiline={multiline}
      placeholderTextColor={colors.textMuted}
      selectionColor={colors.accent}
      // Android: let the field grow with the keyboard instead of scrolling under it.
      textAlignVertical={multiline ? 'top' : 'center'}
      {...rest}
    />
  );
});

/**
 * Selectable chip. Selection is communicated three ways: the border thickens,
 * the background fills, and a check mark appears. Never colour alone.
 */
export function Chip({
  label,
  emoji,
  selected = false,
  onPress,
  count,
  accessibilityLabel,
  style,
}) {
  const content = (
    <>
      {emoji ? (
        <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.chipEmoji}>
          {emoji}
        </Text>
      ) : null}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
      {typeof count === 'number' ? <Text style={styles.chipCount}>{count}</Text> : null}
      {selected ? (
        <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.chipCheck}>
          {'✓'}
        </Text>
      ) : null}
    </>
  );

  if (!onPress) {
    return <View style={[styles.chip, selected && styles.chipSelected, style]}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.chip,
        styles.chipTouchable,
        selected && styles.chipSelected,
        pressed && styles.buttonPressed,
        style,
      ]}
    >
      {content}
    </Pressable>
  );
}

/** Read-only tag pill used on cards and detail screens. */
export function Tag({ children, prefix }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>
        {prefix ? `${prefix} ` : ''}
        {children}
      </Text>
    </View>
  );
}

export function Divider({ style }) {
  return <View accessibilityElementsHidden style={[styles.divider, style]} />;
}

export function EmptyState({ title, body, children }) {
  return (
    <View style={styles.empty}>
      <Text accessibilityRole="header" style={styles.emptyTitle}>
        {title}
      </Text>
      {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
      {children}
    </View>
  );
}

export function DemoBadge({ style }) {
  return (
    <View style={[styles.demoBadge, style]}>
      <Text style={styles.demoBadgeText}>DEMO DATA</Text>
    </View>
  );
}

export function LoadingBlock({ label = 'Loading' }) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.loading}>
      <ActivityIndicator color={colors.accent} />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl + spacing.lg,
    gap: spacing.lg,
  },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  headingText: { flex: 1, gap: spacing.xs },
  eyebrow: {
    color: colors.accent,
    fontSize: fontSizes.caption,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  heading: { color: colors.textPrimary, fontSize: fontSizes.heading, fontWeight: '800' },
  description: { color: colors.textSecondary, fontSize: fontSizes.body, lineHeight: 22 },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.title,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  button: {
    alignItems: 'center',
    borderRadius: radii.md,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: touchTarget,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  buttonText: { fontSize: fontSizes.body, fontWeight: '700', textAlign: 'center' },
  buttonIcon: { fontSize: fontSizes.bodyLarge },
  buttonDisabled: { opacity: 0.45 },
  buttonPressed: { opacity: 0.75 },
  status: { borderRadius: radii.md, borderWidth: 1, padding: spacing.md },
  statusText: { color: colors.textPrimary, fontSize: fontSizes.body, lineHeight: 21 },
  statusInfo: { backgroundColor: 'rgba(196,181,253,0.12)', borderColor: colors.borderStrong },
  statusSuccess: { backgroundColor: 'rgba(155,232,192,0.13)', borderColor: colors.success },
  statusWarning: { backgroundColor: 'rgba(243,208,138,0.13)', borderColor: colors.warning },
  statusError: { backgroundColor: 'rgba(255,179,190,0.13)', borderColor: colors.danger },
  fieldLabelBlock: { gap: 2 },
  fieldLabel: { color: colors.textPrimary, fontSize: fontSizes.body, fontWeight: '700' },
  fieldHint: { color: colors.textSecondary, fontSize: fontSizes.small, lineHeight: 18 },
  input: {
    backgroundColor: colors.background,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    minHeight: touchTarget,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm,
  },
  inputMultiline: { minHeight: 132, lineHeight: 22 },
  chip: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipTouchable: { minHeight: touchTarget, paddingHorizontal: spacing.lg },
  chipSelected: {
    backgroundColor: 'rgba(196,181,253,0.18)',
    borderColor: colors.accent,
    borderWidth: 2,
  },
  chipText: { color: colors.textSecondary, fontSize: fontSizes.body, fontWeight: '600' },
  chipTextSelected: { color: colors.textPrimary, fontWeight: '800' },
  chipEmoji: { fontSize: fontSizes.bodyLarge },
  chipCount: {
    color: colors.textMuted,
    fontSize: fontSizes.small,
    fontWeight: '700',
    marginLeft: 2,
  },
  chipCheck: { color: colors.accent, fontSize: fontSizes.body, fontWeight: '900' },
  tag: {
    backgroundColor: 'rgba(196,181,253,0.10)',
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  tagText: { color: colors.textSecondary, fontSize: fontSizes.caption, fontWeight: '600' },
  divider: { backgroundColor: colors.border, height: 1, marginVertical: spacing.sm },
  empty: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.title,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyBody: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    lineHeight: 22,
    maxWidth: 320,
    textAlign: 'center',
  },
  demoBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(243,208,138,0.18)',
    borderColor: colors.warning,
    borderRadius: radii.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  demoBadgeText: {
    color: colors.warning,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  loading: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl },
  loadingText: { color: colors.textSecondary, fontSize: fontSizes.body },
});

export { styles as uiStyles };
