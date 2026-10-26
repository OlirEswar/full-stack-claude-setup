/**
 * Unit 4: second-order response (skills `second-order-params`, `second-order-specs`).
 * Standard form throughout: G(s) = ωn²/(s² + 2ζωn·s + ωn²).
 */
import { defineGenerator, defineUnit, nice } from '../authoring.ts';
import { pick, shuffle } from '../rng.ts';
import type { FigureSpec } from '../types.ts';

/** Unit-step response of ωn²/(s² + 2ζωn·s + ωn²) at time t. */
export function secondOrderStep(zeta: number, wn: number, t: number): number {
  if (zeta < 1) {
    const wd = wn * Math.sqrt(1 - zeta * zeta);
    const phi = Math.acos(zeta);
    return 1 - (Math.exp(-zeta * wn * t) / Math.sqrt(1 - zeta * zeta)) * Math.sin(wd * t + phi);
  }
  if (zeta === 1) return 1 - Math.exp(-wn * t) * (1 + wn * t);
  const r = Math.sqrt(zeta * zeta - 1);
  const p1 = wn * (zeta - r);
  const p2 = wn * (zeta + r);
  return 1 + (p1 * Math.exp(-p2 * t) - p2 * Math.exp(-p1 * t)) / (p2 - p1);
}

/** Percent overshoot for 0 < ζ < 1: 100·e^(−ζπ/√(1−ζ²)). */
export function percentOvershoot(zeta: number): number {
  return 100 * Math.exp((-zeta * Math.PI) / Math.sqrt(1 - zeta * zeta));
}

function stepFigure(zeta: number, wn: number, tEnd: number, n = 41): FigureSpec {
  const points: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const t = (tEnd * i) / (n - 1);
    points.push([Math.round(t * 1000) / 1000, Math.round(secondOrderStep(zeta, wn, t) * 1000) / 1000]);
  }
  return { type: 'step_response', points, finalValue: 1, xLabel: 't (s)', yLabel: 'y(t)' };
}

/** Format "s² + a·s + b" with nice numbers. */
function quad(a: number, b: number): string {
  return `s² + ${nice(a)}s + ${nice(b)}`;
}

/** Imaginary part of a pole: "j", "3j". */
function jw(w: number): string {
  return w === 1 ? 'j' : `${nice(w)}j`;
}

/** Pythagorean (σ, ωd, ωn) triples: poles −σ ± jωd sit at radius ωn. */
const TRIPLES: [number, number, number][] = [
  [3, 4, 5],
  [4, 3, 5],
  [6, 8, 10],
  [8, 6, 10],
  [5, 12, 13],
  [12, 5, 13],
  [9, 12, 15],
  [12, 9, 15],
  [1.5, 2, 2.5],
  [2, 1.5, 2.5],
];

const ZETAS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];

