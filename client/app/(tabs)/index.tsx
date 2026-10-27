import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ApiError, startSession } from '@/api/client';
import type { PathSkill, StartSessionBody } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { DailyChallengeCard, HeartsEmptyNotice, MistakesCard, SkillPath, TopStatsBar } from '@/components/path';
import { AlertGlyph, EmptyState, ErrorState, LoadingState, Screen, Text } from '@/components/ui';
import { useHomeData } from '@/hooks/useHomeData';
import { borders, colors, palette, radii, spacing } from '@/theme/tokens';

type Starting = { kind: 'lesson'; skillId: string } | { kind: 'practice' } | { kind: 'mistakes' } | null;

/** The Learn tab: stats bar, daily challenge, mistakes review and the skill path. */
export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data, loading, error, reload } = useHomeData();
  const [starting, setStarting] = useState<Starting>(null);
  const [heartsEmpty, setHeartsEmpty] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const greeting = user ? `Hi, ${user.username}!` : 'Welcome back!';

  const begin = async (body: StartSessionBody) => {
    setStarting(body.kind === 'lesson' ? { kind: 'lesson', skillId: body.skillId } : { kind: body.kind });
    setStartError(null);
    try {
      const res = await startSession(body);
      setHeartsEmpty(false);
      router.push({ pathname: '/session/[id]', params: { id: String(res.session.id) } });
    } catch (e) {
      const status = e instanceof ApiError ? e.status : -1;
      if (body.kind === 'lesson' && status === 409) {
        // Hearts ran out since the last refresh.
        setHeartsEmpty(true);
        reload();
      } else if (body.kind === 'mistakes' && status === 409) {
        setStartError('Those mistakes are already cleared. Nice.');
        reload();
      } else if (status === 403) {
        setStartError('That skill is still locked. Earn a crown in the one before it first.');
        reload();
      } else {
        setStartError(e instanceof ApiError && e.message ? e.message : 'Couldn’t start that session. Try again.');
      }
    } finally {
      setStarting(null);
    }
  };

  const onSkill = (skill: PathSkill) => {
    if (!skill.unlocked || starting) return;
    if (data && data.stats.hearts <= 0) {
      setStartError(null);
      setHeartsEmpty(true);
      return;
    }
    void begin({ kind: 'lesson', skillId: skill.id });
  };

  if (!data) {
    return (
      <Screen testID="home-screen" scroll={false}>
        <Text variant="title" style={styles.greeting}>
          {greeting}
        </Text>
        {error && !loading ? (
          <View style={styles.fill} testID="home-error">
            <ErrorState title="Your path didn’t load" message={error} onRetry={reload} />
          </View>
        ) : (
          <View style={styles.fill} testID="home-loading">
            <LoadingState label="Plotting your path…" />
          </View>
        )}
      </Screen>
    );
  }

  const { stats, path, daily, mistakes } = data;

  const footer = heartsEmpty ? (
    <HeartsEmptyNotice
      nextHeartAt={stats.nextHeartAt}
      onPractice={() => void begin({ kind: 'practice' })}
      onDismiss={() => setHeartsEmpty(false)}
      practiceBusy={starting?.kind === 'practice'}
    />
  ) : startError ? (
    <Pressable
      onPress={() => setStartError(null)}
      accessibilityRole="alert"
      accessibilityHint="Dismiss"
      style={styles.toast}
      testID="start-error"
    >
      <AlertGlyph size={24} />
      <Text variant="bodyStrong" style={styles.toastText}>
        {startError}
      </Text>
    </Pressable>
  ) : undefined;

  return (
    <Screen testID="home-screen" edges={['top', 'left', 'right']} header={<TopStatsBar stats={stats} />} footer={footer}>
      <View style={styles.content}>
        <View>
          <Text variant="title">{greeting}</Text>
          <Text variant="body" tone="muted">
            {stats.dailyGoalMet ? 'Daily goal met. Anything extra is pure overshoot.' : 'A few minutes today keeps the loop stable.'}
          </Text>
          {error ? (
            <Text variant="caption" tone="error" testID="home-refresh-error">
              Couldn’t refresh just now. Showing your last known progress.
            </Text>
          ) : null}
        </View>

        {daily ? <DailyChallengeCard daily={daily} onPress={() => router.push('/daily')} /> : null}

        <MistakesCard
          count={mistakes?.count ?? 0}
          busy={starting?.kind === 'mistakes'}
          onPress={() => void begin({ kind: 'mistakes' })}
        />

        {path.units.length === 0 ? (
          <EmptyState title="No units yet" message="The course is still being wired up. Check back soon." action={{ label: 'Refresh', onPress: reload }} />
        ) : (
          <SkillPath
            units={path.units}
            onStartSkill={onSkill}
            busySkillId={starting?.kind === 'lesson' ? starting.skillId : starting ? '__busy__' : null}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  greeting: { paddingTop: spacing.lg },
  fill: { flex: 1 },
  content: { gap: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.xxxl },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: palette.error.tint,
    borderWidth: borders.width,
    borderBottomWidth: borders.edge,
    borderColor: palette.error.base,
  },
  toastText: { flex: 1, color: colors.error.shade },
});
