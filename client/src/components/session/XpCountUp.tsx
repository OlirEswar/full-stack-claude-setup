import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { BoltGlyph, Text } from '@/components/ui';
import { motion, palette, spacing, typeScale } from '@/theme/tokens';

export type XpCountUpProps = {
  value: number;
  /** ms; defaults to a celebratory ~1.2s. */
  duration?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Big gold "+N XP" that ticks up from zero. The accessible label always carries the final
 * value, so screen readers (and tests) never read an in-between number.
 */
export function XpCountUp({ value, duration = motion.slow * 2, style, testID = 'xp-count-up' }: XpCountUpProps) {
  const anim = useState(() => new Animated.Value(0))[0];
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setShown(Math.round(v)));
    anim.setValue(0);
    const a = Animated.timing(anim, {
      toValue: value,
      duration: value > 0 ? duration : 0,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    a.start(({ finished }) => {
      if (finished) setShown(value);
    });
    return () => {
      a.stop();
      anim.removeListener(id);
    };
  }, [anim, value, duration]);

  return (
    <View style={[styles.row, style]} testID={testID} accessible accessibilityRole="text" accessibilityLabel={`${value} XP earned`}>
      <BoltGlyph size={48} />
      <Text style={styles.number}>+{shown}</Text>
      <Text variant="heading" style={styles.unit}>
        XP
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  number: { ...typeScale.display, fontSize: 48, lineHeight: 56, color: palette.xp.shade, fontVariant: ['tabular-nums'] },
  unit: { color: palette.xp.shade, marginTop: spacing.md },
});
