import { EmptyState, Screen, TrophyGlyph } from '@/components/ui';

// Placeholder; task 27 builds the weekly leaderboard.
export default function LeaderboardScreen() {
  return (
    <Screen testID="leaderboard-screen" scroll={false} edges={['top', 'left', 'right']}>
      <EmptyState
        illustration={<TrophyGlyph size={48} />}
        title="Weekly league"
        message="Rankings by XP earned since Monday are on their way. Every lesson you finish now already counts."
      />
    </Screen>
  );
}
