/** Pure plotting helpers shared by the figure renderers (no React). */

export type Domain = { lo: number; hi: number; ticks: number[] };

export const MINUS = '−';

/** A 1/2/5 × 10^k step giving roughly `target` intervals over `span`. */
export function niceStep(span: number, target = 5): number {
  const raw = span / Math.max(1, target);
  if (!(raw > 0) || !Number.isFinite(raw)) return 1;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const k = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  return k * mag;
}

function decimalsFor(step: number): number {
  return Math.max(0, Math.min(6, -Math.floor(Math.log10(step) + 1e-9)));
}

/** Round to `step`'s precision, so 0.30000000000000004 becomes 0.3. */
function snap(v: number, step: number): number {
  const r = Number(v.toFixed(decimalsFor(step)));
  return Object.is(r, -0) ? 0 : r;
}

/**
 * Expand [lo, hi] outward to whole multiples of a nice step and list the ticks.
 * A zero-width range (single point, flat line) is widened so it still plots.
 */
export function niceDomain(lo: number, hi: number, target = 5): Domain {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
    lo = 0;
    hi = 1;
  }
  if (lo > hi) [lo, hi] = [hi, lo];
  if (hi - lo < 1e-12) {
    const pad = Math.abs(lo) > 1e-12 ? Math.abs(lo) * 0.5 : 1;
    lo -= pad;
    hi += pad;
  }
  const step = niceStep(hi - lo, target);
  const nlo = snap(Math.floor(lo / step + 1e-9) * step, step);
  const nhi = snap(Math.ceil(hi / step - 1e-9) * step, step);
  const ticks: number[] = [];
  for (let v = nlo; v <= nhi + step * 1e-6; v += step) ticks.push(snap(v, step));
  return { lo: nlo, hi: nhi, ticks };
}

/** Ticks at nice positions inside an already-fixed [lo, hi]. */
export function ticksWithin(lo: number, hi: number, target = 5): number[] {
  const step = niceStep(hi - lo, target);
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-6; v += step) ticks.push(snap(v, step));
  return ticks;
}

/** Compact number for labels: trims trailing zeros, uses a true minus sign. */
export function fmt(v: number, maxDecimals = 3): string {
  if (!Number.isFinite(v)) return String(v);
  const abs = Math.abs(v);
  const s =
    abs !== 0 && (abs >= 1e5 || abs < 1e-3)
      ? abs.toExponential(1).replace('e+', 'e').replace('e-', `e${MINUS}`)
      : String(Number(abs.toFixed(maxDecimals)));
  return (v < 0 && s !== '0' ? MINUS : '') + s;
}

/** Label for a decade tick 10^k: plain decimals near 1, exponent form far away. */
export function decadeLabel(k: number): string {
  if (k >= -3 && k <= 3) return k < 0 ? (10 ** k).toFixed(-k) : String(10 ** k);
  return `1e${k < 0 ? MINUS : ''}${Math.abs(k)}`;
}

/** Linear map from a data interval onto a pixel interval. */
export function linear(d0: number, d1: number, r0: number, r1: number) {
  const span = d1 - d0 || 1;
  return (v: number) => r0 + ((v - d0) / span) * (r1 - r0);
}

/** SVG path through already-projected points; non-finite points break the line. */
export function pathFrom(points: [number, number][]): string {
  let d = '';
  let pen = false;
  for (const [x, y] of points) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      pen = false;
      continue;
    }
    d += `${pen ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)} `;
    pen = true;
  }
  return d.trim();
}

/** "−1 + 2j", "3", "−0.5j": compact complex number text. */
export function fmtComplex(re: number, im: number): string {
  if (Math.abs(im) < 1e-9) return fmt(re);
  if (Math.abs(re) < 1e-9) return `${fmt(im)}j`;
  return `${fmt(re)} ${im < 0 ? MINUS : '+'} ${fmt(Math.abs(im))}j`;
}

