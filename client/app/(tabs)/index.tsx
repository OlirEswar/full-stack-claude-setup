import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/AuthContext';
import { Button, Card, Screen, StepResponseMark, Text } from '@/components/ui';
import { colors, radii, spacing } from '@/theme';

// Placeholder home; task 25 replaces it with the skill path.
export default function HomeScreen() {
  const { user, logout } = useAuth();
  const greeting = user ? `Hi, ${user.username}!` : 'Welcome back!';

  return (
    <Screen testID="home-screen" contentStyle={styles.column}>
      <View style={styles.hero}>
        <View style={styles.badge}>
          <StepResponseMark width={180} />
        </View>
        <Text variant="title" align="center">
          {greeting}
        </Text>
        <Text variant="body" tone="muted" align="center">
          You’re signed in. Your learning path is being wired up next.
        </Text>
      </View>
      <Card>
        <Text variant="label">Coming up</Text>
        <Text variant="heading" style={styles.cardTitle}>
          Unit 1 · Laplace basics
        </Text>
        <Text variant="body" tone="muted">
          Short lessons, instant feedback, and a streak to protect.
        </Text>
      </Card>
      <View style={styles.actions}>
        <Button label="Log out" variant="secondary" onPress={() => void logout()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  column: { justifyContent: 'center', paddingVertical: spacing.xl },
  hero: { alignItems: 'center', gap: spacing.sm, paddingBottom: spacing.xl },
  badge: {
    backgroundColor: colors.primary.tint,
    borderRadius: radii.xxl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTitle: { marginTop: spacing.xs, marginBottom: spacing.xs },
  actions: { marginTop: spacing.xl },
});
