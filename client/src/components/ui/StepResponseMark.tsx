import { useEffect, useState } from 'react';
import { Animated, Easing, Platform } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { colors, motion, type ToneSwatch } from '@/theme/tokens';

/**
 * Loopy's signature motif: an underdamped step response that overshoots,
 * rings, and settles onto a dashed setpoint. See design-system.md.
 */

const W = 200;
const H = 100;
const X0 = 8;
const X1 = W - 8;
const Y_ZERO = 86; // y(t) = 0
const Y_ONE = 34; // y(t) = 1 (setpoint)

function buildResponse(zeta: number, wn: number, tEnd: number, samples = 80) {
  const wd = wn * Math.sqrt(1 - zeta * zeta);
  const phi = Math.acos(zeta);
  const pts: [number, number][] = [];
  for (let i = 0; i <= samples; i++) {
    const t = (i / samples) * tEnd;
    const y = 1 - (Math.exp(-zeta * wn * t) / Math.sqrt(1 - zeta * zeta)) * Math.sin(wd * t + phi);
    const x = X0 + (i / samples) * (X1 - X0);
    pts.push([x, Y_ZERO - y * (Y_ZERO - Y_ONE)]);
  }
  let length = 0;
  for (let i = 1; i < pts.length; i++) {
    length += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');
  return { d, length, end: pts[pts.length - 1] };
}

const RESPONSE = buildResponse(0.3, 1, 16);

const AnimatedPath = Animated.createAnimatedComponent(Path);

export type StepResponseMarkProps = {
  width?: number;
  tone?: ToneSwatch;
  /** Loop the trace drawing on (used by LoadingState). */
  animated?: boolean;
};

export function StepResponseMark({ width = 160, tone = colors.primary, animated = false }: StepResponseMarkProps) {
  const progress = useState(() => new Animated.Value(animated ? 0 : 1))[0];

  useEffect(() => {
    if (!animated) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: motion.slow * 2.5,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.delay(motion.base),
        Animated.timing(progress, { toValue: 0, duration: 0, useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animated, progress]);

  const dashOffset = progress.interpolate({ inputRange: [0, 1], outputRange: [RESPONSE.length, 0] });
  const height = (width * H) / W;

  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${W} ${H}`}
      accessibilityElementsHidden
      importantForAccessibility="no"
      // Keep the web SVG from swallowing pointer events on parents.
      pointerEvents={Platform.OS === 'web' ? 'none' : undefined}
    >
      {/* axes */}
      <Line x1={X0} y1={Y_ZERO} x2={X1} y2={Y_ZERO} stroke={colors.ink[200]} strokeWidth={2} strokeLinecap="round" />
      {/* setpoint */}
      <Line
        x1={X0}
        y1={Y_ONE}
        x2={X1}
        y2={Y_ONE}
        stroke={colors.ink[300]}
        strokeWidth={2}
        strokeDasharray="6 6"
        strokeLinecap="round"
      />
      {/* 3D edge under the trace, matching the button motif */}
      <Path d={RESPONSE.d} transform="translate(0 3)" stroke={tone.shade} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={animated ? 0 : 0.35} />
      <AnimatedPath
        d={RESPONSE.d}
        stroke={tone.base}
        strokeWidth={4}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={`${RESPONSE.length} ${RESPONSE.length}`}
        strokeDashoffset={dashOffset}
      />
      {!animated && <Circle cx={RESPONSE.end[0]} cy={RESPONSE.end[1]} r={5} fill={tone.base} stroke={colors.surface} strokeWidth={2} />}
    </Svg>
  );
}
