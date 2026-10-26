import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';

import { borders, colors, fontFamilies, radii } from '@/theme/tokens';

/**
 * Shared frame + axis chrome for the figure renderers.
 *
 * Every figure draws into a fixed viewBox and the <Svg> stretches to the container
 * width (capped at FIGURE_MAX_WIDTH) with a fixed aspect ratio, so text and strokes
 * scale together and stay legible on a phone (~1:1 at 340px wide).
 */

export const VIEW_W = 340;
export const VIEW_H = 236;
export const FIGURE_MAX_WIDTH = 420;

export const MARGIN = { top: 26, right: 18, bottom: 40, left: 46 } as const;

export const PLOT = {
  left: MARGIN.left,
  right: VIEW_W - MARGIN.right,
  top: MARGIN.top,
  bottom: VIEW_H - MARGIN.bottom,
} as const;

/** Figure-specific type sizes, in viewBox units. */
export const FIG_TYPE = {
  tick: 11,
  title: 12,
  annotation: 11,
} as const;

/** Plot vocabulary from design-system.md: primary = response, teal = reference, dashed ink = setpoint/asymptote. */
export const FIG_COLORS = {
  trace: colors.primary.base,
  traceEdge: colors.primary.shade,
  reference: colors.secondary.base,
  dashed: colors.ink[400],
  axis: colors.ink[300],
  grid: colors.ink[100],
  tickLabel: colors.ink[500],
  title: colors.ink[600],
  surface: colors.surface,
} as const;

export const DASH = '6 5';

export type FigureFrameProps = {
  accessibilityLabel: string;
  testID?: string;
  children: ReactNode;
};

export function FigureFrame({ accessibilityLabel, testID, children }: FigureFrameProps) {
  return (
    <View
      style={styles.frame}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        pointerEvents={Platform.OS === 'web' ? 'none' : undefined}
      >
        {children}
      </Svg>
    </View>
  );
}

export type Tick = { px: number; label?: string; minor?: boolean };

export type CartesianChromeProps = {
  xTicks: Tick[];
  yTicks: Tick[];
  xTitle?: string;
  yTitle?: string;
};

/** Grid, L-shaped axes, tick labels and axis titles for x/y plots. */
export function CartesianChrome({ xTicks, yTicks, xTitle, yTitle }: CartesianChromeProps) {
  return (
    <G>
      <Rect x={PLOT.left} y={PLOT.top} width={PLOT.right - PLOT.left} height={PLOT.bottom - PLOT.top} fill={FIG_COLORS.surface} />
      {xTicks.map((t, i) => (
        <Line
          key={`gx${i}`}
          x1={t.px}
          x2={t.px}
          y1={PLOT.top}
          y2={PLOT.bottom}
          stroke={FIG_COLORS.grid}
          strokeWidth={t.minor ? 0.75 : 1.25}
        />
      ))}
      {yTicks.map((t, i) => (
        <Line
          key={`gy${i}`}
          x1={PLOT.left}
          x2={PLOT.right}
          y1={t.px}
          y2={t.px}
          stroke={FIG_COLORS.grid}
          strokeWidth={t.minor ? 0.75 : 1.25}
        />
      ))}
      {/* L axes */}
      <Line x1={PLOT.left} x2={PLOT.left} y1={PLOT.top} y2={PLOT.bottom} stroke={FIG_COLORS.axis} strokeWidth={borders.width} strokeLinecap="round" />
      <Line x1={PLOT.left} x2={PLOT.right} y1={PLOT.bottom} y2={PLOT.bottom} stroke={FIG_COLORS.axis} strokeWidth={borders.width} strokeLinecap="round" />
      {xTicks
        .filter((t) => t.label !== undefined)
        .map((t, i) => (
          <G key={`lx${i}`}>
            <Line x1={t.px} x2={t.px} y1={PLOT.bottom} y2={PLOT.bottom + 4} stroke={FIG_COLORS.axis} strokeWidth={borders.width} />
            <TickText x={t.px} y={PLOT.bottom + 16} anchor="middle">
              {t.label}
            </TickText>
          </G>
        ))}
      {yTicks
        .filter((t) => t.label !== undefined)
        .map((t, i) => (
          <G key={`ly${i}`}>
            <Line x1={PLOT.left - 4} x2={PLOT.left} y1={t.px} y2={t.px} stroke={FIG_COLORS.axis} strokeWidth={borders.width} />
            <TickText x={PLOT.left - 7} y={t.px + 4} anchor="end">
              {t.label}
            </TickText>
          </G>
        ))}
      {xTitle ? (
        <TitleText x={PLOT.right} y={VIEW_H - 6} anchor="end">
          {xTitle}
        </TitleText>
      ) : null}
      {yTitle ? (
        <TitleText x={PLOT.left - 7} y={PLOT.top - 11} anchor="start">
          {yTitle}
        </TitleText>
      ) : null}
    </G>
  );
}

type TextProps = { x: number; y: number; anchor: 'start' | 'middle' | 'end'; children?: ReactNode; fill?: string; testID?: string };

/** Numbers on axes: JetBrains Mono, per the design system. */
export function TickText({ x, y, anchor, children, fill = FIG_COLORS.tickLabel, testID }: TextProps) {
  return (
    <SvgText x={x} y={y} textAnchor={anchor} fontFamily={fontFamilies.mono} fontSize={FIG_TYPE.tick} fill={fill} testID={testID}>
      {children}
    </SvgText>
  );
}

/** Axis titles and annotations in words: Nunito. */
export function TitleText({ x, y, anchor, children, fill = FIG_COLORS.title, testID }: TextProps) {
  return (
    <SvgText x={x} y={y} textAnchor={anchor} fontFamily={fontFamilies.extraBold} fontSize={FIG_TYPE.title} fill={fill} testID={testID}>
      {children}
    </SvgText>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    maxWidth: FIGURE_MAX_WIDTH,
    aspectRatio: VIEW_W / VIEW_H,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: borders.width,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
});
