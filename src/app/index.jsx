import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATEGORIES, amountToCents, formatUSD, parseExpenseTranscript } from '../lib/expense';
import { useExpenses } from '../hooks/useExpenses';
import { useSpeechExpense } from '../hooks/useSpeechExpense';

const navy = '#151D4D';
const muted = '#8588A1';
const labels = { Food: 'Food & Drink', Transportation: 'Transportation', Shopping: 'Shopping', Entertainment: 'Entertainment', Other: 'Other' };
const icons = { Food: '♨', Transportation: '▣', Shopping: '▢', Entertainment: '★', Other: '●' };
const tones = { Food: ['#FFE8D7', '#C75B00'], Transportation: ['#E5DEFF', '#5146A9'], Shopping: ['#D9F8EA', '#168766'], Entertainment: ['#FCE5F1', '#AC3A79'], Other: ['#EDEEF5', '#585D7A'] };
const freshDraft = () => ({ amount: '', category: 'Other', description: '', transcript: '', ambiguous: false });

function Button({ label, onPress, primary = false, disabled = false, style }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, primary ? styles.primaryButton : styles.lightButton, disabled && { opacity: .55 }, pressed && { opacity: .8 }, style]}><Text style={[styles.buttonText, primary && { color: '#fff' }]}>{label}</Text></Pressable>;
}

