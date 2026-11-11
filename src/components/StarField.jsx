/**
 * Decorative constellation dots and thin connecting lines.
 *
 * Purely atmospheric: hidden from VoiceOver and TalkBack, never animated when
 * Reduce Motion is on, and never the carrier of any information.
 */

import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { constellation } from '../services/visualSeed';
import { colors } from '../theme';

export const StarField = memo(function StarField({
  seed,
  width,
  height,
  starCount = 9,
  color = colors.star,
  opacity = 1,
  style,
}) {
  if (!width || !height) return null;
  const { stars, lines } = constellation(seed, starCount);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { opacity }, style]}
    >
      <Svg width={width} height={height}>
        {lines.map((line, index) => (
          <Line
            key={`line-${index}`}
            x1={line.x1 * width}
            y1={line.y1 * height}
            x2={line.x2 * width}
            y2={line.y2 * height}
            stroke={color}
            strokeWidth={0.6}
            strokeOpacity={0.3}
          />
        ))}
        {stars.map((star, index) => (
          <Circle
            key={`star-${index}`}
            cx={star.x * width}
            cy={star.y * height}
            r={star.r}
            fill={color}
            fillOpacity={star.o}
          />
        ))}
      </Svg>
    </View>
  );
});

export default StarField;
