import { StatusBar, StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Voice Idea Lab</Text>
      <Text style={styles.description}>
        Speak an idea, review its transcript, then save it or turn it into a next step.
      </Text>
      <Text style={styles.note}>Voice capture is coming next.</Text>
      <StatusBar barStyle="dark-content" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F6F8FC',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#172033',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 17,
    lineHeight: 25,
    color: '#344054',
    textAlign: 'center',
    maxWidth: 360,
  },
  note: {
    fontSize: 14,
    color: '#667085',
    marginTop: 28,
  },
});
