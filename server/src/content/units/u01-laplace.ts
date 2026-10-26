/**
 * Unit 1: Laplace & Transfer Functions (skills: laplace-basics, transfer-functions, poles-zeros).
 */
import { defineGenerator, defineUnit, nice } from '../authoring.ts';
import { chance, int, pick, shuffle } from '../rng.ts';

/** "s² + 5s + 6", "s² − s − 6", "s² + 4" style monic quadratic. */
function quad(b: number, c: number): string {
  let out = 's²';
  if (b !== 0) out += `${b > 0 ? ' + ' : ' − '}${Math.abs(b) === 1 ? '' : Math.abs(b)}s`;
  if (c !== 0) out += `${c > 0 ? ' + ' : ' − '}${Math.abs(c)}`;
  return out;
}

/** "s = −2, s = −3" for a pair of real poles, sorted descending (closest to the right first). */
function polePair(p1: number, p2: number): string {
  const [a, b] = [p1, p2].sort((x, y) => y - x) as [number, number];
  return `s = ${nice(a)}, s = ${nice(b)}`;
}

export default defineUnit({
  unitId: 'u1',
  items: [
    // ---------------------------------------------------------------- laplace-basics
    {
      id: 'laplace-basics/ramp',
      skillId: 'laplace-basics',
      difficulty: 1,
      kind: 'mcq',
      prompt: 'What is the Laplace transform of the unit ramp f(t) = t (t ≥ 0)?',
      choices: ['1/s²', '1/s', '2/s³', 's'],
      answer: 0,
      explanation: 'L{tⁿ} = n!/sⁿ⁺¹, so L{t} = 1/s². 1/s is the step; 2/s³ is t².',
    },
    {
      id: 'laplace-basics/exp-sign',
      skillId: 'laplace-basics',
      difficulty: 1,
      kind: 'true_false',
      prompt: 'True or false: L{e^(−3t)} = 1/(s − 3).',
      answer: false,
      explanation: 'L{e^(−at)} = 1/(s + a), so it is 1/(s + 3). 1/(s − 3) is the transform of the growing exponential e^(3t).',
    },
    {
      id: 'laplace-basics/basic-pairs',
      skillId: 'laplace-basics',
      difficulty: 1,
      kind: 'match',
      prompt: 'Match each time function (t ≥ 0) to its Laplace transform.',
      left: ['δ(t)', 'u(t)', 't', 'e^(−at)'],
      right: ['1', '1/s', '1/s²', '1/(s + a)'],
      answer: [0, 1, 2, 3],
      explanation: 'The impulse transforms to 1, the step to 1/s, the ramp to 1/s², and e^(−at) shifts the step pole from 0 to −a.',
    },
    {
      id: 'laplace-basics/cosine',
      skillId: 'laplace-basics',
      difficulty: 2,
      kind: 'mcq',
      prompt: 'What is L{cos ωt}?',
      choices: ['s/(s² + ω²)', 'ω/(s² + ω²)', 's/(s² − ω²)', '1/(s² + ω²)'],
      answer: 0,
      explanation: 'Cosine has an s in the numerator: L{cos ωt} = s/(s² + ω²). ω/(s² + ω²) is sin ωt; s² − ω² gives cosh.',
    },
    {
      id: 'laplace-basics/fvt-basic',
      skillId: 'laplace-basics',
      difficulty: 2,
      kind: 'numeric',
      prompt: 'Y(s) = 10/(s(s + 5)). Use the final value theorem: what is y(∞)?',
      answer: 2,
      tolerance: {},
      explanation: 'y(∞) = lim s→0 of s·Y(s) = 10/(0 + 5) = 2. Valid because the remaining pole at −5 is in the left half-plane.',
    },
    {
      id: 'laplace-basics/inverse-step-exp',
      skillId: 'laplace-basics',
      difficulty: 2,
      kind: 'mcq',
      prompt: 'What is the inverse Laplace transform of 1/(s(s + 1))?',
      choices: ['1 − e^(−t)', 'e^(−t)', '1 + e^(−t)', 't·e^(−t)'],
      answer: 0,
      explanation: 'Partial fractions: 1/(s(s + 1)) = 1/s − 1/(s + 1), so y(t) = 1 − e^(−t). It is the step response of 1/(s + 1).',
    },
    {
      id: 'laplace-basics/derivative-ic',
      skillId: 'laplace-basics',
      difficulty: 3,
      kind: 'mcq',
      prompt: 'If y(0) = 2, what is L{dy/dt}?',
      choices: ['sY(s) − 2', 'sY(s) + 2', 'sY(s)', 'Y(s)/s − 2'],
      answer: 0,
      explanation: 'L{y′} = sY(s) − y(0). The initial condition is subtracted; dividing by s is integration, not differentiation.',
    },
    {
      id: 'laplace-basics/ivt',
      skillId: 'laplace-basics',
      difficulty: 3,
      kind: 'numeric',
      prompt: 'Y(s) = (3s + 1)/(s² + 4s + 5). Use the initial value theorem: what is y(0⁺)?',
      answer: 3,
      tolerance: {},
      explanation: 'y(0⁺) = lim s→∞ of s·Y(s) = lim (3s² + s)/(s² + 4s + 5) = 3, the ratio of leading coefficients.',
    },
    {
      id: 'laplace-basics/damped-sine',
      skillId: 'laplace-basics',
      difficulty: 3,
      kind: 'mcq',
      prompt: 'What is L{e^(−2t)·sin 3t}?',
      choices: ['3/(s² + 4s + 13)', '3/(s² + 4s + 9)', '(s + 2)/(s² + 4s + 13)', '3/(s² − 4s + 13)'],
      answer: 0,
      explanation: 'Frequency shift: replace s by s + 2 in 3/(s² + 9), giving 3/((s + 2)² + 9) = 3/(s² + 4s + 13).',
    },
    {
      id: 'laplace-basics/fvt-unstable',
      skillId: 'laplace-basics',
      difficulty: 4,
      kind: 'true_false',
      prompt: 'True or false: for Y(s) = 1/(s(s − 2)), the final value theorem correctly gives y(∞) = −1/2.',
      answer: false,
      explanation: 'The FVT only holds if every pole of s·Y(s) is in the open left half-plane. Here s = 2 is unstable, so y(t) grows without bound.',
    },
    {
      id: 'laplace-basics/properties',
      skillId: 'laplace-basics',
      difficulty: 4,
      kind: 'multi_select',
      prompt: 'Which Laplace transform properties are correct? (F, G are the transforms of f, g)',
      choices: [
        'L{f(t − T)·u(t − T)} = e^(−sT)·F(s)',
        'L{e^(−at)·f(t)} = F(s + a)',
        'L{f(t)·g(t)} = F(s)·G(s)',
        'L{∫₀ᵗ f(τ)dτ} = F(s)/s',
        'L{f(at)} = F(s/a)',
      ],
      answer: [0, 1, 3],
      explanation: 'Time delay multiplies by e^(−sT), damping shifts s, integration divides by s. Products in s come from convolution in time, and L{f(at)} = (1/a)·F(s/a).',
    },
    {
      id: 'laplace-basics/partial-fractions',
      skillId: 'laplace-basics',
      difficulty: 4,
      kind: 'mcq',
      prompt: 'What is the inverse Laplace transform of 1/((s + 1)(s + 2))?',
      choices: ['e^(−t) − e^(−2t)', 'e^(−t) + e^(−2t)', 'e^(−2t) − e^(−t)', '(e^(−t) − e^(−2t))/2'],
      answer: 0,
      explanation: 'Residues: at s = −1 it is 1/(−1 + 2) = 1, at s = −2 it is 1/(−2 + 1) = −1. So y(t) = e^(−t) − e^(−2t).',
    },
    {
      id: 'laplace-basics/fvt-oscillation',
      skillId: 'laplace-basics',
      difficulty: 5,
      kind: 'true_false',
      prompt: 'True or false: the final value theorem can be applied to Y(s) = 4/(s(s² + 4)).',
      answer: false,
      explanation: 's·Y(s) has poles at ±2j on the imaginary axis, so y(t) = 1 − cos 2t oscillates forever and has no final value.',
    },

    // ---------------------------------------------------------------- transfer-functions
    {
      id: 'transfer-functions/zero-ic',
      skillId: 'transfer-functions',
      difficulty: 1,
      kind: 'mcq',
      prompt: 'A transfer function G(s) = Y(s)/U(s) is defined assuming:',
      choices: ['Zero initial conditions', 'A unit-step input', 'The system has reached steady state', 'Unity feedback'],
      answer: 0,
      explanation: 'With zero initial conditions the output transform is purely G(s)·U(s), so their ratio describes the system alone, for any input.',
    },
    {
      id: 'transfer-functions/dc-gain-simple',
      skillId: 'transfer-functions',
      difficulty: 1,
      kind: 'numeric',
      prompt: 'What is the DC (steady-state) gain of G(s) = 12/(s + 4)?',
      answer: 3,
      tolerance: {},
      explanation: 'DC gain is G(0) = 12/4 = 3: a constant input settles at 3 times its size.',
    },
    {
      id: 'transfer-functions/input-independent',
      skillId: 'transfer-functions',
      difficulty: 1,
      kind: 'true_false',
      prompt: 'True or false: the transfer function of an LTI system changes depending on which input signal is applied.',
      answer: false,
      explanation: 'G(s) is a property of the system alone. The input only enters through U(s) in Y(s) = G(s)·U(s).',
    },
    {
      id: 'transfer-functions/ode-to-tf',
      skillId: 'transfer-functions',
      difficulty: 2,
      kind: 'mcq',
      prompt: 'y″ + 3y′ + 2y = 4u with zero initial conditions. What is G(s) = Y(s)/U(s)?',
      choices: ['4/(s² + 3s + 2)', '4/(s² + 2s + 3)', '(s² + 3s + 2)/4', '4s/(s² + 3s + 2)'],
      answer: 0,
      explanation: 'Each derivative becomes a factor of s: (s² + 3s + 2)Y = 4U, so G(s) = 4/(s² + 3s + 2).',
    },
    {
      id: 'transfer-functions/step-steady-state',
      skillId: 'transfer-functions',
      difficulty: 2,
      kind: 'numeric',
      prompt: 'A step of size 3 is applied to the stable system G(s) = 4/(s + 2). What is the steady-state output?',
      answer: 6,
      tolerance: {},
      explanation: 'Steady-state output = step size × DC gain = 3·G(0) = 3·4/2 = 6.',
    },
    {
      id: 'transfer-functions/impulse-responses',
      skillId: 'transfer-functions',
      difficulty: 2,
      kind: 'match',
      prompt: 'Match each transfer function to its impulse response.',
      left: ['1/(s + 2)', '1/s²', '1/(s + 2)²', '2/(s² + 4)'],
      right: ['e^(−2t)', 't', 't·e^(−2t)', 'sin 2t'],
      answer: [0, 1, 2, 3],
      explanation: 'The impulse response is the inverse transform of G(s) itself, since L{δ(t)} = 1.',
    },
    {
      id: 'transfer-functions/dc-gain-second-order',
      skillId: 'transfer-functions',
      difficulty: 3,
      kind: 'numeric',
      prompt: 'What is the DC gain of G(s) = (2s + 6)/(s² + 5s + 3)?',
      answer: 2,
      tolerance: {},
      explanation: 'Set s = 0: G(0) = 6/3 = 2. Only the constant terms matter at DC.',
    },
    {
      id: 'transfer-functions/ode-with-input-derivative',
      skillId: 'transfer-functions',
      difficulty: 3,
      kind: 'mcq',
      prompt: 'y″ + 4y′ + 3y = 2u′ + u with zero initial conditions. What is G(s)?',
      choices: ['(2s + 1)/(s² + 4s + 3)', '(s + 2)/(s² + 4s + 3)', '3/(s² + 4s + 3)', '(2s + 1)/(s² + 3s + 4)'],
      answer: 0,
      explanation: 'Input derivatives build the numerator: (s² + 4s + 3)Y = (2s + 1)U, so G(s) = (2s + 1)/(s² + 4s + 3).',
    },
    {
      id: 'transfer-functions/strictly-proper',
      skillId: 'transfer-functions',
      difficulty: 3,
      kind: 'multi_select',
      prompt: 'Which transfer functions are strictly proper?',
      choices: ['1/(s + 1)', '(s + 2)/(s² + 3s + 2)', '(s² + 1)/(s² + 2s + 1)', 's³/(s + 1)', '5/(s² + 1)'],
      answer: [0, 1, 4],
      explanation: 'Strictly proper means numerator degree < denominator degree. Equal degrees is just proper (biproper); s³/(s + 1) is improper.',
    },
    {
      id: 'transfer-functions/impulse-to-dc-gain',
      skillId: 'transfer-functions',
      difficulty: 4,
      kind: 'numeric',
      prompt: 'A system has impulse response h(t) = 3e^(−2t). What is its DC gain?',
      answer: 1.5,
      tolerance: {},
      explanation: 'G(s) = L{h} = 3/(s + 2), so G(0) = 1.5. Equivalently, the area under h(t) is 3/2.',
    },
    {
      id: 'transfer-functions/feedthrough',
      skillId: 'transfer-functions',
      difficulty: 4,
      kind: 'true_false',
      prompt: 'True or false: if G(s) has equal numerator and denominator degree, its step response jumps to a nonzero value at t = 0⁺.',
      answer: true,
      explanation: 'By the initial value theorem y(0⁺) = lim s→∞ G(s), the ratio of leading coefficients, which is nonzero: there is direct feedthrough.',
    },
    {
      id: 'transfer-functions/rhp-zero-undershoot',
      skillId: 'transfer-functions',
      difficulty: 5,
      kind: 'mcq',
      prompt: 'How does the unit-step response of G(s) = (1 − s)/(s + 1)² start out?',
      choices: [
        'It first moves opposite to its final value (undershoot)',
        'It heads straight toward its final value',
        'It jumps instantly to its final value',
        'It oscillates around its final value',
      ],
      answer: 0,
      explanation: 'The right-half-plane zero at s = 1 gives y′(0⁺) = lim s→∞ s·G(s) = −1, while y(∞) = G(0) = +1, so it dips first.',
    },

    // ---------------------------------------------------------------- poles-zeros
    {
      id: 'poles-zeros/single-pole',
      skillId: 'poles-zeros',
      difficulty: 1,
      kind: 'numeric',
      prompt: 'Where is the pole of G(s) = 5/(s + 3)? Enter its value of s.',
      answer: -3,
      tolerance: { abs: 0.01 },
      explanation: 'Poles are where the denominator is zero: s + 3 = 0 gives s = −3.',
    },
    {
      id: 'poles-zeros/char-eq',
      skillId: 'poles-zeros',
      difficulty: 1,
      kind: 'true_false',
      prompt: 'True or false: the poles of a transfer function are the roots of its denominator (the characteristic equation).',
      answer: true,
      explanation: 'Poles make G(s) blow up, i.e. the denominator is zero. Zeros are the roots of the numerator.',
    },
    {
      id: 'poles-zeros/find-zero',
      skillId: 'poles-zeros',
      difficulty: 1,
      kind: 'mcq',
      prompt: 'Where are the zeros of G(s) = (s + 2)/(s² + 4s + 3)?',
      choices: ['s = −2', 's = 2', 's = −1 and s = −3', 's = −1'],
      answer: 0,
      explanation: 'Zeros are roots of the numerator: s + 2 = 0 gives s = −2. The denominator roots −1 and −3 are the poles.',
    },
    {
      id: 'poles-zeros/mode-match',
      skillId: 'poles-zeros',
      difficulty: 2,
      kind: 'match',
      prompt: 'Match each pole location to the time-domain mode it produces.',
      left: ['s = −2', 's = 0', 's = ±3j', 's = 1'],
      right: ['Decaying e^(−2t)', 'Constant', 'Sustained oscillation at 3 rad/s', 'Growing e^(t)'],
      answer: [0, 1, 2, 3],
      explanation: 'A pole at s = σ ± jω gives a mode e^(σt) with oscillation at ω: σ < 0 decays, σ = 0 persists, σ > 0 grows.',
    },
    {
      id: 'poles-zeros/read-map',
      skillId: 'poles-zeros',
      difficulty: 2,
      kind: 'mcq',
      prompt: 'Which transfer function matches this pole-zero map (up to a gain K)?',
      figure: { type: 'pole_zero', poles: [{ re: -1, im: 0 }, { re: -4, im: 0 }], zeros: [{ re: -2, im: 0 }] },
      choices: ['K(s + 2)/((s + 1)(s + 4))', 'K(s − 2)/((s − 1)(s − 4))', 'K(s + 1)(s + 4)/(s + 2)', 'K(s + 2)/((s + 1)(s − 4))'],
      answer: 0,
      explanation: 'Crosses are poles at −1 and −4, giving factors (s + 1)(s + 4) below; the circle is a zero at −2, giving (s + 2) on top.',
    },
    {
      id: 'poles-zeros/fastest-mode',
      skillId: 'poles-zeros',
      difficulty: 2,
      kind: 'mcq',
      prompt: 'Which pole gives the fastest-decaying mode?',
      choices: ['s = −5', 's = −1 ± 10j', 's = −0.5', 's = 2'],
      answer: 0,
      explanation: 'Decay rate is set by the real part: e^(−5t) dies fastest. A large imaginary part means faster oscillation, not faster decay.',
    },
    {
      id: 'poles-zeros/damped-frequency',
      skillId: 'poles-zeros',
      difficulty: 3,
      kind: 'numeric',
      prompt: 'G(s) = 1/(s² + 6s + 25). At what frequency does its impulse response oscillate?',
      answer: 4,
      tolerance: {},
      unit: 'rad/s',
      explanation: 'Completing the square, s² + 6s + 25 = (s + 3)² + 16, so the poles are −3 ± 4j. The imaginary part, 4 rad/s, is the oscillation frequency.',
    },
    {
      id: 'poles-zeros/map-statements',
      skillId: 'poles-zeros',
      difficulty: 3,
      kind: 'multi_select',
      prompt: 'Poles at −2 ± 3j and −1, zero at −5 (shown). Which statements are true?',
      figure: {
        type: 'pole_zero',
        poles: [
          { re: -2, im: 3 },
          { re: -2, im: -3 },
          { re: -1, im: 0 },
        ],
        zeros: [{ re: -5, im: 0 }],
      },
      choices: [
        'The system is stable',
        'The step response contains a 3 rad/s oscillation',
        'The slowest-decaying mode is e^(−t)',
        'There is a zero in the right half-plane',
        'The system has two poles',
      ],
      answer: [0, 1, 2],
      explanation: 'All three poles have negative real parts, so it is stable. The complex pair oscillates at 3 rad/s, and the pole at −1 is closest to the axis, so it decays slowest.',
    },
    {
      id: 'poles-zeros/cancellation',
      skillId: 'poles-zeros',
      difficulty: 4,
      kind: 'mcq',
      prompt: 'G(s) = (s + 1)/(s³ + 3s² + 2s). After cancelling common factors, where are its poles?',
      choices: ['s = 0 and s = −2', 's = 0, s = −1 and s = −2', 's = −1 and s = −2', 's = 1 and s = 2'],
      answer: 0,
      explanation: 's³ + 3s² + 2s = s(s + 1)(s + 2). The (s + 1) cancels the zero, leaving poles at 0 and −2.',
    },
    {
      id: 'poles-zeros/rhp-cancellation',
      skillId: 'poles-zeros',
      difficulty: 4,
      kind: 'true_false',
      prompt: 'True or false: cancelling an unstable plant pole at s = 1 with a controller zero at s = 1 makes the closed loop internally stable.',
      answer: false,
      explanation: 'The unstable mode is hidden, not removed: it still appears in other loop transfer functions, and any slight mismatch or initial condition excites it.',
    },
    {
      id: 'poles-zeros/dipole',
      skillId: 'poles-zeros',
      difficulty: 5,
      kind: 'true_false',
      prompt: 'True or false: a pole at s = −1 with a zero at s = −1.05 contributes only a small-amplitude e^(−t) term to the step response.',
      answer: true,
      explanation: 'The residue at a pole scales with its distance to nearby zeros. A near-cancelling pole-zero pair (a dipole) leaves a tiny residue, so that mode barely shows.',
    },
  ],
  generators: [
    defineGenerator({
      id: 'laplace-pair',
      skillId: 'laplace-basics',
      difficulties: [1, 2, 3],
      generate(rng, d) {
        const a = int(rng, 1, 9);
        const w = int(rng, 2, 9);
        const w2 = w * w;
        const at = a === 1 ? 't' : `${a}t`;
        const form = d === 1 ? 'exp' : d === 2 ? pick(rng, ['texp', 'sin'] as const) : pick(rng, ['dsin', 'texp'] as const);
        let fn: string;
        let choices: string[];
        let why: string;
        switch (form) {
          case 'exp':
            fn = `e^(−${at})`;
            choices = [`1/(s + ${a})`, `1/(s − ${a})`, `1/(s + ${a})²`, `${a}/(s(s + ${a}))`];
            why = `L{e^(−at)} = 1/(s + a): a decaying exponential is a pole at s = −${a}. 1/(s − ${a}) would grow.`;
            break;
          case 'texp':
            fn = `t·e^(−${at})`;
            choices = [`1/(s + ${a})²`, `1/(s + ${a})`, `1/(s − ${a})²`, `2/(s + ${a})³`];
            why = `L{t} = 1/s², and multiplying by e^(−${at}) shifts s → s + ${a}, giving a double pole: 1/(s + ${a})².`;
            break;
          case 'sin':
            fn = `sin ${w}t`;
            choices = [`${w}/(s² + ${w2})`, `s/(s² + ${w2})`, `${w}/(s² − ${w2})`, `1/(s² + ${w2})`];
            why = `L{sin ωt} = ω/(s² + ω²) with ω = ${w}. The s-numerator version is cosine; s² − ω² is sinh.`;
            break;
          case 'dsin':
            fn = `e^(−${at})·sin ${w}t`;
            choices = [
              `${w}/((s + ${a})² + ${w2})`,
              `${w}/((s − ${a})² + ${w2})`,
              `(s + ${a})/((s + ${a})² + ${w2})`,
              `${w}/((s + ${a})² − ${w2})`,
            ];
            why = `Start from ${w}/(s² + ${w2}) and apply the frequency shift s → s + ${a} for the e^(−${at}) factor.`;
            break;
        }
        return {
          skillId: 'laplace-basics',
          difficulty: d,
          kind: 'mcq',
          prompt: `What is the Laplace transform of ${fn}?`,
          choices,
          answer: 0,
          explanation: why,
        };
      },
    }),
    defineGenerator({
      id: 'final-value',
      skillId: 'transfer-functions',
      difficulties: [1, 2, 3],
      generate(rng, d) {
        const amp = d === 1 ? 1 : int(rng, 2, 5);
        let tf: string;
        let dc: number;
        let dcText: string;
        if (d < 3) {
          const a = int(rng, 2, 8);
          const k = int(rng, 1, 9);
          tf = `${k * a}/(s + ${a})`;
          dc = k;
          dcText = `${k * a}/${a}`;
        } else {
          const r1 = int(rng, 1, 4);
          const r2 = int(rng, r1 + 1, 6);
          const q = r1 * r2;
          const n = int(rng, 2, 30);
          tf = `${n}/(${quad(r1 + r2, q)})`;
          dc = n / q;
          dcText = `${n}/${q}`;
        }
        const answer = amp * dc;
        const input = amp === 1 ? 'A unit step is' : `A step of size ${amp} is`;
        return {
          skillId: 'transfer-functions',
          difficulty: d,
          kind: 'numeric',
          prompt: `${input} applied to G(s) = ${tf}. Use the final value theorem: what is y(∞)?`,
          answer,
          tolerance: {},
          explanation: `y(∞) = lim s→0 of s·(${amp}/s)·G(s) = ${amp === 1 ? '' : `${amp}·`}G(0) = ${amp === 1 ? '' : `${amp}·`}${dcText} ${Number.isInteger(answer) ? "=" : "≈"} ${nice(answer)}. The FVT applies because all poles are in the left half-plane.`,
        };
      },
    }),
    defineGenerator({
      id: 'tf-poles',
      skillId: 'poles-zeros',
      difficulties: [1, 2, 3],
      generate(rng, d) {
        if (d < 3) {
          const hi = d === 1 ? 6 : 12;
          const r1 = int(rng, 1, hi - 1);
          const r2 = int(rng, r1 + 1, hi);
          const askSlow = d === 1 ? true : chance(rng, 0.5);
          const answer = askSlow ? -r1 : -r2;
          return {
            skillId: 'poles-zeros',
            difficulty: d,
            kind: 'numeric',
            prompt: `G(s) = 1/(${quad(r1 + r2, r1 * r2)}) has two real poles. Which pole is ${askSlow ? 'slower (closer to the origin)' : 'faster (farther from the origin)'}? Enter its value of s.`,
            answer,
            tolerance: { abs: 0.01 },
            explanation: `Factor: ${quad(r1 + r2, r1 * r2)} = (s + ${r1})(s + ${r2}), so the poles are −${r1} and −${r2}. The ${askSlow ? 'slower' : 'faster'} one is ${nice(answer)}.`,
          };
        }
        // d3: possibly one unstable pole; mcq on the pair.
        const m1 = int(rng, 1, 6);
        let m2 = int(rng, 1, 6);
        if (m2 === m1) m2 = m1 === 6 ? 1 : m1 + 1;
        const p1 = chance(rng, 0.5) ? m1 : -m1;
        const p2 = -m2;
        const b = -(p1 + p2);
        const c = p1 * p2;
        const correct = polePair(p1, p2);
        const candidates = [polePair(-p1, -p2), polePair(-p1, p2), polePair(p1, -p2), polePair(-b, -c), polePair(b, c)];
        const choices = [correct];
        for (const cand of shuffle(rng, candidates)) {
          if (choices.length < 4 && !choices.includes(cand)) choices.push(cand);
        }
        const f1 = p1 < 0 ? `(s + ${-p1})` : `(s − ${p1})`;
        const f2 = `(s + ${-p2})`;
        return {
          skillId: 'poles-zeros',
          difficulty: d,
          kind: 'mcq',
          prompt: `Where are the poles of G(s) = 1/(${quad(b, c)})?`,
          choices,
          answer: 0,
          explanation: `${quad(b, c)} = ${f1}${f2}: find two numbers with product ${nice(c)} and sum ${nice(b)}. The poles are the roots, so the signs flip: ${correct}.`,
        };
      },
    }),
  ],
});
