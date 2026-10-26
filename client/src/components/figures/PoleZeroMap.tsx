import { useMemo } from 'react';
import { Circle, G, Line } from 'react-native-svg';

import { CartesianChrome, FIG_COLORS, FigureFrame, PLOT, TickText, TitleText, type Tick } from './chrome';
import { fmt, fmtComplex, niceStep } from './scale';
import type { Complex, PoleZeroFigure } from './types';

export type PoleZeroMapProps = Omit<PoleZeroFigure, 'type'> & { testID?: string };

type Site = { re: number; im: number; count: number };

const TOL = 1e-6;

/** Collapse repeated roots into one site with a multiplicity count. */
export function groupRoots(roots: Complex[]): Site[] {
  const sites: Site[] = [];
  for (const r of roots) {
    if (!Number.isFinite(r.re) || !Number.isFinite(r.im)) continue;
    const scale = Math.max(1, Math.hypot(r.re, r.im));
    const hit = sites.find((s) => Math.abs(s.re - r.re) <= TOL * scale && Math.abs(s.im - r.im) <= TOL * scale);
    if (hit) hit.count += 1;
    else sites.push({ re: r.re, im: r.im, count: 1 });
  }
  return sites;
}

const MULT_WORD: Record<number, string> = { 2: 'double', 3: 'triple', 4: 'quadruple' };
const multWord = (n: number) => MULT_WORD[n] ?? `multiplicity ${n}`;

/** "−1 ± 2j, −3 (double)" with conjugate pairs folded together. */
function describeSites(sites: Site[]): string {
  const out: string[] = [];
  const used = new Set<Site>();
  for (const s of sites) {
    if (used.has(s)) continue;
    used.add(s);
    let text = fmtComplex(s.re, s.im);
    if (Math.abs(s.im) > TOL) {
      const conj = sites.find(
        (o) => !used.has(o) && o.count === s.count && Math.abs(o.re - s.re) <= TOL && Math.abs(o.im + s.im) <= TOL,
      );
      if (conj) {
        used.add(conj);
        text = Math.abs(s.re) < TOL ? `±${fmt(Math.abs(s.im))}j` : `${fmt(s.re)} ± ${fmt(Math.abs(s.im))}j`;
      }
    }
    out.push(s.count > 1 ? `${text} (${multWord(s.count)})` : text);
  }
  return out.join(', ');
}

export function describePoleZero({ poles, zeros }: Omit<PoleZeroFigure, 'type'>): string {
  const p = groupRoots(poles);
  const z = groupRoots(zeros);
  const poleText = p.length ? `poles at ${describeSites(p)}` : 'no poles';
  const zeroText = z.length ? `zeros at ${describeSites(z)}` : 'no zeros';
  return `Pole-zero map in the s-plane: ${poleText}; ${zeroText}.`;
}

