/**
 * U8 Frequency Response: sinusoidal steady state and Bode magnitude plots.
 */
import { defineGenerator, defineUnit, nice, round } from '../authoring.ts';
import { int, pick, shuffle } from '../rng.ts';
import type { FigureSpec } from '../types.ts';

/**
 * Transfer function in Bode form:
 * G(s) = k · Π(s/z + 1) / (s^integrators · Π(s/p + 1)), with real LHP corners z, p > 0.
 */
export interface BodeTf {
  k: number;
  zeros?: number[];
  poles?: number[];
  integrators?: number;
}

/** Exact |G(jω)| in dB. */
export function magDb(tf: BodeTf, w: number): number {
  let db = 20 * Math.log10(tf.k) - 20 * (tf.integrators ?? 0) * Math.log10(w);
  for (const z of tf.zeros ?? []) db += 10 * Math.log10(1 + (w / z) ** 2);
  for (const p of tf.poles ?? []) db -= 10 * Math.log10(1 + (w / p) ** 2);
  return db;
}

/** Straight-line (asymptotic) magnitude in dB. */
export function asymptoteDb(tf: BodeTf, w: number): number {
  let db = 20 * Math.log10(tf.k) - 20 * (tf.integrators ?? 0) * Math.log10(w);
  for (const z of tf.zeros ?? []) db += Math.max(0, 20 * Math.log10(w / z));
  for (const p of tf.poles ?? []) db -= Math.max(0, 20 * Math.log10(w / p));
  return db;
}

/**
 * A `bode_mag` figure computed from the transfer function: exact magnitude at
 * 10 log-spaced points per decade over [10^loDec, 10^hiDec], plus the straight-line
 * asymptotes (exact at the end points and every corner frequency in range).
 */
export function bodeFigure(tf: BodeTf, loDec: number, hiDec: number): FigureSpec {
  const points: [number, number][] = [];
  for (let i = loDec * 10; i <= hiDec * 10; i++) {
    const w = 10 ** (i / 10);
    points.push([round(w, 4), round(magDb(tf, w), 2)]);
  }
  const lo = 10 ** loDec;
  const hi = 10 ** hiDec;
  const corners = [...(tf.zeros ?? []), ...(tf.poles ?? [])].filter((c) => c > lo && c < hi);
  const ws = [...new Set([lo, ...corners, hi])].sort((a, b) => a - b);
  const asymptotes = ws.map((w): [number, number] => [round(w, 4), round(asymptoteDb(tf, w), 2)]);
  return { type: 'bode_mag', points, asymptotes };
}

const DB_K = [0.1, 0.5, 2, 5, 10, 20, 50, 100, 200, 1000];

