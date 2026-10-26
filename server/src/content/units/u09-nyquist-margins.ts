/**
 * U9 Nyquist & Margins: encirclements of −1, gain margin and phase margin.
 */
import { defineGenerator, defineUnit, nice, round } from '../authoring.ts';
import { pick } from '../rng.ts';

export default defineUnit({
  unitId: 'u9',
  items: [
    // ---- nyquist ------------------------------------------------------------
    {
      id: 'nyquist/z-meaning',
      skillId: 'nyquist',
      difficulty: 1,
      kind: 'mcq',
      prompt: 'In the Nyquist criterion Z = N + P for the loop L(s), what does Z count?',
      choices: [
        'Closed-loop poles in the right half-plane',
        'Open-loop poles in the right half-plane',
        'Clockwise encirclements of −1',
        'Zeros of L(s) in the right half-plane',
      ],
      answer: 0,
      explanation:
        'Z counts RHP zeros of 1 + L(s), which are the closed-loop poles. P counts RHP poles of L, and N counts clockwise encirclements of −1.',
    },
    {
      id: 'nyquist/stable-open-loop',
      skillId: 'nyquist',
      difficulty: 1,
      kind: 'true_false',
      prompt: 'If the open loop L(s) has no RHP poles (P = 0), the closed loop is stable exactly when the Nyquist plot does not encircle −1.',
      answer: true,
      explanation: 'With P = 0, Z = N, so the closed loop has no RHP poles exactly when the net encirclement count N is zero.',
    },
    {
      id: 'nyquist/symbols-match',
      skillId: 'nyquist',
      difficulty: 1,
      kind: 'match',
      prompt: 'Match each symbol in the Nyquist criterion Z = N + P to its meaning.',
      left: ['Z', 'N', 'P'],
      right: [
        'Closed-loop RHP poles',
        'Net clockwise encirclements of −1 by L(jω)',
        'Open-loop RHP poles of L(s)',
      ],
      answer: [0, 1, 2],
      explanation:
        'The argument principle applied to 1 + L(s) gives Z = N + P. Encircling −1 by L is the same as encircling the origin by 1 + L.',
    },
    {
      id: 'nyquist/two-cw',
      skillId: 'nyquist',
      difficulty: 2,
      kind: 'numeric',
      prompt: 'L(s) is open-loop stable (P = 0) and its Nyquist plot encircles −1 twice clockwise. How many closed-loop poles are in the RHP?',
      answer: 2,
      tolerance: { abs: 0 },
      explanation: 'Z = N + P = 2 + 0 = 2 closed-loop RHP poles.',
    },
    {
      id: 'nyquist/ccw-stabilizes',
      skillId: 'nyquist',
      difficulty: 2,
      kind: 'numeric',
      prompt: 'L(s) has one RHP pole (P = 1) and its Nyquist plot encircles −1 once counterclockwise. How many closed-loop RHP poles are there?',
      answer: 0,
      tolerance: { abs: 0 },
      explanation:
        'A counterclockwise encirclement counts as N = −1, so Z = −1 + 1 = 0. An unstable open loop needs CCW encirclements to be stabilized by feedback.',
    },
    {
      id: 'nyquist/symmetry',
      skillId: 'nyquist',
      difficulty: 2,
      kind: 'mcq',
      prompt: 'Why is the Nyquist plot of a real-coefficient L(s) symmetric about the real axis?',
      choices: [
        'L(−jω) is the complex conjugate of L(jω)',
        'L(jω) is always real',
        'The −1 point lies on the real axis',
        'Only stable systems have symmetric plots',
      ],
      answer: 0,
      explanation:
        'Real coefficients give L(s̄) = conj(L(s)), so the negative-frequency half is the mirror image of the positive-frequency half.',
    },
    {
      id: 'nyquist/indent',
      skillId: 'nyquist',
      difficulty: 3,
      kind: 'mcq',
      prompt: 'L(s) = K/(s(s + 1)) has a pole at the origin. How does the Nyquist contour handle it?',
      choices: [
        'It detours around s = 0 on a small semicircle, since it may not pass through poles',
        'It passes straight through s = 0',
        'The pole at the origin is counted in P',
        'The Nyquist criterion cannot be applied',
      ],
      answer: 0,
      explanation:
        'The argument principle needs a contour that avoids poles of L. The small indentation keeps s = 0 outside, so P = 0, and it maps to a large arc in the L-plane.',
    },
    {
      id: 'nyquist/unstable-cases',
      skillId: 'nyquist',
      difficulty: 3,
      kind: 'multi_select',
      prompt: 'L(s) is open-loop stable (P = 0). Which Nyquist observations mean the closed loop is unstable?',
      choices: [
        'The plot encircles −1 once clockwise',
        'The plot encircles −1 twice clockwise',
        'The plot crosses the negative real axis only at −0.5',
        'The plot passes to the right of −1 without encircling it',
      ],
      answer: [0, 1],
      explanation:
        'With P = 0, any clockwise encirclement makes Z = N > 0. A crossing at −0.5 never encloses −1, so it is stable with a gain margin of 2.',
    },
    {
      id: 'nyquist/gain-scales-plot',
      skillId: 'nyquist',
      difficulty: 3,
      kind: 'true_false',
      prompt: 'Multiplying L(s) by a gain K > 0 scales the Nyquist plot radially, so the −1 encirclement count can change with K even though the shape does not.',
      answer: true,
      explanation:
        'K·L(jω) stretches every point by K. Equivalently, you can keep L fixed and check encirclements of −1/K.',
    },
    {
      id: 'nyquist/triple-pole-kmax',
      skillId: 'nyquist',
      difficulty: 4,
      kind: 'numeric',
      prompt: 'L(s) = K/(s + 1)³. Its phase hits −180° at ω = √3. What is the largest K that keeps the closed loop stable?',
      answer: 8,
      tolerance: { rel: 0.02 },
      explanation:
        '|1 + j√3| = 2, so |L(j√3)| = K/8. The plot crosses the negative real axis at −K/8 and encircles −1 once K > 8.',
    },
    {
      id: 'nyquist/unstable-open-loop',
      skillId: 'nyquist',
      difficulty: 4,
      kind: 'mcq',
      prompt: 'L(s) = K/(s − 1) (one RHP pole). For which K > 0 is the unity-feedback closed loop stable?',
      choices: ['K > 1', 'K < 1', 'All K > 0', 'No K > 0'],
      answer: 0,
      explanation:
        'L(jω) traces a circle through 0 and −K, needing one CCW encirclement of −1 (N = −1 cancels P = 1). That happens when K > 1; directly, s − 1 + K = 0 gives s = 1 − K.',
    },

    // ---- stability-margins --------------------------------------------------
    {
      id: 'stability-margins/gm-definition',
      skillId: 'stability-margins',
      difficulty: 1,
      kind: 'mcq',
      prompt: 'The gain margin is measured at which frequency?',
      choices: [
        'The phase crossover, where ∠L(jω) = −180°',
        'The gain crossover, where |L(jω)| = 1',
        'The bandwidth frequency',
        'ω = 0',
      ],
      answer: 0,
      explanation:
        'GM = 1/|L(jω180)|: how much the gain can grow before |L| reaches 1 where the phase is −180°. Phase margin is the one read at the gain crossover.',
    },
    {
      id: 'stability-margins/pm-definition',
      skillId: 'stability-margins',
      difficulty: 1,
      kind: 'numeric',
      prompt: 'At the gain crossover frequency (|L| = 1), ∠L(jωc) = −135°. What is the phase margin?',
      answer: 45,
      tolerance: { abs: 0.5 },
      unit: '°',
      explanation: 'PM = 180° + ∠L(jωc) = 180° − 135° = 45°: the extra phase lag the loop can tolerate at crossover.',
    },
    {
      id: 'stability-margins/gm-tenth',
      skillId: 'stability-margins',
      difficulty: 1,
      kind: 'numeric',
      prompt: 'At the phase crossover frequency, |L(jω180)| = 0.1. What is the gain margin in dB?',
      answer: 20,
      tolerance: { abs: 0.2 },
      unit: 'dB',
      explanation: 'GM = 20·log10(1/0.1) = 20 dB: the loop gain can rise 10× before the closed loop goes unstable.',
    },
    {
      id: 'stability-margins/negative-gm',
      skillId: 'stability-margins',
      difficulty: 2,
      kind: 'true_false',
      prompt: 'For a stable, minimum-phase open loop with a single phase crossover, a negative gain margin (in dB) means the closed loop is unstable.',
      answer: true,
      explanation:
        'Negative GM in dB means |L(jω180)| > 1, so the Nyquist plot crosses the negative real axis left of −1 and encircles it.',
    },
    {
      id: 'stability-margins/first-order-gm',
      skillId: 'stability-margins',
      difficulty: 2,
      kind: 'true_false',
      prompt: 'L(s) = K/(s + a) with K, a > 0 has an infinite gain margin.',
      answer: true,
      explanation:
        'Its phase only approaches −90°, never −180°, so there is no phase crossover: no gain K > 0 can destabilize it.',
    },
    {
      id: 'stability-margins/pm-to-zeta',
      skillId: 'stability-margins',
      difficulty: 2,
      kind: 'mcq',
      prompt: 'A loop has a phase margin of 50°. Using the rule of thumb ζ ≈ PM/100, the closed-loop damping ratio is about:',
      choices: ['0.5', '0.05', '0.7', '5'],
      answer: 0,
      explanation:
        'For PM up to about 70°, ζ ≈ PM(°)/100, so 50° gives ζ ≈ 0.5. More phase margin means a better-damped closed loop and less overshoot.',
    },
    {
      id: 'stability-margins/triple-pole-gm',
      skillId: 'stability-margins',
      difficulty: 3,
      kind: 'numeric',
      prompt: 'L(s) = 4/(s + 1)³. At ω180 = √3 rad/s, |L| = 4/8. What is the gain margin in dB?',
      answer: 6.02,
      tolerance: { abs: 0.2 },
      unit: 'dB',
      explanation: 'GM = 20·log10(8/4) = 20·log10(2) ≈ 6.02 dB, so the gain could double before instability.',
    },
    {
      id: 'stability-margins/type1-pm',
      skillId: 'stability-margins',
      difficulty: 3,
      kind: 'numeric',
      prompt: 'L(s) = K/(s(s + 1)) with K = √2 has its gain crossover at ω = 1 rad/s. What is the phase margin?',
      answer: 45,
      tolerance: { abs: 1 },
      unit: '°',
      explanation: '∠L(j1) = −90° − arctan(1) = −135°, so PM = 180° − 135° = 45°. Check: |L(j1)| = √2/(1·√2) = 1.',
    },
    {
      id: 'stability-margins/improve-pm',
      skillId: 'stability-margins',
      difficulty: 3,
      kind: 'multi_select',
      prompt: 'L(s) = K/(s(s + 1)(s + 5)). Which changes increase the phase margin?',
      choices: [
        'Adding phase lead near the gain crossover',
        'Reducing K',
        'Adding a time delay',
        'Adding another pole below the crossover frequency',
      ],
      answer: [0, 1],
      explanation:
        'Lead adds positive phase at crossover. Lower K moves crossover to a lower ω where the lag is smaller. Delays and extra poles only add phase lag.',
    },
    {
      id: 'stability-margins/max-delay',
      skillId: 'stability-margins',
      difficulty: 4,
      kind: 'numeric',
      prompt: 'A loop has crossover ωc = 2 rad/s and phase margin 60°. What is the largest pure time delay it can tolerate before going unstable?',
      answer: Math.PI / 6,
      tolerance: { rel: 0.03 },
      unit: 's',
      explanation:
        'A delay T leaves |L| alone but adds −ωc·T rad at crossover. Instability when ωc·T = PM = π/3 rad, so T = π/6 ≈ 0.52 s.',
    },
    {
      id: 'stability-margins/margins-match',
      skillId: 'stability-margins',
      difficulty: 4,
      kind: 'match',
      prompt: 'Match each margin reading with what it tells you.',
      left: ['GM = ∞', 'PM = 0°', 'GM = 6 dB', 'PM = 60°'],
      right: [
        'The phase never reaches −180°',
        'Marginally stable: closed-loop poles on the jω axis',
        'Loop gain could roughly double before instability',
        'Well damped, about 10% overshoot',
      ],
      answer: [0, 1, 2, 3],
      explanation:
        'No phase crossover means no gain can destabilize; zero PM puts the Nyquist plot through −1. 6 dB is a gain factor of about 2, and 60° of PM gives ζ ≈ 0.6, roughly 10% overshoot.',
    },
  ],
  generators: [
    defineGenerator({
      id: 'gain-margin-db',
      skillId: 'stability-margins',
      difficulties: [2, 3, 4],
      generate(rng, d) {
        if (d === 3) {
          // L = K/(s + a)³: phase −180° at ω = √3·a, where |L| = K/(8a³).
          const a = pick(rng, [1, 2, 5]);
          const g = pick(rng, [2, 4, 5, 10, 20]);
          const k = (8 * a ** 3) / g;
          const gm = 20 * Math.log10(g);
          return {
            skillId: 'stability-margins',
            difficulty: d,
            kind: 'numeric',
            prompt: `L(s) = ${nice(k)}/(s + ${a})³. At ω180 = ${a === 1 ? '' : a}√3 rad/s, |jω180 + ${a}| = ${2 * a}. What is the gain margin in dB?`,
            answer: round(gm, 2),
            tolerance: { abs: 0.2 },
            unit: 'dB',
            explanation: `|L(jω180)| = ${nice(k)}/${2 * a}³ = ${nice(k)}/${8 * a ** 3} = 1/${g}, so GM = 20·log10(${g}) ≈ ${nice(gm, 2)} dB.`,
          };
        }
        const mag = pick(rng, [0.5, 0.4, 0.25, 0.2, 0.1, 0.05, 0.02, 0.01]);
        const w = pick(rng, [0.5, 1, 2, 3, 5, 10, 20]);
        if (d === 4) {
          const c = pick(rng, [2, 5, 10].filter((x) => x * mag !== 1));
          const gm = 20 * Math.log10(1 / (mag * c));
          return {
            skillId: 'stability-margins',
            difficulty: d,
            kind: 'numeric',
            prompt: `A loop has |L(jω180)| = ${nice(mag)} at ω180 = ${nice(w)} rad/s. If the loop gain is multiplied by ${c}, what is the new gain margin in dB?`,
            answer: round(gm, 2),
            tolerance: { abs: 0.2 },
            unit: 'dB',
            explanation: `Gain does not move ω180, so |L(jω180)| becomes ${nice(mag * c)} and GM = 20·log10(1/${nice(mag * c)}) ≈ ${nice(gm, 2)} dB${gm < 0 ? ', negative: unstable' : ''}.`,
          };
        }
        const gm = 20 * Math.log10(1 / mag);
        return {
          skillId: 'stability-margins',
          difficulty: d,
          kind: 'numeric',
          prompt: `The phase of L(jω) reaches −180° at ω = ${nice(w)} rad/s, where |L| = ${nice(mag)}. What is the gain margin in dB?`,
          answer: round(gm, 2),
          tolerance: { abs: 0.2 },
          unit: 'dB',
          explanation: `GM = 20·log10(1/|L(jω180)|) = 20·log10(${nice(1 / mag)}) ≈ ${nice(gm, 2)} dB: the gain can grow ${nice(1 / mag)}× before |L| = 1 at −180°.`,
        };
      },
    }),
  ],
});
