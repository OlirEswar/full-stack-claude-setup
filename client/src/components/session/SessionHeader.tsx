import { Pressable, StyleSheet, View } from 'react-native';

import { CrossGlyph } from '@/components/questions/OptionCard';
import { ProgressBar, StatPill } from '@/components/ui';
import { colors, layout, radii, spacing } from '@/theme/tokens';

export type SessionHeaderProps = {
  /** Questions finished so far. */
  answered: number;
  total: number;
  /** Hearts left; omit for sessions without hearts (practice, daily). */
  hearts?: number;
  onClose: () => void;
};

/** Lesson top bar: close, a chunky progress bar, and the heart counter. */
export function SessionHeader({ answered, total, hearts, onClose }: SessionHeaderProps) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close lesson"
        hitSlop={8}
        testID="session-close"
        style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
      >
        <CrossGlyph color={colors.ink[500]} size={24} />
      </Pressable>
      <View style={styles.bar}>
        <ProgressBar
          value={answered}
          max={total}
          tone="primary"
          accessibilityLabel={`Question progress: ${answered} of ${total}`}
          testID="session-progress"
        />
      </View>
      {hearts !== undefined ? <StatPill kind="hearts" value={hearts} inactive={hearts <= 0} testID="session-hearts" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  close: {
    width: layout.minTouch,
    height: layout.minTouch,
    marginLeft: -spacing.sm,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closePressed: { backgroundColor: colors.ink[100] },
  bar: { flex: 1 },
});
