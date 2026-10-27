import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { getLeaderboard } from '@/api/client';
import type { LeaderboardResponse } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { LeaderboardRow, resetLabel, weekLabel } from '@/components/social';
import { EmptyState, ErrorState, LoadingState, Screen, Text, TrophyGlyph } from '@/components/ui';
import { useFocusedResource } from '@/hooks/useFocusedResource';
import { borders, colors, palette, radii, spacing } from '@/theme/tokens';

const isLeaderboard = (v: LeaderboardResponse) => Array.isArray(v.entries) && !!v.me;

/** Weekly XP league: top 50 since Monday 00:00 UTC, plus your own rank. */
export default function LeaderboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data, loading, error, reload } = useFocusedResource(getLeaderboard, isLeaderboard);

  const heading = (
    <View style={styles.heading}>
      <Text variant="label" tone="primary">
        Weekly league
      </Text>
      <Text variant="title">Leaderboard</Text>
    </View>
  );

  if (!data) {
    return (
      <Screen testID="leaderboard-screen" scroll={false} edges={['top', 'left', 'right']}>
        {heading}
        {error && !loading ? (
          <View style={styles.fill} testID="leaderboard-error">
            <ErrorState title="The league table didn’t load" message={error} onRetry={reload} />
          </View>
        ) : (
          <View style={styles.fill} testID="leaderboard-loading">
            <LoadingState label="Tallying this week’s XP…" />
          </View>
        )}
      </Screen>
    );
  }

  const { entries, me, weekStart } = data;
  const meInTop = entries.some((e) => e.isMe);
  const reset = resetLabel(weekStart);

  if (entries.length === 0) {
    return (
      <Screen testID="leaderboard-screen" scroll={false} edges={['top', 'left', 'right']}>
        {heading}
        <View style={styles.fill} testID="leaderboard-empty">
          <EmptyState
            illustration={<TrophyGlyph size={48} />}
            title="The board is wide open"
            message={`Nobody has earned XP yet this week${reset ? ` (${reset.toLowerCase()})` : ''}. Finish one lesson and the top spot is yours.`}
            action={{ label: 'Start learning', onPress: () => router.navigate('/') }}
          />
        </View>
      </Screen>
    );
  }

  const footer = meInTop ? undefined : (
    <View style={styles.footer} testID="my-rank-footer">
      <Text variant="label" tone="muted">
        {me.xp > 0 ? 'Your position' : 'You haven’t scored yet this week'}
      </Text>
      <LeaderboardRow rank={me.rank} username={user?.username ?? 'You'} xp={me.xp} isMe testID="my-rank-row" />
    </View>
  );

  return (
    <Screen testID="leaderboard-screen" edges={['top', 'left', 'right']} footer={footer}>
      <View style={styles.content}>
        <View style={styles.headerRow}>
          {heading}
          <View style={styles.trophy}>
            <TrophyGlyph size={48} />
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={[styles.chip, { backgroundColor: palette.primary.tint, borderColor: palette.primary.base }]}>
            <Text variant="label" style={{ color: palette.primary.shade }}>
              {weekLabel(weekStart)}
            </Text>
          </View>
          {reset ? (
            <View style={[styles.chip, { backgroundColor: palette.streak.tint, borderColor: palette.streak.base }]}>
              <Text variant="label" style={{ color: palette.streak.shade }} testID="leaderboard-reset">
                {reset}
              </Text>
            </View>
          ) : null}
        </View>

        <Text variant="body" tone="muted">
          {meInTop
            ? `You’re #${me.rank} with ${me.xp.toLocaleString('en-US')} XP this week. Keep the gain up.`
            : 'XP earned since Monday counts. Top 50 learners make the board.'}
        </Text>

        <View style={styles.list} testID="leaderboard-list" accessibilityRole="list">
          {entries.map((e) => (
            <LeaderboardRow
              key={`${e.rank}-${e.username}`}
              rank={e.rank}
              username={e.username}
              xp={e.xp}
              isMe={e.isMe}
              testID={`leaderboard-row-${e.rank}`}
            />
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { paddingTop: spacing.lg, gap: spacing.xxs },
  fill: { flex: 1 },
  content: { gap: spacing.lg, paddingBottom: spacing.xxxl },
  headerRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  trophy: {
    width: 72,
    height: 72,
    borderRadius: radii.pill,
    backgroundColor: palette.xp.tint,
    borderWidth: borders.width,
    borderBottomWidth: borders.edge,
    borderColor: palette.xp.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: borders.width,
  },
  list: { gap: spacing.sm },
  footer: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: borders.width,
    borderTopColor: colors.border,
  },
});