export default function Home() {
  const insets = useSafeAreaInsets();
  const { expenses, loading, error: storageError, pendingUndo, save, remove, undo } = useExpenses();
  const [filter, setFilter] = useState('All');
  const [draft, setDraft] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const scrollRef = useRef(null);

  const reviewTranscript = useCallback(value => {
    const parsed = parseExpenseTranscript(value);
    setDraft({ ...parsed, transcript: value });
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);
  const speech = useSpeechExpense(reviewTranscript);
  const total = useMemo(() => expenses.reduce((sum, item) => sum + item.amountCents, 0), [expenses]);
  const shown = useMemo(() => filter === 'All' ? expenses : expenses.filter(item => item.category === filter), [expenses, filter]);
  const subtotal = useMemo(() => shown.reduce((sum, item) => sum + item.amountCents, 0), [shown]);
  const update = (key, value) => setDraft(old => ({ ...old, [key]: value }));

  const saveDraft = async () => {
    if (!draft || busyRef.current) return;
    const amountCents = amountToCents(draft.amount);
    if (amountCents === null) { setMessage('Enter a valid amount greater than zero, with up to two decimal places.'); return; }
    if (!draft.description.trim()) { setMessage('Enter a description for this expense.'); return; }
    busyRef.current = true; setBusy(true); setMessage('');
    try {
      await save({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, amountCents, category: draft.category, description: draft.description.trim(), createdAt: new Date().toISOString() });
      setDraft(null); setMessage('Expense saved.');
    } catch (e) { setMessage(`Could not save expense: ${e.message}`); }
    finally { busyRef.current = false; setBusy(false); }
  };

  const deleteExpense = async id => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setMessage('');
    try { await remove(id); }
    catch (e) { setMessage(`Could not delete expense: ${e.message}`); }
    finally { busyRef.current = false; setBusy(false); }
  };

  const undoDelete = async () => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true);
    try { await undo(); setMessage('Expense restored.'); }
    catch (e) { setMessage(`Could not restore expense. Tap Undo to retry. ${e.message}`); }
    finally { busyRef.current = false; setBusy(false); }
  };

  return <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingTop: insets.top + 22, paddingBottom: insets.bottom + 40 }]}>
      <View style={styles.header}><View style={styles.brandIcon}><Text style={styles.brandIconText}>▂▆▂</Text></View><Text style={styles.title}>Voice Expense</Text></View>
      <View style={styles.totalBlock}><Text style={styles.eyebrow}>Total saved expenses</Text><Text style={styles.total}>{formatUSD(total)}</Text><Text style={styles.totalCaption}>{expenses.length} {expenses.length === 1 ? 'expense' : 'expenses'} saved locally</Text></View>

      <View style={styles.recordCard}>
        <View style={styles.micHalo}><View style={styles.micInner}><View style={styles.micCapsule} /><View style={styles.micCradle} /><View style={styles.micStem} /></View></View>
        <Text style={styles.recordTitle}>{speech.state === 'listening' ? 'Listening…' : speech.state === 'processing' ? 'Processing…' : speech.state === 'starting' ? 'Starting…' : 'Speak an expense'}</Text>
        <Text style={styles.recordHint}>Try “I spent 12 dollars on lunch.”</Text>
        {speech.transcript ? <View style={styles.transcript}><Text style={styles.transcriptLabel}>HEARD</Text><Text style={styles.transcriptText}>{speech.transcript}</Text></View> : null}
        {speech.error ? <Text style={styles.errorText}>{speech.error}</Text> : null}
        {speech.state === 'listening' ? <Button label="Stop listening" primary onPress={speech.stop} style={styles.recordButton} /> : <Button label="Record Expense" primary onPress={speech.start} disabled={speech.state !== 'idle' || loading || !!storageError || !!draft} style={styles.recordButton} />}
        <Pressable accessibilityRole="button" accessibilityLabel="Add expense manually" disabled={speech.state !== 'idle'} onPress={() => { setDraft(freshDraft()); setMessage(''); setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100); }} style={[styles.manualLink, speech.state !== 'idle' && { opacity: .5 }]}><Text style={styles.manualLinkText}>Or add manually  →</Text></Pressable>
      </View>

      {storageError ? <View style={styles.warning}><Text style={styles.errorText}>{storageError} Saved data was not overwritten.</Text></View> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}

      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Expenses</Text><Text style={styles.sectionTotal}>{filter === 'All' ? formatUSD(total) : `${labels[filter]} subtotal: ${formatUSD(subtotal)}`}</Text></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} accessibilityLabel="Category filters">
        {['All', ...CATEGORIES].map(item => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: filter === item }} accessibilityLabel={`Filter ${item}`} onPress={() => setFilter(item)} style={[styles.chip, filter === item && styles.chipActive]}><Text style={[styles.chipText, filter === item && { color: '#fff' }]}>{item}</Text></Pressable>)}
      </ScrollView>

      {loading ? <ActivityIndicator color={navy} style={{ marginTop: 30 }} /> : shown.length === 0 ? <View style={styles.empty}><Text style={styles.emptyIcon}>◇</Text><Text style={styles.emptyTitle}>{filter === 'All' ? 'No expenses yet' : `No ${labels[filter].toLowerCase()} expenses`}</Text><Text style={styles.emptyText}>{filter === 'All' ? 'Record your first expense or add one manually.' : 'Choose another category or add a new expense.'}</Text></View> : <View style={styles.listCard}>{shown.map((item, index) => <View key={item.id} style={[styles.expenseRow, index > 0 && styles.rowBorder]}><View style={[styles.categoryIcon, { backgroundColor: tones[item.category][0] }]}><Text style={[styles.categoryGlyph, { color: tones[item.category][1] }]}>{icons[item.category]}</Text></View><View style={styles.expenseInfo}><Text style={styles.expenseName} numberOfLines={1}>{item.description}</Text><Text style={styles.expenseMeta}>{labels[item.category]} · {new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text></View><View style={styles.amountColumn}><Text style={styles.expenseAmount}>{formatUSD(item.amountCents)}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Delete ${item.description} expense`} onPress={() => deleteExpense(item.id)} disabled={busy || !!storageError} hitSlop={12} style={styles.deleteButton}><Text style={styles.deleteText}>Delete</Text></Pressable></View></View>)}</View>}

      {pendingUndo ? <View style={styles.undoBar}><Text style={styles.undoText}>Expense deleted</Text><Pressable accessibilityRole="button" accessibilityLabel="Undo deletion" onPress={undoDelete} disabled={busy} style={styles.undoButton}><Text style={styles.undoAction}>Undo</Text></Pressable></View> : null}

      {draft ? <View style={styles.confirmCard}><Text style={styles.confirmTitle}>Confirm Expense</Text>{draft.transcript ? <View style={styles.transcript}><Text style={styles.transcriptLabel}>TRANSCRIPT</Text><Text style={styles.transcriptText}>{draft.transcript}</Text></View> : null}{draft.ambiguous ? <Text style={styles.errorText}>Multiple amounts were heard. Enter the correct amount.</Text> : null}
        <Text style={styles.fieldLabel}>Amount</Text><TextInput accessibilityLabel="Expense amount in dollars" style={styles.input} keyboardType="decimal-pad" placeholder="0.00" value={draft.amount} onChangeText={value => update('amount', value)} />
        <Text style={styles.fieldLabel}>Category</Text><View style={styles.categoryChoices}>{CATEGORIES.map(item => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: draft.category === item }} onPress={() => update('category', item)} style={[styles.choice, draft.category === item && styles.choiceActive]}><Text style={[styles.choiceText, draft.category === item && { color: '#fff' }]}>{item}</Text></Pressable>)}</View>
        <Text style={styles.fieldLabel}>Description</Text><TextInput accessibilityLabel="Expense description" style={styles.input} placeholder="What was it for?" value={draft.description} onChangeText={value => update('description', value)} maxLength={120} />
        <View style={styles.actions}><Button label="Cancel" onPress={() => { setDraft(null); setMessage(''); }} style={{ flex: 1 }} /><Button label={busy ? 'Saving…' : 'Save Expense'} primary disabled={busy || loading || !!storageError} onPress={saveDraft} style={{ flex: 1.25 }} /></View>
      </View> : null}
    </ScrollView>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FCFCFE' }, content: { paddingHorizontal: 22 }, header: { flexDirection: 'row', alignItems: 'center', gap: 12 }, brandIcon: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#F2F2F6', alignItems: 'center', justifyContent: 'center' }, brandIconText: { color: navy, fontSize: 22, fontWeight: '800' }, title: { fontSize: 27, fontWeight: '800', color: navy, letterSpacing: -.7 }, totalBlock: { marginTop: 35, marginBottom: 25 }, eyebrow: { color: muted, fontSize: 16, fontWeight: '600' }, total: { color: navy, fontSize: 58, fontWeight: '800', letterSpacing: -2.5, marginTop: 5 }, totalCaption: { color: muted, fontSize: 14, marginTop: 1 }, recordCard: { borderRadius: 32, padding: 24, backgroundColor: '#fff', borderWidth: 1, borderColor: '#EEEEF4', alignItems: 'center', shadowColor: navy, shadowOpacity: .06, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 2 }, micHalo: { height: 150, width: 150, borderRadius: 75, backgroundColor: '#F1ECFF', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }, micInner: { width: 100, height: 100, borderRadius: 34, backgroundColor: '#343862', alignItems: 'center', justifyContent: 'center' }, micCapsule: { width: 17, height: 38, borderRadius: 9, backgroundColor: '#fff', position: 'absolute', top: 22 }, micCradle: { width: 43, height: 35, borderWidth: 4, borderTopWidth: 0, borderColor: '#fff', borderBottomLeftRadius: 23, borderBottomRightRadius: 23, position: 'absolute', top: 39 }, micStem: { width: 4, height: 13, backgroundColor: '#fff', position: 'absolute', bottom: 14 }, recordTitle: { color: navy, fontSize: 25, fontWeight: '800' }, recordHint: { color: muted, fontSize: 14, textAlign: 'center', marginTop: 7 }, recordButton: { alignSelf: 'stretch', marginTop: 22 }, button: { minHeight: 52, borderRadius: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }, primaryButton: { backgroundColor: '#353962' }, lightButton: { backgroundColor: '#F3F3F6' }, buttonText: { fontSize: 16, color: navy, fontWeight: '700' }, manualLink: { minHeight: 48, justifyContent: 'center', marginTop: 3 }, manualLinkText: { color: '#6255AA', fontWeight: '700' }, transcript: { alignSelf: 'stretch', marginTop: 18, borderRadius: 18, padding: 14, backgroundColor: '#F4F0FF' }, transcriptLabel: { color: '#7165AB', fontSize: 11, fontWeight: '800', letterSpacing: 1 }, transcriptText: { color: navy, fontSize: 16, marginTop: 5 }, warning: { padding: 16, marginTop: 18, borderRadius: 16, backgroundColor: '#FFF2EF' }, errorText: { color: '#A53528', fontSize: 14, marginTop: 10, textAlign: 'center' }, message: { color: navy, textAlign: 'center', marginTop: 16, fontWeight: '600' }, sectionHeader: { marginTop: 34, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }, sectionTitle: { fontSize: 24, color: navy, fontWeight: '800' }, sectionTotal: { color: muted, fontSize: 13, fontWeight: '700', flexShrink: 1, textAlign: 'right' }, filters: { gap: 9, paddingVertical: 18, paddingRight: 22 }, chip: { paddingHorizontal: 18, minHeight: 44, borderRadius: 25, borderWidth: 1, borderColor: '#E6E6EE', justifyContent: 'center', backgroundColor: '#fff' }, chipActive: { backgroundColor: '#414568', borderColor: '#414568' }, chipText: { color: '#686B84', fontSize: 14, fontWeight: '700' }, empty: { padding: 30, borderWidth: 1, borderColor: '#EEEEF3', borderRadius: 25, alignItems: 'center', backgroundColor: '#fff' }, emptyIcon: { color: '#BDB0F1', fontSize: 45 }, emptyTitle: { color: navy, fontSize: 19, fontWeight: '800', marginTop: 6 }, emptyText: { color: muted, textAlign: 'center', marginTop: 6 }, listCard: { borderRadius: 27, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ECECF2', paddingHorizontal: 16, shadowColor: navy, shadowOpacity: .04, shadowRadius: 12, elevation: 1 }, expenseRow: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: 12 }, rowBorder: { borderTopWidth: 1, borderTopColor: '#EEEEF2' }, categoryIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, categoryGlyph: { fontSize: 25, fontWeight: '800' }, expenseInfo: { flex: 1 }, expenseName: { color: navy, fontSize: 17, fontWeight: '800' }, expenseMeta: { color: muted, fontSize: 13, marginTop: 3 }, amountColumn: { alignItems: 'flex-end' }, expenseAmount: { color: navy, fontSize: 18, fontWeight: '800' }, deleteButton: { minHeight: 36, minWidth: 50, alignItems: 'flex-end', justifyContent: 'center' }, deleteText: { color: '#A53528', fontSize: 12, fontWeight: '700' }, undoBar: { backgroundColor: navy, borderRadius: 18, marginTop: 16, paddingLeft: 18, paddingRight: 8, minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, undoText: { color: '#fff', fontWeight: '700' }, undoButton: { minHeight: 44, minWidth: 65, alignItems: 'center', justifyContent: 'center' }, undoAction: { color: '#D9CBFF', fontWeight: '800' }, confirmCard: { marginTop: 30, backgroundColor: '#fff', borderRadius: 30, borderWidth: 1, borderColor: '#ECECF2', padding: 22, shadowColor: navy, shadowOpacity: .07, shadowRadius: 18, elevation: 2 }, confirmTitle: { fontSize: 26, fontWeight: '800', color: navy, marginBottom: 12 }, fieldLabel: { color: '#777994', fontSize: 15, fontWeight: '700', marginTop: 17, marginBottom: 8 }, input: { borderWidth: 1, borderColor: '#E2E2ED', minHeight: 52, borderRadius: 17, paddingHorizontal: 16, fontSize: 19, color: navy, fontWeight: '700' }, categoryChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, choice: { minHeight: 42, paddingHorizontal: 12, borderRadius: 14, backgroundColor: '#F2F0F9', justifyContent: 'center' }, choiceActive: { backgroundColor: '#6159A3' }, choiceText: { color: '#625B85', fontWeight: '700', fontSize: 13 }, actions: { flexDirection: 'row', gap: 9, marginTop: 25 },
});
