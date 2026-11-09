import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, styles } from '../../theme';

export function Button({ title, onPress, secondary = false, danger = false, disabled = false, icon, busy = false }: {
  title: string; onPress: () => void; secondary?: boolean; danger?: boolean; disabled?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>['name']; busy?: boolean;
}) {
  const foreground = secondary ? (danger ? colors.red : colors.navy) : colors.white;
  return <Pressable accessibilityRole="button" accessibilityLabel={title} aria-disabled={disabled || busy} accessibilityState={{ disabled: disabled || busy }}
    disabled={disabled || busy} onPress={onPress} style={({ pressed }) => ({
      minHeight: 50, paddingHorizontal: 20, paddingVertical: 13, borderRadius: 15,
      backgroundColor: secondary ? colors.white : danger ? colors.red : colors.orange,
      borderWidth: secondary ? 1 : 0, borderColor: colors.line, flexDirection: 'row', gap: 9,
      alignItems: 'center', justifyContent: 'center', opacity: disabled || busy ? 0.5 : pressed ? 0.8 : 1,
    })}>
    {busy ? <ActivityIndicator color={foreground} /> : icon ? <Ionicons name={icon} size={20} color={foreground} /> : null}
    <Text style={{ color: foreground, fontSize: 15, fontWeight: '700' }}>{title}</Text>
  </Pressable>;
}

export function IconButton({ name, label, onPress, color = colors.navy, disabled = false }: {
  name: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; color?: string; disabled?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} aria-disabled={disabled} disabled={disabled}
    onPress={onPress} style={({ pressed }) => ({ minWidth: 44, minHeight: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', opacity: pressed || disabled ? 0.45 : 1 })}>
    <Ionicons name={name} size={23} color={color} />
  </Pressable>;
}

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  return <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
    {scroll ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>{children}</ScrollView> : children}
  </SafeAreaView>;
}

export function BackHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return <View style={styles.between}>
    <View style={styles.row}><IconButton name="arrow-back" label="Go back" onPress={onBack} /><Text style={styles.section}>{title}</Text></View>
    <Text style={[styles.eyebrow, { fontSize: 9 }]}>PANTRY WEEK</Text>
  </View>;
}

export function BrandHeader({ right }: { right?: ReactNode }) {
  return <View style={styles.between}>
    <View style={styles.row}>
      <View style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="basket-outline" color={colors.white} size={23} /></View>
      <Text style={{ color: colors.navy, fontWeight: '800', fontSize: 17, letterSpacing: -0.3 }}>pantry week<Text style={{ color: colors.orange }}>.</Text></Text>
    </View>
    {right}
  </View>;
}

export function EmptyState({ title, message, icon = 'basket-outline', action }: {
  title: string; message: string; icon?: React.ComponentProps<typeof Ionicons>['name']; action?: ReactNode;
}) {
  return <View style={{ alignItems: 'center', paddingVertical: 34, paddingHorizontal: 20, gap: 14 }}>
    <View style={{ padding: 24, borderRadius: 32, backgroundColor: colors.peach }}><Ionicons name={icon} size={40} color={colors.orange} /></View>
    <Text style={[styles.section, { textAlign: 'center' }]}>{title}</Text>
    <Text style={[styles.subtitle, { textAlign: 'center', maxWidth: 300 }]}>{message}</Text>
    {action}
  </View>;
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return <View style={styles.card}><Text style={styles.error}>{message}</Text>{retry && <Button title="Try again" onPress={retry} secondary />}</View>;
}

export function ConfirmDialog({ visible, title, message, confirmLabel, onCancel, onConfirm, danger = false }: {
  visible: boolean; title: string; message: string; confirmLabel: string; onCancel: () => void; onConfirm: () => void; danger?: boolean;
}) {
  return <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
    <View style={{ flex: 1, backgroundColor: '#152C3588', justifyContent: 'center', alignItems: 'center', padding: 26 }}>
      <View accessibilityViewIsModal style={[styles.card, { width: '100%', maxWidth: 420, gap: 18 }]}>
        <Text style={styles.section}>{title}</Text><Text style={styles.subtitle}>{message}</Text>
        <Button title={confirmLabel} onPress={onConfirm} danger={danger} />
        <Button title="Cancel" onPress={onCancel} secondary />
      </View>
    </View>
  </Modal>;
}

export function ChoiceChips<T extends string>({ values, value, onChange, label }: { values: readonly T[]; value: T; onChange: (value: T) => void; label: string }) {
  return <View style={{ gap: 7 }}><Text style={styles.label}>{label}</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
    {values.map(option => <Pressable key={option} accessibilityRole="button" accessibilityLabel={`${label}: ${option || 'none'}`} aria-selected={option === value} accessibilityState={{ selected: option === value }}
      onPress={() => onChange(option)} style={[styles.chip, option === value && styles.chipActive]}>
      <Text style={[styles.chipText, option === value && { color: colors.white }]}>{option || 'none'}</Text>
    </Pressable>)}
  </View></View>;
}

export function QuantityStepper({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: colors.line, alignSelf: 'flex-start', backgroundColor: colors.white }}>
    <IconButton name="remove" label="Decrease quantity" onPress={() => onChange(Math.max(1, value - 1))} disabled={value <= 1} />
    <Text accessibilityLabel={`Quantity ${value}`} style={{ fontSize: 19, color: colors.navy, fontWeight: '700', minWidth: 35, textAlign: 'center' }}>{value}</Text>
    <IconButton name="add" label="Increase quantity" onPress={() => onChange(Math.min(9999, value + 1))} disabled={value >= 9999} />
  </View>;
}

export function Expandable({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <View style={{ gap: 12 }}><Pressable accessibilityRole="button" aria-expanded={open} accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={styles.between}>
    <Text style={styles.small}>{title}</Text><Ionicons name={open ? 'chevron-up' : 'chevron-down'} color={colors.muted} size={17} />
  </Pressable>{open && children}</View>;
}
