import type { ReactElement, ReactNode } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { BoltGlyph, CrownGlyph, FlameGlyph, LoopBackGlyph, MedalGlyph, type GlyphProps } from '@/components/ui';
import { palette, type ToneSwatch } from '@/theme/tokens';

/*
 * Badge glyphs for achievement icons the shared set doesn't cover. Same rules as
 * components/ui/icons.tsx: 24-unit grid, filled bodies, 2px shade outline.
 */

type Glyph = (props: GlyphProps) => ReactElement;

function Frame({ size = 20, children }: { size?: GlyphProps['size']; children: ReactNode }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      {children}
    </Svg>
  );
}

const FootstepsGlyph: Glyph = ({ size, tone = palette.success }) => (
  <Frame size={size}>
    <Path d="M7.5 3c2 0 3 2.2 3 5s-1 4.5-3 4.5-3-1.7-3-4.5S5.5 3 7.5 3z" fill={tone.base} stroke={tone.shade} strokeWidth={2} />
    <Circle cx={7.5} cy={16} r={2} fill={tone.base} stroke={tone.shade} strokeWidth={2} />
    <Path d="M16.5 7.5c2 0 3 2.2 3 5s-1 4.5-3 4.5-3-1.7-3-4.5 1-5 3-5z" fill={tone.base} stroke={tone.shade} strokeWidth={2} />
    <Circle cx={16.5} cy={20.5} r={1.8} fill={tone.base} stroke={tone.shade} strokeWidth={2} />
  </Frame>
);

const StarGlyph: Glyph = ({ size, tone = palette.xp }) => (
  <Frame size={size}>
    <Path
      d="m12 2.8 2.8 5.8 6.3.8-4.6 4.4 1.2 6.3L12 17l-5.7 3.1 1.2-6.3-4.6-4.4 6.3-.8z"
      fill={tone.base}
      stroke={tone.shade}
      strokeWidth={2}
      strokeLinejoin="round"
    />
  </Frame>
);

const TargetGlyph: Glyph = ({ size, tone = palette.accent }) => (
  <Frame size={size}>
    <Circle cx={12} cy={12} r={9.5} fill={tone.base} stroke={tone.shade} strokeWidth={2} />
    <Circle cx={12} cy={12} r={5.5} fill={tone.on} />
    <Circle cx={12} cy={12} r={2.5} fill={tone.base} />
  </Frame>
);

const TrendGlyph: Glyph = ({ size, tone = palette.primary }) => (
  <Frame size={size}>
    <Rect x={2.5} y={2.5} width={19} height={19} rx={5} fill={tone.base} stroke={tone.shade} strokeWidth={2} />
    <Path d="m6 16 4-4 3 2.5 5-6" fill="none" stroke={tone.on} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M14.5 8.5H18V12" fill="none" stroke={tone.on} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
  </Frame>
);

const RocketGlyph: Glyph = ({ size, tone = palette.primary }) => (
  <Frame size={size}>
    <Path d="M12 2.5c3.5 2.6 4.8 6.4 4 11.5H8c-.8-5.1.5-8.9 4-11.5z" fill={tone.base} stroke={tone.shade} strokeWidth={2} strokeLinejoin="round" />
    <Path d="M8 11.5 5 15v3.5l3.5-2M16 11.5l3 3.5v3.5l-3.5-2" fill={tone.base} stroke={tone.shade} strokeWidth={2} strokeLinejoin="round" />
    <Circle cx={12} cy={8.5} r={1.8} fill={tone.on} />
    <Path d="M10.5 17.5 12 21.5l1.5-4z" fill={palette.streak.base} stroke={palette.streak.shade} strokeWidth={1.5} strokeLinejoin="round" />
  </Frame>
);

const ShieldGlyph: Glyph = ({ size, tone = palette.secondary }) => (
  <Frame size={size}>
    <Path d="M12 2.5 20 5.5v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6z" fill={tone.base} stroke={tone.shade} strokeWidth={2} strokeLinejoin="round" />
    <Path d="m8.5 12 2.5 2.5 4.5-5" fill="none" stroke={tone.on} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
  </Frame>
);

/** Bode magnitude: flat, then a -20 dB/dec roll-off. */
const BodeGlyph: Glyph = ({ size, tone = palette.secondary }) => (
  <Frame size={size}>
    <Rect x={2.5} y={2.5} width={19} height={19} rx={5} fill={tone.base} stroke={tone.shade} strokeWidth={2} />
    <Path d="M5.5 8.5h6c2 0 3 1.5 4 4l3 5.5" fill="none" stroke={tone.on} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
  </Frame>
);

/** State matrix: a 2x2 grid of cells. */
const GridGlyph: Glyph = ({ size, tone = palette.primary }) => (
  <Frame size={size}>
    <Rect x={3} y={3} width={8} height={8} rx={2.5} fill={tone.base} stroke={tone.shade} strokeWidth={2} />
    <Rect x={13} y={3} width={8} height={8} rx={2.5} fill={tone.base} stroke={tone.shade} strokeWidth={2} />
    <Rect x={3} y={13} width={8} height={8} rx={2.5} fill={tone.base} stroke={tone.shade} strokeWidth={2} />
    <Rect x={13} y={13} width={8} height={8} rx={2.5} fill={tone.base} stroke={tone.shade} strokeWidth={2} />
  </Frame>
);

type BadgeArt = { Glyph: Glyph; tone: ToneSwatch };

/** Server icon key (see server/src/content/achievements.ts) to glyph + tone. */
const ART: Record<string, BadgeArt> = {
  footsteps: { Glyph: FootstepsGlyph, tone: palette.success },
  flame: { Glyph: FlameGlyph, tone: palette.streak },
  star: { Glyph: StarGlyph, tone: palette.xp },
  bolt: { Glyph: BoltGlyph, tone: palette.xp },
  target: { Glyph: TargetGlyph, tone: palette.accent },
  'trending-up': { Glyph: TrendGlyph, tone: palette.primary },
  rocket: { Glyph: RocketGlyph, tone: palette.primary },
  shield: { Glyph: ShieldGlyph, tone: palette.secondary },
  chart: { Glyph: BodeGlyph, tone: palette.secondary },
  grid: { Glyph: GridGlyph, tone: palette.primary },
  bandage: { Glyph: LoopBackGlyph, tone: palette.accent },
  crown: { Glyph: CrownGlyph, tone: palette.xp },
};

const FALLBACK: BadgeArt = { Glyph: MedalGlyph, tone: palette.accent };

export function badgeArt(icon: string): BadgeArt {
  return ART[icon] ?? FALLBACK;
}

