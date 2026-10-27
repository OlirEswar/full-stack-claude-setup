import Svg, { Circle, Path } from 'react-native-svg';

import { ink, palette, type ToneSwatch } from '@/theme/tokens';

/** Neutral swatch for locked/inactive glyphs. */
export const lockedTone: ToneSwatch = { base: ink[300], shade: ink[400], tint: ink[100], on: ink[0] };

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

export function LockGlyph({ size = 20, tone = lockedTone }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      <Path d="M7.5 10.5V8a4.5 4.5 0 0 1 9 0v2.5" fill="none" stroke={tone.shade} strokeWidth={2.6} strokeLinecap="round" />
      <Path
        d="M5.5 11.5A1.5 1.5 0 0 1 7 10h10a1.5 1.5 0 0 1 1.5 1.5V19a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2z"
        fill={tone.base}
        stroke={tone.shade}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path d="M12 14.5V17" stroke={tone.shade} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

export function CrownGlyph({ size = 20, tone = palette.xp }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      <Path d="M3.5 8.5 8 12l4-6.5 4 6.5 4.5-3.5-1.6 10H5.1z" fill={tone.base} stroke={tone.shade} strokeWidth={2} strokeLinejoin="round" />
      <Circle cx={12} cy={14.5} r={1.6} fill="#FFFFFF" fillOpacity={0.8} />
    </Svg>
  );
}

/** Mini step response (the signature motif): face of an open skill node and the Learn tab icon. */
export function TraceGlyph({ size = 20, color = ink[0] }: { size?: GlyphProps['size']; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      <Path d="M3 9.5h18" stroke={color} strokeOpacity={0.5} strokeWidth={2} strokeDasharray="2 3" strokeLinecap="round" />
      <Path
        d="M3 20c2.2 0 3.2-14 6-14s2.6 6.4 4.8 6.4S16 8 18 8.8s2 .7 3 .7"
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Circular arrow: "close the loop" on past mistakes. */
export function LoopBackGlyph({ size = 20, tone = palette.accent }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      <Circle cx={12} cy={12} r={10} fill={tone.base} stroke={tone.shade} strokeWidth={2} />
      <Path d="M16.4 10A4.8 4.8 0 1 0 16.6 14" fill="none" stroke={tone.on} strokeWidth={2.4} strokeLinecap="round" />
      <Path d="M17 6.8v3.6h-3.6" fill="none" stroke={tone.on} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function TrophyGlyph({ size = 20, tone = palette.xp }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      <Path d="M7 6H4.5v1.5A3.5 3.5 0 0 0 8 11M17 6h2.5v1.5A3.5 3.5 0 0 1 16 11" fill="none" stroke={tone.shade} strokeWidth={2} />
      <Path d="M6.5 3.5h11V8a5.5 5.5 0 0 1-11 0z" fill={tone.base} stroke={tone.shade} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M12 13.5V17M8 20.5h8l-1-3.5H9z" fill={tone.base} stroke={tone.shade} strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  );
}

export function MedalGlyph({ size = 20, tone = palette.accent }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      <Path d="M8 2.5 6 8.5l3.5 2M16 2.5l2 6-3.5 2" fill="none" stroke={tone.shade} strokeWidth={2.4} strokeLinejoin="round" />
      <Circle cx={12} cy={15} r={6.5} fill={tone.base} stroke={tone.shade} strokeWidth={2} />
      <Path d="m12 11.6 1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.3z" fill={tone.on} />
    </Svg>
  );
}

export function ProfileGlyph({ size = 20, tone = palette.secondary }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      <Circle cx={12} cy={8.5} r={4.5} fill={tone.base} stroke={tone.shade} strokeWidth={2} />
      <Path d="M3.5 21a8.5 7 0 0 1 17 0z" fill={tone.base} stroke={tone.shade} strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  );
}
