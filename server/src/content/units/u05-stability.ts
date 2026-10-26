/**
 * Unit 5: stability (skills `stability-poles`, `routh-hurwitz`).
 */
import { defineGenerator, defineUnit, nice } from '../authoring.ts';
import { chance, int, pick, shuffle } from '../rng.ts';

type C = { re: number; im: number };

const STABILITY_CHOICES = ['Stable', 'Marginally stable', 'Unstable'];

/** "−2", "0", "±3j", "−1 ± 2j" for a real pole or a conjugate pair (im > 0). */
function fmtPole(p: C): string {
  if (p.im === 0) return nice(p.re);
  const im = p.im === 1 ? 'j' : `${nice(p.im)}j`;
  if (p.re === 0) return `±${im}`;
  return `${nice(p.re)} ± ${im}`;
}

/** Coefficient in front of a power of s: 1 is implicit. */
function co(c: number): string {
  return c === 1 ? '' : nice(c);
}

/** Expand a representative pole/pair list (pairs given once with im > 0) into all poles. */
function expand(ps: C[]): C[] {
  return ps.flatMap((p) => (p.im === 0 ? [p] : [p, { re: p.re, im: -p.im }]));
}

export default defineUnit({
  unitId: 'u5',
  items: [
    // ---------------------------------------------------------------- stability-poles
    {
      id: 'stability-poles/classify-stable',
      skillId: 'stability-poles',
      difficulty: 1,
      kind: 'mcq',
      prompt: 'The pole-zero map shows poles at s = −1 and s = −2 ± 3j. Classify the system.',
      choices: STABILITY_CHOICES,
      answer: 0,
      figure: {
        type: 'pole_zero',
        poles: [
          { re: -1, im: 0 },
          { re: -2, im: 3 },
          { re: -2, im: -3 },
        ],
        zeros: [],
      },
      explanation: 'Every pole has a negative real part, so every mode decays: the system is stable.',
    },
    {
      id: 'stability-poles/classify-marginal',
      skillId: 'stability-poles',
      difficulty: 2,
      kind: 'mcq',
      prompt: 'The pole-zero map shows poles at s = ±2j and s = −3. Classify the system.',
      choices: STABILITY_CHOICES,
      answer: 1,
      figure: {
        type: 'pole_zero',
        poles: [
          { re: 0, im: 2 },
          { re: 0, im: -2 },
          { re: -3, im: 0 },
        ],
        zeros: [],
      },
      explanation:
        'A simple (non-repeated) pole pair on the jω axis gives a sinusoid that neither grows nor decays: marginally stable.',
    },
    {
      id: 'stability-poles/classify-unstable-zero',
      skillId: 'stability-poles',
      difficulty: 2,
      kind: 'mcq',
      prompt: 'The pole-zero map shows poles at s = −2 and s = 1 ± j, and a zero at s = −1. Classify the system.',
      choices: STABILITY_CHOICES,
      answer: 2,
      figure: {
        type: 'pole_zero',
        poles: [
          { re: -2, im: 0 },
          { re: 1, im: 1 },
          { re: 1, im: -1 },
        ],
        zeros: [{ re: -1, im: 0 }],
      },
      explanation: 'The pair 1 ± j lies in the right half-plane, giving an oscillation growing as e^t. The zero does not matter.',
    },
    {
      id: 'stability-poles/rhp-zero',
      skillId: 'stability-poles',
      difficulty: 1,
      kind: 'true_false',
      prompt: 'A transfer function with a zero in the right half-plane is unstable.',
      answer: false,
      explanation: 'Stability is decided by the poles alone. A RHP zero makes the system non-minimum phase (e.g. initial undershoot), not unstable.',
    },
    {
      id: 'stability-poles/repeated-jw',
      skillId: 'stability-poles',
      difficulty: 3,
      kind: 'true_false',
      prompt: 'G(s) = 1/(s² + 1)² has only jω-axis poles, so it is marginally stable.',
      answer: false,
      explanation: 'The ±j poles are repeated, so the impulse response contains t·sin t, which grows without bound: unstable.',
    },
    {
      id: 'stability-poles/bibo-select',
      skillId: 'stability-poles',
      difficulty: 2,
      kind: 'multi_select',
      prompt: 'Which transfer functions are BIBO stable?',
      choices: ['1/(s + 3)', '1/(s − 1)', '(s − 2)/(s² + 3s + 2)', '1/(s(s + 1))', '1/(s² + 2s + 5)'],
      answer: [0, 2, 4],
      explanation:
        'BIBO stability needs every pole strictly in the LHP. 1/(s − 1) has a RHP pole, and the pole at s = 0 makes a step input produce an unbounded ramp.',
    },
    {
      id: 'stability-poles/jw-impulse',
      skillId: 'stability-poles',
      difficulty: 2,
      kind: 'mcq',
      prompt: 'G(s) = 9/(s² + 9). What does its impulse response do as t → ∞?',
      choices: [
        'Oscillates forever at 3 rad/s with constant amplitude',
        'Decays to zero',
        'Grows without bound',
        'Settles to a nonzero constant',
      ],
      answer: 0,
      explanation: 'The poles are ±3j, exactly on the jω axis, so the impulse response is 3·sin 3t: no decay, no growth.',
    },
    {
      id: 'stability-poles/pole-to-mode',
      skillId: 'stability-poles',
      difficulty: 2,
      kind: 'match',
      prompt: 'Match each pole location to the term it contributes to the impulse response.',
      left: ['s = −2', 's = 2', 's = ±2j', 's = 0', 's = −1 ± 2j'],
      right: [
        'Decaying exponential',
        'Growing exponential',
        'Constant-amplitude sinusoid',
        'Constant',
        'Decaying sinusoid',
      ],
      answer: [0, 1, 2, 3, 4],
      explanation: 'A pole at σ + jω contributes e^(σt) times a sinusoid at ω: σ sets growth or decay, ω sets oscillation.',
    },
    {
      id: 'stability-poles/coeff-sign',
      skillId: 'stability-poles',
      difficulty: 3,
      kind: 'mcq',
      prompt: 'Characteristic polynomial s³ + 2s² + 3s − 1. Without solving, what can you conclude?',
      choices: [
        'Unstable: a coefficient has the wrong sign',
        'Stable: the leading coefficients are positive',
        'Marginally stable',
        'Nothing without a full Routh array',
      ],
      answer: 0,
      explanation:
        'A stable polynomial must have all coefficients of the same sign, so this one is not. Here f(0) = −1 < 0 forces a real RHP root (near s = 0.28).',
    },
    {
      id: 'stability-poles/dominant-tau',
      skillId: 'stability-poles',
      difficulty: 3,
      kind: 'numeric',
      prompt: 'A stable system has poles at s = −2 and s = −10 ± j. What is the time constant of its dominant (slowest) mode?',
      answer: 0.5,
      tolerance: {},
      unit: 's',
      explanation: 'The pole closest to the jω axis decays slowest: s = −2 gives e^(−2t), so τ = 1/2 = 0.5 s.',
    },
    {
      id: 'stability-poles/near-axis',
      skillId: 'stability-poles',
      difficulty: 4,
      kind: 'mcq',
      prompt:
        'Plant P has a pole at s = 0.01; plant Q has poles at s = −0.01 ± 5j. Which statement is correct?',
      choices: [
        'P is unstable; Q is stable but very lightly damped',
        'Both are effectively marginally stable',
        'Both are stable because their poles are tiny',
        'P is stable; Q is unstable',
      ],
      answer: 0,
      explanation:
        'Stability is a sharp line at Re(s) = 0: any positive real part grows (slowly). Q decays, but with ζ ≈ 0.002 it rings for a very long time.',
    },

    // ---------------------------------------------------------------- routh-hurwitz
    {
      id: 'routh-hurwitz/what-it-tells',
      skillId: 'routh-hurwitz',
      difficulty: 1,
      kind: 'true_false',
      prompt: 'The Routh–Hurwitz test tells you how many closed-loop poles lie in the right half-plane without computing the roots.',
      answer: true,
      explanation: 'The number of sign changes in the first column of the Routh array equals the number of RHP roots.',
    },
    {
      id: 'routh-hurwitz/sign-changes-meaning',
      skillId: 'routh-hurwitz',
      difficulty: 1,
      kind: 'mcq',
      prompt: 'In a Routh array, what does the number of sign changes in the first column equal?',
      choices: [
        'The number of right half-plane roots',
        'The number of left half-plane roots',
        'The number of complex roots',
        'The system type',
      ],
      answer: 0,
      explanation: 'Each sign change in the first column corresponds to one root with positive real part.',
    },
    {
      id: 'routh-hurwitz/count-rhp',
      skillId: 'routh-hurwitz',
      difficulty: 2,
      kind: 'numeric',
      prompt: 'The first column of a Routh array for a 4th-order polynomial is 1, 2, −1, 3, 5. How many roots are in the RHP?',
      answer: 2,
      tolerance: { abs: 0 },
      explanation: 'Count sign changes down the column: 2 → −1 is one, −1 → 3 is another. Two sign changes, two RHP roots.',
    },
    {
      id: 'routh-hurwitz/positive-not-enough',
      skillId: 'routh-hurwitz',
      difficulty: 2,
      kind: 'true_false',
      prompt: 'If every coefficient of a cubic characteristic polynomial is positive, the system is guaranteed to be stable.',
      answer: false,
      explanation:
        'Positive coefficients are necessary, not sufficient, beyond 2nd order. For s³ + as² + bs + c you also need ab > c; s³ + s² + s + 2 fails.',
    },
    {
      id: 'routh-hurwitz/cubic-select',
      skillId: 'routh-hurwitz',
      difficulty: 3,
      kind: 'multi_select',
      prompt: 'Which characteristic polynomials are stable (all roots strictly in the LHP)?',
      choices: ['s³ + 2s² + 3s + 4', 's³ + s² + s + 2', 's³ + 3s² + 3s + 1', 's³ + 2s² + 2s + 4', 's³ − s² + 4s + 1'],
      answer: [0, 2],
      explanation:
        'For s³ + as² + bs + c: all positive and ab > c. 6 > 4 and 9 > 1 pass; 1 < 2 fails, 4 = 4 is marginal (roots ±j√2), and −1 fails outright.',
    },
    {
      id: 'routh-hurwitz/k-max-cubic',
      skillId: 'routh-hurwitz',
      difficulty: 2,
      kind: 'numeric',
      prompt: 'Characteristic equation s³ + 4s² + 5s + K = 0. What is the largest K for which the system is stable?',
      answer: 20,
      tolerance: {},
      explanation: 'The s¹ row is (4·5 − K)/4, positive for K < 20; the s⁰ row needs K > 0. So 0 < K < 20.',
    },
    {
      id: 'routh-hurwitz/s1-entry',
      skillId: 'routh-hurwitz',
      difficulty: 3,
      kind: 'numeric',
      prompt: 'Build the Routh array for s³ + 2s² + 3s + 4. What is the first-column entry of the s¹ row?',
      answer: 1,
      tolerance: {},
      explanation: 'Rows s³: 1, 3 and s²: 2, 4. The s¹ entry is (2·3 − 1·4)/2 = 1, so no sign change appears.',
    },
    {
      id: 'routh-hurwitz/oscillation-freq',
      skillId: 'routh-hurwitz',
      difficulty: 3,
      kind: 'numeric',
      prompt: 's³ + 3s² + 2s + K = 0 becomes marginally stable at K = 6. At what frequency does it oscillate there?',
      answer: Math.SQRT2,
      tolerance: {},
      unit: 'rad/s',
      explanation: 'The auxiliary polynomial from the s² row is 3s² + 6 = 0, so s = ±j√2 and ω ≈ 1.41 rad/s.',
    },
    {
      id: 'routh-hurwitz/zero-row',
      skillId: 'routh-hurwitz',
      difficulty: 4,
      kind: 'mcq',
      prompt: 'While building a Routh array, an entire row becomes zero. What does that indicate?',
      choices: [
        'Roots placed symmetrically about the origin, such as a ±jω pair',
        'The system is certainly stable',
        'An arithmetic mistake; a full zero row cannot occur',
        'A root exactly at s = 0 only',
      ],
      answer: 0,
      explanation:
        'A zero row means the polynomial has a factor (the auxiliary polynomial) with roots symmetric about the origin, e.g. ±jω; differentiate it to continue.',
    },
    {
      id: 'routh-hurwitz/k-max-loop',
      skillId: 'routh-hurwitz',
      difficulty: 4,
      kind: 'numeric',
      prompt: 'Unity feedback around G(s) = K/(s(s + 1)(s + 5)). What is the largest K for closed-loop stability?',
      answer: 30,
      tolerance: {},
      explanation: 'The characteristic equation is s³ + 6s² + 5s + K = 0. Routh needs 6·5 − K > 0, so K < 30.',
    },
  ],
  generators: [
    defineGenerator({
      id: 'stability-from-poles',
      skillId: 'stability-poles',
      difficulties: [1, 2, 3],
      generate(rng, d) {
        const cls = int(rng, 0, 2); // 0 stable, 1 marginal, 2 unstable
        const lhp = (): C =>
          chance(rng, 0.5) ? { re: -int(rng, 1, 6), im: 0 } : { re: -int(rng, 1, 5), im: int(rng, 1, 5) };
        const reps: C[] = [lhp()];
        if (d >= 2 || cls === 0) reps.push(lhp());
        let double: C | undefined;
        let why: string;
        if (cls === 0) {
          why = 'Every pole has a negative real part, so every mode decays: stable.';
        } else if (cls === 1) {
          reps.push(pick(rng, [{ re: 0, im: 0 }, { re: 0, im: int(rng, 1, 5) }]));
          why = 'The jω-axis pole is simple and all others are in the LHP, so one mode neither grows nor decays: marginally stable.';
        } else if (d === 3 && chance(rng, 0.5)) {
          // Repeated jω-axis poles: looks marginal, is unstable.
          double = { re: 0, im: pick(rng, [0, int(rng, 1, 4)]) };
          why = 'The jω-axis pole is repeated, which produces a t·(mode) term that grows without bound: unstable.';
        } else {
          reps.push(
            pick(rng, [
              { re: int(rng, 1, 4), im: 0 },
              { re: int(rng, 1, 3), im: int(rng, 1, 4) },
            ]),
          );
          why = 'A pole has a positive real part, so its mode grows exponentially: unstable.';
        }
        const unique = [...new Map(reps.map((p) => [`${p.re},${p.im}`, p])).values()];
        const shown = shuffle(rng, unique);
        const labels = shown.map((p) => `s = ${fmtPole(p)}`);
        const poles = expand(shown);
        if (double) {
          labels.push(`a double pole at s = ${fmtPole(double)}`);
          poles.push(...expand([double, double]));
        }
        const zeros: C[] = d >= 2 && chance(rng, 0.5) ? [{ re: int(rng, 1, 3), im: 0 }] : [];
        const zeroText = zeros.length ? `, and a zero at s = ${nice(zeros[0]!.re)}` : '';
        const zeroWhy = zeros.length ? ' The RHP zero does not affect stability.' : '';
        return {
          skillId: 'stability-poles',
          difficulty: d,
          kind: 'mcq',
          prompt: `The pole-zero map shows poles at ${labels.join(', ')}${zeroText}. Classify the system.`,
          choices: STABILITY_CHOICES,
          answer: cls,
          figure: { type: 'pole_zero', poles, zeros },
          explanation: why + zeroWhy,
        };
      },
    }),
    defineGenerator({
      id: 'routh-k-range',
      skillId: 'routh-hurwitz',
      difficulties: [2, 3, 4],
      generate(rng, d) {
        if (d === 2) {
          const a = int(rng, 1, 9);
          const b = int(rng, 1, 12);
          return {
            skillId: 'routh-hurwitz',
            difficulty: d,
            kind: 'numeric',
            prompt: `Characteristic equation s³ + ${co(a)}s² + ${co(b)}s + K = 0. What is the largest K for which the system is stable?`,
            answer: a * b,
            tolerance: {},
            explanation: `The s¹ row of the Routh array is (${a}·${b} − K)/${a}, which stays positive for K < ${a}·${b} = ${a * b} (and K > 0).`,
          };
        }
        if (d === 3) {
          const p1 = int(rng, 1, 5);
          const p2 = int(rng, p1 + 1, 10);
          const a = p1 + p2;
          const b = p1 * p2;
          return {
            skillId: 'routh-hurwitz',
            difficulty: d,
            kind: 'numeric',
            prompt: `Unity feedback around G(s) = K/(s(s + ${p1})(s + ${p2})). What is the largest K for closed-loop stability?`,
            answer: a * b,
            tolerance: {},
            explanation: `1 + G = 0 gives s³ + ${a}s² + ${b}s + K = 0. Routh needs ${a}·${b} − K > 0, so K < ${a * b}.`,
          };
        }
        const w = int(rng, 1, 6);
        const b = w * w;
        const a = int(rng, 1, 9);
        return {
          skillId: 'routh-hurwitz',
          difficulty: d,
          kind: 'numeric',
          prompt: `s³ + ${co(a)}s² + ${b}s + K = 0. At the K where stability is lost, the closed loop oscillates. At what frequency ω?`,
          answer: w,
          tolerance: {},
          unit: 'rad/s',
          explanation: `At K = ${a}·${b} = ${a * b} the s¹ row vanishes; the auxiliary polynomial ${co(a)}s² + ${a * b} = 0 gives s = ±j√${b}, so ω = ${w} rad/s.`,
        };
      },
    }),
  ],
});
