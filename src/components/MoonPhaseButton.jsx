/**
 * The moon button in the top-right of Home. Opens Symbols / Interpretations.
 *
 * The disc is drawn with SVG, not an emoji, so the terminator is a real
 * geometric mask and waxing can be told apart from waning: the lit side is on
 * the right while waxing and on the left while waning.
 *
 * How the mask works: a full disc is drawn in the lit colour, then the dark
 * part is drawn over it as one path made of two arcs — the disc's own limb
 * plus the terminator ellipse, whose horizontal radius is
 * |cos(elongation)| * r. At new moon that ellipse is as wide as the disc and
 * the whole face is dark; at full moon it has zero width and nothing is
 * covered; at the quarters it is flat and exactly half is covered.
 *
 * The phase is recomputed on app resume and when the local date changes.
 * It is approximate — see src/services/moonPhase.js.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, Path, RadialGradient, Stop } from 'react-native-svg';
import { getMoonPhase, localDateKey } from '../services/moonPhase';
import { colors, glow, radii, touchTarget } from '../theme';

/**
 * Builds the dark overlay path for a given phase.
 * @param {number} radius
 * @param {number} elongation degrees, 0 new .. 180 full .. 360 new
 */
export function darkLimbPath(radius, elongation) {
  const radians = (elongation * Math.PI) / 180;
  const terminator = Math.cos(radians) * radius;
  const waxing = elongation < 180;

  // The dark side is on the left while waxing, on the right while waning.
  const limbSweep = waxing ? 0 : 1;
  // The terminator bulges toward the dark side before the quarter and away
  // from it after, which is what makes a crescent a crescent and a gibbous
  // moon gibbous. abs() gives the ellipse width; the sweep flag gives the side.
  const terminatorSweep = terminator >= 0 ? limbSweep : 1 - limbSweep;
  const rx = Math.abs(terminator);

  return [
    `M 0 ${-radius}`,
    `A ${radius} ${radius} 0 0 ${limbSweep} 0 ${radius}`,
    `A ${rx} ${radius} 0 0 ${terminatorSweep} 0 ${-radius}`,
    'Z',
  ].join(' ');
}

export function MoonPhaseButton({ onPress, size = 56, style }) {
  const [phase, setPhase] = useState(() => getMoonPhase());
  const dateKeyRef = useRef(localDateKey());

  const refresh = useCallback(() => {
    dateKeyRef.current = localDateKey();
    setPhase(getMoonPhase());
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      // Refresh on resume, and whenever the calendar date has rolled over.
      if (state === 'active') refresh();
    });

    // Catch a date change while the app stays open overnight.
    const interval = setInterval(() => {
      if (localDateKey() !== dateKeyRef.current) refresh();
    }, 60_000);

    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, [refresh]);

  const discSize = Math.round(size * 0.74);
  const radius = discSize / 2;
  const illuminationPercent = Math.round(phase.illumination * 100);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={phase.accessibilityLabel}
      accessibilityHint={`Approximately ${illuminationPercent} percent lit, ${phase.waxing ? 'waxing' : 'waning'}.`}
      onPress={onPress}
      // Touch target is the Pressable, sized independently of the illustration,
      // so a thin crescent is still as easy to hit as a full moon.
      hitSlop={10}
      style={({ pressed }) => [
        styles.button,
        { width: Math.max(touchTarget, size), height: Math.max(touchTarget, size) },
        glow('md', colors.accent),
        pressed && styles.pressed,
        style,
      ]}
    >
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Svg width={discSize} height={discSize} viewBox={`${-radius} ${-radius} ${discSize} ${discSize}`}>
          <Defs>
            <RadialGradient id="moonLit" cx="38%" cy="34%" r="72%">
              <Stop offset="0%" stopColor="#FFFDF6" />
              <Stop offset="100%" stopColor="#E8DCFF" />
            </RadialGradient>
          </Defs>
          <G>
            {/* Unlit disc, faintly visible so the whole moon reads as a sphere. */}
            <Circle r={radius} fill="#2A1B45" stroke={colors.borderStrong} strokeWidth={0.8} />
            <Circle r={radius} fill="url(#moonLit)" />
            <Path d={darkLimbPath(radius, phase.elongation)} fill="#231541" fillOpacity={0.94} />
          </G>
        </Svg>
      </View>
      {/* Visible text label: the moon illustration is never the only cue. */}
      <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.caption}>
        Symbols
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: 'rgba(196,181,253,0.08)',
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: 'center',
    paddingTop: 2,
  },
  pressed: { opacity: 0.7 },
  caption: {
    color: colors.textSecondary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginTop: 1,
  },
});

export default MoonPhaseButton;
