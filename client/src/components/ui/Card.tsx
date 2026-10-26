import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { borders, colors, palette, radii, spacing, type Tone } from '@/theme/tokens';

export type CardProps = {
  children: ReactNode;
  /** Colored card (tint face, tone border). Omit for a neutral surface card. */
  tone?: Tone;
  /** Makes the card pressable with the same click-down edge as Button. */
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  padding?: keyof typeof spacing;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

function look(tone: Tone | undefined, down: boolean): ViewStyle {
  const face = tone ? palette[tone].tint : colors.surface;
  const edge = tone ? palette[tone].base : colors.border;
  return {
    backgroundColor: face,
    borderColor: edge,
    borderWidth: borders.width,
    borderBottomWidth: down ? borders.width : borders.edge,
    marginTop: down ? borders.edge - borders.width : 0,
  };
}

/** Surface container: 2px border plus a 4px solid bottom edge. No blur shadows. */
export function Card({ children, tone, onPress, disabled, accessibilityLabel, padding = 'lg', style, testID }: CardProps) {
  const pad = { padding: spacing[padding] };
  if (!onPress) {
    return (
      <View testID={testID} style={[styles.base, look(tone, false), pad, style]}>
        {children}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [styles.base, look(tone, pressed && !disabled), pad, disabled && styles.disabled, style]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.xl,
  },
  disabled: { opacity: 0.55 },
});
