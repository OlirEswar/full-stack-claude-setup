import { StyleSheet, View } from 'react-native';

import { Button, Card, ProgressBar, Screen, StatPill, StepResponseMark, Text } from '@/components/ui';
import { spacing } from '@/theme';

// Placeholder home screen; replaced by the skill path in a later task.
export default function Index() {
  return (
    <Screen
      header={
        <View style={styles.stats}>
          <StatPill kind="streak" value={0} inactive />
          <StatPill kind="hearts" value={5} />
          <StatPill kind="xp" value={0} />
        </View>
      }
    >
      <View style={styles.hero}>
        <StepResponseMark width={200} />
        <Text variant="display" align="center">
          Loopy
        </Text>
        <Text variant="body" tone="muted" align="center">
          Control theory, one quick loop at a time.
        </Text>
      </View>
      <Card>
        <Text variant="label">Unit 1 · Feedback basics</Text>
        <Text variant="heading" style={styles.cardTitle}>
          Poles, zeros and the s-plane
        </Text>
        <ProgressBar value={2} max={5} tone="success" accessibilityLabel="Unit progress" />
      </Card>
      <View style={styles.actions}>
        <Button label="Start learning" />
        <Button label="I already have an account" variant="secondary" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', justifyContent: 'space-between' },
  hero: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  cardTitle: { marginTop: spacing.xs, marginBottom: spacing.md },
  actions: { gap: spacing.md, marginTop: spacing.xl, paddingBottom: spacing.xl },
});
