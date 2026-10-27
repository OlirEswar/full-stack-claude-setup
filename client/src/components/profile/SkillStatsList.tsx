import { StyleSheet, View } from 'react-native';

import type { SkillStats } from '@/api/types';
import { CrownGlyph, ProgressBar, Text, TraceGlyph } from '@/components/ui';
import { borders, colors, palette, radii, spacing, type Tone } from '@/theme/tokens';

export type SkillStatsListProps = {
  skills: SkillStats[];
};

/** Whole-percent label for a 0..1 ratio. */
export function percent(ratio: number): string {
  return `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`;
}

/** Signed ability estimate (theta), one decimal: "+0.4", "−1.2", "0.0". */
export function abilityLabel(theta: number): string {
  const v = Math.round(theta * 10) / 10;
  if (v === 0) return '0.0';
  return `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}`;
}

function strengthTone(s: number): { tone: Tone; word: string } {
  if (s >= 0.7) return { tone: 'success', word: 'Strong' };
  if (s >= 0.4) return { tone: 'warning', word: 'Fading' };
  return { tone: 'error', word: 'Needs review' };
}

function SkillRow({ skill }: { skill: SkillStats }) {
  const { tone, word } = strengthTone(skill.strength);
  return (
    <View style={styles.row} testID={`skill-stats-${skill.skillId}`}>
      <View style={styles.rowHead}>
        <Text variant="bodyStrong" style={styles.title} numberOfLines={2}>
          {skill.title}
        </Text>
        <View
          style={styles.crown}
          accessible
          accessibilityLabel={`Level ${skill.level} of 5`}
          testID={`skill-level-${skill.skillId}`}
        >
          <CrownGlyph size={16} />
          <Text variant="monoStrong" style={styles.crownText}>
            {skill.level}
          </Text>
        </View>
      </View>
      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Text variant="label" tone="subtle">
            Accuracy
          </Text>
          <Text variant="monoStrong" testID={`skill-accuracy-${skill.skillId}`}>
            {percent(skill.accuracy)}
          </Text>
        </View>
        <View style={styles.metric}>
          <Text variant="label" tone="subtle">
            Ability θ
          </Text>
          <Text variant="monoStrong">{abilityLabel(skill.ability)}</Text>
        </View>
        <View style={[styles.metric, styles.strength]}>
          <View style={styles.strengthHead}>
            <Text variant="label" tone="subtle">
              Strength
            </Text>
            <Text variant="caption" style={{ color: palette[tone].shade }}>
              {word}
            </Text>
          </View>
          <ProgressBar value={skill.strength} max={1} tone={tone} height={12} accessibilityLabel={`Memory strength ${percent(skill.strength)}`} />
        </View>
      </View>
    </View>
  );
}

/** Per-skill level / accuracy / ability / strength for every skill the learner has started. */
export function SkillStatsList({ skills }: SkillStatsListProps) {
  const started = skills.filter((s) => s.started);
  const notStarted = skills.length - started.length;

  if (started.length === 0) {
    return (
      <View style={styles.empty} testID="skill-stats-empty">
        <View style={styles.emptyIcon}>
          <TraceGlyph size={24} color={palette.primary.base} />
        </View>
        <View style={styles.emptyText}>
          <Text variant="bodyStrong">No skills practised yet</Text>
          <Text variant="caption">Finish a lesson on the Learn tab and your accuracy and strength show up here.</Text>
        </View>
      </View>
    );
  }

  return (
    <View testID="skill-stats-list">
      {started.map((s, i) => (
        <View key={s.skillId} style={i > 0 ? styles.divider : undefined}>
          <SkillRow skill={s} />
        </View>
      ))}
      {notStarted > 0 ? (
        <Text variant="caption" tone="subtle" style={styles.footnote}>
          {notStarted} more {notStarted === 1 ? 'skill' : 'skills'} waiting further down the path.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: spacing.md, gap: spacing.sm },
  divider: { borderTopWidth: borders.width, borderTopColor: colors.ink[100] },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1 },
  crown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: palette.xp.tint,
  },
  crownText: { color: palette.xp.shade },
  metrics: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.lg },
  metric: { gap: spacing.xxs },
  strength: { flex: 1, minWidth: 96 },
  strengthHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.xs },
  footnote: { paddingTop: spacing.sm },
  empty: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.lg,
    backgroundColor: palette.primary.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { flex: 1, gap: spacing.xxs },
});
