import { useEffect, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';

import { FlameGlyph, Text } from '@/components/ui';
import { borders, palette, radii, spacing } from '@/theme/tokens';

/** Combo length at which the badge appears (spec: the client animates combos of 3+). */
export const COMBO_THRESHOLD = 3;

export type ComboBadgeProps = {
  combo: number;
  /** Bonus XP the server awarded on this answer (every 5th in a row). */
  bonusXp?: number;
};

/** Streak-orange flame pill that pops in with a spring each time the combo grows. */
export function ComboBadge({ combo, bonusXp = 0 }: ComboBadgeProps) {
  const scale = useState(() => new Animated.Value(0.6))[0];
  const visible = combo >= COMBO_THRESHOLD;

  useEffect(() => {
    if (!visible) return;
    scale.setValue(0.6);
    const a = Animated.spring(scale, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [combo, visible, scale]);

  if (!visible) return null;

  const label = bonusXp > 0 ? `${combo} in a row! +${bonusXp} XP combo bonus` : `${combo} in a row!`;
  return (
    <Animated.View
      testID="combo-badge"
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
      style={[styles.pill, { transform: [{ scale }] }]}
    >
      <FlameGlyph size={20} />
      <Text variant="label" style={styles.text}>
        {combo} in a row
      </Text>
      {bonusXp > 0 ? (
        <Text variant="monoStrong" style={styles.bonus}>
          +{bonusXp} XP
        </Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingLeft: spacing.sm,
    paddingRight: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: palette.streak.tint,
    borderWidth: borders.width,
    borderColor: palette.streak.base,
  },
  text: { color: palette.streak.shade },
  bonus: { color: palette.xp.shade, marginLeft: spacing.xs },
});
