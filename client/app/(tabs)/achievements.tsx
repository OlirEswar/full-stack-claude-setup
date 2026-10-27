import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { getAchievements } from '@/api/client';
import type { Achievement, AchievementsResponse } from '@/api/types';
import { AchievementBadge, badgeArt } from '@/components/social';
import { EmptyState, ErrorState, LoadingState, MedalGlyph, ProgressBar, Screen, Text } from '@/components/ui';
import { useFocusedResource } from '@/hooks/useFocusedResource';
import { borders, colors, fontFamilies, layout, palette, radii, spacing } from '@/theme/tokens';

const isAchievements = (v: AchievementsResponse) => Array.isArray(v.achievements);

const ratio = (a: Achievement) => (a.progress.target > 0 ? a.progress.current / a.progress.target : 0);

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

function BadgeGrid({ items, columns, testID }: { items: Achievement[]; columns: number; testID: string }) {
  return (
    <View style={styles.grid} testID={testID}>
      {chunk(items, columns).map((row, i) => (
        <View key={i} style={styles.gridRow}>
          {row.map((a) => (
            <AchievementBadge key={a.id} achievement={a} />
          ))}
          {/* Keep the last row's tiles the same width as the rest. */}
          {Array.from({ length: columns - row.length }, (_, j) => (
            <View key={`pad-${j}`} style={styles.pad} />
          ))}
        </View>
      ))}
    </View>
  );
}

/** Badge case: earned badges up top, then locked ones with progress toward each. */
export default function AchievementsScreen() {
  const { width } = useWindowDimensions();
  const { data, loading, error, reload } = useFocusedResource(getAchievements, isAchievements);
  const columns = Math.min(width, layout.maxContentWidth) >= 520 ? 3 : 2;

  const heading = (
    <View style={styles.heading}>
      <Text variant="label" tone="primary">
        Badge case
      </Text>
      <Text variant="title">Achievements</Text>
    </View>
  );

  if (!data) {
    return (
      <Screen testID="achievements-screen" scroll={false} edges={['top', 'left', 'right']}>
        {heading}
        {error && !loading ? (
          <View style={styles.fill} testID="achievements-error">
            <ErrorState title="Your badges didn’t load" message={error} onRetry={reload} />
          </View>
        ) : (
          <View style={styles.fill} testID="achievements-loading">
            <LoadingState label="Polishing your badges…" />
          </View>
        )}
      </Screen>
    );
  }

  const all = data.achievements;
  if (all.length === 0) {
    return (
      <Screen testID="achievements-screen" scroll={false} edges={['top', 'left', 'right']}>
        {heading}
        <View style={styles.fill} testID="achievements-empty">
          <EmptyState
            illustration={<MedalGlyph size={48} />}
            title="No badges to chase yet"
            message="The badge case is empty right now. Pull back later and new goals will be waiting."
            action={{ label: 'Refresh', onPress: reload }}
          />
        </View>
      </Screen>
    );
  }

  const unlocked = all.filter((a) => a.unlocked);
  const locked = all.filter((a) => !a.unlocked);
  // The locked badge you're closest to finishing.
  const next = locked.reduce<Achievement | null>((best, a) => (!best || ratio(a) > ratio(best) ? a : best), null);
  const nextArt = next ? badgeArt(next.icon) : null;

  return (
    <Screen testID="achievements-screen" edges={['top', 'left', 'right']}>
      <View style={styles.content}>
        {heading}

        <View style={styles.summary} testID="achievements-summary">
          <View style={styles.summaryTop}>
            <View style={styles.summaryCount}>
              <Text variant="display" style={styles.countNumber}>
                {unlocked.length}
              </Text>
              <Text variant="bodyStrong" tone="muted">
                {`of ${all.length} earned`}
              </Text>
            </View>
            <MedalGlyph size={48} tone={palette.xp} />
          </View>
          <ProgressBar value={unlocked.length} max={all.length} tone="xp" accessibilityLabel="Badges earned" />
          {next && nextArt ? (
            <View style={styles.nextUp} testID="achievements-next">
              <nextArt.Glyph size={24} tone={nextArt.tone} />
              <Text variant="caption" style={styles.nextText}>
                <Text variant="caption" style={styles.nextStrong}>
                  Closest next: {next.title}
                </Text>
                {` · ${next.progress.current} / ${next.progress.target}`}
              </Text>
            </View>
          ) : (
            <Text variant="caption" tone="success">
              Every badge earned. Your loop is fully closed.
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <Text variant="heading">Earned</Text>
          {unlocked.length > 0 ? (
            <BadgeGrid items={unlocked} columns={columns} testID="achievements-unlocked" />
          ) : (
            <View style={styles.inlineEmpty} testID="achievements-none-unlocked">
              <Text variant="body" tone="muted">
                Nothing here yet. Finish your first lesson and First Steps lands in this case.
              </Text>
            </View>
          )}
        </View>

        {locked.length > 0 ? (
          <View style={styles.section}>
            <Text variant="heading">Still to unlock</Text>
            <BadgeGrid items={locked} columns={columns} testID="achievements-locked" />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { paddingTop: spacing.lg, gap: spacing.xxs },
  fill: { flex: 1 },
  content: { gap: spacing.xl, paddingBottom: spacing.xxxl },
  summary: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.xl,
    backgroundColor: palette.xp.tint,
    borderWidth: borders.width,
    borderBottomWidth: borders.edge,
    borderColor: palette.xp.base,
  },
  summaryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryCount: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  countNumber: { color: palette.xp.shade },
  nextUp: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  nextText: { flex: 1, color: colors.textMuted },
  nextStrong: { color: colors.text, fontFamily: fontFamilies.extraBold },
  section: { gap: spacing.md },
  grid: { gap: spacing.md },
  gridRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'stretch' },
  pad: { flex: 1 },
  inlineEmpty: {
    padding: spacing.lg,
    borderRadius: radii.xl,
    borderWidth: borders.width,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
  },
});
