import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { borders, button3d, colors, layout, radii, spacing, typeScale } from '@/theme/tokens';

import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'md' | 'lg';

export type ButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretch to the parent's width (default true: chunky full-width CTAs). */
  fullWidth?: boolean;
  loading?: boolean;
  /** Optional leading glyph. */
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

type VariantStyle = { face: string; edge: string; pressedFace: string; label: string; border?: string };

const variants: Record<Exclude<ButtonVariant, 'ghost'>, VariantStyle> = {
  primary: { face: colors.primary.base, edge: colors.primary.shade, pressedFace: colors.primary.base, label: colors.primary.on },
  danger: { face: colors.error.base, edge: colors.error.shade, pressedFace: colors.error.base, label: colors.error.on },
  success: { face: colors.success.base, edge: colors.success.shade, pressedFace: colors.success.base, label: colors.success.on },
  secondary: {
    face: colors.surface,
    edge: colors.border,
    pressedFace: colors.ink[50],
    label: colors.primary.base,
    border: colors.border,
  },
};

/**
 * Loopy's chunky 3D button. Pressing collapses the bottom edge and drops the face,
 * so it "clicks" down (see design-system.md "Shape language").
 */
export function Button({
  label,
  variant = 'primary',
  size = 'lg',
  fullWidth = true,
  loading = false,
  disabled,
  icon,
  style,
  ...rest
}: ButtonProps) {
  const isDisabled = !!disabled || loading;
  const height = layout.buttonHeight[size];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      {...rest}
      style={({ pressed }) => {
        const down = pressed && !isDisabled;
        let look: ViewStyle;
        if (variant === 'ghost') {
          look = {
            backgroundColor: down ? colors.primary.tint : 'transparent',
            borderRadius: radii.lg,
            marginTop: borders.edge,
          };
        } else if (isDisabled) {
          look = { ...button3d(colors.disabled.base, colors.disabled.shade, false), borderWidth: 0, borderBottomWidth: borders.edge };
        } else {
          const v = variants[variant];
          look = {
            ...button3d(down ? v.pressedFace : v.face, v.edge, down),
            ...(v.border ? { borderWidth: borders.width, borderColor: v.border, borderBottomWidth: down ? borders.width : borders.edge } : null),
            ...(v.border && down ? { marginTop: borders.edge - borders.width } : null),
          };
        }
        return [styles.base, { minHeight: height }, fullWidth ? styles.full : styles.inline, look, style];
      }}
    >
      {({ pressed }) => {
        const labelColor = isDisabled
          ? colors.disabled.text
          : variant === 'ghost'
            ? pressed
              ? colors.primary.shade
              : colors.primary.base
            : variants[variant].label;
        return (
          <View style={styles.content}>
            {loading ? <ActivityIndicator size="small" color={labelColor} /> : icon}
            <Text style={[typeScale.button, { color: labelColor }, size === 'md' && styles.labelMd]} numberOfLines={1}>
              {label}
            </Text>
          </View>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  full: { alignSelf: 'stretch' },
  inline: { alignSelf: 'flex-start' },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  labelMd: { fontSize: 15 },
});