export function PoleZeroMap({ poles, zeros, testID }: PoleZeroMapProps) {
  const model = useMemo(() => {
    const poleSites = groupRoots(poles);
    const zeroSites = groupRoots(zeros);
    const all = [...poleSites, ...zeroSites];

    // Always include the origin so both axes are on screen, even if every root is on one side.
    const res = [0, ...all.map((s) => s.re)];
    const ims = all.map((s) => Math.abs(s.im));
    let xLo = Math.min(...res);
    let xHi = Math.max(...res);
    const yMax = ims.length ? Math.max(...ims) : 0;
    let size = Math.max(xHi - xLo, 2 * yMax);
    if (size < 1e-9) size = 2; // everything at the origin
    const pad = 0.22 * size;
    xLo -= pad;
    xHi += pad;
    let yLo = -yMax - pad;
    let yHi = yMax + pad;

    // Equal units on both axes, so angles (damping) read true; grow the short side to fill the box.
    const w = PLOT.right - PLOT.left;
    const h = PLOT.bottom - PLOT.top;
    const k = Math.min(w / (xHi - xLo), h / (yHi - yLo));
    const xc = (xLo + xHi) / 2;
    const yc = (yLo + yHi) / 2;
    xLo = xc - w / k / 2;
    xHi = xc + w / k / 2;
    yLo = yc - h / k / 2;
    yHi = yc + h / k / 2;

    const sx = (v: number) => PLOT.left + (v - xLo) * k;
    const sy = (v: number) => PLOT.bottom - (v - yLo) * k;

    const step = niceStep(xHi - xLo, 6);
    const ticksIn = (lo: number, hi: number) => {
      const out: number[] = [];
      for (let i = Math.ceil(lo / step - 1e-9); i * step <= hi + 1e-9; i++) out.push(Number((i * step).toPrecision(12)));
      return out;
    };
    // Keep tick labels clear of the frame corners.
    const edge = 10 / k;
    const xTicks: Tick[] = ticksIn(xLo, xHi).map((v) => ({ px: sx(v), label: v > xLo + edge && v < xHi - edge ? fmt(v) : undefined }));
    const yTicks: Tick[] = ticksIn(yLo, yHi).map((v) => ({ px: sy(v), label: v > yLo + edge / 2 && v < yHi - edge / 2 ? fmt(v) : undefined }));

    return {
      xTicks,
      yTicks,
      ox: sx(0),
      oy: sy(0),
      poles: poleSites.map((s) => ({ ...s, x: sx(s.re), y: sy(s.im) })),
      zeros: zeroSites.map((s) => ({ ...s, x: sx(s.re), y: sy(s.im) })),
    };
  }, [poles, zeros]);

  const X = 6.5;
  const R = 6.5;

  return (
    <FigureFrame accessibilityLabel={describePoleZero({ poles, zeros })} testID={testID ?? 'figure-pole-zero'}>
      <CartesianChrome xTicks={model.xTicks} yTicks={model.yTicks} />
      {/* s-plane axes through the origin */}
      <Line x1={PLOT.left} x2={PLOT.right} y1={model.oy} y2={model.oy} stroke={FIG_COLORS.title} strokeWidth={1.5} />
      <Line x1={model.ox} x2={model.ox} y1={PLOT.top} y2={PLOT.bottom} stroke={FIG_COLORS.title} strokeWidth={1.5} />
      <TitleText x={PLOT.right - 3} y={model.oy - 6} anchor="end">
        {'σ'}
      </TitleText>
      <TitleText x={model.ox + 6} y={PLOT.top + 13} anchor="start">
        {'jω'}
      </TitleText>

      {model.zeros.map((z, i) => (
        <G key={`z${i}`} testID="zero-marker">
          <Circle cx={z.x} cy={z.y} r={R} fill={FIG_COLORS.surface} stroke={FIG_COLORS.reference} strokeWidth={3} />
          {z.count > 1 && <Multiplicity x={z.x} y={z.y} n={z.count} color={FIG_COLORS.reference} testID="zero-multiplicity" />}
        </G>
      ))}
      {model.poles.map((p, i) => (
        <G key={`p${i}`} testID="pole-marker">
          {/* halo so the × stays crisp over grid/axis lines */}
          <Circle cx={p.x} cy={p.y} r={X + 2} fill={FIG_COLORS.surface} opacity={0.85} />
          <Line x1={p.x - X} y1={p.y - X} x2={p.x + X} y2={p.y + X} stroke={FIG_COLORS.trace} strokeWidth={3} strokeLinecap="round" />
          <Line x1={p.x - X} y1={p.y + X} x2={p.x + X} y2={p.y - X} stroke={FIG_COLORS.trace} strokeWidth={3} strokeLinecap="round" />
          {p.count > 1 && <Multiplicity x={p.x} y={p.y} n={p.count} color={FIG_COLORS.trace} testID="pole-multiplicity" />}
        </G>
      ))}
    </FigureFrame>
  );
}

function Multiplicity({ x, y, n, color, testID }: { x: number; y: number; n: number; color: string; testID: string }) {
  // Flip the badge to the left of markers near the right edge so it stays in frame.
  const left = x > PLOT.right - 24;
  return (
    <TickText x={left ? x - 10 : x + 10} y={y - 8} anchor={left ? 'end' : 'start'} fill={color} testID={testID}>
      {`(${n})`}
    </TickText>
  );
}
