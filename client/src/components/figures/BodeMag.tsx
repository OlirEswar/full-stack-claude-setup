import { useMemo } from 'react';
import { Circle, Line, Path } from 'react-native-svg';

import { CartesianChrome, DASH, FIG_COLORS, FigureFrame, PLOT, type Tick } from './chrome';
import { decadeLabel, fmt, linear, niceDomain, pathFrom } from './scale';
import type { BodeMagFigure } from './types';

export type BodeMagProps = Omit<BodeMagFigure, 'type'> & { testID?: string };

const valid = (pts: [number, number][]) => pts.filter(([w, db]) => w > 0 && Number.isFinite(w) && Number.isFinite(db));

export function describeBodeMag({ points, asymptotes }: Omit<BodeMagFigure, 'type'>): string {
  const pts = valid(points);
  if (pts.length === 0) return 'Bode magnitude plot with no data.';
  const ws = pts.map((p) => p[0]);
  const dbs = pts.map((p) => p[1]);
  const first = pts[0];
  const last = pts[pts.length - 1];
  const parts = [
    `Bode magnitude plot, gain in dB against log frequency from ${fmt(Math.min(...ws))} to ${fmt(Math.max(...ws))} rad/s`,
    `gain ranges from ${fmt(Math.min(...dbs), 1)} to ${fmt(Math.max(...dbs), 1)} dB`,
    pts.length > 1 ? `starting at ${fmt(first[1], 1)} dB and ending at ${fmt(last[1], 1)} dB` : undefined,
    asymptotes && valid(asymptotes).length > 1 ? 'straight-line asymptotes shown dashed' : undefined,
  ];
  return parts.filter(Boolean).join(', ') + '.';
}

/**
 * Clip a polyline given in (log10 ω, dB) to the visible decade band by interpolation,
 * so straight-line asymptotes that extend past the data never spill out of the plot.
 */
export function clipToBand(pts: [number, number][], lo: number, hi: number): [number, number][] {
  const out: [number, number][] = [];
  const at = (a: [number, number], b: [number, number], x: number): [number, number] => [
    x,
    a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0] || 1),
  ];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const prev = pts[i - 1];
    if (prev) {
      // Band-edge crossings on the segment prev→p, in travel order.
      const edges = prev[0] <= p[0] ? [lo, hi] : [hi, lo];
      for (const e of edges) if ((prev[0] - e) * (p[0] - e) < 0) out.push(at(prev, p, e));
    }
    if (p[0] >= lo && p[0] <= hi) out.push(p);
  }
  return out;
}

export function BodeMag({ points, asymptotes, testID }: BodeMagProps) {
  const model = useMemo(() => {
    const pts = valid(points);
    const asy = asymptotes ? valid(asymptotes) : [];
    const ws = pts.length ? pts.map((p) => p[0]) : [0.1, 10];

    let kLo = Math.floor(Math.log10(Math.min(...ws)) + 1e-9);
    let kHi = Math.ceil(Math.log10(Math.max(...ws)) - 1e-9);
    if (kHi <= kLo) {
      kLo -= 1;
      kHi += 1;
    }
    const sx = linear(kLo, kHi, PLOT.left, PLOT.right);
    const lx = (w: number) => sx(Math.log10(w));

    // Only the part of the asymptotes inside the visible band counts toward the dB range.
    const asyLog = clipToBand(
      asy.map(([w, db]) => [Math.log10(w), db] as [number, number]),
      kLo,
      kHi,
    );
    const dbs = [...pts.map((p) => p[1]), ...asyLog.map((p) => p[1])];
    const yd = niceDomain(dbs.length ? Math.min(...dbs) : -20, dbs.length ? Math.max(...dbs) : 20, 5);
    const sy = linear(yd.lo, yd.hi, PLOT.bottom, PLOT.top);

    const decades = kHi - kLo;
    const labelEvery = decades > 6 ? 2 : 1;
    const xTicks: Tick[] = [];
    for (let k = kLo; k <= kHi; k++) {
      xTicks.push({ px: sx(k), label: (k - kLo) % labelEvery === 0 ? decadeLabel(k) : undefined });
      if (k < kHi && decades <= 4) {
        for (let m = 2; m <= 9; m++) xTicks.push({ px: sx(k + Math.log10(m)), minor: true });
      }
    }
    const yTicks: Tick[] = yd.ticks.map((v) => ({ px: sy(v), label: fmt(v) }));

    const projected = pts.map(([w, db]) => [lx(w), sy(db)] as [number, number]);
    const asyD = asyLog.length > 1 ? pathFrom(asyLog.map(([k, db]) => [sx(k), sy(db)] as [number, number])) : undefined;
    const zeroDb = yd.lo < 0 && yd.hi > 0 ? sy(0) : undefined;

    return { xTicks, yTicks, projected, d: pathFrom(projected), asyD, zeroDb };
  }, [points, asymptotes]);

  return (
    <FigureFrame accessibilityLabel={describeBodeMag({ points, asymptotes })} testID={testID ?? 'figure-bode-mag'}>
      <CartesianChrome xTicks={model.xTicks} yTicks={model.yTicks} xTitle={'ω (rad/s)'} yTitle="|G(jω)| (dB)" />
      {model.zeroDb !== undefined && (
        <Line x1={PLOT.left} x2={PLOT.right} y1={model.zeroDb} y2={model.zeroDb} stroke={FIG_COLORS.axis} strokeWidth={1.25} />
      )}
      {model.projected.length > 1 && (
        <>
          <Path d={model.d} transform="translate(0 2)" stroke={FIG_COLORS.traceEdge} strokeOpacity={0.25} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Path testID="bode-path" d={model.d} stroke={FIG_COLORS.trace} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {model.asyD && (
        <Path
          testID="bode-asymptotes"
          d={model.asyD}
          stroke={FIG_COLORS.dashed}
          strokeWidth={2}
          strokeDasharray={DASH}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {model.projected.length === 1 && (
        <Circle testID="bode-point" cx={model.projected[0][0]} cy={model.projected[0][1]} r={4.5} fill={FIG_COLORS.trace} stroke={FIG_COLORS.surface} strokeWidth={2} />
      )}
    </FigureFrame>
  );
}
