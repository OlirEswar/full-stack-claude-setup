import { StyleSheet, View } from 'react-native';

import { MedalGlyph, Text } from '@/components/ui';
import { borders, colors, ink, palette, radii, spacing, type ToneSwatch } from '@/theme/tokens';

/** Podium tones: gold (xp), silver (ink), bronze (streak orange). */
const podium: Record<1 | 2 | 3, { tone: ToneSwatch; label: string }> = {
  1: { tone: palette.xp, label: 'Gold' },
  2: { tone: { base: ink[300], shade: ink[500], tint: ink[100], on: ink[0] }, label: 'Silver' },
  3: { tone: palette.streak, label: 'Bronze' },
};

export type LeaderboardRowProps = {
  rank: number;
  username: string;
  xp: number;
  isMe?: boolean;
  testID?: string;
};

function initials(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || '?';
}

/**
 * One ranked learner. Top 3 get a medal and a tinted face in their podium tone;
 * the signed-in learner's row is Loop Violet with a "You" tag.
 */
export function LeaderboardRow({ rank, username, xp, isMe = false, testID }: LeaderboardRowProps) {
  const medal = rank >= 1 && rank <= 3 ? podium[rank as 1 | 2 | 3] : null;
  const face = isMe ? palette.primary.tint : medal ? medal.tone.tint : colors.surface;
  const edge = isMe ? palette.primary.base : medal ? medal.tone.base : colors.border;
  const avatarTone = isMe ? palette.primary : medal ? medal.tone : palette.secondary;

  const a11y = `${medal ? `${medal.label} medal, ` : ''}rank ${rank}, ${isMe ? 'you' : username}, ${xp} XP`;

  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={a11y}
      accessibilityState={{ selected: isMe }}
      style={[styles.row, { backgroundColor: face, borderColor: edge }]}
    >
      <View style={styles.rankCell}>
        {medal ? (
          <View testID={testID ? `${testID}-medal` : undefined}>
            <MedalGlyph size={32} tone={medal.tone} />
          </View>
        ) : (
          <Text variant="monoStrong" tone="muted" align="center">
            {rank}
          </Text>
        )}
      </View>

      <View style={[styles.avatar, { backgroundColor: avatarTone.base, borderColor: avatarTone.shade }]}>
        <Text variant="bodyStrong" style={{ color: avatarTone.on }}>
          {initials(username)}
        </Text>
      </View>

      <View style={styles.nameCell}>
        <Text variant="bodyStrong" numberOfLines={1} style={isMe ? styles.meName : undefined}>
          {username}
        </Text>
        {isMe ? (
          <View style={styles.youTag}>
            <Text variant="label" style={styles.youText}>
              You
            </Text>
          </View>
        ) : null}
      </View>

      <Text variant="monoStrong" style={styles.xp}>
        {xp.toLocaleString('en-US')} XP
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 64,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: borders.width,
    borderBottomWidth: borders.edge,
  },
  rankCell: { width: 36, alignItems: 'center' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    borderWidth: borders.width,
    borderBottomWidth: borders.edge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minWidth: 0 },
  meName: { color: palette.primary.shade, flexShrink: 1 },
  youTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radii.pill,
    backgroundColor: palette.primary.base,
  },
  youText: { color: palette.primary.on, fontSize: 11 },
  xp: { color: colors.text },
});
