import { StyleSheet, View } from 'react-native';

import { Button, HeartGlyph, Text } from '@/components/ui';
import { borders, palette, radii, spacing } from '@/theme/tokens';

import { useNextHeartLabel } from './TopStatsBar';

export type HeartsEmptyNoticeProps = {
  /** ISO time of the next regenerated heart (from /api/me); null if unknown. */
  nextHeartAt: string | null;
  onPractice: () => void;
  onDismiss: () => void;
  practiceBusy?: boolean;
};

/** Shown instead of starting a lesson when the user has 0 hearts. */
export function HeartsEmptyNotice({ nextHeartAt, onPractice, onDismiss, practiceBusy }: HeartsEmptyNoticeProps) {
  const regenLabel = useNextHeartLabel(nextHeartAt);
  return (
    <View style={styles.wrap} testID="hearts-empty" accessibilityRole="alert">
      <View style={styles.head}>
        <View style={styles.heart}>
          <HeartGlyph size={32} />
        </View>
        <View style={styles.text}>
          <Text variant="heading">Your hearts are empty</Text>
          <Text variant="caption">
            Lessons need at least one heart. {regenLabel ? `Next heart: ${regenLabel.replace('+1 ', '')}.` : 'One refills every 30 minutes.'}{' '}
            A practice round earns one back right now.
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Button label="Practice to earn a heart" size="md" onPress={onPractice} loading={practiceBusy} testID="hearts-practice" />
        <Button label="Not now" size="md" variant="ghost" onPress={onDismiss} testID="hearts-dismiss" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.xl,
    backgroundColor: palette.heart.tint,
    borderWidth: borders.width,
    borderBottomWidth: borders.edge,
    borderColor: palette.heart.base,
  },
  head: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  heart: {
    width: 52,
    height: 52,
    borderRadius: radii.pill,
    backgroundColor: palette.heart.tint,
    borderWidth: borders.width,
    borderColor: palette.heart.base,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.6,
  },
  text: { flex: 1, gap: spacing.xxs },
  actions: { gap: spacing.sm },
});
