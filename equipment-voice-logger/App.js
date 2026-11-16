import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
} from 'react-native';
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import { fetch as expoFetch } from 'expo/fetch';
import { File } from 'expo-file-system';

export default function App() {
  const [transcription, setTranscription] = useState('');
  const [reports, setReports] = useState([]);
  const [recording, setRecording] = useState(false);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [audioUri, setAudioUri] = useState(null);
  const [transcribing, setTranscribing] = useState(false);
  const transcribeAudio = async (uri) => {
    const apiKey = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;
    console.log('API key loaded:', !!apiKey);
    if (!apiKey) {
      Alert.alert('Missing API key', 'Check your .env file.');
      return;
    }

    setTranscribing(true);

    try {
      const file = new File(uri);
      const formData = new FormData();

      formData.append('file', file);
      formData.append('model', 'openai/whisper-1');

      const response = await expoFetch(
        'https://openrouter.ai/api/v1/audio/transcriptions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          body: formData,
        }
      );

      const result = await response.json();
      console.log('Transcription HTTP status:', response.status);
      console.log('Transcription error:', result.error?.message ?? 'None');

      if (!response.ok) {
        throw new Error(
          result.error?.message || 'Transcription failed'
        );
      }

      if (!result.text) {
        throw new Error('No transcription was returned.');
      }

      setTranscription(result.text);
    } catch (error) {
      console.error('Transcription error:', error);
      Alert.alert('Transcription Error', error.message);
    } finally {
      setTranscribing(false);
    }
  };

  const saveReport = () => {
    if (!transcription.trim()) {
      Alert.alert('Missing report', 'Enter a maintenance issue first.');
      return;
    }

    const newReport = {
      id: Date.now().toString(),
      text: transcription.trim(),
      date: new Date().toLocaleString(),
    };

    setReports((previous) => [newReport, ...previous]);
    setTranscription('');
    Alert.alert('Success', 'Maintenance report saved!');
  };

  const toggleRecording = async () => {
  try {
    if (!recording) {
      const permission = await requestRecordingPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Microphone Permission',
          'Please allow microphone access to record maintenance issues.'
        );
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();

      setAudioUri(null);
      setRecording(true);
    } else {
      await audioRecorder.stop();
      const recordedUri = audioRecorder.uri;

      setAudioUri(recordedUri);
      setRecording(false);

      if (recordedUri) {
        await transcribeAudio(recordedUri);
      } else {
        Alert.alert('Error', 'No recording was found.');
      }
    }
  } catch (error) {
    console.error('Recording error:', error);
    setRecording(false);
    Alert.alert('Recording Error', error.message);
  }
};

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Equipment Voice Logger</Text>
      <Text style={styles.subtitle}>
        Report equipment problems using your voice.
      </Text>

      <TouchableOpacity
        style={[
          styles.recordButton,
          recording && styles.recordingButton,
        ]}
        onPress={toggleRecording}
      >
        <Text style={styles.recordButtonText}>
          {recording ? 'Stop Recording' : 'Start Recording'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.label}>Transcription</Text>

      <TextInput
        style={styles.input}
        multiline
        placeholder="Your voice transcription will appear here..."
        value={transcription}
        onChangeText={setTranscription}
      />

      <TouchableOpacity
        style={styles.saveButton}
        onPress={saveReport}
      >
        <Text style={styles.buttonText}>Save Report</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Saved Reports</Text>

      <FlatList
        data={reports}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No maintenance reports yet.
          </Text>
        }
        renderItem={({ item }) => (
          <View style={styles.reportCard}>
            <Text style={styles.reportText}>{item.text}</Text>
            <Text style={styles.reportDate}>{item.date}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6F8',
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    marginTop: 8,
    marginBottom: 30,
  },
  recordButton: {
    backgroundColor: '#2563EB',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 25,
  },
  recordingButton: {
    backgroundColor: '#DC2626',
  },
  recordButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: 'bold',
  },
  label: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 15,
    height: 120,
    textAlignVertical: 'top',
    fontSize: 16,
    marginBottom: 20,
  },
  saveButton: {
    backgroundColor: '#059669',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 30,
    marginBottom: 15,
  },
  reportCard: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
  },
  reportText: {
    fontSize: 16,
    color: '#1F2937',
  },
  reportDate: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
  },
  emptyText: {
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 20,
  },
});
