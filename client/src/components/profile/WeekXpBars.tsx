import { Platform, StyleSheet, View } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';

import { colors, fontFamilies, palette } from '@/theme/tokens';

export type WeekXpBarsProps = {
  /** Seven days, oldest first, ending today (as returned by GET /api/stats). */
  days: { date: string; xp: number }[];
  /** Daily XP goal, drawn as the dashed "setpoint" line. */
  goal: number;
  testID?: string;
};

const W = 336;
const H = 176;
const TOP = 30;
const BASE = 140;
const COL = W / 7;
const BAR = 30;
const EDGE = 4;
const STUB = 6;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Mon" for a YYYY-MM-DD date (calendar date, so no time-zone shift). */
export function weekdayLabel(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? '' : WEEKDAYS[d.getUTCDay()];
}

/**
 * Last-7-days XP as chunky bars with the same solid bottom edge as the cards.
 * Days that hit the goal are solid Loop Violet; the rest are tinted. The goal
 * is a dashed setpoint line, echoing the step-response motif.
 */
export function WeekXpBars({ days, goal, testID = 'week-xp-bars' }: WeekXpBarsProps) {
  const max = Math.max(goal, ...days.map((d) => d.xp), 1) * 1.1;
  const y = (v: number) => BASE - (v / max) * (BASE - TOP);
  const goalY = y(goal);
  const total = days.reduce((s, d) => s + d.xp, 0);
  const lastIndex = days.length - 1;

  return (
    <View
      style={styles.frame}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`XP over the last 7 days: ${days.map((d) => `${weekdayLabel(d.date)} ${d.xp}`).join(', ')}. ${total} XP total.`}
      testID={testID}
    >
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} pointerEvents={Platform.OS === 'web' ? 'none' : undefined}>
        <Line x1={2} x2={W - 2} y1={BASE} y2={BASE} stroke={colors.ink[200]} strokeWidth={2} strokeLinecap="round" />
        {goal > 0 ? (
          <G>
            <Line x1={2} x2={W - 2} y1={goalY} y2={goalY} stroke={colors.ink[300]} strokeWidth={2} strokeDasharray="6 5" strokeLinecap="round" />
            <SvgText x={W - 2} y={goalY - 6} fontSize={10} fontFamily={fontFamilies.extraBold} fill={colors.ink[500]} textAnchor="end">
              {`GOAL ${goal}`}
            </SvgText>
          </G>
        ) : null}
        {days.map((d, i) => {
          const x = i * COL + (COL - BAR) / 2;
          const cx = i * COL + COL / 2;
          const isToday = i === lastIndex;
          const met = goal > 0 && d.xp >= goal;
          const dayLabel = (
            <SvgText
              x={cx}
              y={BASE + 24}
              fontSize={12}
              fontFamily={fontFamilies.extraBold}
              fill={isToday ? palette.primary.base : colors.textSubtle}
              textAnchor="middle"
            >
              {isToday ? 'Today' : weekdayLabel(d.date)}
            </SvgText>
          );
          if (d.xp <= 0) {
            return (
              <G key={d.date}>
                <Rect testID="week-xp-bar" x={x} y={BASE - STUB} width={BAR} height={STUB} rx={3} fill={colors.ink[200]} />
                {dayLabel}
              </G>
            );
          }
          const top = Math.min(y(d.xp), BASE - EDGE * 3);
          const face = met ? palette.primary.base : palette.primary.tint;
          const edge = met ? palette.primary.shade : palette.primary.base;
          const inset = met ? 0 : 2;
          return (
            <G key={d.date}>
              {/* The solid edge sits behind the face and shows 4px at the bottom, like a card. */}
              <Rect x={x} y={top} width={BAR} height={BASE - top} rx={8} fill={edge} />
              <Rect
                testID="week-xp-bar"
                x={x + inset}
                y={top + inset}
                width={BAR - inset * 2}
                height={BASE - top - EDGE - inset}
                rx={8 - inset}
                fill={face}
              />
              <SvgText
                x={cx}
                y={top - 7}
                fontSize={12}
                fontFamily={fontFamilies.monoBold}
                fill={met ? palette.primary.shade : colors.textMuted}
                textAnchor="middle"
              >
                {String(d.xp)}
              </SvgText>
              {dayLabel}
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', aspectRatio: W / H },
});
