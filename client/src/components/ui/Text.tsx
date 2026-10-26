import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { colors, typeScale, type TextVariant } from '@/theme/tokens';

export type TextTone = 'default' | 'muted' | 'subtle' | 'onColor' | 'primary' | 'success' | 'error' | 'warning';

export type TextProps = RNTextProps & {
  variant?: TextVariant;
  tone?: TextTone;
  align?: TextStyle['textAlign'];
};

const toneColor: Record<TextTone, string> = {
  default: colors.text,
  muted: colors.textMuted,
  subtle: colors.textSubtle,
  onColor: colors.textOnColor,
  primary: colors.primary.base,
  success: colors.success.shade,
  error: colors.error.shade,
  warning: colors.warning.shade,
};

const defaultTone: Partial<Record<TextVariant, TextTone>> = {
  caption: 'muted',
  label: 'muted',
};

const headingVariants: TextVariant[] = ['display', 'title', 'heading'];

/** Typed text primitive. Always use a variant instead of setting fontWeight/fontFamily ad hoc. */
export function Text({ variant = 'body', tone, align, style, ...rest }: TextProps) {
  const resolvedTone = tone ?? defaultTone[variant] ?? 'default';
  return (
    <RNText
      accessibilityRole={headingVariants.includes(variant) ? 'header' : undefined}
      {...rest}
      style={[typeScale[variant], { color: toneColor[resolvedTone] }, align ? { textAlign: align } : null, style]}
    />
  );
}