export default defineUnit({
  unitId: 'u4',
  items: [
    // ---------------------------------------------------------------- second-order-params
    {
      id: 'second-order-params/wn-from-tf',
      skillId: 'second-order-params',
      difficulty: 1,
      kind: 'numeric',
      prompt: 'G(s) = 25/(s² + 4s + 25). What is the natural frequency ωn?',
      answer: 5,
      tolerance: {},
      unit: 'rad/s',
      explanation: 'Match the constant term to ωn²: ωn² = 25, so ωn = 5 rad/s.',
    },
    {
      id: 'second-order-params/zeta-from-tf',
      skillId: 'second-order-params',
      difficulty: 2,
      kind: 'numeric',
      prompt: 'G(s) = 25/(s² + 4s + 25). What is the damping ratio ζ?',
      answer: 0.4,
      tolerance: {},
      explanation: 'The s coefficient is 2ζωn. With ωn = 5, 2ζ·5 = 4 gives ζ = 0.4.',
    },
    {
      id: 'second-order-params/zeta-zero-behavior',
      skillId: 'second-order-params',
      difficulty: 1,
      kind: 'mcq',
      prompt: 'A second-order system has ζ = 0. What does its step response look like?',
      choices: [
        'A sustained oscillation at ωn that never dies out',
        'A smooth rise with no overshoot',
        'An oscillation that decays to the final value',
        'An exponential that grows without bound',
      ],
      answer: 0,
      explanation: 'ζ = 0 puts the poles on the jω axis at ±jωn, so nothing damps the oscillation.',
    },
    {
      id: 'second-order-params/damping-classes',
      skillId: 'second-order-params',
      difficulty: 2,
      kind: 'match',
      prompt: 'Match each damping ratio to its step-response class.',
      left: ['ζ = 0', '0 < ζ < 1', 'ζ = 1', 'ζ > 1'],
      right: ['Undamped', 'Underdamped', 'Critically damped', 'Overdamped'],
      answer: [0, 1, 2, 3],
      explanation:
        'ζ < 1 gives complex poles (oscillation, damped unless ζ = 0); ζ = 1 a repeated real pole; ζ > 1 two distinct real poles.',
    },
    {
      id: 'second-order-params/which-zeta-underdamped',
      skillId: 'second-order-params',
      difficulty: 2,
      kind: 'mcq',
      prompt: 'This is the unit-step response of ωn²/(s² + 2ζωn·s + ωn²). Which ζ fits it best?',
      choices: ['ζ ≈ 0.3', 'ζ = 1', 'ζ ≈ 2', 'ζ = 0'],
      answer: 0,
      figure: stepFigure(0.3, 2, 8),
      explanation:
        'It overshoots (~37%) and the ringing decays, so 0 < ζ < 1; ζ = 0 would never settle and ζ ≥ 1 would not overshoot.',
    },
    {
      id: 'second-order-params/which-zeta-critical',
      skillId: 'second-order-params',
      difficulty: 2,
      kind: 'mcq',
      prompt: 'Unit-step response of a standard second-order system with ωn = 1 rad/s. Which ζ fits it?',
      choices: ['ζ = 1', 'ζ = 0.5', 'ζ = 0.2', 'ζ = 0'],
      answer: 0,
      figure: stepFigure(1, 1, 10),
      explanation: 'No overshoot means ζ ≥ 1; ζ = 0.5 would overshoot about 16% and ζ = 0.2 about 53%.',
    },
    {
      id: 'second-order-params/which-zeta-overdamped',
      skillId: 'second-order-params',
      difficulty: 3,
      kind: 'mcq',
      prompt:
        'Unit-step response of a standard second-order system with ωn = 1 rad/s. Which ζ fits it? (It reaches only ~0.72 at t = 5 s.)',
      choices: ['ζ = 2', 'ζ = 1', 'ζ = 0.5', 'ζ = 0.2'],
      answer: 0,
      figure: stepFigure(2, 1, 20),
      explanation:
        'No overshoot rules out ζ < 1. With ωn = 1, critical damping is already ~96% done at t = 5 s; this sluggish curve has a slow real pole, so ζ > 1.',
    },
    {
      id: 'second-order-params/wn-from-poles',
      skillId: 'second-order-params',
      difficulty: 3,
      kind: 'numeric',
      prompt: 'A second-order system has poles at s = −3 ± 4j. What is ωn?',
      answer: 5,
      tolerance: {},
      unit: 'rad/s',
      explanation: 'ωn is the distance of the poles from the origin: √(3² + 4²) = 5 rad/s.',
    },
    {
      id: 'second-order-params/zeta-from-poles',
      skillId: 'second-order-params',
      difficulty: 3,
      kind: 'numeric',
      prompt: 'A second-order system has poles at s = −3 ± 4j. What is ζ?',
      answer: 0.6,
      tolerance: {},
      explanation: 'ζ = cos θ, with θ measured from the negative real axis: ζ = σ/ωn = 3/5 = 0.6.',
    },
    {
      id: 'second-order-params/wd-vs-wn',
      skillId: 'second-order-params',
      difficulty: 2,
      kind: 'true_false',
      prompt: 'For an underdamped system (0 < ζ < 1), the damped frequency ωd is larger than ωn.',
      answer: false,
      explanation: 'ωd = ωn√(1 − ζ²), and √(1 − ζ²) < 1 for ζ > 0, so ωd < ωn: damping slows the ringing.',
    },
    {
      id: 'second-order-params/wd-from-tf',
      skillId: 'second-order-params',
      difficulty: 3,
      kind: 'numeric',
      prompt: 'G(s) = 5/(s² + 2s + 5). At what frequency ωd does its step response ring?',
      answer: 2,
      tolerance: {},
      unit: 'rad/s',
      explanation: 'The poles are −1 ± 2j; the imaginary part is the damped frequency, so ωd = 2 rad/s.',
    },
    {
      id: 'second-order-params/zeta-circle',
      skillId: 'second-order-params',
      difficulty: 4,
      kind: 'true_false',
      prompt:
        'Holding ωn fixed and increasing ζ from 0 to 1 moves the complex poles along a circle of radius ωn toward the negative real axis.',
      answer: true,
      explanation: 'The poles are at −ζωn ± jωn√(1 − ζ²), whose magnitude is always ωn; at ζ = 1 they meet at −ωn.',
    },
    {
      id: 'second-order-params/underdamped-select',
      skillId: 'second-order-params',
      difficulty: 4,
      kind: 'multi_select',
      prompt: 'Which characteristic polynomials are underdamped (0 < ζ < 1)?',
      choices: ['s² + 2s + 10', 's² + 6s + 9', 's² + 5s + 4', 's² + s + 1', 's² + 4'],
      answer: [0, 3],
      explanation:
        'ζ = b/(2√c): 0.32 and 0.5 are underdamped; s² + 6s + 9 has ζ = 1, s² + 5s + 4 has ζ = 1.25, and s² + 4 has ζ = 0 (undamped).',
    },

    // ---------------------------------------------------------------- second-order-specs
    {
      id: 'second-order-specs/os-depends-on',
      skillId: 'second-order-specs',
      difficulty: 1,
      kind: 'mcq',
      prompt: 'For a standard second-order system, the percent overshoot depends on which parameter(s)?',
      choices: ['ζ only', 'ωn only', 'Both ζ and ωn', 'The DC gain'],
      answer: 0,
      explanation: '%OS = 100·e^(−ζπ/√(1−ζ²)) contains only ζ; ωn just stretches or squeezes the time axis.',
    },
    {
      id: 'second-order-specs/overdamped-no-os',
      skillId: 'second-order-specs',
      difficulty: 1,
      kind: 'true_false',
      prompt: 'An overdamped second-order system with no finite zeros never overshoots its final value for a step input.',
      answer: true,
      explanation: 'Its two real LHP poles give a sum of decaying exponentials that approaches the final value monotonically.',
    },
    {
      id: 'second-order-specs/ts-from-zeta-wn',
      skillId: 'second-order-specs',
      difficulty: 2,
      kind: 'numeric',
      prompt: 'ζ = 0.5 and ωn = 4 rad/s. Estimate the 2% settling time Ts.',
      answer: 2,
      tolerance: {},
      unit: 's',
      explanation: 'The envelope decays as e^(−ζωn·t); Ts ≈ 4/(ζωn) = 4/2 = 2 s.',
    },
    {
      id: 'second-order-specs/os-zeta-07',
      skillId: 'second-order-specs',
      difficulty: 2,
      kind: 'mcq',
      prompt: 'Roughly how much does a standard second-order system with ζ = 0.7 overshoot?',
      choices: ['≈ 5%', '≈ 16%', '≈ 37%', '0%'],
      answer: 0,
      explanation: '%OS = 100·e^(−0.7π/√0.51) ≈ 4.6%. ζ = 0.5 gives ≈ 16% and ζ = 0.3 gives ≈ 37%.',
    },
    {
      id: 'second-order-specs/tp-from-zeta-wn',
      skillId: 'second-order-specs',
      difficulty: 2,
      kind: 'numeric',
      prompt: 'ζ = 0.6 and ωn = 5 rad/s. What is the peak time Tp?',
      answer: Math.PI / 4,
      tolerance: {},
      unit: 's',
      explanation: 'ωd = ωn√(1 − ζ²) = 5·0.8 = 4 rad/s, and the first peak is half a period in: Tp = π/ωd ≈ 0.785 s.',
    },
    {
      id: 'second-order-specs/ts-from-poles',
      skillId: 'second-order-specs',
      difficulty: 3,
      kind: 'numeric',
      prompt: 'Poles at s = −2 ± 5j. Estimate the 2% settling time Ts.',
      answer: 2,
      tolerance: {},
      unit: 's',
      explanation: 'Settling depends only on the real part σ = ζωn = 2: Ts ≈ 4/σ = 2 s. The 5 rad/s only sets the ringing.',
    },
    {
      id: 'second-order-specs/os-zeta-05',
      skillId: 'second-order-specs',
      difficulty: 3,
      kind: 'numeric',
      prompt: 'What is the percent overshoot of a standard second-order system with ζ = 0.5?',
      answer: percentOvershoot(0.5),
      tolerance: { abs: 0.5 },
      unit: '%',
      explanation: '%OS = 100·e^(−0.5π/√0.75) = 100·e^(−1.81) ≈ 16.3%.',
    },
    {
      id: 'second-order-specs/double-wn',
      skillId: 'second-order-specs',
      difficulty: 3,
      kind: 'true_false',
      prompt: 'Doubling ωn while keeping ζ fixed halves the settling time and leaves the percent overshoot unchanged.',
      answer: true,
      explanation: 'Ts ≈ 4/(ζωn) halves when ωn doubles, while %OS depends on ζ alone; the response is just time-compressed.',
    },
    {
      id: 'second-order-specs/pole-moves',
      skillId: 'second-order-specs',
      difficulty: 3,
      kind: 'match',
      prompt: 'Match each pole movement (complex pair, upper-left quadrant) to its main effect on the step response.',
      left: [
        'Move left (larger σ = ζωn)',
        'Move up (larger ωd), same σ',
        'Rotate toward the jω axis, same |p|',
      ],
      right: ['Shorter settling time', 'Shorter peak time', 'More overshoot'],
      answer: [0, 1, 2],
      explanation: 'Ts ≈ 4/σ, Tp = π/ωd, and %OS grows as the angle from the negative real axis grows (ζ = cos θ shrinks).',
    },
    {
      id: 'second-order-specs/spec-region',
      skillId: 'second-order-specs',
      difficulty: 4,
      kind: 'multi_select',
      prompt: 'Specs: %OS ≤ 10% and Ts ≤ 2 s (2%). Which closed-loop pole pairs meet both?',
      choices: ['−3 ± 3j', '−1 ± 1j', '−2 ± 6j', '−4 ± 2j'],
      answer: [0, 3],
      explanation:
        '%OS ≤ 10% needs ζ ≥ 0.59 and Ts ≤ 2 s needs σ ≥ 2. −1 ± 1j is too slow (σ = 1); −2 ± 6j has ζ ≈ 0.32 (≈ 35% overshoot).',
    },
    {
      id: 'second-order-specs/lhp-zero-effect',
      skillId: 'second-order-specs',
      difficulty: 4,
      kind: 'mcq',
      prompt:
        'A LHP zero is added near the poles of an underdamped second-order system (DC gain kept at 1). What typically happens to the step response?',
      choices: [
        'Overshoot increases and the rise gets faster',
        'Overshoot disappears',
        'The system becomes unstable',
        'Nothing changes; only poles matter for the response',
      ],
      answer: 0,
      explanation:
        'A zero at −z adds a term proportional to the derivative of the response, (1/z)·dy/dt, which boosts the early rise and the peak.',
    },
  ],
  generators: [
    defineGenerator({
      id: 'second-order-wn-zeta',
      skillId: 'second-order-params',
      difficulties: [1, 2, 3],
      generate(rng, d) {
        if (d === 3) {
          const [sig, wd, wn] = pick(rng, TRIPLES);
          const askZeta = pick(rng, [true, false]);
          const poles = `s = −${nice(sig)} ± ${jw(wd)}`;
          return askZeta
            ? {
                skillId: 'second-order-params',
                difficulty: d,
                kind: 'numeric',
                prompt: `A second-order system has poles at ${poles}. What is the damping ratio ζ?`,
                answer: sig / wn,
                tolerance: {},
                explanation: `ωn = |p| = √(${nice(sig)}² + ${nice(wd)}²) = ${nice(wn)}, and ζ = σ/ωn = ${nice(sig)}/${nice(wn)} = ${nice(sig / wn)}.`,
              }
            : {
                skillId: 'second-order-params',
                difficulty: d,
                kind: 'numeric',
                prompt: `A second-order system has poles at ${poles}. What is ωn?`,
                answer: wn,
                tolerance: {},
                unit: 'rad/s',
                explanation: `ωn is the poles' distance from the origin: √(${nice(sig)}² + ${nice(wd)}²) = ${nice(wn)} rad/s.`,
              };
        }
        const wn = pick(rng, [2, 3, 4, 5, 6, 8, 10]);
        const zeta = pick(rng, [0.1, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7, 0.75, 0.8, 0.9]);
        const k = pick(rng, [1, 2, 3, 5]);
        const a = 2 * zeta * wn;
        const b = wn * wn;
        const tf = `G(s) = ${nice(k * b)}/(${quad(a, b)})`;
        if (d === 1) {
          return {
            skillId: 'second-order-params',
            difficulty: d,
            kind: 'numeric',
            prompt: `${tf}. What is the natural frequency ωn?`,
            answer: wn,
            tolerance: {},
            unit: 'rad/s',
            explanation: `Read ωn² from the constant term of the denominator (not the numerator): ωn² = ${nice(b)}, so ωn = ${wn} rad/s.`,
          };
        }
        return {
          skillId: 'second-order-params',
          difficulty: d,
          kind: 'numeric',
          prompt: `${tf}. What is the damping ratio ζ?`,
          answer: zeta,
          tolerance: {},
          explanation: `ωn = √${nice(b)} = ${wn}, and the s coefficient is 2ζωn: ζ = ${nice(a)}/(2·${wn}) = ${nice(zeta)}.`,
        };
      },
    }),
    defineGenerator({
      id: 'percent-overshoot',
      skillId: 'second-order-specs',
      difficulties: [2, 3],
      generate(rng, d) {
        const zeta = pick(rng, ZETAS);
        const others = shuffle(
          rng,
          ZETAS.filter((z) => z !== zeta),
        ).slice(0, 3);
        const fmt = (z: number) => `${nice(percentOvershoot(z), 1)}%`;
        const choices = [fmt(zeta), ...others.map(fmt)];
        const os = fmt(zeta);
        if (d === 2) {
          return {
            skillId: 'second-order-specs',
            difficulty: d,
            kind: 'mcq',
            prompt: `A standard second-order system has ζ = ${nice(zeta)}. What is its percent overshoot to a step?`,
            choices,
            answer: 0,
            explanation: `%OS = 100·e^(−ζπ/√(1−ζ²)) depends only on ζ; for ζ = ${nice(zeta)} it is ${os}. Smaller ζ, more overshoot.`,
          };
        }
        const wn = pick(rng, [2, 4, 5, 10]);
        const a = 2 * zeta * wn;
        return {
          skillId: 'second-order-specs',
          difficulty: d,
          kind: 'mcq',
          prompt: `G(s) = ${nice(wn * wn)}/(${quad(a, wn * wn)}). What is its percent overshoot to a step?`,
          choices,
          answer: 0,
          explanation: `ωn = ${wn} and 2ζωn = ${nice(a)} give ζ = ${nice(zeta)}, so %OS = 100·e^(−ζπ/√(1−ζ²)) = ${os}.`,
        };
      },
    }),
    defineGenerator({
      id: 'settling-time',
      skillId: 'second-order-specs',
      difficulties: [2, 3, 4],
      generate(rng, d) {
        if (d === 2) {
          const zeta = pick(rng, [0.2, 0.4, 0.5, 0.8]);
          const wn = pick(rng, [2, 4, 5, 10]);
          const s = zeta * wn;
          return {
            skillId: 'second-order-specs',
            difficulty: d,
            kind: 'numeric',
            prompt: `ζ = ${nice(zeta)} and ωn = ${wn} rad/s. Estimate the 2% settling time Ts.`,
            answer: 4 / s,
            tolerance: {},
            unit: 's',
            explanation: `The envelope decays as e^(−ζωn·t), so Ts ≈ 4/(ζωn) = 4/${nice(s)} = ${nice(4 / s)} s.`,
          };
        }
        const sigma = pick(rng, [0.5, 1, 2, 4, 5]);
        const wd = pick(rng, [1, 2, 3, 4, 6, 8, 10]);
        if (d === 3) {
          const a = 2 * sigma;
          const b = sigma * sigma + wd * wd;
          return {
            skillId: 'second-order-specs',
            difficulty: d,
            kind: 'numeric',
            prompt: `G(s) = ${nice(b)}/(${quad(a, b)}). Estimate the 2% settling time Ts.`,
            answer: 4 / sigma,
            tolerance: {},
            unit: 's',
            explanation: `The s coefficient is 2ζωn = ${nice(a)}, so ζωn = ${nice(sigma)} and Ts ≈ 4/(ζωn) = ${nice(4 / sigma)} s.`,
          };
        }
        return {
          skillId: 'second-order-specs',
          difficulty: d,
          kind: 'numeric',
          prompt: `Closed-loop poles at s = −${nice(sigma)} ± ${jw(wd)}. Estimate the 2% settling time Ts.`,
          answer: 4 / sigma,
          tolerance: {},
          unit: 's',
          explanation: `Only the real part sets the decay: σ = ζωn = ${nice(sigma)}, so Ts ≈ 4/σ = ${nice(4 / sigma)} s. The imaginary part only sets the ringing.`,
        };
      },
    }),
    defineGenerator({
      id: 'peak-time',
      skillId: 'second-order-specs',
      difficulties: [2, 3],
      generate(rng, d) {
        if (d === 2) {
          const sigma = pick(rng, [1, 2, 3, 4, 5]);
          const wd = pick(rng, [1, 2, 3, 4, 5, 6, 8, 10]);
          return {
            skillId: 'second-order-specs',
            difficulty: d,
            kind: 'numeric',
            prompt: `Poles at s = −${sigma} ± ${jw(wd)}. What is the peak time Tp of the step response?`,
            answer: Math.PI / wd,
            tolerance: {},
            unit: 's',
            explanation: `The first peak comes half a damped period in: Tp = π/ωd = π/${wd} ≈ ${nice(Math.PI / wd)} s. The real part does not affect it.`,
          };
        }
        const [zeta, root] = pick(rng, [
          [0.6, 0.8],
          [0.8, 0.6],
          [0.28, 0.96],
        ] as const);
        const wn = pick(rng, [5, 10, 20, 25]);
        const wd = wn * root;
        return {
          skillId: 'second-order-specs',
          difficulty: d,
          kind: 'numeric',
          prompt: `ζ = ${nice(zeta)} and ωn = ${wn} rad/s. What is the peak time Tp? (√(1 − ζ²) = ${nice(root)})`,
          answer: Math.PI / wd,
          tolerance: {},
          unit: 's',
          explanation: `ωd = ωn√(1 − ζ²) = ${wn}·${nice(root)} = ${nice(wd)} rad/s, so Tp = π/ωd ≈ ${nice(Math.PI / wd)} s.`,
        };
      },
    }),
  ],
});
