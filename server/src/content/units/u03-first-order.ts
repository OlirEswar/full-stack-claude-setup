/**
 * Unit 3: First-Order Response (skill: first-order).
 */
import { defineGenerator, defineUnit, nice, round } from '../authoring.ts';
import type { FigureSpec } from '../types.ts';
import { int, pick } from '../rng.ts';

/** Sampled step response y(t) = K(1 − e^(−t/τ)) from 0 to 5τ. */
function firstOrderStep(k: number, tau: number): FigureSpec {
  const n = 25;
  const points: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = (5 * tau * i) / n;
    points.push([round(t, 3), round(k * (1 - Math.exp(-t / tau)), 3)]);
  }
  return { type: 'step_response', points, finalValue: k, xLabel: 't (s)', yLabel: 'y(t)' };
}

export default defineUnit({
  unitId: 'u3',
  items: [
    {
      id: 'first-order/tau-from-pole',
      skillId: 'first-order',
      difficulty: 1,
      kind: 'numeric',
      prompt: 'G(s) = 3/(s + 4). What is the time constant τ?',
      answer: 0.25,
      tolerance: {},
      unit: 's',
      explanation: 'Rewrite as 0.75/(0.25s + 1): τ = 1/(pole magnitude) = 1/4 = 0.25 s. The numerator only sets the gain.',
    },
    {
      id: 'first-order/one-tau-fraction',
      skillId: 'first-order',
      difficulty: 1,
      kind: 'mcq',
      prompt: 'At t = τ, what fraction of its final value has a first-order step response reached?',
      choices: ['≈ 63%', '50%', '≈ 86%', '≈ 37%'],
      answer: 0,
      explanation: 'y(τ) = K(1 − e^(−1)) ≈ 0.632K. 37% is what remains to go; 86% is reached at 2τ.',
    },
    {
      id: 'first-order/double-tau',
      skillId: 'first-order',
      difficulty: 1,
      kind: 'true_false',
      prompt: 'True or false: doubling the time constant τ halves the 2% settling time.',
      answer: false,
      explanation: 'Settling time ≈ 4τ is proportional to τ, so doubling τ doubles it. A bigger τ means a slower system.',
    },
    {
      id: 'first-order/read-tau',
      skillId: 'first-order',
      difficulty: 2,
      kind: 'numeric',
      prompt: 'The plot shows a first-order step response settling at 2. Estimate the time constant τ.',
      figure: firstOrderStep(2, 0.5),
      answer: 0.5,
      tolerance: { abs: 0.1 },
      unit: 's',
      explanation: 'τ is when y reaches 63.2% of its final value: 0.632·2 ≈ 1.26, which happens at t ≈ 0.5 s.',
    },
    {
      id: 'first-order/percent-match',
      skillId: 'first-order',
      difficulty: 2,
      kind: 'match',
      prompt: 'Match each time to the percentage of final value a first-order step response has reached.',
      left: ['t = τ', 't = 2τ', 't = 3τ', 't = 4τ'],
      right: ['≈ 63%', '≈ 86%', '≈ 95%', '≈ 98%'],
      answer: [0, 1, 2, 3],
      explanation: 'The fraction is 1 − e^(−t/τ): 1 − e^(−1) ≈ 0.63, 1 − e^(−2) ≈ 0.86, 1 − e^(−3) ≈ 0.95, 1 − e^(−4) ≈ 0.98.',
    },
    {
      id: 'first-order/identify-tf',
      skillId: 'first-order',
      difficulty: 3,
      kind: 'mcq',
      prompt: 'Which transfer function produced this unit-step response?',
      figure: firstOrderStep(3, 2),
      choices: ['3/(2s + 1)', '2/(3s + 1)', '3/(s + 2)', '1.5/(2s + 1)'],
      answer: 0,
      explanation: 'The final value gives K = 3, and 63% of it (≈ 1.9) is reached at t ≈ 2 s, so τ = 2: G(s) = 3/(2s + 1).',
    },
    {
      id: 'first-order/settling-time',
      skillId: 'first-order',
      difficulty: 3,
      kind: 'numeric',
      prompt: 'G(s) = 5/(s + 2). What is the 2% settling time of its step response?',
      answer: 2,
      tolerance: { rel: 0.03 },
      unit: 's',
      explanation: 'τ = 1/2 = 0.5 s, and the 2% settling time is ≈ 4τ = 2 s (since e^(−4) ≈ 0.018).',
    },
    {
      id: 'first-order/step-facts',
      skillId: 'first-order',
      difficulty: 3,
      kind: 'multi_select',
      prompt: 'For G(s) = K/(τs + 1) with K, τ > 0, which statements about the unit-step response are true?',
      choices: [
        'It never overshoots',
        'Its initial slope is K/τ',
        'Its final value is K',
        'It reaches the final value exactly at t = 5τ',
        'A larger K makes it settle faster',
      ],
      answer: [0, 1, 2],
      explanation: 'y(t) = K(1 − e^(−t/τ)) rises monotonically to K with slope K/τ at t = 0. It only approaches K asymptotically, and its speed depends on τ alone.',
    },
    {
      id: 'first-order/thermometer',
      skillId: 'first-order',
      difficulty: 3,
      kind: 'numeric',
      prompt: 'A thermometer (τ = 10 s) at 20 °C is plunged into a 70 °C bath. What does it read after 10 s?',
      answer: 51.6,
      tolerance: { abs: 0.6 },
      unit: '°C',
      explanation: 'After one τ it covers 63.2% of the 50 °C jump: 20 + 0.632·50 ≈ 51.6 °C.',
    },
    {
      id: 'first-order/feedback-speedup',
      skillId: 'first-order',
      difficulty: 4,
      kind: 'numeric',
      prompt: 'G(s) = 1/(s + 1) under proportional control K = 9 with unity negative feedback. What is the closed-loop time constant?',
      answer: 0.1,
      tolerance: {},
      unit: 's',
      explanation: 'T(s) = 9/(s + 1 + 9) = 9/(s + 10), so τ = 1/10 = 0.1 s, ten times faster than the open-loop τ of 1 s.',
    },
    {
      id: 'first-order/half-time',
      skillId: 'first-order',
      difficulty: 4,
      kind: 'numeric',
      prompt: 'A first-order system has τ = 1 s. How long does its step response take to reach half its final value?',
      answer: Math.LN2,
      tolerance: { abs: 0.015 },
      unit: 's',
      explanation: 'Solve 1 − e^(−t/τ) = 0.5: t = τ·ln 2 ≈ 0.69 s.',
    },
    {
      id: 'first-order/bandwidth',
      skillId: 'first-order',
      difficulty: 4,
      kind: 'mcq',
      prompt: 'What is the −3 dB bandwidth of G(s) = 1/(0.2s + 1)?',
      choices: ['5 rad/s', '0.2 rad/s', '1 rad/s', '10 rad/s'],
      answer: 0,
      explanation: 'The magnitude drops by 3 dB at the corner frequency ω = 1/τ = 1/0.2 = 5 rad/s. A faster time constant means a wider bandwidth.',
    },
    {
      id: 'first-order/ramp-lag',
      skillId: 'first-order',
      difficulty: 5,
      kind: 'numeric',
      prompt: 'A unit ramp r(t) = t drives G(s) = 1/(2s + 1). In steady state, by how much does y(t) lag behind r(t)?',
      answer: 2,
      tolerance: {},
      explanation: 'Y = 1/(s²(2s + 1)) gives y(t) → t − 2 for large t, so the output trails the ramp by τ = 2 (error = τ × ramp slope).',
    },
  ],
  generators: [
    defineGenerator({
      id: 'first-order-tau',
      skillId: 'first-order',
      difficulties: [1, 2, 3],
      generate(rng, d) {
        const base = { skillId: 'first-order', difficulty: d, kind: 'numeric' as const };
        const den = (tau: number) => (tau === 1 ? 's + 1' : `${nice(tau)}s + 1`);
        if (d === 1) {
          const a = pick(rng, [1, 2, 4, 5, 8, 10, 20]);
          const b = a * int(rng, 1, 6);
          const tau = 1 / a;
          return {
            ...base,
            prompt: `G(s) = ${b}/(s + ${a}). What is the time constant τ?`,
            answer: tau,
            tolerance: {},
            unit: 's',
            explanation: `τ is the reciprocal of the pole magnitude: τ = 1/${a} = ${nice(tau)} s. The numerator ${b} only affects the gain.`,
          };
        }
        if (d === 2) {
          const tau = pick(rng, [0.2, 0.5, 1, 2, 2.5, 4, 5]);
          const k = int(rng, 1, 9);
          const ts = 4 * tau;
          return {
            ...base,
            prompt: `G(s) = ${k}/(${den(tau)}). Approximately what is its 2% settling time?`,
            answer: ts,
            tolerance: { rel: 0.03 },
            unit: 's',
            explanation: `In K/(τs + 1) form τ = ${nice(tau)} s, and the 2% settling time is ≈ 4τ = ${nice(ts)} s because e^(−4) ≈ 0.018.`,
          };
        }
        const tau = pick(rng, [0.5, 1, 2, 3, 5, 10]);
        const k = int(rng, 2, 9);
        const amp = int(rng, 1, 5);
        const answer = 0.632 * k * amp;
        const input = amp === 1 ? 'A unit step' : `A step of size ${amp}`;
        return {
          ...base,
          prompt: `${input} is applied at t = 0 to G(s) = ${k}/(${den(tau)}). What is y(t) at t = ${nice(tau)} s?`,
          answer,
          tolerance: { rel: 0.02 },
          explanation: `t = ${nice(tau)} s is exactly one time constant, so y = 0.632 × final value = 0.632 × ${k * amp} ≈ ${nice(answer, 2)}.`,
        };
      },
    }),
  ],
});
