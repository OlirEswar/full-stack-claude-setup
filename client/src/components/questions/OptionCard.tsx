import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type AccessibilityRole, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Text } from '@/components/ui';
import { borders, colors, layout, palette, radii, spacing, typeScale, type Tone } from '@/theme/tokens';

import { isMathy } from './mathy';

/**
 * Visual state of an answer card.
 * - idle / selected: while answering
 * - correct / incorrect / missed / dimmed: after Check (`missed` = a right answer the learner didn't pick)
 */
export type OptionState = 'idle' | 'selected' | 'correct' | 'incorrect' | 'missed' | 'dimmed';

type Look = { face: string; border: string; edge: string; text: string };

const idleLook: Look = { face: colors.surface, border: colors.border, edge: colors.border, text: colors.text };

function toneLook(tone: Tone): Look {
  const p = palette[tone];
  return { face: p.tint, border: p.base, edge: p.base, text: p.shade };
}

function lookFor(state: OptionState, tone: Tone | undefined): Look {
  switch (state) {
    case 'selected':
      // Pair tones (gold, orange...) have low-contrast shades, so non-brand tones keep ink text.
      return tone && tone !== 'primary' ? { ...toneLook(tone), text: colors.text } : toneLook('primary');
    case 'correct':
      return toneLook('success');
    case 'incorrect':
      return toneLook('error');
    case 'missed':
      return { face: colors.surface, border: palette.success.base, edge: palette.success.base, text: palette.success.shade };
    default:
      return idleLook;
  }
}

export type OptionCardProps = {
  label: string;
  state: OptionState;
  onPress?: () => void;
  disabled?: boolean;
  /** Leading key/index badge text ("1", "2"...). */
  badge?: string;
  /** Render the badge as a checkbox (multi-select). */
  checkbox?: boolean;
  /** Override the "selected" color (match pairs). */
  tone?: Tone;
  /** Extra trailing element (e.g. a pair chip). */
  trailing?: ReactNode;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Selection state reported to assistive tech. */
  checked?: boolean;
  compact?: boolean;
  align?: 'left' | 'center';
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * The Duolingo-style answer card: big tap target, 2px border, 4px solid bottom edge that
 * collapses on press. Colors shift with state (selected violet, correct green, wrong red).
 */
export function OptionCard({
  label,
  state,
  onPress,
  disabled,
  badge,
  checkbox,
  tone,
  trailing,
  accessibilityRole = 'button',
  accessibilityLabel,
  accessibilityHint,
  checked,
  compact,
  align = 'left',
  style,
  testID,
}: OptionCardProps) {
  const look = lookFor(state, tone);
  const mono = isMathy(label);
  const marked = state === 'selected' || state === 'correct' || state === 'incorrect';

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{
        disabled: !!disabled,
        ...(accessibilityRole === 'checkbox' || accessibilityRole === 'radio' ? { checked: !!checked } : { selected: !!checked }),
      }}
      style={({ pressed }) => {
        const down = pressed && !disabled;
        return [
          styles.card,
          compact ? styles.compact : null,
          {
            backgroundColor: look.face,
            borderColor: look.border,
            borderBottomColor: look.edge,
            borderBottomWidth: down ? borders.width : borders.edge,
            marginTop: down ? borders.edge - borders.width : 0,
          },
          state === 'dimmed' ? styles.dimmed : null,
          style,
        ];
      }}
    >
      <View style={[styles.row, align === 'center' && styles.center]}>
        {badge !== undefined || checkbox ? (
          <View
            style={[
              styles.badge,
              { borderColor: marked || state === 'missed' ? look.border : colors.border },
              checkbox && marked ? { backgroundColor: look.border } : null,
            ]}
          >
            {checkbox && marked ? (
              <CheckGlyph color={colors.textOnColor} />
            ) : (
              <Text style={[typeScale.monoStrong, styles.badgeText, { color: marked ? look.text : colors.textSubtle }]}>
                {checkbox ? '' : badge}
              </Text>
            )}
          </View>
        ) : null}
        <Text
          style={[
            mono ? typeScale.monoStrong : typeScale.bodyStrong,
            mono ? styles.monoLabel : styles.label,
            { color: look.text },
            align === 'center' && styles.centerText,
            styles.grow,
          ]}
        >
          {label}
        </Text>
        {state === 'correct' ? <ResultDot ok /> : state === 'incorrect' ? <ResultDot ok={false} /> : null}
        {trailing}
      </View>
    </Pressable>
  );
}

export function CheckGlyph({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Path d="M3.5 8.5l3 3 6-7" stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CrossGlyph({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

/** Filled circle with a check or cross, shown on revealed cards. */
export function ResultDot({ ok }: { ok: boolean }) {
  const p = ok ? palette.success : palette.error;
  return (
    <View
      style={[styles.dot, { backgroundColor: p.base }]}
      accessibilityLabel={ok ? 'correct' : 'incorrect'}
      testID={ok ? 'result-correct' : 'result-incorrect'}
    >
      {ok ? <CheckGlyph color={p.on} /> : <CrossGlyph color={p.on} />}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: layout.buttonHeight.lg,
    borderRadius: radii.lg,
    borderWidth: borders.width,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    justifyContent: 'center',
  },
  compact: {
    minHeight: layout.buttonHeight.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  dimmed: { opacity: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  center: { justifyContent: 'center' },
  grow: { flexShrink: 1, flexGrow: 1 },
  label: { fontSize: 17, lineHeight: 24 },
  monoLabel: { fontSize: 16, lineHeight: 24 },
  centerText: { textAlign: 'center' },
  badge: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    borderWidth: borders.width,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 13, lineHeight: 16 },
  dot: {
    width: 24,
    height: 24,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
