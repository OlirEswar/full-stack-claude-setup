import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import type { MeStats } from '@/api/types';
import { BoltGlyph, StatPill, Text } from '@/components/ui';
import { colors, palette, spacing } from '@/theme/tokens';

export type TopStatsBarProps = {
  stats: MeStats;
  /** Injectable clock for tests. */
  now?: () => number;
};

/** "+1 in 23m" style countdown to the next regenerated heart; null when hearts are full. */
export function nextHeartLabel(nextHeartAt: string | null, nowMs: number): string | null {
  if (!nextHeartAt) return null;
  const ms = Date.parse(nextHeartAt) - nowMs;
  if (!Number.isFinite(ms)) return null;
  if (ms <= 0) return '+1 any moment';
  const mins = Math.ceil(ms / 60_000);
  if (mins < 60) return `+1 in ${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `+1 in ${h}h ${m}m` : `+1 in ${h}h`;
}

function useNow(now: () => number, enabled: boolean) {
  const [t, setT] = useState(now);
  useEffect(() => {
    if (!enabled) return;
    const handle = setInterval(() => setT(now()), 30_000);
    return () => clearInterval(handle);
  }, [now, enabled]);
  return t;
}

/** Live (30s tick) next-heart countdown label. */
export function useNextHeartLabel(nextHeartAt: string | null, now: () => number = Date.now): string | null {
  const t = useNow(now, !!nextHeartAt);
  return nextHeartLabel(nextHeartAt, t);
}

const RING = 44;
const STROKE = 5;

/** Daily goal ring: gold arc fills toward the goal, turns success green once it's met. */
function XpRing({ xpToday, goal, met }: { xpToday: number; goal: number; met: boolean }) {
  const r = (RING - STROKE) / 2;
  const c = 2 * Math.PI * r;
  const ratio = goal > 0 ? Math.min(xpToday / goal, 1) : 0;
  const arc = met ? palette.success.base : palette.xp.base;
  return (
    <View
      style={styles.ringRow}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${xpToday} of ${goal} XP today${met ? ', daily goal met' : ''}`}
      accessibilityValue={{ min: 0, max: goal, now: Math.min(xpToday, goal) }}
      testID="xp-ring"
    >
      <View style={styles.ring}>
        <Svg width={RING} height={RING}>
          <Circle cx={RING / 2} cy={RING / 2} r={r} stroke={colors.ink[200]} strokeWidth={STROKE} fill="none" />
          {ratio > 0 ? (
            <Circle
              cx={RING / 2}
              cy={RING / 2}
              r={r}
              stroke={arc}
              strokeWidth={STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${c * ratio} ${c}`}
              transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
            />
          ) : null}
        </Svg>
        <View style={styles.ringIcon}>
          <BoltGlyph size={20} tone={met ? palette.success : palette.xp} />
        </View>
      </View>
      <View>
        <Text variant="monoStrong" style={{ color: met ? palette.success.shade : palette.xp.shade }}>
          {xpToday}/{goal}
        </Text>
        <Text variant="caption" tone="subtle">
          XP today
        </Text>
      </View>
    </View>
  );
}

/** Home header: streak, hearts (with next-heart countdown) and today's XP against the goal. */
export function TopStatsBar({ stats, now = Date.now }: TopStatsBarProps) {
  const full = stats.hearts >= stats.maxHearts;
  const label = useNextHeartLabel(full ? null : stats.nextHeartAt, now);
  const regen = full ? null : label;

  return (
    <View style={styles.bar} testID="top-stats">
      <View style={styles.stat}>
        <StatPill kind="streak" value={stats.streak} inactive={!stats.dailyChallengeDone} testID="stat-streak" />
        <Text variant="caption" tone="subtle">
          {stats.dailyChallengeDone ? 'Extended today' : stats.streak > 0 ? 'Keep it alive' : 'Start a streak'}
        </Text>
      </View>
      <View style={styles.stat}>
        <StatPill kind="hearts" value={stats.hearts} inactive={stats.hearts <= 0} testID="stat-hearts" />
        <Text variant="caption" tone={stats.hearts <= 0 ? 'error' : 'subtle'} testID="next-heart">
          {full ? 'Full hearts' : (regen ?? 'Refilling')}
        </Text>
      </View>
      <XpRing xpToday={stats.xpToday} goal={stats.dailyXpGoal} met={stats.dailyGoalMet} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  stat: { gap: spacing.xxs, alignItems: 'flex-start' },
  ringRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ring: { width: RING, height: RING },
  ringIcon: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
});
