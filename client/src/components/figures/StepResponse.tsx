import { useMemo } from 'react';
import { Circle, Line, Path } from 'react-native-svg';

import { CartesianChrome, DASH, FIG_COLORS, FigureFrame, PLOT, TickText, type Tick } from './chrome';
import { fmt, linear, niceDomain, pathFrom } from './scale';
import type { StepResponseFigure } from './types';

export type StepResponseProps = Omit<StepResponseFigure, 'type'> & { testID?: string };

export function describeStepResponse({ points, finalValue, xLabel, yLabel }: Omit<StepResponseFigure, 'type'>): string {
  const pts = points.filter(([t, y]) => Number.isFinite(t) && Number.isFinite(y));
  const what = `Step response plot of ${yLabel ?? 'y(t)'} against ${xLabel ?? 'time t (s)'}`;
  if (pts.length === 0) return `${what}, with no data.`;
  const t0 = pts[0][0];
  const t1 = pts[pts.length - 1][0];
  let peak = pts[0];
  for (const p of pts) if (p[1] > peak[1]) peak = p;
  const parts = [
    pts.length === 1 ? `${what}: a single point at t ${fmt(t0)}, y ${fmt(pts[0][1])}` : `${what} from t ${fmt(t0)} to ${fmt(t1)}`,
    pts.length > 1 ? `peak ${fmt(peak[1])} at t ${fmt(peak[0])}` : undefined,
    pts.length > 1 ? `ends at ${fmt(pts[pts.length - 1][1])}` : undefined,
    finalValue !== undefined ? `final value ${fmt(finalValue)} shown dashed` : undefined,
  ];
  return parts.filter(Boolean).join(', ') + '.';
}

export function StepResponse({ points, finalValue, xLabel, yLabel, testID }: StepResponseProps) {
  const model = useMemo(() => {
    const pts = points.filter(([t, y]) => Number.isFinite(t) && Number.isFinite(y));
    const ts = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    if (finalValue !== undefined && Number.isFinite(finalValue)) ys.push(finalValue);

    // Time axis: start at 0 when data starts there or later (step responses are causal).
    const tMin = ts.length ? Math.min(0, ...ts) : 0;
    const tMax = ts.length ? Math.max(...ts) : 1;
    const xd = niceDomain(tMin, tMax, 5);
    // Amplitude axis: always include 0 so overshoot is read against the baseline.
    const yd = niceDomain(Math.min(0, ...ys), ys.length ? Math.max(0, ...ys) : 1, 4);

    const sx = linear(xd.lo, xd.hi, PLOT.left, PLOT.right);
    const sy = linear(yd.lo, yd.hi, PLOT.bottom, PLOT.top);

    const xTicks: Tick[] = xd.ticks.map((v) => ({ px: sx(v), label: fmt(v) }));
    const yTicks: Tick[] = yd.ticks.map((v) => ({ px: sy(v), label: fmt(v) }));
    const projected = pts.map(([t, y]) => [sx(t), sy(y)] as [number, number]);

    return { xTicks, yTicks, projected, d: pathFrom(projected), fvY: finalValue !== undefined ? sy(finalValue) : undefined };
  }, [points, finalValue]);

  const label = describeStepResponse({ points, finalValue, xLabel, yLabel });
  const last = model.projected[model.projected.length - 1];

  return (
    <FigureFrame accessibilityLabel={label} testID={testID ?? 'figure-step-response'}>
      <CartesianChrome xTicks={model.xTicks} yTicks={model.yTicks} xTitle={xLabel ?? 't (s)'} yTitle={yLabel ?? 'y(t)'} />
      {model.fvY !== undefined && finalValue !== undefined && (
        <>
          <Line
            testID="final-value-line"
            x1={PLOT.left}
            x2={PLOT.right}
            y1={model.fvY}
            y2={model.fvY}
            stroke={FIG_COLORS.dashed}
            strokeWidth={2}
            strokeDasharray={DASH}
            strokeLinecap="round"
          />
          {/* Label on the left: a step response starts at 0, so the setpoint line is clear there. */}
          <TickText x={PLOT.left + 6} y={model.fvY - 6} anchor="start" fill={FIG_COLORS.title}>
            {`y∞ = ${fmt(finalValue)}`}
          </TickText>
        </>
      )}
      {model.projected.length > 1 && (
        <>
          {/* Solid offset edge under the trace: the card/button 3D motif, quietly. */}
          <Path d={model.d} transform="translate(0 2)" stroke={FIG_COLORS.traceEdge} strokeOpacity={0.25} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Path testID="step-path" d={model.d} stroke={FIG_COLORS.trace} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {last && (
        <Circle
          testID={model.projected.length === 1 ? 'step-point' : 'step-end'}
          cx={last[0]}
          cy={last[1]}
          r={4.5}
          fill={FIG_COLORS.trace}
          stroke={FIG_COLORS.surface}
          strokeWidth={2}
        />
      )}
    </FigureFrame>
  );
}
