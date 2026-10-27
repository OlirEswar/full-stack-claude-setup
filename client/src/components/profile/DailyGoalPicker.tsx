import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { borders, colors, layout, palette, radii, spacing } from '@/theme/tokens';

/** The goals PATCH /api/me accepts. */
export const DAILY_GOALS = [
  { xp: 10, name: 'Casual' },
  { xp: 20, name: 'Regular' },
  { xp: 30, name: 'Serious' },
  { xp: 50, name: 'Intense' },
] as const;

export type DailyGoal = (typeof DAILY_GOALS)[number]['xp'];

export type DailyGoalPickerProps = {
  value: number;
  onChange: (goal: DailyGoal) => void;
  /** The goal currently being saved, if any. Other options are disabled meanwhile. */
  saving?: number | null;
  error?: string | null;
};

/** Daily XP goal as four chunky radio tiles; the selected one is Loop Violet. */
export function DailyGoalPicker({ value, onChange, saving = null, error }: DailyGoalPickerProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel="Daily XP goal">
        {DAILY_GOALS.map((g) => {
          const selected = g.xp === value;
          const busy = saving === g.xp;
          const disabled = saving !== null;
          return (
            <Pressable
              key={g.xp}
              testID={`goal-option-${g.xp}`}
              accessibilityRole="radio"
              accessibilityLabel={`${g.name}, ${g.xp} XP a day`}
              accessibilityState={{ selected, checked: selected, disabled, busy }}
              disabled={disabled}
              onPress={() => {
                if (!selected) onChange(g.xp);
              }}
              style={({ pressed }) => {
                const down = pressed && !disabled && !selected;
                return [
                  styles.option,
                  {
                    backgroundColor: selected ? palette.primary.tint : colors.surface,
                    borderColor: selected ? palette.primary.base : colors.border,
                    borderBottomWidth: down ? borders.width : borders.edge,
                    marginTop: down ? borders.edge - borders.width : 0,
                  },
                  disabled && !busy && !selected && styles.dim,
                ];
              }}
            >
              {busy ? (
                <ActivityIndicator size="small" color={palette.primary.base} style={styles.spinner} />
              ) : (
                <Text variant="monoStrong" style={[styles.xp, { color: selected ? palette.primary.shade : colors.text }]}>
                  {g.xp}
                </Text>
              )}
              <Text variant="label" style={{ color: selected ? palette.primary.base : colors.textSubtle }} numberOfLines={1}>
                {g.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <Text variant="caption" tone="error" testID="goal-error">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  option: {
    flex: 1,
    minHeight: layout.buttonHeight.lg + spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.lg,
    borderWidth: borders.width,
  },
  xp: { fontSize: 20, lineHeight: 26 },
  spinner: { height: 26 },
  dim: { opacity: 0.55 },
});
