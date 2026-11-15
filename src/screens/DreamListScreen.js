import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CategoryPicker from '../components/CategoryPicker';
import { dreamTitle } from '../data/dreamCategories';

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function DreamListScreen({ dreams, loading, error, onOpen, onNew }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const filtered = useMemo(() => dreams
    .filter((dream) => category === 'All' || (dream.category || 'Uncategorized') === category)
    .filter((dream) => `${dream.text} ${dream.category || ''}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [dreams, query, category]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.eyebrow}>Your dream journal</Text>
            <Text accessibilityRole="header" style={styles.title}>Saved dreams</Text>
            <Text style={styles.description}>Keep the details you remember, then find them later.</Text>
            <Pressable accessibilityRole="button" onPress={onNew} style={styles.newButton}>
              <Text style={styles.newButtonText}>+ Speak a dream</Text>
            </Pressable>
            <TextInput
              accessibilityLabel="Search dreams"
              value={query}
              onChangeText={setQuery}
              placeholder="Search your dreams"
              placeholderTextColor="#625D80"
              style={styles.search}
            />
            <Text style={styles.filterLabel}>Category</Text>
            <CategoryPicker value={category} onChange={setCategory} categories={['All', 'Uncategorized', 'Adventure', 'People', 'Places', 'Nightmare', 'Other']} />
            <Text style={styles.count}>{filtered.length} {filtered.length === 1 ? 'dream' : 'dreams'}</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        }
        ListEmptyComponent={loading ? <ActivityIndicator color="#5B4BC4" /> : (
          <Text style={styles.empty}>{dreams.length ? 'No dreams match your search or category.' : 'No dreams saved yet. Speak or type your first one.'}</Text>
        )}
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button" accessibilityLabel={`Open dream from ${formatDate(item.createdAt)}`} onPress={() => onOpen(item.id)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
            <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
            <Text style={styles.cardTitle} numberOfLines={2}>{dreamTitle(item.text)}</Text>
            <Text style={styles.preview} numberOfLines={2}>{item.text}</Text>
            <Text style={styles.category}>{item.category || 'Uncategorized'}</Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F3FB' },
  page: { width: '100%', maxWidth: 640, alignSelf: 'center', padding: 20, paddingBottom: 32, gap: 12, flexGrow: 1 },
  header: { gap: 12, marginBottom: 4 },
  eyebrow: { color: '#5B4BC4', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  title: { color: '#1E1B3A', fontSize: 30, fontWeight: '800' },
  description: { color: '#625D80', fontSize: 16, lineHeight: 23 },
  newButton: { backgroundColor: '#5B4BC4', borderRadius: 12, padding: 15, alignItems: 'center' },
  newButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  search: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDD8EE', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: '#1E1B3A' },
  filterLabel: { color: '#1E1B3A', fontWeight: '700', marginTop: 2 },
  count: { color: '#625D80', fontSize: 13, marginTop: 4 },
  error: { color: '#B42318', fontSize: 14 },
  empty: { color: '#625D80', fontSize: 16, textAlign: 'center', marginTop: 36 },
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDD8EE', borderRadius: 16, padding: 16, gap: 8 },
  date: { color: '#625D80', fontSize: 13 },
  cardTitle: { color: '#1E1B3A', fontSize: 18, fontWeight: '700' },
  preview: { color: '#514B70', fontSize: 15, lineHeight: 21 },
  category: { color: '#5B4BC4', fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});
