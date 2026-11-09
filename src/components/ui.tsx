import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

export const colors = {
  background: '#F3F6FA',
  card: '#FFFFFF',
  ink: '#172B4D',
  muted: '#52627A',
  faint: '#8593A8',
  border: '#D9E1EC',
  primary: '#135C78',
  primaryDark: '#0E455B',
  paleBlue: '#E8F3F7',
  success: '#226643',
  paleGreen: '#EAF5EF',
  danger: '#9B2C2C',
  paleRed: '#FCEEEE',
  amber: '#76510C',
  paleAmber: '#FFF4D8',
  highlight: '#FFE7A3',
  placeholder: '#DCEBFA',
  purple: '#5B3E96',
  palePurple: '#F0EBFA',
};

export function Screen({ children, contentStyle }: { children: ReactNode; contentStyle?: StyleProp<ViewStyle> }) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.page, contentStyle]}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {children}
      </Text>
      {right}
    </View>
  );
}

export function Body({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: StyleProp<any> }) {
  return <Text style={[styles.body, muted && styles.muted, style]}>{children}</Text>;
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  title,
  onPress,
  disabled,
  variant = 'primary',
  loading,
  small,
  accessibilityHint,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
  loading?: boolean;
  small?: boolean;
  accessibilityHint?: string;
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        styles[`button_${variant}`],
        isDisabled && styles.buttonDisabled,
        pressed && !isDisabled && styles.buttonPressed,
      ]}
    >
      {loading ? <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? '#fff' : colors.primary} /> : null}
      <Text style={[styles.buttonText, small && styles.buttonTextSmall, styles[`buttonText_${variant}`]]}>{title}</Text>
    </Pressable>
  );
}

export function ButtonRow({ children }: { children: ReactNode }) {
  return <View style={styles.buttonRow}>{children}</View>;
}

type Tone = 'info' | 'success' | 'warning' | 'danger' | 'demo';
const toneColors: Record<Tone, { bg: string; fg: string }> = {
  info: { bg: colors.paleBlue, fg: colors.primaryDark },
  success: { bg: colors.paleGreen, fg: colors.success },
  warning: { bg: colors.paleAmber, fg: colors.amber },
  danger: { bg: colors.paleRed, fg: colors.danger },
  demo: { bg: colors.palePurple, fg: colors.purple },
};

export function Banner({ tone = 'info', title, children }: { tone?: Tone; title?: string; children?: ReactNode }) {
  const c = toneColors[tone];
  return (
    <View accessibilityRole={tone === 'danger' ? 'alert' : undefined} style={[styles.banner, { backgroundColor: c.bg }]}>
      {title ? <Text style={[styles.bannerTitle, { color: c.fg }]}>{title}</Text> : null}
      {typeof children === 'string' ? <Text style={[styles.bannerText, { color: c.fg }]}>{children}</Text> : children}
    </View>
  );
}

export function Pill({ label, tone = 'info' }: { label: string; tone?: Tone }) {
  const c = toneColors[tone];
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <Text style={[styles.pillText, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

export function Field({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.faint}
        accessibilityLabel={label}
        {...props}
        style={[styles.input, props.multiline && styles.inputMultiline, props.style]}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function ToggleRow({
  label,
  description,
  value,
  onValueChange,
  disabled,
}: {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {description ? <Text style={styles.hint}>{description}</Text> : null}
      </View>
      <Switch accessibilityLabel={label} value={value} onValueChange={onValueChange} disabled={disabled} trackColor={{ true: colors.primary }} />
    </View>
  );
}

export function ProgressBar({ value }: { value: number | null }) {
  return (
    <View style={styles.progressTrack} accessibilityRole="progressbar" accessibilityValue={value === null ? undefined : { min: 0, max: 100, now: Math.round(value * 100) }}>
      <View style={[styles.progressFill, { width: `${Math.round((value ?? 0.15) * 100)}%` }]} />
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ListItem({
  title,
  subtitle,
  right,
  onPress,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      style={({ pressed }) => [styles.listItem, pressed && onPress && { backgroundColor: colors.paleBlue }]}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.listTitle}>{title}</Text>
        {subtitle ? <Text style={styles.hint}>{subtitle}</Text> : null}
      </View>
      {right}
      {onPress ? <Text style={styles.chevron}>›</Text> : null}
    </Pressable>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {children}
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  page: { padding: 16, paddingBottom: 48, gap: 14 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 14,
    gap: 10,
  },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
  body: { fontSize: 15, lineHeight: 21, color: colors.ink },
  muted: { color: colors.muted },
  button: {
    minHeight: 46,
    borderRadius: 11,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    flexGrow: 1,
  },
  buttonSmall: { minHeight: 36, paddingHorizontal: 12, flexGrow: 0 },
  button_primary: { backgroundColor: colors.primary },
  button_secondary: { backgroundColor: colors.paleBlue, borderWidth: 1, borderColor: '#BBD6E2' },
  button_danger: { backgroundColor: colors.danger },
  button_ghost: { backgroundColor: 'transparent' },
  buttonDisabled: { opacity: 0.45 },
  buttonPressed: { opacity: 0.8 },
  buttonText: { fontSize: 16, fontWeight: '700' },
  buttonTextSmall: { fontSize: 14 },
  buttonText_primary: { color: '#fff' },
  buttonText_secondary: { color: colors.primaryDark },
  buttonText_danger: { color: '#fff' },
  buttonText_ghost: { color: colors.primary },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  banner: { borderRadius: 12, padding: 12, gap: 4 },
  bannerTitle: { fontSize: 15, fontWeight: '700' },
  bannerText: { fontSize: 14, lineHeight: 19 },
  pill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, fontWeight: '700' },
  field: { gap: 6 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: colors.ink },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: '#FBFCFE',
  },
  inputMultiline: { minHeight: 84, textAlignVertical: 'top' },
  hint: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: colors.ink },
  progressTrack: { height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: colors.primary },
  segmented: { flexDirection: 'row', backgroundColor: '#E4EAF2', borderRadius: 10, padding: 3 },
  segment: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  segmentSelected: { backgroundColor: '#fff' },
  segmentText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  segmentTextSelected: { color: colors.ink },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  listTitle: { fontSize: 16, fontWeight: '600', color: colors.ink },
  chevron: { fontSize: 24, color: colors.faint },
  empty: { alignItems: 'center', padding: 20, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.muted },
});