export default defineUnit({
  unitId: 'u8',
  items: [
    // ---- frequency-response -------------------------------------------------
    {
      id: 'frequency-response/sinusoid-in-out',
      skillId: 'frequency-response',
      difficulty: 1,
      kind: 'mcq',
      prompt: 'A stable LTI system G(s) is driven by sin(ωt). In steady state, the output is:',
      choices: [
        'A sinusoid at ω, scaled by |G(jω)| and shifted by ∠G(jω)',
        'A sinusoid at 2ω',
        'A sinusoid at ω with the same amplitude and phase',
        'A decaying exponential',
      ],
      answer: 0,
      explanation:
        'Linear time-invariant systems cannot create new frequencies. Once transients die out, the output is the input sinusoid scaled by |G(jω)| and phase-shifted by ∠G(jω).',
    },
    {
      id: 'frequency-response/gain-to-db',
      skillId: 'frequency-response',
      difficulty: 1,
      kind: 'true_false',
      prompt: 'A magnitude ratio of 0.1 corresponds to −20 dB.',
      answer: true,
      explanation: 'dB = 20·log10|G| = 20·log10(0.1) = 20·(−1) = −20 dB.',
    },
    {
      id: 'frequency-response/dc-input',
      skillId: 'frequency-response',
      difficulty: 1,
      kind: 'numeric',
      prompt: 'G(s) = 5/(s + 1) is driven by a constant input u = 2. What is the steady-state output?',
      answer: 10,
      tolerance: {},
      explanation: 'A constant is a sinusoid at ω = 0, so the output is G(0)·2 = 5·2 = 10.',
    },
    {
      id: 'frequency-response/first-order-amplitude',
      skillId: 'frequency-response',
      difficulty: 2,
      kind: 'numeric',
      prompt: 'G(s) = 1/(s + 1) with input u(t) = 2 sin(t). What is the steady-state output amplitude?',
      answer: Math.SQRT2,
      tolerance: { rel: 0.02 },
      explanation: '|G(j1)| = 1/|1 + j| = 1/√2, so the amplitude is 2/√2 = √2 ≈ 1.414.',
    },
    {
      id: 'frequency-response/first-order-phase',
      skillId: 'frequency-response',
      difficulty: 2,
      kind: 'mcq',
      prompt: 'What is the phase of G(s) = 1/(s + 1) at ω = 1 rad/s?',
      choices: ['−45°', '−90°', '+45°', '0°'],
      answer: 0,
      explanation: '∠G(jω) = −arctan(ω/1); at ω = 1 that is −arctan(1) = −45°. The corner frequency is where a first-order pole contributes half its −90°.',
    },
    {
      id: 'frequency-response/integrator-amplitude',
      skillId: 'frequency-response',
      difficulty: 2,
      kind: 'numeric',
      prompt: 'An integrator G(s) = 1/s is driven by sin(2t). What is the steady-state output amplitude?',
      answer: 0.5,
      tolerance: { rel: 0.02 },
      explanation: '|G(jω)| = 1/ω = 1/2. Indeed ∫sin(2t)dt = −cos(2t)/2: amplitude 0.5, lagging by 90°.',
    },
    {
      id: 'frequency-response/high-freq-phase-match',
      skillId: 'frequency-response',
      difficulty: 3,
      kind: 'match',
      prompt: 'Match each transfer function to its phase as ω → ∞.',
      left: ['1/(s + 1)', '1/(s + 1)²', '(s + 1)/(s + 10)', '1/(s + 1)³'],
      right: ['−90°', '−180°', '0°', '−270°'],
      answer: [0, 1, 2, 3],
      explanation:
        'At high frequency each LHP pole contributes −90° and each LHP zero +90°, so the phase tends to −90°·(n − m).',
    },
    {
      id: 'frequency-response/delay',
      skillId: 'frequency-response',
      difficulty: 3,
      kind: 'mcq',
      prompt: 'What is the frequency response of a pure time delay G(s) = e^(−sT)?',
      choices: [
        '|G| = 1, phase = −ωT rad',
        '|G| = e^(−ωT), phase = 0',
        '|G| = 1, phase = −90° at all ω',
        '|G| = 1/(ωT), phase = −ωT rad',
      ],
      answer: 0,
      explanation:
        'e^(−jωT) has unit magnitude and angle −ωT. A delay never changes gain but adds phase lag that grows linearly with ω.',
    },
    {
      id: 'frequency-response/lowpass-facts',
      skillId: 'frequency-response',
      difficulty: 3,
      kind: 'multi_select',
      prompt: 'For G(s) = 10/(s + 10), which statements are true?',
      choices: [
        'DC gain is 1 (0 dB)',
        '|G(j10)| ≈ −3 dB',
        'Phase at ω = 10 rad/s is −45°',
        'Phase tends to −180° as ω → ∞',
        '|G(jω)| increases with ω',
      ],
      answer: [0, 1, 2],
      explanation:
        'G(0) = 10/10 = 1. At the corner ω = 10, |G| = 1/√2 (−3 dB) and phase −45°. A single pole only reaches −90°, and the magnitude rolls off.',
    },
    {
      id: 'frequency-response/resonance-at-wn',
      skillId: 'frequency-response',
      difficulty: 4,
      kind: 'numeric',
      prompt: 'G(s) = ωn²/(s² + 2ζωn·s + ωn²) with ζ = 0.25. What is |G(jωn)| (as a ratio)?',
      answer: 2,
      tolerance: { rel: 0.02 },
      explanation: 'At ω = ωn the real parts cancel: G(jωn) = ωn²/(j·2ζωn²) = 1/(2ζ·j), so |G| = 1/(2ζ) = 2.',
    },
    {
      id: 'frequency-response/resonant-peak',
      skillId: 'frequency-response',
      difficulty: 4,
      kind: 'mcq',
      prompt: 'A standard second-order low-pass G(s) = ωn²/(s² + 2ζωn·s + ωn²) has a resonant peak above 0 dB when:',
      choices: ['ζ < 1/√2 ≈ 0.707', 'ζ < 1', 'ζ > 0.707', 'Always, for any ζ > 0'],
      answer: 0,
      explanation:
        'The peak is at ωr = ωn·√(1 − 2ζ²), which only exists for ζ < 1/√2. Between 0.707 and 1 the system is underdamped in time yet shows no peak.',
    },

    // ---- bode-plots ---------------------------------------------------------
    {
      id: 'bode-plots/pole-slope',
      skillId: 'bode-plots',
      difficulty: 1,
      kind: 'mcq',
      prompt: 'Above its corner frequency, a single real pole changes the Bode magnitude slope by:',
      choices: ['−20 dB/decade', '−6 dB/decade', '−40 dB/decade', '−10 dB/decade'],
      answer: 0,
      explanation:
        'For ω ≫ p, |1/(1 + jω/p)| ≈ p/ω, which falls by 10× (−20 dB) per decade. That is the same as −6 dB per octave, a common mix-up.',
    },
    {
      id: 'bode-plots/gain-10-db',
      skillId: 'bode-plots',
      difficulty: 1,
      kind: 'numeric',
      prompt: 'A transfer function has DC gain 10. What is that in dB?',
      answer: 20,
      tolerance: { abs: 0.1 },
      unit: 'dB',
      explanation: '20·log10(10) = 20 dB. Magnitudes use 20·log10 because dB measures power, which goes as amplitude squared.',
    },
    {
      id: 'bode-plots/zero-slope',
      skillId: 'bode-plots',
      difficulty: 1,
      kind: 'true_false',
      prompt: 'A real LHP zero adds +20 dB/decade to the magnitude slope above its corner frequency.',
      answer: true,
      explanation: 'For ω ≫ z, |1 + jω/z| ≈ ω/z, which grows 10× per decade: +20 dB/dec, the mirror image of a pole.',
    },
    {
      id: 'bode-plots/read-dc-gain',
      skillId: 'bode-plots',
      difficulty: 2,
      kind: 'numeric',
      prompt: 'The Bode magnitude plot shows a first-order low-pass. What is its DC gain as a plain ratio (not dB)?',
      figure: bodeFigure({ k: 10, poles: [5] }, -2, 3),
      answer: 10,
      tolerance: { rel: 0.05 },
      explanation: 'The low-frequency plateau sits at 20 dB, and 10^(20/20) = 10. This is G(s) = 10/(s/5 + 1).',
    },
    {
      id: 'bode-plots/read-corner',
      skillId: 'bode-plots',
      difficulty: 2,
      kind: 'mcq',
      prompt: 'The plot shows the Bode magnitude of a single-pole low-pass. What is its corner frequency?',
      figure: bodeFigure({ k: 2, poles: [10] }, -1, 3),
      choices: ['10 rad/s', '1 rad/s', '100 rad/s', '3 rad/s'],
      answer: 0,
      explanation:
        'The asymptotes meet at ω = 10 rad/s, where the true curve is 3 dB below the plateau (6 − 3 ≈ 3 dB). This is G(s) = 2/(s/10 + 1).',
    },
    {
      id: 'bode-plots/corner-error',
      skillId: 'bode-plots',
      difficulty: 2,
      kind: 'numeric',
      prompt: 'At the corner frequency of a single real pole, how far is the true magnitude from the straight-line asymptote, in dB? (Give a signed value.)',
      answer: -3.01,
      tolerance: { abs: 0.1 },
      unit: 'dB',
      explanation: '|1/(1 + j)| = 1/√2, and 20·log10(1/√2) ≈ −3.01 dB, while the asymptote is still at 0 dB there.',
    },
    {
      id: 'bode-plots/read-slope',
      skillId: 'bode-plots',
      difficulty: 3,
      kind: 'mcq',
      prompt: 'The plot shows |G(jω)| for a system with no zeros. What is the slope well above 10 rad/s, and how many poles does that imply?',
      figure: bodeFigure({ k: 100, poles: [1, 10] }, -1, 3),
      choices: ['−40 dB/dec, 2 poles', '−20 dB/dec, 1 pole', '−60 dB/dec, 3 poles', '−40 dB/dec, 4 poles'],
      answer: 0,
      explanation:
        'The curve drops 40 dB per decade above 10 rad/s; each pole contributes −20 dB/dec, so two poles. This is G(s) = 1000/((s + 1)(s + 10)).',
    },
    {
      id: 'bode-plots/read-kv',
      skillId: 'bode-plots',
      difficulty: 3,
      kind: 'numeric',
      prompt:
        'The open-loop plot starts with a −20 dB/dec slope (one integrator). Extend that low-frequency asymptote to ω = 1 rad/s. What is the velocity constant Kv?',
      figure: bodeFigure({ k: 10, integrators: 1, poles: [10] }, -1, 3),
      answer: 10,
      tolerance: { rel: 0.05 },
      unit: '1/s',
      explanation:
        'Near ω → 0, L ≈ Kv/s, so the low-frequency asymptote equals Kv at ω = 1. It reads 20 dB, so Kv = 10. This is L(s) = 100/(s(s + 10)).',
    },
    {
      id: 'bode-plots/asymptote-value',
      skillId: 'bode-plots',
      difficulty: 3,
      kind: 'numeric',
      prompt: 'G(s) = 100/(s + 10). What is the straight-line asymptotic magnitude at ω = 100 rad/s?',
      answer: 0,
      tolerance: { abs: 0.5 },
      unit: 'dB',
      explanation: 'DC gain is 100/10 = 10 (20 dB), flat to the corner at 10 rad/s, then −20 dB/dec for one decade: 20 − 20 = 0 dB.',
    },
    {
      id: 'bode-plots/identify-lead',
      skillId: 'bode-plots',
      difficulty: 3,
      kind: 'mcq',
      prompt: 'The magnitude is 0 dB at low frequency, rises at +20 dB/dec from 1 to 10 rad/s, then levels off at 20 dB. Which G(s) is it?',
      figure: bodeFigure({ k: 1, zeros: [1], poles: [10] }, -2, 3),
      choices: ['10(s + 1)/(s + 10)', '(s + 10)/(s + 1)', '(s + 1)/(s + 10)', '10/(s + 1)'],
      answer: 0,
      explanation:
        'A zero at 1 then a pole at 10 gives the rise; the DC gain must be 1, and 10·1/10 = 1. (s + 1)/(s + 10) has the right shape but starts at −20 dB.',
    },
    {
      id: 'bode-plots/slopes-multi',
      skillId: 'bode-plots',
      difficulty: 4,
      kind: 'multi_select',
      prompt: 'For G(s) = 10(s + 1)/(s(s + 100)), which statements about the asymptotic Bode magnitude are true?',
      choices: [
        'Slope is −20 dB/dec below 1 rad/s',
        'Slope is 0 dB/dec between 1 and 100 rad/s',
        'Slope is −20 dB/dec above 100 rad/s',
        'The DC gain is finite',
      ],
      answer: [0, 1, 2],
      explanation:
        'The integrator sets −20 dB/dec from the start, the zero at 1 cancels it to 0, and the pole at 100 restores −20 dB/dec. With a pole at s = 0, |G| → ∞ as ω → 0.',
    },
  ],
  generators: [
    defineGenerator({
      id: 'bode-dc-gain',
      skillId: 'bode-plots',
      difficulties: [1, 2, 3],
      generate(rng, d) {
        if (d === 1) {
          const k = pick(rng, DB_K);
          const p = pick(rng, [2, 5, 10, 20, 50, 100]);
          const db = 20 * Math.log10(k);
          return {
            skillId: 'bode-plots',
            difficulty: d,
            kind: 'numeric',
            prompt: `G(s) = ${nice(k)}/(s/${p} + 1). What is the low-frequency (DC) magnitude in dB?`,
            answer: round(db, 2),
            tolerance: { abs: 0.2 },
            unit: 'dB',
            explanation: `At ω → 0 the pole term is 1, so |G| = ${nice(k)} and 20·log10(${nice(k)}) ≈ ${nice(db, 2)} dB. The corner at ${p} rad/s does not affect it.`,
          };
        }
        // d 2: N poles; d 3: N poles and 1 ≤ M < N zeros (all corners distinct, at most 6).
        const n = d === 3 ? int(rng, 2, 4) : int(rng, 1, 4);
        const m = d === 3 ? int(rng, 1, Math.min(n - 1, 6 - n)) : 0;
        const corners = shuffle(rng, [1, 2, 5, 10, 20, 50]).slice(0, n + m);
        const poles = corners.slice(0, n).sort((a, b) => a - b);
        const zeros = corners.slice(n).sort((a, b) => a - b);
        const top = Math.max(...corners);
        const k = pick(rng, [1, 10, 100]);
        const num = zeros.length === 0 ? `${k}` : `${k === 1 ? '' : k}${zeros.map((z) => `(s + ${z})`).join('')}`;
        const den = poles.map((p) => `(s + ${p})`).join('');
        const slope = -20 * (n - m);
        return {
          skillId: 'bode-plots',
          difficulty: d,
          kind: 'numeric',
          prompt: `G(s) = ${num}/${poles.length > 1 ? `(${den})` : den}. What is the asymptotic magnitude slope above ${top} rad/s, in dB/decade?`,
          answer: slope,
          tolerance: { abs: 0 },
          unit: 'dB/dec',
          explanation: `Above every corner, each pole adds −20 dB/dec and each zero +20 dB/dec: ${n} pole${n > 1 ? 's' : ''}${m > 0 ? ` and ${m} zero${m > 1 ? 's' : ''}` : ''} give −20·${n - m} = ${nice(slope)} dB/dec.`,
        };
      },
    }),
  ],
});
