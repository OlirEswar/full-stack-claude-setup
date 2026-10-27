import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError, getDaily, getMe, startDaily } from '@/api/client';
import type { DailyResponse } from '@/api/types';
import { BoltGlyph, Button, Card, ErrorState, FlameGlyph, LoadingState, Screen, Text } from '@/components/ui';
import { borders, palette, radii, spacing } from '@/theme/tokens';

type Data = { daily: DailyResponse; streak: number };

/** Daily challenge intro/status: start, resume, or celebrate today's finished run. */
export default function DailyScreen() {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [daily, me] = await Promise.all([getDaily(), getMe()]);
      setData({ daily, streak: me.stats.streak });
    } catch (e) {
      setError(e instanceof ApiError && e.message ? e.message : 'We couldn’t load today’s challenge.');
    }
  }, []);

  // Refetch on focus so returning from the player shows the up-to-date status.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const retry = () => {
    setError(null);
    void load();
  };

  const start = async () => {
    setStarting(true);
    setStartError(null);
    try {
      const res = await startDaily();
      router.push({ pathname: '/session/[id]', params: { id: String(res.session.id) } });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setStartError('Today’s challenge is already done. Come back tomorrow.');
        void load();
      } else {
        setStartError(e instanceof ApiError && e.message ? e.message : 'Couldn’t start the challenge. Try again.');
      }
    } finally {
      setStarting(false);
    }
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (!data) {
    return (
      <Screen scroll={false} testID="daily-screen">
        {error ? (
          <ErrorState title="Today’s challenge didn’t load" message={error} onRetry={retry} />
        ) : (
          <LoadingState label="Picking today’s questions…" />
        )}
      </Screen>
    );
  }

  const { daily, streak } = data;
  const done = daily.status === 'completed';
  const tone = done ? palette.success : palette.streak;
  const days = `${streak}-day streak`;

  return (
    <Screen
      testID="daily-screen"
      footer={
        <View style={styles.footer}>
          {startError ? (
            <Text variant="caption" tone="error" align="center" testID="daily-start-error">
              {startError}
            </Text>
          ) : null}
          {done ? (
            <Button label="Back to path" variant="success" onPress={back} />
          ) : (
            <Button
              label={daily.status === 'in_progress' ? 'Resume' : 'Start'}
              loading={starting}
              onPress={start}
              testID="daily-start"
            />
          )}
          {!done ? <Button label="Not now" variant="ghost" onPress={back} /> : null}
        </View>
      }
    >
      <View style={styles.hero}>
        <View style={[styles.badge, { backgroundColor: tone.base, borderColor: tone.shade }]}>
          <FlameGlyph size={48} tone={palette.xp} />
        </View>
        <Text variant="label" style={{ color: tone.shade }} align="center">
          {done ? 'Daily challenge · done' : 'Daily challenge'}
        </Text>
        <Text variant="title" align="center">
          {done
            ? 'Streak secured for today'
            : daily.status === 'in_progress'
              ? 'Pick up where you left off'
              : 'Five questions, one hot streak'}
        </Text>
      </View>

      <View style={styles.facts}>
        <Card style={styles.fact} tone={done ? 'success' : 'streak'}>
          <FlameGlyph size={24} tone={palette.xp} />
          <Text variant="heading" testID="daily-streak">
            {days}
          </Text>
          <Text variant="caption">{done ? 'Extended today. See you tomorrow.' : 'Finish today to keep it alive.'}</Text>
        </Card>
        <Card style={styles.fact}>
          <BoltGlyph size={24} />
          <Text variant="heading" testID="daily-meta">
            {`${daily.questionCount} questions · ~3 min`}
          </Text>
          <Text variant="caption">Drawn from your due and shakiest skills. No hearts at stake.</Text>
        </Card>
      </View>

      <Text variant="body" tone="muted" align="center">
        {done
          ? 'You closed the loop today. A fresh challenge unlocks at midnight in your timezone.'
          : daily.status === 'in_progress'
            ? 'Your answers so far are saved. Finish the run to extend your streak.'
            : 'A short, mixed review that keeps your feedback loop tight.'}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.xl, paddingBottom: spacing.lg },
  badge: {
    width: 104,
    height: 104,
    borderRadius: radii.xl,
    borderBottomWidth: borders.edge,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.lg },
  fact: { flexGrow: 1, flexBasis: 220, gap: spacing.xs },
  footer: { gap: spacing.sm },
});
