import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Card, LoopBackGlyph, Text } from '@/components/ui';
import { palette, spacing } from '@/theme/tokens';

export type MistakesCardProps = {
  count: number;
  onPress: () => void;
  busy?: boolean;
};

/** "Close the loop" on past misses. Renders nothing when there's nothing to review. */
export function MistakesCard({ count, onPress, busy }: MistakesCardProps) {
  if (count <= 0) return null;
  const noun = count === 1 ? 'mistake' : 'mistakes';
  return (
    <Card
      tone="accent"
      onPress={onPress}
      disabled={busy}
      accessibilityLabel={`Practice ${count} ${noun}`}
      testID="mistakes-card"
      padding="md"
    >
      <View style={styles.row}>
        <LoopBackGlyph size={32} />
        <View style={styles.text}>
          <Text variant="bodyStrong">
            <Text variant="monoStrong" style={{ color: palette.accent.shade }} testID="mistakes-count">
              {count}
            </Text>{' '}
            {noun} to revisit
          </Text>
          <Text variant="caption">Fresh numbers, same ideas. Each one you nail is cleared, and you earn a heart back.</Text>
        </View>
        {busy ? <ActivityIndicator color={palette.accent.shade} /> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  text: { flex: 1, gap: spacing.xxs },
});
