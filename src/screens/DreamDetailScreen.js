import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CategoryPicker from '../components/CategoryPicker';

export default function DreamDetailScreen({ dream, onBack, onSave, onDelete }) {
  const [text, setText] = useState(dream.text);
  const [category, setCategory] = useState(dream.category || 'Uncategorized');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const changed = text.trim() !== dream.text || category !== (dream.category || 'Uncategorized');

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await onSave(dream.id, { text, category });
      setSaved(true);
    } catch (caught) {
      setError(caught?.message || 'Could not save your changes. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setDeleting(true);
    setError(null);
    try {
      await onDelete(dream.id);
    } catch (caught) {
      setError(caught?.message || 'Could not delete this dream. Please try again.');
      setDeleting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          <Pressable accessibilityRole="button" onPress={onBack} style={styles.back}>
            <Text style={styles.backText}>‹ Back to dreams</Text>
          </Pressable>
          <Text accessibilityRole="header" style={styles.title}>Dream entry</Text>
          <Text style={styles.date}>{new Date(dream.createdAt).toLocaleString()}</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Your dream</Text>
            <TextInput
              accessibilityLabel="Dream text"
              multiline
              value={text}
              onChangeText={(value) => { setText(value); setSaved(false); }}
              textAlignVertical="top"
              style={styles.input}
            />
            <Text style={styles.label}>Category</Text>
            <CategoryPicker value={category} onChange={(value) => { setCategory(value); setSaved(false); }} />
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {saved ? <Text style={styles.success}>Changes saved.</Text> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !changed || !text.trim() || saving || deleting }}
            disabled={!changed || !text.trim() || saving || deleting}
            onPress={save}
            style={[styles.saveButton, (!changed || !text.trim() || saving || deleting) && styles.disabled]}
          >
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>Save changes</Text>}
          </Pressable>
          {confirmDelete ? (
            <View style={styles.deleteConfirm}>
              <Text style={styles.deletePrompt}>Delete this dream permanently?</Text>
              <View style={styles.deleteActions}>
                <Pressable accessibilityRole="button" disabled={deleting} onPress={() => setConfirmDelete(false)} style={styles.cancelButton}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                <Pressable accessibilityRole="button" disabled={deleting} onPress={remove} style={styles.confirmButton}>
                  {deleting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.confirmText}>Delete dream</Text>}
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable accessibilityRole="button" disabled={saving} onPress={() => setConfirmDelete(true)} style={[styles.deleteButton, saving && styles.disabled]}>
              <Text style={styles.deleteText}>Delete dream</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#F5F3FB' },
  page: { width: '100%', maxWidth: 640, alignSelf: 'center', padding: 20, paddingBottom: 36, gap: 14 },
  back: { alignSelf: 'flex-start', paddingVertical: 6 },
  backText: { color: '#5B4BC4', fontSize: 16, fontWeight: '700' },
  title: { color: '#1E1B3A', fontSize: 30, fontWeight: '800' },
  date: { color: '#625D80', fontSize: 14 },
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDD8EE', borderRadius: 16, padding: 16, gap: 12 },
  label: { color: '#1E1B3A', fontSize: 15, fontWeight: '700' },
  input: { minHeight: 220, borderWidth: 1, borderColor: '#DDD8EE', borderRadius: 12, padding: 12, color: '#1E1B3A', fontSize: 16, lineHeight: 23, backgroundColor: '#FCFBFF' },
  error: { color: '#B42318', fontSize: 14 },
  success: { color: '#1F7A4D', fontSize: 14 },
  saveButton: { backgroundColor: '#5B4BC4', borderRadius: 12, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  disabled: { opacity: 0.45 },
  deleteButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  deleteText: { color: '#B42318', fontSize: 16, fontWeight: '700' },
  deleteConfirm: { borderWidth: 1, borderColor: '#F5C2BC', backgroundColor: '#FEF0EE', borderRadius: 12, padding: 14, gap: 12 },
  deletePrompt: { color: '#1E1B3A', fontSize: 15, fontWeight: '700' },
  deleteActions: { flexDirection: 'row', gap: 10 },
  cancelButton: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDD8EE' },
  cancelText: { color: '#1E1B3A', fontWeight: '700' },
  confirmButton: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#B42318' },
  confirmText: { color: '#FFFFFF', fontWeight: '700' },
});
