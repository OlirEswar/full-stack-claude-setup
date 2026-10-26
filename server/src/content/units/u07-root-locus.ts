/**
 * U7 Root Locus: how closed-loop poles of 1 + K·G(s) = 0 move as K sweeps 0 → ∞.
 */
import { defineGenerator, defineUnit, nice } from '../authoring.ts';
import { chance, int, pick, shuffle } from '../rng.ts';

/** Asymptote angles for n − m branches going to infinity (K > 0). */
export function asymptoteAngles(q: number): string {
  switch (q) {
    case 1:
      return '180°';
    case 2:
      return '±90°';
    case 3:
      return '±60°, 180°';
    case 4:
      return '±45°, ±135°';
    case 5:
      return '±36°, ±108°, 180°';
    default:
      throw new Error(`asymptoteAngles: unsupported n − m = ${q}`);
  }
}

/** "s" for a root at 0, "(s + a)" for a root at −a. */
function factor(root: number): string {
  return root === 0 ? 's' : `(s + ${nice(-root)})`;
}

/** Render K·Π(s − z)/Π(s − p) for real, non-positive roots. */
export function loopTf(poles: number[], zeros: number[]): string {
  const num = zeros.length === 0 ? 'K' : `K${zeros.map(factor).join('')}`;
  const den = poles.map(factor).join('');
  return `${num}/(${den})`;
}

