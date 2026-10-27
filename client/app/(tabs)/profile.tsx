import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError, updateMe } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { DailyGoalPicker, ProfileStatGrid, SkillStatsList, WeekXpBars, type DailyGoal } from '@/components/profile';
import { Button, Card, ErrorState, LoadingState, ProfileGlyph, Screen, Text } from '@/components/ui';
import { useProfileData } from '@/hooks/useProfileData';
import { borders, palette, radii, spacing } from '@/theme/tokens';

/** The Profile tab: lifetime totals, this week's XP, per-skill progress and settings. */
export default function ProfileScreen() {
  const { user, logout, setUser } = useAuth();
  const { data, loading, error, reload, setMe } = useProfileData();
  const [savingGoal, setSavingGoal] = useState<number | null>(null);
  const [goalError, setGoalError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const username = data?.me.user.username ?? user?.username ?? 'Your profile';

  const onLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  };

  const logoutButton = (
    <Button label="Log out" variant="secondary" onPress={() => void onLogout()} loading={loggingOut} testID="logout-button" />
  );

  const onGoal = async (goal: DailyGoal) => {
    setSavingGoal(goal);
    setGoalError(null);
    try {
      const res = await updateMe({ dailyXpGoal: goal });
      setMe(res);
      setUser(res.user);
    } catch (e) {
      setGoalError(
        e instanceof ApiError && e.status !== 0 && e.message
          ? `Couldn’t save that goal: ${e.message}`
          : 'Couldn’t save that goal. Check your connection and try again.',
      );
    } finally {
      setSavingGoal(null);
    }
  };

  const header = (
    <View style={styles.identity}>
      <View style={styles.avatar}>
        <ProfileGlyph size={32} />
      </View>
      <View style={styles.identityText}>
        <Text variant="title" numberOfLines={1} testID="profile-username">
          {username}
        </Text>
        <Text variant="caption" tone="subtle" numberOfLines={1}>
          {data ? `${data.me.stats.streak}-day streak · ${data.me.user.timezone}` : 'Control theory learner'}
        </Text>
      </View>
    </View>
  );

  if (!data) {
    return (
      <Screen testID="profile-screen" scroll={false} edges={['top', 'left', 'right']}>
        <View style={styles.top}>{header}</View>
        {error && !loading ? (
          <View style={styles.fill} testID="profile-error">
            <ErrorState title="Your stats didn’t load" message={error} onRetry={reload} />
          </View>
        ) : (
          <View style={styles.fill} testID="profile-loading">
            <LoadingState label="Tallying your XP…" />
          </View>
        )}
        <View style={styles.bottom}>{logoutButton}</View>
      </Screen>
    );
  }

  const { stats, me } = data;
  const weekTotal = stats.last7Days.reduce((s, d) => s + d.xp, 0);
  const goalDays = stats.last7Days.filter((d) => d.xp >= me.user.dailyXpGoal).length;

  return (
    <Screen testID="profile-screen" edges={['top', 'left', 'right']}>
      <View style={styles.content}>
        <View style={styles.top}>{header}</View>
        {error ? (
          <Text variant="caption" tone="error" testID="profile-refresh-error">
            Couldn’t refresh just now. Showing your last known stats.
          </Text>
        ) : null}

        <ProfileStatGrid stats={stats} />

        <Card testID="week-card">
          <View style={styles.cardHead}>
            <View style={styles.flex}>
              <Text variant="heading">Last 7 days</Text>
              <Text variant="caption">
                Goal hit on {goalDays} of 7 days
              </Text>
            </View>
            <View style={styles.weekTotal}>
              <Text variant="monoStrong" style={styles.weekTotalText} testID="week-xp-total">
                {weekTotal} XP
              </Text>
            </View>
          </View>
          <WeekXpBars days={stats.last7Days} goal={me.user.dailyXpGoal} />
        </Card>

        <Card testID="skills-card">
          <Text variant="heading">Skills</Text>
          <Text variant="caption" style={styles.sub}>
            Strength fades between reviews. Practise “Needs review” skills to lock them back in.
          </Text>
          <SkillStatsList skills={stats.skills} />
        </Card>

        <View style={styles.settings}>
          <Text variant="label">Settings</Text>
          <Card>
            <Text variant="bodyStrong">Daily XP goal</Text>
            <Text variant="caption" style={styles.sub}>
              A lesson is worth about 10–15 XP. Pick a pace you can keep every day.
            </Text>
            <DailyGoalPicker value={me.user.dailyXpGoal} onChange={(g) => void onGoal(g)} saving={savingGoal} error={goalError} />
          </Card>
          {logoutButton}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fill: { flex: 1 },
  top: { paddingTop: spacing.lg },
  bottom: { paddingBottom: spacing.xl },
  content: { gap: spacing.xl, paddingBottom: spacing.xxxl },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  identityText: { flex: 1 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: palette.secondary.tint,
    borderWidth: borders.width,
    borderBottomWidth: borders.edge,
    borderColor: palette.secondary.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.md },
  weekTotal: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: palette.primary.tint,
  },
  weekTotalText: { color: palette.primary.shade },
  sub: { marginTop: spacing.xxs, marginBottom: spacing.md },
  settings: { gap: spacing.md },
});
