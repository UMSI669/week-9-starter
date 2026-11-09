import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import SpeakDreamScreen from './src/screens/SpeakDreamScreen';

// Task #1 hands off here. SpeakDreamScreen calls onSave({ text, createdAt })
// after the user reviews the transcript. Task #2/#3: replace this function
// with real storage (it may be async; throwing an Error shows it on screen
// and keeps the draft).
async function handleSaveDream(entry) {
  console.log('Dream ready to store:', entry);
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SpeakDreamScreen onSave={handleSaveDream} />
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
