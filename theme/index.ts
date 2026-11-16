import { StyleSheet } from 'react-native';
export const colors = {
  navy: '#152C35', muted: '#61727A', orange: '#CB541E', peach: '#FFF0E6',
  cream: '#FCF9F5', white: '#FFFFFF', line: '#E8E2D9', green: '#32745A',
  greenLight: '#EAF3EC', red: '#B63D36',
};
export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 22, paddingBottom: 36, gap: 20, width: '100%', maxWidth: 780, alignSelf: 'center' },
  title: { fontSize: 32, lineHeight: 40, fontWeight: '800', color: colors.navy, letterSpacing: -1 },
  subtitle: { fontSize: 15, lineHeight: 23, color: colors.muted },
  eyebrow: { fontSize: 11, letterSpacing: 2, fontWeight: '700', color: colors.orange, textTransform: 'uppercase' },
  section: { fontSize: 20, fontWeight: '700', color: colors.navy },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  card: { backgroundColor: colors.white, borderRadius: 20, borderWidth: 1, borderColor: colors.line, padding: 18, gap: 12 },
  input: { minHeight: 50, minWidth: 0, borderWidth: 1, borderColor: colors.line, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.white, color: colors.navy, fontSize: 16 },
  chip: { minHeight: 42, paddingHorizontal: 15, paddingVertical: 10, borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  chipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.navy },
  label: { color: colors.navy, fontSize: 13, fontWeight: '700', marginBottom: 6 },
  small: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  error: { color: colors.red, fontSize: 14, lineHeight: 21 },
});
