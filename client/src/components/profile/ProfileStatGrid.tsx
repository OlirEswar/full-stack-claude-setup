import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { StatsResponse } from '@/api/types';
import { BoltGlyph, FlameGlyph, MedalGlyph, Text, TraceGlyph } from '@/components/ui';
import { borders, palette, radii, spacing, type ToneSwatch } from '@/theme/tokens';

import { percent } from './SkillStatsList';

export type ProfileStatGridProps = {
  stats: StatsResponse;
};

/** "12,480" without depending on the runtime's Intl data. */
export function formatCount(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function Tile({
  tone,
  icon,
  value,
  label,
  caption,
  testID,
}: {
  tone: ToneSwatch;
  icon: ReactNode;
  value: string;
  label: string;
  caption: string;
  testID: string;
}) {
  return (
    <View
      style={[styles.tile, { backgroundColor: tone.tint, borderColor: tone.base }]}
      accessible
      accessibilityLabel={`${label}: ${value}. ${caption}`}
      testID={testID}
    >
      <View style={styles.tileHead}>
        {icon}
        <Text variant="label" style={{ color: tone.shade }} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text variant="display" style={[styles.value, { color: tone.shade }]} testID={`${testID}-value`} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text variant="caption" numberOfLines={1}>
        {caption}
      </Text>
    </View>
  );
}

/** Lifetime totals as four tinted tiles: XP, accuracy, longest streak, lessons. */
export function ProfileStatGrid({ stats }: ProfileStatGridProps) {
  const answered = stats.answered;
  return (
    <View style={styles.grid} testID="profile-stat-grid">
      <Tile
        tone={palette.xp}
        icon={<BoltGlyph size={20} />}
        label="Total XP"
        value={formatCount(stats.xpTotal)}
        caption={`${formatCount(answered)} ${answered === 1 ? 'answer' : 'answers'} checked`}
        testID="stat-total-xp"
      />
      <Tile
        tone={palette.success}
        icon={<TraceGlyph size={20} color={palette.success.base} />}
        label="Accuracy"
        value={answered > 0 ? percent(stats.accuracy) : '–'}
        caption={answered > 0 ? 'of answers correct' : 'No answers yet'}
        testID="stat-accuracy"
      />
      <Tile
        tone={palette.streak}
        icon={<FlameGlyph size={20} />}
        label="Best streak"
        value={String(stats.longestStreak)}
        caption={stats.longestStreak === 1 ? 'day in a row' : 'days in a row'}
        testID="stat-longest-streak"
      />
      <Tile
        tone={palette.accent}
        icon={<MedalGlyph size={20} />}
        label="Lessons"
        value={formatCount(stats.lessonsCompleted)}
        caption="completed"
        testID="stat-lessons"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: {
    flexGrow: 1,
    flexBasis: '40%',
    minWidth: 140,
    padding: spacing.md,
    gap: spacing.xxs,
    borderRadius: radii.xl,
    borderWidth: borders.width,
    borderBottomWidth: borders.edge,
  },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  value: { fontSize: 30, lineHeight: 36 },
});
