import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import SpeakDreamScreen from './src/screens/SpeakDreamScreen';
import DreamListScreen from './src/screens/DreamListScreen';
import DreamDetailScreen from './src/screens/DreamDetailScreen';
import { useDreamJournal } from './src/hooks/useDreamJournal';

export default function App() {
  const journal = useDreamJournal();
  const [page, setPage] = useState('speak');
  const [selectedId, setSelectedId] = useState(null);
  const selected = journal.dreams.find((dream) => dream.id === selectedId);

  async function saveDream(entry) {
    await journal.addDream(entry);
    setPage('journal');
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
          <DreamDetailScreen key={selected.id} dream={selected} onBack={() => setSelectedId(null)} onSave={journal.updateDream} onDelete={deleteDream} />
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
