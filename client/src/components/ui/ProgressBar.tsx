import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, motion, palette, radii, type Tone } from '@/theme/tokens';

export type ProgressBarProps = {
  /** Current value, clamped to [0, max]. */
  value: number;
  max: number;
  tone?: Tone;
  height?: number;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Chunky pill progress bar with a glossy highlight strip on the fill. */
export function ProgressBar({
  value,
  max,
  tone = 'primary',
  height = 16,
  accessibilityLabel = 'Progress',
  style,
  testID,
}: ProgressBarProps) {
  const safeMax = max > 0 ? max : 1;
  const now = Math.min(Math.max(value, 0), safeMax);
  const ratio = now / safeMax;

  const anim = useState(() => new Animated.Value(ratio))[0];
  const target = useRef(ratio);
  useEffect(() => {
    // Initial mount already renders at `ratio`; only animate real changes.
    if (target.current === ratio) return;
    target.current = ratio;
    const a = Animated.timing(anim, {
      toValue: ratio,
      duration: motion.base,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    a.start();
    return () => a.stop();
  }, [anim, ratio]);

  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const swatch = palette[tone];

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: safeMax, now }}
      style={[styles.track, { height, borderRadius: radii.pill }, style]}
    >
      <Animated.View
        style={[
          styles.fill,
          { width, backgroundColor: swatch.base, borderRadius: radii.pill, minWidth: ratio > 0 ? height : 0 },
        ]}
      >
        <View style={[styles.shine, { height: Math.max(3, Math.round(height / 4)), top: Math.round(height / 5) }]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    backgroundColor: colors.ink[200],
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
  shine: {
    position: 'absolute',
    left: 8,
    right: 8,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
});
