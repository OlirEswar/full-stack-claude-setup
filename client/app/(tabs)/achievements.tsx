import { EmptyState, MedalGlyph, Screen } from '@/components/ui';

// Placeholder; task 28 builds the badge grid.
export default function AchievementsScreen() {
  return (
    <Screen testID="achievements-screen" scroll={false} edges={['top', 'left', 'right']}>
      <EmptyState
        illustration={<MedalGlyph size={48} />}
        title="Badges"
        message="Your badge case is being built. Badges you unlock now will be waiting for you here."
      />
    </Screen>
  );
}
