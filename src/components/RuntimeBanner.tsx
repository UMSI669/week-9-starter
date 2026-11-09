import { Link } from 'expo-router';
import { Text } from 'react-native';
import { runtimeMode } from '../services/runtime';
import { Banner, colors } from './ui';

export function RuntimeBanner() {
  if (runtimeMode === 'full') return null;
  return (
    <Banner tone="demo" title="Demo mode (Expo Go)">
      <Text style={{ color: colors.purple, fontSize: 14, lineHeight: 19 }}>
        Sample interviews use pre-written sample transcripts, and masking is the simplified pattern-based version. On-device
        speech recognition and the local Qwen/Llama model need a development build. Cloud analysis is real and uses your
        own OpenRouter key.{' '}
        <Link href="/about" style={{ fontWeight: '700', textDecorationLine: 'underline' }}>
          Learn more
        </Link>
      </Text>
    </Banner>
  );
}

export function TranscriptSourceLabel({ source, model }: { source?: string; model?: string }) {
  const label =
    source === 'demo-sample'
      ? 'Sample transcript (pre-written, not speech recognition)'
      : source === 'apple-on-device'
        ? 'Apple on-device speech recognition'
        : source === 'whisper-on-device'
          ? `Whisper on-device${model ? ` · ${model}` : ''}`
          : source === 'manual'
            ? 'Typed / pasted by researcher'
            : 'No transcript yet';
  return <Text style={{ fontSize: 13, color: source === 'demo-sample' ? colors.purple : colors.muted, fontWeight: '600' }}>{label}</Text>;
}
