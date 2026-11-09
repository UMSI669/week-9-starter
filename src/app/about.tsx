import { Text } from 'react-native';
import { Body, Card, colors, Screen, SectionTitle } from '../components/ui';
import { MVP, runtimeMode } from '../services/runtime';

function Item({ title, children }: { title: string; children: string }) {
  return (
    <Text style={{ fontSize: 15, lineHeight: 21, color: colors.ink }}>
      <Text style={{ fontWeight: '700' }}>{title} </Text>
      {children}
    </Text>
  );
}

export default function AboutScreen() {
  return (
    <Screen>
      <Card>
        <SectionTitle>Pseudonymization is not anonymity</SectionTitle>
        <Body>
          Interview Lens replaces detected names, contact details, identifiers, organizations and places with stable placeholders
          such as [PERSON_01]. That is pseudonymization. The remaining story (a job, a schedule, a rare event) can still identify a
          person, especially to someone who knows them. Automatic detection also misses things. Always read the cloud-bound text
          before approving it, and mask identifying context yourself.
        </Body>
      </Card>

      <Card>
        <SectionTitle>What leaves the iPhone</SectionTitle>
        <Item title="Sent:">Only the masked transcript you approved, segment ids, rough timestamps, generic speaker roles, and (if enabled per project) masked research context. It goes directly to OpenRouter over HTTPS with your own key.</Item>
        <Item title="Never sent:">Audio, original wording, the placeholder-to-identity mapping, interview titles, file names, private notes, or project names.</Item>
        <Item title="Model downloads:">On-device models are downloaded from Hugging Face. Downloads send no research data.</Item>
        <Item title="No backend, no analytics:">There is no server of ours. The app has no analytics or crash reporting.</Item>
      </Card>

      <Card>
        <SectionTitle>On this device</SectionTitle>
        <Item title="Storage:">Projects, transcripts, identity mappings and audio live in the app’s private Documents folder (iOS Data Protection). They are included in your device backups, so encrypt your backups.</Item>
        <Item title="API key:">In the iOS Keychain, this device only.</Item>
        <Item title="Deletion:">Deleting an interview or project removes its audio, transcript, mapping and analysis. Settings › Delete all local research data wipes everything.</Item>
        <Item title="Exports:">You choose masked or original for every export. Original exports are labeled as identifying.</Item>
      </Card>

      <Card>
        <SectionTitle>Demo mode vs development build</SectionTitle>
        <Body>Currently running: {runtimeMode === 'full' ? 'development build (full features)' : 'Expo Go demo mode'}.</Body>
        <Item title="Expo Go demo:">Bundled synthetic interviews with pre-written sample transcripts, simplified pattern-based masking, editable review, and real cloud analysis with your key. Recording and importing work, but on-device transcription does not; type or paste a transcript instead.</Item>
        <Item title="Development build:">Adds Apple on-device speech recognition (forced on-device, so no Apple servers) or Whisper via whisper.rn, plus Qwen/Llama sensitive-span detection via llama.rn. Nothing falls back to the cloud: if local recognition fails, the app stops.</Item>
      </Card>

      <Card>
        <SectionTitle>MVP scope</SectionTitle>
        <Body>
          {MVP.supportedDevices}; iOS {MVP.minimumIos}+; English (US); interviews up to about {MVP.recommendedRecordingMinutes} minutes (hard stop at {MVP.maxRecordingMinutes}).
          Outputs are research codes, themes, a summary, and supporting quotes linked to transcript segments. Automatic speaker
          identification is out of scope; speakers can be labeled by hand.
        </Body>
      </Card>
    </Screen>
  );
}
