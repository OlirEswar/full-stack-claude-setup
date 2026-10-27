import { StyleSheet, View } from 'react-native';

import type { DailyResponse } from '@/api/types';
import { Card, FlameGlyph, Text } from '@/components/ui';
import { borders, palette, radii, spacing, type Tone } from '@/theme/tokens';

export type DailyChallengeCardProps = {
  daily: DailyResponse;
  onPress: () => void;
};

const copy: Record<DailyResponse['status'], { tone: Tone; eyebrow: string; title: string; body: (n: number) => string; cta: string }> = {
  not_started: {
    tone: 'streak',
    eyebrow: 'Daily challenge',
    title: 'Keep your streak burning',
    body: (n) => `${n} quick questions from your due and shakiest skills. About 3 minutes, no hearts at stake.`,
    cta: 'Start',
  },
  in_progress: {
    tone: 'streak',
    eyebrow: 'Daily challenge · in progress',
    title: 'Pick up where you left off',
    body: () => 'Your answers so far are saved. Finish it to extend your streak.',
    cta: 'Resume',
  },
  completed: {
    tone: 'success',
    eyebrow: 'Daily challenge · done',
    title: 'Streak secured for today',
    body: () => 'Nice work. A fresh challenge unlocks tomorrow.',
    cta: 'Done',
  },
};

/** Prominent top-of-path card linking to /daily; its look follows the day's status. */
export function DailyChallengeCard({ daily, onPress }: DailyChallengeCardProps) {
  const c = copy[daily.status];
  const sw = palette[c.tone];
  return (
    <Card
      tone={c.tone}
      onPress={onPress}
      accessibilityLabel={`${c.eyebrow}. ${c.title}`}
      testID="daily-card"
      style={styles.card}
    >
      <View style={styles.row}>
        <View style={[styles.badge, { backgroundColor: sw.base, borderColor: sw.shade }]}>
          <FlameGlyph size={32} tone={palette.xp} />
        </View>
        <View style={styles.text}>
          <Text variant="label" style={{ color: sw.shade }}>
            {c.eyebrow}
          </Text>
          <Text variant="heading">{c.title}</Text>
          <Text variant="caption">{c.body(daily.questionCount)}</Text>
        </View>
        <View style={[styles.cta, { backgroundColor: sw.base, borderColor: sw.shade }]} testID="daily-status">
          <Text variant="label" style={{ color: sw.on }}>
            {c.cta}
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {},
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  badge: {
    width: 56,
    height: 56,
    borderRadius: radii.lg,
    borderBottomWidth: borders.edge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: spacing.xxs },
  cta: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderBottomWidth: borders.edge - 1,
  },
});
