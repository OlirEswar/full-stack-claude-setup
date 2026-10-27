import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError, completeSession } from '@/api/client';
import type { SessionSummary } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { XpCountUp } from '@/components/session';
import { Button, ErrorState, FlameGlyph, LoadingState, ProgressBar, Screen, StepResponseMark, Text } from '@/components/ui';
import { sessionSummaryCache } from '@/hooks/sessionSummaryCache';
import { borders, colors, palette, radii, spacing, type ToneSwatch } from '@/theme/tokens';

type Load = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; summary: SessionSummary };

/** Session summary: XP count-up, accuracy, combo, streak, daily goal, level-ups and achievements. */
export default function SummaryScreen() {
  const { sessionId: raw } = useLocalSearchParams<{ sessionId: string }>();
  const sessionId = Number(raw);
  const router = useRouter();
  const { user } = useAuth();
  const [load, setLoad] = useState<Load>(() => {
    const cached = sessionSummaryCache.get(sessionId);
    return cached ? { status: 'ready', summary: cached } : { status: 'loading' };
  });
  const [attempt, setAttempt] = useState(0);
  const needsFetch = load.status === 'loading';

  // Cold load (e.g. a web refresh): the completion endpoint returns the stored summary idempotently.
  useEffect(() => {
    if (!needsFetch || !Number.isFinite(sessionId) || sessionId <= 0) return;
    let live = true;
    completeSession(sessionId).then(
      (summary) => {
        sessionSummaryCache.set(sessionId, summary);
        if (live) setLoad({ status: 'ready', summary });
      },
      (e: unknown) => {
        if (!live) return;
        setLoad({
          status: 'error',
          message: e instanceof ApiError && e.message ? e.message : 'We couldn’t load your results. Try again.',
        });
      },
    );
    return () => {
      live = false;
    };
  }, [needsFetch, sessionId, attempt]);

  const done = () => router.replace('/');

  if (!Number.isFinite(sessionId) || sessionId <= 0) {
    return (
      <Screen scroll={false}>
        <ErrorState title="No results to show" message="This summary link is missing its session." onRetry={done} retryLabel="Back to path" />
      </Screen>
    );
  }
  if (load.status === 'loading') {
    return (
      <Screen scroll={false}>
        <LoadingState label="Tallying your XP…" />
      </Screen>
    );
  }
  if (load.status === 'error') {
    return (
      <Screen scroll={false}>
        <ErrorState
          message={load.message}
          onRetry={() => {
            setLoad({ status: 'loading' });
            setAttempt((n) => n + 1);
          }}
        />
      </Screen>
    );
  }

  const s = load.summary;
  const accuracyPct = Math.round(s.accuracy * 100);
  const goal = user?.dailyXpGoal ?? 0;

  return (
    <Screen testID="summary-screen" footer={<Button label="Continue" onPress={done} testID="summary-continue" />}>
      <View style={styles.hero}>
        <View style={styles.mark}>
          <StepResponseMark width={160} />
        </View>
        <Text variant="label" tone="primary">
          {s.perfect ? 'Flawless loop' : 'Session complete'}
        </Text>
        <Text variant="title" align="center">
          {s.perfect ? 'Perfect run!' : 'Nicely settled!'}
        </Text>
        <XpCountUp value={s.xpEarned} style={styles.xp} />
      </View>

      {s.streakExtended ? (
        <View style={styles.streakBanner} testID="streak-extended-banner" accessible accessibilityRole="text" accessibilityLabel={`Streak extended! ${s.streak} day streak`}>
          <FlameGlyph size={48} />
          <View style={styles.flex}>
            <Text variant="heading" style={{ color: palette.streak.shade }}>
              Streak extended!
            </Text>
            <Text variant="body" style={{ color: palette.streak.shade }}>
              {s.streak} {s.streak === 1 ? 'day' : 'days'} in a row. Keep the loop closed tomorrow.
            </Text>
          </View>
        </View>
      ) : null}

      <View style={styles.tiles}>
        <StatTile label="Accuracy" value={`${accuracyPct}%`} tone={accuracyPct >= 80 ? palette.success : palette.primary} testID="summary-accuracy" />
        <StatTile label="Correct" value={`${s.correct}/${s.total}`} tone={palette.secondary} />
        <StatTile label="Best combo" value={String(s.maxCombo)} tone={palette.streak} />
      </View>

      {s.levelUp ? (
        <View style={[styles.banner, { backgroundColor: palette.primary.tint, borderColor: palette.primary.base }]} testID="level-up-banner">
          <Text variant="label" tone="primary">
            Crown level up
          </Text>
          <Text variant="heading">Skill reached level {s.levelUp.level}</Text>
        </View>
      ) : null}

      {s.xpBreakdown.length > 0 ? (
        <View style={styles.section}>
          <Text variant="label">XP breakdown</Text>
          <View style={styles.breakdown}>
            {s.xpBreakdown.map((line, i) => (
              <View key={`${line.label}-${i}`} style={[styles.breakdownRow, i > 0 && styles.breakdownDivider]}>
                <Text variant="body" style={styles.flex}>
                  {line.label}
                </Text>
                <Text variant="monoStrong" style={{ color: palette.xp.shade }}>
                  +{line.amount}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {goal > 0 ? (
        <View style={styles.section}>
          <View style={styles.goalHead}>
            <Text variant="label">Daily goal</Text>
            <Text variant="monoStrong" tone={s.dailyGoalMet ? 'success' : 'muted'}>
              {Math.min(s.xpToday, goal)}/{goal} XP
            </Text>
          </View>
          <ProgressBar value={s.xpToday} max={goal} tone={s.dailyGoalMet ? 'success' : 'xp'} accessibilityLabel="Daily XP goal" />
          <Text variant="caption">{s.dailyGoalMet ? 'Daily goal met. Anything more is bonus.' : `${goal - s.xpToday} XP to go today.`}</Text>
        </View>
      ) : null}

      {s.newAchievements.length > 0 ? (
        <View style={styles.section}>
          <Text variant="label">New achievements</Text>
          <View style={styles.chips}>
            {s.newAchievements.map((a) => (
              <View key={a.id} style={styles.chip}>
                <Text variant="bodyStrong" style={{ color: palette.accent.shade }}>
                  {a.title}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

function StatTile({ label, value, tone, testID }: { label: string; value: string; tone: ToneSwatch; testID?: string }) {
  return (
    <View style={[styles.tile, { borderColor: tone.base, backgroundColor: tone.tint }]} testID={testID} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text variant="label" style={{ color: tone.shade }}>
        {label}
      </Text>
      <Text variant="monoStrong" style={[styles.tileValue, { color: tone.shade }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.xl, paddingBottom: spacing.lg },
  mark: {
    backgroundColor: palette.primary.tint,
    borderRadius: radii.xxl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  xp: { marginTop: spacing.sm },
  streakBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.xl,
    backgroundColor: palette.streak.tint,
    borderWidth: borders.width,
    borderBottomWidth: borders.edge,
    borderColor: palette.streak.base,
    marginBottom: spacing.lg,
  },
  tiles: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  tile: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.lg,
    borderWidth: borders.width,
    borderBottomWidth: borders.edge,
  },
  tileValue: { fontSize: 22, lineHeight: 28 },
  banner: {
    padding: spacing.lg,
    borderRadius: radii.xl,
    borderWidth: borders.width,
    borderBottomWidth: borders.edge,
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  section: { gap: spacing.sm, marginBottom: spacing.lg },
  breakdown: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: borders.width,
    borderBottomWidth: borders.edge,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
  },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  breakdownDivider: { borderTopWidth: borders.width, borderTopColor: colors.ink[100] },
  goalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: palette.accent.tint,
    borderWidth: borders.width,
    borderColor: palette.accent.base,
  },
});
