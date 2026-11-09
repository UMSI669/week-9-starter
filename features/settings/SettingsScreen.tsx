import { useCallback, useState } from 'react';
import { Linking, Platform, Text, View } from 'react-native';
import { AudioModule } from 'expo-audio';
import { router, useFocusEffect } from 'expo-router';
import { useClearMutation } from '../../store/listApi';
import { store, useAppDispatch } from '../../store';
import { notice, dismissNotice } from '../../store/uiSlice';
import { resetVoice } from '../../store/voiceSlice';
import { deleteRecording } from '../voice/useVoiceRecording';
import { safeError } from '../../services/apiErrors';
import { colors, styles } from '../../theme';
import { BrandHeader, Button, ConfirmDialog, Screen } from '../common/ui';
export default function SettingsScreen() {
  const [permission, setPermission] = useState('Checking…'); const [confirm, setConfirm] = useState(false);
  const [clear, clearState] = useClearMutation(); const dispatch = useAppDispatch();
  useFocusEffect(useCallback(() => {
    let active = true;
    void AudioModule.getRecordingPermissionsAsync().then(result => { if (active) setPermission(result.granted ? 'Allowed' : result.status === 'undetermined' ? 'Not requested yet' : 'Not allowed'); }).catch(() => { if (active) setPermission('Unavailable on this device'); });
    return () => { active = false; };
  }, []));
  const clearData = async () => {
    setConfirm(false);
    try {
      await clear().unwrap();
      deleteRecording(store.getState().voice.audioUri); dispatch(resetVoice());
      while (store.getState().ui.notices.length) dispatch(dismissNotice());
      dispatch(notice({ text: 'All lists and history cleared. Ready for a fresh start.' }));
    } catch (error) { dispatch(notice({ text: safeError(error) })); }
  };
  return <Screen><BrandHeader /><View style={{ gap: 8 }}><Text style={styles.eyebrow}>MAKE YOURSELF AT HOME</Text><Text style={styles.title}>A few useful things</Text><Text style={styles.subtitle}>Your lists, your history, your preferences.</Text></View>
    <View style={styles.card}><Text style={styles.section}>Your weeks</Text><Text style={styles.subtitle}>Look back at past lists and bring items into this week.</Text><Button title="View week history" onPress={() => router.push('/history')} secondary icon="time-outline" /></View>
    <View style={styles.card}><View style={styles.between}><Text style={styles.section}>Microphone</Text><Text style={{ color: permission === 'Allowed' ? colors.green : colors.muted, fontSize: 13 }}>{permission}</Text></View><Text style={styles.subtitle}>We only record when you tap the mic. Recordings stop at 60 seconds or when the app goes into the background.</Text>
      <Button title="Open microphone settings" secondary icon="settings-outline" onPress={() => {
        if (Platform.OS === 'web') dispatch(notice({ text: 'Use your browser’s site settings to allow microphone access.' }));
        else void Linking.openSettings().catch(error => dispatch(notice({ text: safeError(error) })));
      }} />
    </View>
    <View style={styles.card}><Text style={styles.section}>A fresh start</Text><Text style={styles.subtitle}>Clear this week’s list, past weeks, and your saved view preference.</Text><Button title="Clear all data" danger secondary icon="trash-outline" onPress={() => setConfirm(true)} busy={clearState.isLoading} /></View>
    <View style={{ padding: 12, gap: 8 }}><Text style={[styles.small, { textAlign: 'center' }]}>Weeks run Sunday to Saturday in your device’s timezone.</Text><Text style={[styles.small, { textAlign: 'center' }]}>Manual lists work offline. Voice recordings are sent to OpenRouter for transcription, and the transcript is sent to U-M GPT Toolkit to format your items.</Text><Text style={[styles.eyebrow, { textAlign: 'center', marginTop: 10 }]}>PANTRY WEEK · VERSION 1.0</Text></View>
    <ConfirmDialog visible={confirm} title="Clear all grocery data?" message="This removes your current list, all past weeks, and preferences from this device. This cannot be undone." confirmLabel="Clear all data" danger onCancel={() => setConfirm(false)} onConfirm={clearData} />
  </Screen>;
}
