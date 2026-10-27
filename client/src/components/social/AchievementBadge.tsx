import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { Achievement } from '@/api/types';
import { LockGlyph, ProgressBar, Text, lockedTone } from '@/components/ui';
import { borders, colors, radii, spacing } from '@/theme/tokens';

import { badgeArt } from './achievementGlyphs';

export type AchievementBadgeProps = {
  achievement: Achievement;
  style?: StyleProp<ViewStyle>;
};

const dateFmt = (iso: string | null): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

/**
 * A single badge tile. Unlocked: tinted card in the badge's tone with a raised
 * medallion and the earned date. Locked: neutral card, greyed medallion with a
 * lock, and a progress bar with `current / target`.
 */
export function AchievementBadge({ achievement, style }: AchievementBadgeProps) {
  const { id, title, description, icon, unlocked, unlockedAt, progress } = achievement;
  const art = badgeArt(icon);
  const tone = unlocked ? art.tone : lockedTone;
  const target = Math.max(1, progress.target);
  const current = Math.min(Math.max(0, progress.current), target);
  const earned = dateFmt(unlockedAt);

  const a11y = unlocked
    ? `${title}, unlocked${earned ? ` ${earned}` : ''}. ${description}`
    : `${title}, locked, ${current} of ${target}. ${description}`;

  return (
    <View
      testID={`badge-${id}`}
      accessible
      accessibilityLabel={a11y}
      accessibilityState={{ disabled: !unlocked }}
      style={[
        styles.card,
        unlocked
          ? { backgroundColor: art.tone.tint, borderColor: art.tone.base }
          : { backgroundColor: colors.surface, borderColor: colors.border },
        style,
      ]}
    >
      <View
        testID={`badge-medallion-${id}`}
        style={[
          styles.medallion,
          unlocked
            ? { backgroundColor: colors.surface, borderColor: art.tone.shade }
            : { backgroundColor: colors.ink[100], borderColor: colors.ink[300] },
        ]}
      >
        <View style={unlocked ? undefined : styles.dim}>
          <art.Glyph size={32} tone={tone} />
        </View>
        {unlocked ? null : (
          <View style={styles.lock} testID={`badge-lock-${id}`}>
            <LockGlyph size={16} />
          </View>
        )}
      </View>

      <Text variant="bodyStrong" align="center" numberOfLines={2} style={unlocked ? undefined : styles.lockedTitle}>
        {title}
      </Text>
      <Text variant="caption" align="center" numberOfLines={3} style={styles.description}>
        {description}
      </Text>

      <View style={styles.footer}>
        {unlocked ? (
          <View style={[styles.earnedPill, { backgroundColor: art.tone.base, borderColor: art.tone.shade }]}>
            <Text variant="label" style={[styles.earnedText, { color: art.tone.on }]} testID={`badge-earned-${id}`}>
              {earned ? `Earned ${earned}` : 'Unlocked'}
            </Text>
          </View>
        ) : (
          <View style={styles.progress}>
            <ProgressBar
              value={current}
              max={target}
              tone="primary"
              height={10}
              accessibilityLabel={`${title} progress`}
              testID={`badge-bar-${id}`}
            />
            <Text variant="mono" tone="muted" align="center" style={styles.count} testID={`badge-progress-${id}`}>
              {`${current} / ${target}`}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.md,
    paddingTop: spacing.lg,
    borderRadius: radii.xl,
    borderWidth: borders.width,
    borderBottomWidth: borders.edge,
  },
  medallion: {
    width: 64,
    height: 64,
    borderRadius: radii.pill,
    borderWidth: borders.width,
    borderBottomWidth: borders.edge + 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  dim: { opacity: 0.7 },
  lock: {
    position: 'absolute',
    right: -6,
    bottom: -6,
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: borders.width,
    borderColor: colors.ink[300],
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedTitle: { color: colors.ink[700] },
  description: { minHeight: 36 },
  footer: { alignSelf: 'stretch', marginTop: 'auto', paddingTop: spacing.sm, alignItems: 'center' },
  progress: { alignSelf: 'stretch', gap: spacing.xs },
  count: { fontSize: 13, lineHeight: 18 },
  earnedPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: borders.width,
    borderBottomWidth: borders.edge - 1,
  },
  earnedText: { fontSize: 11 },
});
