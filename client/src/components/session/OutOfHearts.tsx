import { StyleSheet, View } from 'react-native';

import { Button, HeartGlyph, Text } from '@/components/ui';
import { borders, layout, palette, radii, spacing } from '@/theme/tokens';

export type OutOfHeartsProps = {
  answered: number;
  total: number;
  onPractice: () => void;
  onExit: () => void;
  practiceBusy?: boolean;
  practiceError?: string | null;
};

/** Shown when a lesson's status turns `failed` (0 hearts). No XP is awarded for the attempt. */
export function OutOfHearts({ answered, total, onPractice, onExit, practiceBusy, practiceError }: OutOfHeartsProps) {
  return (
    <View style={styles.wrap} testID="out-of-hearts" accessibilityRole="alert">
      <View style={styles.hearts}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={[styles.heartSlot, { opacity: 0.25 + i * 0.06 }]}>
            <HeartGlyph size={32} tone={palette.heart} />
          </View>
        ))}
      </View>
      <View style={styles.zero}>
        <Text variant="display" style={{ color: palette.heart.shade }}>
          0
        </Text>
        <Text variant="label" style={{ color: palette.heart.shade }}>
          hearts left
        </Text>
      </View>
      <Text variant="title" align="center">
        You’re out of hearts
      </Text>
      <Text variant="body" tone="muted" align="center" style={styles.body}>
        This lesson ended after {answered} of {total} questions, so it doesn’t count toward your crown. Hearts refill one every 30
        minutes, or finish a practice session to earn one back right now.
      </Text>
      <View style={styles.actions}>
        <Button label="Practice to earn a heart" onPress={onPractice} loading={practiceBusy} testID="practice-button" />
        <Button label="Back to path" variant="secondary" onPress={onExit} testID="exit-button" />
        {practiceError ? (
          <Text variant="caption" tone="error" align="center">
            {practiceError}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxl,
  },
  hearts: { flexDirection: 'row', gap: spacing.xs },
  heartSlot: {},
  zero: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.xxl,
    backgroundColor: palette.heart.tint,
    borderWidth: borders.width,
    borderBottomWidth: borders.edge,
    borderColor: palette.heart.base,
    marginBottom: spacing.sm,
  },
  body: { maxWidth: 420 },
  actions: { alignSelf: 'stretch', maxWidth: layout.maxContentWidth, gap: spacing.md, marginTop: spacing.lg },
});
