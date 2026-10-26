import Svg, { Circle, Path } from 'react-native-svg';

import { palette, type ToneSwatch } from '@/theme/tokens';

/**
 * Loopy glyphs: filled, chunky bodies with a 2px shade outline, on a 24-unit grid.
 * Sizes: 16 / 20 / 24 (see design-system.md "Icons").
 */
export type GlyphProps = {
  size?: 16 | 20 | 24 | 32 | 48;
  tone?: ToneSwatch;
};

export function FlameGlyph({ size = 20, tone = palette.streak }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      <Path
        d="M12.6 2.2c.6 3.3 5.9 5.6 5.9 11.3A6.5 6.5 0 0 1 5.5 13.6c0-2.9 1.5-4.9 3.2-6.1.1 2 1 3.3 2.2 3.8-.5-3.5.4-6.6 1.7-9.1z"
        fill={tone.base}
        stroke={tone.shade}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path d="M12 20.2a3 3 0 0 1-3-3c0-1.7 1.2-2.6 2-3.7.5 1.3 1.4 1.7 2.2 1.4.1.8.8 1.4.8 2.4a3 3 0 0 1-2 2.9z" fill="#FFE07A" />
    </Svg>
  );
}

export function HeartGlyph({ size = 20, tone = palette.heart }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      <Path
        d="M12 20.5s-7.6-4.6-9.2-9.3C1.7 8 3.8 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.4 0 5.5 3.5 4.4 6.7-1.6 4.7-9.2 9.3-9.2 9.3z"
        fill={tone.base}
        stroke={tone.shade}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path d="M6.5 8.2c.4-.9 1.2-1.4 2-1.4" stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function BoltGlyph({ size = 20, tone = palette.xp }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      <Path
        d="M13.8 2.5 4.5 13.4h6.3l-1.3 8.1 9.9-11.6h-6.5l.9-7.4z"
        fill={tone.base}
        stroke={tone.shade}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function AlertGlyph({ size = 24, tone = palette.error }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      <Circle cx={12} cy={12} r={9.5} fill={tone.base} stroke={tone.shade} strokeWidth={2} />
      <Path d="M12 7v6" stroke={tone.on} strokeWidth={2.6} strokeLinecap="round" />
      <Circle cx={12} cy={16.6} r={1.5} fill={tone.on} />
    </Svg>
  );
}
