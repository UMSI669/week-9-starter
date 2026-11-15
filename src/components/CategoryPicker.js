import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DREAM_CATEGORIES } from '../data/dreamCategories';

export default function CategoryPicker({ value, onChange, categories = DREAM_CATEGORIES }) {
  return (
    <View style={styles.wrap} accessibilityRole="radiogroup">
      {categories.map((category) => (
        <Pressable
          key={category}
          accessibilityRole="radio"
          accessibilityState={{ checked: value === category }}
          onPress={() => onChange(category)}
          style={[styles.chip, value === category && styles.selected]}
        >
          <Text style={[styles.label, value === category && styles.selectedLabel]}>{category}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 18, borderWidth: 1, borderColor: '#DDD8EE', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFFFFF' },
  selected: { backgroundColor: '#5B4BC4', borderColor: '#5B4BC4' },
  label: { color: '#514B70', fontSize: 13, fontWeight: '600' },
  selectedLabel: { color: '#FFFFFF' },
});
