/**
 * Loopy design tokens. Mirrors `.claude/state/design-system.md`.
 * Add tokens there first, then here. Don't hard-code colors/spacing in components.
 */
import type { TextStyle, ViewStyle } from 'react-native';

export type ToneSwatch = {
  /** Face color. */
  base: string;
  /** Darker edge used for the 3D bottom border. */
  shade: string;
  /** Light background tint. */
  tint: string;
  /** Text color readable on `base`. */
  on: string;
};

export const ink = {
  0: '#FFFFFF',
  50: '#F7F6FB',
  100: '#EFEDF6',
  200: '#E0DDEC',
  300: '#C7C2D9',
  400: '#9D97B4',
  500: '#76708F',
  600: '#5A5472',
  700: '#403B56',
  800: '#2A2640',
  900: '#1A1729',
} as const;

const swatch = (base: string, shade: string, tint: string, on: string = ink[0]): ToneSwatch => ({
  base,
  shade,
  tint,
  on,
});

export const palette = {
  /** Loop Violet: brand primary. */
  primary: swatch('#5B3DF5', '#3F24C9', '#ECE8FF'),
  /** Signal Teal. */
  secondary: swatch('#0FB5A4', '#0A8A7D', '#DDF7F3'),
  /** Setpoint Pink. */
  accent: swatch('#FF5FA2', '#D63F80', '#FFE6F1'),
  success: swatch('#25B864', '#1A8F4C', '#DFF7E9'),
  error: swatch('#EF4452', '#BF2734', '#FDE6E8'),
  warning: swatch('#F5A524', '#C98213', '#FFF3DA', ink[900]),
  streak: swatch('#FF8A1F', '#D96A06', '#FFEEDC'),
  xp: swatch('#FFC21A', '#D99E00', '#FFF6D6', ink[900]),
  heart: swatch('#FF4B6E', '#D62E52', '#FFE5EB'),
} as const;

export type Tone = keyof typeof palette;

export const colors = {
  ...palette,
  ink,
  background: ink[50],
  surface: ink[0],
  border: ink[200],
  borderStrong: ink[300],
  text: ink[900],
  textMuted: ink[600],
  textSubtle: ink[500],
  textOnColor: ink[0],
  disabled: { base: ink[200], shade: ink[300], text: ink[400] },
} as const;

export const fontFamilies = {
  body: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  extraBold: 'Nunito_800ExtraBold',
  black: 'Nunito_900Black',
  mono: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_700Bold',
} as const;

export const typeScale = {
  display: { fontFamily: fontFamilies.black, fontSize: 34, lineHeight: 40 },
  title: { fontFamily: fontFamilies.extraBold, fontSize: 26, lineHeight: 32 },
  heading: { fontFamily: fontFamilies.extraBold, fontSize: 20, lineHeight: 26 },
  body: { fontFamily: fontFamilies.body, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: fontFamilies.extraBold, fontSize: 16, lineHeight: 24 },
  caption: { fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 18 },
  label: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  button: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  mono: { fontFamily: fontFamilies.mono, fontSize: 15, lineHeight: 22 },
  monoStrong: { fontFamily: fontFamilies.monoBold, fontSize: 15, lineHeight: 22 },
} as const satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof typeScale;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  pill: 999,
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const borders = {
  /** Standard stroke weight for borders, dividers and icons. */
  width: 2,
  /** Height of the 3D bottom edge on pressables and cards. */
  edge: 4,
} as const;

export const layout = {
  maxContentWidth: 640,
  screenPadding: spacing.lg,
  minTouch: 44,
  buttonHeight: { md: 48, lg: 56 },
} as const;

/**
 * Elevation is expressed as solid offset edges, not blur.
 * `overlay` is the only blurred shadow, reserved for modals/sheets.
 */
export const elevation = {
  flat: { borderBottomWidth: borders.width } satisfies ViewStyle,
  raised: { borderBottomWidth: borders.edge } satisfies ViewStyle,
  overlay: {
    shadowColor: ink[900],
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  } satisfies ViewStyle,
} as const;

/**
 * The signature "3D" press button: a solid bottom edge in the tone's shade.
 * On press the edge collapses and the face drops by the same amount, so the
 * total footprint stays constant and surrounding layout doesn't jump.
 */
export function button3d(
  face: string,
  edge: string,
  pressed: boolean,
): Pick<ViewStyle, 'backgroundColor' | 'borderColor' | 'borderBottomWidth' | 'marginTop' | 'borderRadius'> {
  return {
    backgroundColor: face,
    borderColor: edge,
    borderBottomWidth: pressed ? 0 : borders.edge,
    marginTop: pressed ? borders.edge : 0,
    borderRadius: radii.lg,
  };
}

export const motion = {
  fast: 120,
  base: 300,
  slow: 600,
} as const;

export const tokens = {
  colors,
  palette,
  ink,
  fontFamilies,
  typeScale,
  radii,
  spacing,
  borders,
  layout,
  elevation,
  motion,
} as const;

export type Tokens = typeof tokens;
