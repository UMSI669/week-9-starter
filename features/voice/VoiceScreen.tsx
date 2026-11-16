import { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Linking, Platform, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CATEGORIES, UNITS, CATEGORY_EMOJI } from '../../utils/groceries';
import { useAppDispatch } from '../../store';
import { editVoiceItem, removeVoiceItem, voiceTranscript } from '../../store/voiceSlice';
import { notice } from '../../store/uiSlice';
import { useAddMutation } from '../../store/listApi';
import { safeError } from '../../services/apiErrors';
import { colors, styles } from '../../theme';
import { BackHeader, Button, ChoiceChips, ConfirmDialog, Expandable, IconButton, QuantityStepper, Screen } from '../common/ui';
import { useVoiceRecording } from './useVoiceRecording';

export default function VoiceScreen() {
  const controller = useVoiceRecording(); const { voice } = controller;
  const dispatch = useAppDispatch(); const [confirmLeave, setConfirmLeave] = useState(false); const [saveError, setSaveError] = useState('');
  const [add, addState] = useAddMutation();
  const busy = ['transcribing', 'parsing'].includes(voice.status) || addState.isLoading;
  const close = () => { if (voice.status !== 'idle' || controller.starting) setConfirmLeave(true); else router.back(); };
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { close(); return true; });
    return () => subscription.remove();
  });
  const save = async () => {
    setSaveError('');
    try {
      const result = await add({ items: voice.items, source: 'voice' }).unwrap();
      await controller.discard();
      dispatch(notice({ text: `${result.added} new ${result.added === 1 ? 'item' : 'items'} added to this week` }));
      for (const text of result.merged) dispatch(notice({ text }));
      router.back();
    } catch (error) { setSaveError(safeError(error)); }
  };
  return <Screen>
    <BackHeader title="Voice list" onBack={close} />
    <View style={{ gap: 8 }}><Text style={styles.eyebrow}>FROM YOUR MIND TO YOUR LIST</Text><Text style={styles.title}>{voice.status === 'reviewing' ? 'A quick look before saving' : 'Just say what you need'}</Text><Text style={styles.subtitle}>{voice.status === 'reviewing' ? 'Check the transcript and make any little adjustments.' : 'We’ll turn your words into a shopping list. You get the final say.'}</Text></View>
    {!['reviewing', 'parsing'].includes(voice.status) && <View style={[styles.card, { backgroundColor: colors.peach, borderColor: '#F6DCC9', alignItems: 'center', paddingVertical: 30, gap: 22 }]}>
      <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="mic" size={43} color={colors.white} /></View>
      {voice.status === 'recording' ? <>
        <View accessibilityLabel="Audio level waveform" style={{ height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          {Array.from({ length: 25 }, (_, index) => <View key={index} style={{ width: 5, borderRadius: 4, backgroundColor: colors.orange,
            height: 7 + Math.max(0, Math.min(1, (controller.level + 60) / 60)) * (15 + 25 * Math.abs(Math.sin(index * 1.4 + controller.seconds))) }} />)}
        </View><Text style={{ fontSize: 34, fontWeight: '600', color: colors.navy, fontVariant: ['tabular-nums'] }}>0:{String(controller.seconds).padStart(2, '0')}</Text>
        <Text accessibilityLiveRegion="polite" style={[styles.subtitle, { textAlign: 'center', color: controller.warning ? colors.orange : colors.muted }]}>{controller.warning ? '10 seconds left. Wrapping up at 60 seconds.' : 'Listening… take your time.'}</Text>
        <Button title="Stop and make my list" icon="stop" onPress={() => void controller.stop()} />
      </> : voice.status === 'transcribing' ? <><ActivityIndicator color={colors.orange} /><Text accessibilityLiveRegion="polite" style={styles.subtitle}>Turning your recording into words…</Text></> : <>
        <Text style={[styles.subtitle, { textAlign: 'center' }]}>“Apples, a dozen eggs, two gallons of milk, and a loaf of bread.”</Text>
        <Button title={voice.audioUri ? 'Record again' : 'Start recording'} icon="mic-outline" onPress={() => void controller.start()} busy={controller.starting} />
        <Text style={styles.small}>Up to 60 seconds · review before saving</Text>
      </>}
    </View>}
    {voice.status === 'error' && <View style={styles.card}><Text accessibilityLiveRegion="polite" style={styles.error}>{voice.error}</Text>
      {voice.transcript ? <Button title="Retry item formatting" onPress={() => void controller.reparse(voice.transcript)} secondary /> : voice.audioUri ? <Button title="Retry transcription" onPress={() => void controller.upload(voice.audioUri!)} secondary /> : null}
      {controller.permissionDenied && <Button title="Open microphone settings" secondary onPress={() => {
        if (Platform.OS === 'web') dispatch(notice({ text: 'Allow microphone access using your browser’s site settings, then try recording again.' }));
        else void Linking.openSettings().catch(error => dispatch(notice({ text: safeError(error) })));
      }} />}
    </View>}
    {['parsing', 'reviewing'].includes(voice.status) && <>
      <View style={styles.card}><Text style={styles.label}>Your transcript</Text><TextInput accessibilityLabel="Edit transcript" multiline editable={!busy} value={voice.transcript} onChangeText={text => dispatch(voiceTranscript(text))} maxLength={12000} style={[styles.input, { minHeight: 120, textAlignVertical: 'top', lineHeight: 23 }]} />
        <Button title="Re-parse transcript" secondary icon="refresh-outline" disabled={!voice.transcript.trim() || busy} onPress={() => void controller.reparse(voice.transcript)} />
        {voice.status === 'reviewing' && voice.transcript !== voice.parsedTranscript && <Text style={styles.small}>Re-parse your edited transcript to update the items before saving.</Text>}
      </View>
      {voice.status === 'parsing' ? <View style={[styles.card, styles.row]}><ActivityIndicator color={colors.orange} /><Text accessibilityLiveRegion="polite" style={styles.subtitle}>Sorting your words into grocery items…</Text></View> : <>
        {voice.warning ? <View style={[styles.card, { backgroundColor: colors.peach }]}><Text style={{ color: colors.orange, fontSize: 14, lineHeight: 21 }}>{voice.warning}</Text></View> : null}
        <View style={styles.between}><Text style={styles.section}>Review items</Text><Text style={styles.small}>{voice.items.length} items</Text></View>
        {voice.items.length === 0 && <Text style={styles.subtitle}>No grocery items found. Edit the transcript and re-parse, or record again.</Text>}
        {voice.items.map((item, index) => <View key={index} style={styles.card}>
          <View style={styles.row}><Text style={{ fontSize: 27 }}>{item.emoji}</Text><TextInput accessibilityLabel={`Voice item ${index + 1} name`} value={item.name} onChangeText={name => dispatch(editVoiceItem({ index, item: { ...item, name } }))} maxLength={120} style={[styles.input, { flex: 1, flexBasis: 0, flexShrink: 1 }]} /><IconButton name="close" label={`Remove voice item ${index + 1}`} color={colors.red} onPress={() => dispatch(removeVoiceItem(index))} /></View>
          <View style={styles.between}><QuantityStepper value={item.quantity} onChange={quantity => dispatch(editVoiceItem({ index, item: { ...item, quantity, quantityInferred: false } }))} />{item.quantityInferred && <Text style={{ color: colors.orange, fontSize: 11, maxWidth: 130 }}>Quantity not heard · assumed 1</Text>}</View>
          <Expandable title={`${item.category} · ${item.unit || 'no unit'} · change details`}>
            <ChoiceChips values={CATEGORIES} label={`Category for item ${index + 1}`} value={item.category} onChange={category => dispatch(editVoiceItem({ index, item: { ...item, category, emoji: CATEGORY_EMOJI[category] } }))} />
            <ChoiceChips values={UNITS} label={`Unit for item ${index + 1}`} value={item.unit} onChange={unit => dispatch(editVoiceItem({ index, item: { ...item, unit } }))} />
          </Expandable>
        </View>)}
        {saveError && <Text style={styles.error}>{saveError}</Text>}
        <Button title={`Save ${voice.items.length} ${voice.items.length === 1 ? 'item' : 'items'} to this week`} icon="checkmark" onPress={save} disabled={!voice.items.length || voice.items.some(item => !item.name.trim()) || voice.transcript !== voice.parsedTranscript} busy={addState.isLoading} />
        <Button title="Start over" secondary disabled={busy} onPress={() => setConfirmLeave(true)} />
      </>}
    </>}
    <ConfirmDialog visible={confirmLeave} title="Discard this voice list?" message="The recording and unsaved items will be removed. Your saved shopping list stays as it is." confirmLabel="Discard and close" onCancel={() => setConfirmLeave(false)} onConfirm={() => { void controller.discard().then(() => router.back()); }} danger />
  </Screen>;
}
