import { render, screen } from '@testing-library/react-native';

import { BodeMag, Figure, PoleZeroMap, StepResponse, groupRoots, type FigureSpec } from '@/components/figures';
import { clipToBand } from '@/components/figures/BodeMag';
import { decadeLabel, fmt, niceDomain } from '@/components/figures/scale';

/** Collect the text content of every node in the rendered tree (SVG <Text> included). */
function allText(): string[] {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (node == null) return;
    if (typeof node === 'string') {
      out.push(node);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    // react-native-svg puts <Text> strings on a child TSpan's `content` prop.
    const n = node as { children?: unknown; props?: { content?: unknown } };
    if (typeof n.props?.content === 'string') out.push(n.props.content);
    walk(n.children);
  };
  walk(screen.toJSON());
  return out;
}

function underdamped(n = 60, tEnd = 10): [number, number][] {
  const z = 0.3;
  const wd = Math.sqrt(1 - z * z);
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = (i / n) * tEnd;
    return [t, 1 - (Math.exp(-z * t) / wd) * Math.sin(wd * t + Math.acos(z))];
  });
}

describe('figures', () => {
  it('PoleZeroMap renders one marker per pole and zero', async () => {
    await render(
      <PoleZeroMap
        poles={[
          { re: -1, im: 2 },
          { re: -1, im: -2 },
          { re: -3, im: 0 },
        ]}
        zeros={[{ re: -5, im: 0 }]}
      />,
    );
    expect(screen.getAllByTestId('pole-marker')).toHaveLength(3);
    expect(screen.getAllByTestId('zero-marker')).toHaveLength(1);
    const label = screen.getByRole('image').props.accessibilityLabel as string;
    expect(label).toContain('poles at −1 ± 2j, −3');
    expect(label).toContain('zeros at −5');
    expect(allText()).toEqual(expect.arrayContaining(['σ', 'jω']));
  });

  it('PoleZeroMap shows multiplicity for repeated poles and handles poles at the origin', async () => {
    await render(
      <PoleZeroMap
        poles={[
          { re: 0, im: 0 },
          { re: -2, im: 0 },
          { re: -2, im: 0 },
        ]}
        zeros={[]}
      />,
    );
    expect(screen.getAllByTestId('pole-marker')).toHaveLength(2);
    expect(screen.getByTestId('pole-multiplicity')).toBeTruthy();
    expect(allText()).toContain('(2)');
    const label = screen.getByRole('image').props.accessibilityLabel as string;
    expect(label).toContain('−2 (double)');
    expect(label).toContain('no zeros');
  });

  it('PoleZeroMap tolerates no roots and roots all in the right half-plane', async () => {
    await render(<PoleZeroMap poles={[]} zeros={[]} />);
    expect(screen.queryAllByTestId('pole-marker')).toHaveLength(0);
    await render(<PoleZeroMap poles={[{ re: 4, im: 1 }, { re: 4, im: -1 }]} zeros={[{ re: 2, im: 0 }]} />);
    expect(screen.getAllByTestId('pole-marker')).toHaveLength(2);
  });

  it('groupRoots collapses repeated roots within tolerance', () => {
    expect(groupRoots([{ re: -1, im: 0 }, { re: -1 + 1e-9, im: 0 }, { re: -2, im: 0 }])).toEqual([
      { re: -1, im: 0, count: 2 },
      { re: -2, im: 0, count: 1 },
    ]);
  });

  it('StepResponse renders a path from points', async () => {
    const points = underdamped();
    await render(<StepResponse points={points} finalValue={1} />);
    const d = screen.getByTestId('step-path').props.d as string;
    expect(d.startsWith('M')).toBe(true);
    // one M plus one L per remaining point
    expect(d.match(/[ML]/g)).toHaveLength(points.length);
    expect(screen.getByTestId('final-value-line')).toBeTruthy();
    expect(screen.getByRole('image').props.accessibilityLabel).toMatch(/Step response.*final value 1/);
  });

  it('StepResponse handles a single point without a path', async () => {
    await render(<StepResponse points={[[1, 0.5]]} />);
    expect(screen.queryByTestId('step-path')).toBeNull();
    expect(screen.getByTestId('step-point')).toBeTruthy();
    expect(screen.queryByTestId('final-value-line')).toBeNull();
  });

  it('BodeMag renders decade tick labels for 0.1–100 rad/s', async () => {
    const points: [number, number][] = [];
    for (let e = -1; e <= 2.0001; e += 0.1) {
      const w = 10 ** e;
      points.push([w, -10 * Math.log10(1 + w * w)]);
    }
    await render(
      <BodeMag
        points={points}
        asymptotes={[
          [0.1, 0],
          [1, 0],
          [100, -40],
        ]}
      />,
    );
    const text = allText();
    for (const l of ['0.1', '1', '10', '100']) expect(text).toContain(l);
    expect(screen.getByTestId('bode-path')).toBeTruthy();
    expect(screen.getByTestId('bode-asymptotes')).toBeTruthy();
    expect(screen.getByRole('image').props.accessibilityLabel).toMatch(/0\.1 to 100 rad\/s/);
  });

  it('Figure dispatches on type', async () => {
    await render(<Figure figure={{ type: 'pole_zero', poles: [{ re: -1, im: 0 }], zeros: [] }} />);
    expect(screen.getAllByTestId('pole-marker')).toHaveLength(1);
    await render(<Figure figure={{ type: 'step_response', points: underdamped(10) }} />);
    expect(screen.getByTestId('step-path')).toBeTruthy();
    await render(<Figure figure={{ type: 'bode_mag', points: [[1, 0], [10, -20]] }} />);
    expect(screen.getByTestId('bode-path')).toBeTruthy();
  });

  it('Figure returns null for unknown type', async () => {
    await render(<Figure figure={{ type: 'nyquist', points: [] } as unknown as FigureSpec} />);
    expect(screen.toJSON()).toBeNull();
    await render(<Figure figure={undefined} />);
    expect(screen.toJSON()).toBeNull();
  });

  it('BodeMag clips asymptotes to the visible decade band', () => {
    // log10 ω from -2 to 3 with a band of [-1, 2]
    expect(clipToBand([[-2, 0], [0, 0], [3, -60]], -1, 2)).toEqual([[-1, 0], [0, 0], [2, -40]]);
    expect(clipToBand([[-3, 0], [-2, 0]], -1, 2)).toEqual([]);
  });

  it('scale helpers produce clean ticks and labels', () => {
    expect(niceDomain(-0.05, 1.32, 4).ticks).toEqual([-0.5, 0, 0.5, 1, 1.5]);
    expect(niceDomain(2, 2).ticks.length).toBeGreaterThan(1);
    expect([-1, 0, 1, 2].map(decadeLabel)).toEqual(['0.1', '1', '10', '100']);
    expect(fmt(-0.30000000000000004)).toBe('−0.3');
  });
});
