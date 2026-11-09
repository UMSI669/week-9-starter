/**
 * Tracks the system "Reduce Motion" setting (iOS) / "Remove animations"
 * (Android) and keeps it current while the app runs.
 *
 * Every decorative animation in this app reads this and simply does not run
 * when it is on. Nothing functional depends on motion.
 */

import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active) setReduceMotion(Boolean(enabled));
      })
      .catch(() => {
        // Treat an unavailable API as "motion allowed"; the animation is only
        // decorative either way.
      });

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) =>
      setReduceMotion(Boolean(enabled)),
    );

    return () => {
      active = false;
      subscription?.remove();
    };
  }, []);

  return reduceMotion;
}

export default useReduceMotion;
