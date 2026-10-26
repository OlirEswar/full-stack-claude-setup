import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { borders, colors, palette, radii, spacing, type ToneSwatch } from '@/theme/tokens';

import { BoltGlyph, FlameGlyph, HeartGlyph } from './icons';
import { Text } from './Text';

export type StatKind = 'streak' | 'hearts' | 'xp';

export type StatPillProps = {
  kind: StatKind;
  value: number;
  /** Greys the pill out, e.g. a streak not yet extended today or zero hearts. */
  inactive?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const inactiveTone: ToneSwatch = { base: colors.ink[300], shade: colors.ink[400], tint: colors.ink[100], on: colors.ink[0] };

const config: Record<StatKind, { tone: ToneSwatch; Glyph: typeof FlameGlyph; label: (n: number) => string }> = {
  streak: { tone: palette.streak, Glyph: FlameGlyph, label: (n) => `${n} day streak` },
  hearts: { tone: palette.heart, Glyph: HeartGlyph, label: (n) => `${n} ${n === 1 ? 'heart' : 'hearts'} left` },
  xp: { tone: palette.xp, Glyph: BoltGlyph, label: (n) => `${n} XP` },
};

/** Compact header stat: streak flame, hearts, or XP bolt plus a mono counter. */
export function StatPill({ kind, value, inactive = false, style, testID }: StatPillProps) {
  const { tone: activeTone, Glyph, label } = config[kind];
  const tone = inactive ? inactiveTone : activeTone;
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="text"
      accessibilityLabel={label(value)}
      style={[styles.pill, { backgroundColor: tone.tint, borderColor: inactive ? colors.ink[200] : tone.tint }, style]}
    >
      <Glyph size={20} tone={tone} />
      <Text variant="monoStrong" style={{ color: inactive ? colors.textSubtle : tone.shade }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingLeft: spacing.sm,
    paddingRight: spacing.md,
    borderRadius: radii.pill,
    borderWidth: borders.width,
    alignSelf: 'flex-start',
  },
});
