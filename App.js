import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import SpeakDreamScreen from './src/screens/SpeakDreamScreen';
import DreamListScreen from './src/screens/DreamListScreen';
import DreamDetailScreen from './src/screens/DreamDetailScreen';
import { useDreamJournal } from './src/hooks/useDreamJournal';
import { interpretDream } from './src/services/interpretDream';

export default function App() {
  const journal = useDreamJournal();
  const [page, setPage] = useState('speak');
  const [selectedId, setSelectedId] = useState(null);
  const [interpretationState, setInterpretationState] = useState({});
  const selected = journal.dreams.find((dream) => dream.id === selectedId);

  async function generateInterpretation(id, text) {
    setInterpretationState((current) => ({ ...current, [id]: { text, loading: true, error: null } }));
    try {
      const interpretation = await interpretDream(text);
      await journal.saveInterpretation(id, text, interpretation);
      setInterpretationState((current) => current[id]?.text === text
        ? { ...current, [id]: { text, loading: false, error: null } }
        : current);
    } catch (caught) {
      setInterpretationState((current) => current[id]?.text === text
        ? { ...current, [id]: { text, loading: false, error: caught?.message || 'Could not interpret this dream.' } }
        : current);
    }
  }

  async function saveDream(entry) {
    const dream = await journal.addDream(entry);
    setSelectedId(dream.id);
    setPage('journal');
    void generateInterpretation(dream.id, dream.text);
  }

  async function saveDreamChanges(id, changes) {
    const previousText = journal.dreams.find((dream) => dream.id === id)?.text;
    await journal.updateDream(id, changes);
    const text = changes.text.trim();
    if (previousText !== text) void generateInterpretation(id, text);
  }

  async function deleteDream(id) {
    await journal.deleteDream(id);
    setSelectedId(null);
    setPage('journal');
  }

  return (
    <SafeAreaProvider>
      <View style={styles.app}>
        {selected ? (
          <DreamDetailScreen
            key={selected.id}
            dream={selected}
            onBack={() => setSelectedId(null)}
            onSave={saveDreamChanges}
            onDelete={deleteDream}
            onInterpret={() => generateInterpretation(selected.id, selected.text)}
            interpretationStatus={interpretationState[selected.id]}
          />
        ) : page === 'journal' ? (
          <DreamListScreen {...journal} onOpen={setSelectedId} onNew={() => setPage('speak')} />
        ) : (
          <SpeakDreamScreen onSave={saveDream} />
        )}
        <SafeAreaView style={styles.tabs} edges={['bottom']}>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: page === 'speak' && !selected }} onPress={() => { setSelectedId(null); setPage('speak'); }} style={styles.tab}>
            <Text style={[styles.tabText, page === 'speak' && !selected && styles.active]}>Speak</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: page === 'journal' }} onPress={() => { setSelectedId(null); setPage('journal'); }} style={styles.tab}>
            <Text style={[styles.tabText, page === 'journal' && styles.active]}>Journal</Text>
          </Pressable>
        </SafeAreaView>
      </View>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: '#F5F3FB' },
  tabs: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#DDD8EE' },
  tab: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  tabText: { color: '#625D80', fontSize: 16, fontWeight: '700' },
  active: { color: '#5B4BC4' },
});