export default defineUnit({
  unitId: 'u7',
  items: [
    {
      id: 'root-locus/branches-start',
      skillId: 'root-locus',
      difficulty: 1,
      kind: 'mcq',
      prompt: 'For 1 + K·G(s) = 0 with K ≥ 0, where do the root-locus branches start (K = 0)?',
      choices: ['At the open-loop poles', 'At the open-loop zeros', 'At the origin', 'On the imaginary axis'],
      answer: 0,
      explanation:
        'Write G = N/D: the closed-loop poles solve D(s) + K·N(s) = 0, which reduces to D(s) = 0 at K = 0. So every branch starts at an open-loop pole.',
    },
    {
      id: 'root-locus/branches-end',
      skillId: 'root-locus',
      difficulty: 1,
      kind: 'true_false',
      prompt: 'As K → ∞, every root-locus branch ends at an open-loop zero, either a finite zero or a zero at infinity.',
      answer: true,
      explanation:
        'Dividing D(s) + K·N(s) = 0 by K gives N(s) ≈ 0 for large K. The m finite zeros capture m branches; the other n − m run off to infinity along asymptotes.',
    },
    {
      id: 'root-locus/branch-count',
      skillId: 'root-locus',
      difficulty: 1,
      kind: 'numeric',
      prompt: 'L(s) = K(s + 3)/(s(s + 1)(s + 5)). How many branches does the root locus have?',
      answer: 3,
      tolerance: { abs: 0 },
      explanation:
        'The number of branches equals the number of closed-loop poles, which is the number of open-loop poles n = 3 (n ≥ m).',
    },
    {
      id: 'root-locus/asymptotes-three-poles',
      skillId: 'root-locus',
      difficulty: 2,
      kind: 'mcq',
      prompt:
        'The figure shows the open-loop poles of L(s) = K/(s(s + 2)(s + 4)), with no zeros. How many branches go to infinity, and at what asymptote angles?',
      figure: {
        type: 'pole_zero',
        poles: [
          { re: 0, im: 0 },
          { re: -2, im: 0 },
          { re: -4, im: 0 },
        ],
        zeros: [],
      },
      choices: ['3, at ±60° and 180°', '2, at ±90°', '3, at 0° and ±120°', '1, at 180°'],
      answer: 0,
      explanation:
        'n − m = 3 − 0 = 3 branches go to infinity at angles (2k + 1)·180°/3 = 60°, 180°, 300°. They meet the real axis at the centroid (0 − 2 − 4)/3 = −2.',
    },
    {
      id: 'root-locus/real-axis-segments',
      skillId: 'root-locus',
      difficulty: 2,
      kind: 'multi_select',
      prompt:
        'L(s) = K(s + 2)/(s(s + 4)), K > 0, with poles and zero shown. Which real-axis segments lie on the root locus?',
      figure: {
        type: 'pole_zero',
        poles: [
          { re: 0, im: 0 },
          { re: -4, im: 0 },
        ],
        zeros: [{ re: -2, im: 0 }],
      },
      choices: ['−2 < s < 0', '−4 < s < −2', 's < −4', 's > 0'],
      answer: [0, 2],
      explanation:
        'A real-axis point is on the locus when the number of real poles plus zeros to its right is odd. That holds for −2 < s < 0 (one) and s < −4 (three), not between −4 and −2 (two).',
    },
    {
      id: 'root-locus/complex-poles-end',
      skillId: 'root-locus',
      difficulty: 2,
      kind: 'mcq',
      prompt:
        'L(s) = K(s + 3)/(s² + 2s + 5): poles at −1 ± 2j, zero at −3 (see figure). Where do the two branches go as K → ∞?',
      figure: {
        type: 'pole_zero',
        poles: [
          { re: -1, im: 2 },
          { re: -1, im: -2 },
        ],
        zeros: [{ re: -3, im: 0 }],
      },
      choices: [
        'One ends at s = −3, the other runs to −∞ along the real axis',
        'Both end at s = −3',
        'Both return to −1 ± 2j',
        'Both go to infinity along ±90° asymptotes',
      ],
      answer: 0,
      explanation:
        'One branch ends at the finite zero; the other (n − m = 1) goes to infinity along the 180° asymptote. The two branches meet on the real axis left of −3, which is on the locus since one real root (the zero) lies to its right.',
    },
    {
      id: 'root-locus/centroid-with-zero',
      skillId: 'root-locus',
      difficulty: 2,
      kind: 'numeric',
      prompt: 'L(s) = K(s + 1)/(s(s + 3)(s + 4)(s + 6)). Where do the asymptotes meet the real axis (centroid σ)?',
      answer: -4,
      tolerance: { abs: 0.05 },
      explanation:
        'σ = (Σpoles − Σzeros)/(n − m) = ((0 − 3 − 4 − 6) − (−1))/(4 − 1) = −12/3 = −4.',
    },
    {
      id: 'root-locus/angle-condition',
      skillId: 'root-locus',
      difficulty: 3,
      kind: 'mcq',
      prompt: 'A point s₀ lies on the root locus of 1 + K·G(s) = 0 (K > 0) if and only if:',
      choices: [
        '∠G(s₀) is an odd multiple of 180°',
        '|G(s₀)| = 1',
        '∠G(s₀) = 0°',
        'Re G(s₀) = 0',
      ],
      answer: 0,
      explanation:
        'K·G(s₀) = −1 with K > 0 needs ∠G(s₀) = ±180°(2k + 1). The magnitude condition K = 1/|G(s₀)| then just tells you which K puts a pole there.',
    },
    {
      id: 'root-locus/breakaway',
      skillId: 'root-locus',
      difficulty: 3,
      kind: 'mcq',
      prompt: 'For L(s) = K/(s(s + 2)), where is the breakaway point from the real axis?',
      choices: ['s = −1', 's = −2', 's = −0.5', 's = 0'],
      answer: 0,
      explanation:
        'On the locus K = −s(s + 2); dK/ds = −2s − 2 = 0 gives s = −1, midway between the poles. There K = 1 and the poles become a complex pair.',
    },
    {
      id: 'root-locus/add-lhp-zero',
      skillId: 'root-locus',
      difficulty: 3,
      kind: 'true_false',
      prompt: 'Adding a left-half-plane zero to L(s) tends to bend the root locus to the left, toward more stable regions.',
      answer: true,
      explanation:
        'A zero attracts a branch and reduces n − m, so fewer branches head to infinity and the centroid moves. This is why PD and lead compensation improve stability.',
    },
    {
      id: 'root-locus/asymptote-match',
      skillId: 'root-locus',
      difficulty: 4,
      kind: 'match',
      prompt: 'Match the relative degree n − m with the root-locus asymptote angles (K > 0).',
      left: ['n − m = 1', 'n − m = 2', 'n − m = 3', 'n − m = 4'],
      right: ['180°', '±90°', '±60°, 180°', '±45°, ±135°'],
      answer: [0, 1, 2, 3],
      explanation: 'Asymptote angles are (2k + 1)·180°/(n − m) for k = 0, 1, …, n − m − 1.',
    },
    {
      id: 'root-locus/jw-crossing-gain',
      skillId: 'root-locus',
      difficulty: 4,
      kind: 'numeric',
      prompt: 'L(s) = K/(s(s + 1)(s + 2)). At what gain K does the root locus cross the jω axis?',
      answer: 6,
      tolerance: { rel: 0.02 },
      explanation:
        'The characteristic polynomial is s³ + 3s² + 2s + K. Routh gives a zero row when 3·2 = K, so K = 6, with poles at ±j√2.',
    },
    {
      id: 'root-locus/three-pole-stability',
      skillId: 'root-locus',
      difficulty: 4,
      kind: 'true_false',
      prompt: 'For L(s) = K/(s(s + 1)(s + 2)), the closed loop is stable for every K > 0.',
      answer: false,
      explanation:
        'With n − m = 3 the asymptotes at ±60° head into the right half-plane. The branches cross the jω axis at K = 6, so the loop is unstable for K > 6.',
    },
  ],
  generators: [
    defineGenerator({
      id: 'root-locus-centroid',
      skillId: 'root-locus',
      difficulties: [2, 3, 4],
      generate(rng, d) {
        const n = d === 2 ? int(rng, 3, 4) : int(rng, 3, 5);
        const m = d === 2 ? 0 : 1;
        const pool = shuffle(rng, [0, -1, -2, -3, -4, -5, -6, -7, -8]);
        // Half the time, force an integrator (pole at the origin), as in a type-1 loop.
        const poles = pool.slice(0, n).sort((a, b) => b - a);
        if (chance(rng, 0.5) && !poles.includes(0)) poles[0] = 0;
        poles.sort((a, b) => b - a);
        const zeroChoices = [-1, -2, -3, -4, -5, -6, -7, -8, -9].filter((z) => !poles.includes(z));
        const zeros = m === 1 ? [pick(rng, zeroChoices)] : [];
        const sumP = poles.reduce((a, b) => a + b, 0);
        const sumZ = zeros.reduce((a, b) => a + b, 0);
        const q = n - m;
        const sigma = (sumP - sumZ) / q;
        const tf = loopTf(poles, zeros);
        const how =
          m === 0
            ? `σ = Σp/n = ${nice(sumP)}/${q} = ${nice(sigma, 2)}`
            : `σ = (Σp − Σz)/(n − m) = (${nice(sumP)} − (${nice(sumZ)}))/${q} = ${nice(sigma, 2)}`;

        if (d === 4) {
          const wrongSigma = (sumP + sumZ) / q;
          const right = asymptoteAngles(q);
          const wrong = asymptoteAngles(n);
          return {
            skillId: 'root-locus',
            difficulty: d,
            kind: 'mcq',
            prompt: `L(s) = ${tf}, K > 0. Which gives the asymptote centroid σ and angles?`,
            choices: [
              `σ = ${nice(sigma, 2)}; ${right}`,
              `σ = ${nice(sigma, 2)}; ${wrong}`,
              `σ = ${nice(wrongSigma, 2)}; ${right}`,
              `σ = ${nice(wrongSigma, 2)}; ${wrong}`,
            ],
            answer: 0,
            explanation: `n − m = ${q} asymptotes at (2k + 1)·180°/${q}: ${right}. ${how}.`,
          };
        }
        return {
          skillId: 'root-locus',
          difficulty: d,
          kind: 'numeric',
          prompt: `L(s) = ${tf}. Where do the root-locus asymptotes meet the real axis (centroid σ)?`,
          answer: Math.round(sigma * 100) / 100,
          tolerance: { abs: 0.05 },
          explanation: `${how}. The ${q} asymptotes leave σ at (2k + 1)·180°/${q}.`,
        };
      },
    }),
  ],
});
