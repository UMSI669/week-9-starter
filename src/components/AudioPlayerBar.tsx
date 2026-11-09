import { useAudioPlayer, useAudioPlayerStatus, type AudioPlayer } from 'expo-audio';
import { StyleSheet, Text, View } from 'react-native';
import type { AudioRef } from '../models/types';
import { playerSource } from '../services/audio/audioFiles';
import { formatMs } from '../utils/ids';
import { Button, colors } from './ui';

/** One player per screen; tapping a transcript timestamp calls seekAndPlay. */
export function useSessionPlayer(audio: AudioRef | undefined) {
  const player = useAudioPlayer(playerSource(audio));
  const status = useAudioPlayerStatus(player);
  const seekAndPlay = async (ms: number) => {
    await player.seekTo(ms / 1000);
    player.play();
  };
  return { player, status, seekAndPlay };
}

export function AudioPlayerBar({
  player,
  status,
  label,
}: {
  player: AudioPlayer;
  status: ReturnType<typeof useAudioPlayerStatus>;
  label?: string;
}) {
  const position = (status.currentTime ?? 0) * 1000;
  const duration = (status.duration ?? 0) * 1000;
  const fraction = duration > 0 ? Math.min(1, position / duration) : 0;
  const toggle = () => {
    if (status.playing) {
      player.pause();
    } else {
      if (status.didJustFinish || (duration > 0 && position >= duration - 200)) void player.seekTo(0);
      player.play();
    }
  };
  return (
    <View style={s.wrap}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <View style={s.track}>
        <View style={[s.fill, { width: `${fraction * 100}%` }]} />
      </View>
      <View style={s.row}>
        <Button small variant="secondary" title="−15s" onPress={() => void player.seekTo(Math.max(0, position / 1000 - 15))} />
        <Button small title={status.playing ? 'Pause' : 'Play'} onPress={toggle} disabled={!status.isLoaded} />
        <Button small variant="secondary" title="+15s" onPress={() => void player.seekTo(Math.min(duration / 1000, position / 1000 + 15))} />
        <Text style={s.time} accessibilityLabel={`Position ${formatMs(position)} of ${formatMs(duration)}`}>
          {formatMs(position)} / {formatMs(duration)}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 8 },
  label: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: 6, backgroundColor: colors.primary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  time: { marginLeft: 'auto', fontVariant: ['tabular-nums'], color: colors.muted, fontSize: 13 },
});
