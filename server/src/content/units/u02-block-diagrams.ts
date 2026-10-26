/**
 * Unit 2: Block Diagrams (skill: block-diagrams).
 */
import { defineGenerator, defineUnit, nice } from '../authoring.ts';
import { chance, int, pick } from '../rng.ts';

export default defineUnit({
  unitId: 'u2',
  items: [
    {
      id: 'block-diagrams/series',
      skillId: 'block-diagrams',
      difficulty: 1,
      kind: 'mcq',
      prompt: 'Two blocks G₁(s) and G₂(s) are connected in series (cascade). What is the overall transfer function?',
      choices: ['G₁G₂', 'G₁ + G₂', 'G₁/(1 + G₁G₂)', 'G₁/G₂'],
      answer: 0,
      explanation: 'In series the output of G₁ is the input of G₂, so Y = G₂(G₁U): transfer functions multiply. Parallel paths add.',
    },
    {
      id: 'block-diagrams/static-unity-loop',
      skillId: 'block-diagrams',
      difficulty: 1,
      kind: 'numeric',
      prompt: 'A static gain G = 4 is placed in a unity negative feedback loop. What is the closed-loop gain Y/R?',
      answer: 0.8,
      tolerance: { abs: 0.005 },
      explanation: 'T = G/(1 + G) = 4/5 = 0.8. Unity feedback with finite gain always gives a closed-loop gain below 1.',
    },
    {
      id: 'block-diagrams/connection-rules',
      skillId: 'block-diagrams',
      difficulty: 2,
      kind: 'match',
      prompt: 'Match each connection of G and H to its equivalent transfer function.',
      left: ['Series G, H', 'Parallel G, H (summed)', 'G with negative feedback H', 'G with positive feedback H'],
      right: ['GH', 'G + H', 'G/(1 + GH)', 'G/(1 − GH)'],
      answer: [0, 1, 2, 3],
      explanation: 'Cascades multiply, parallel paths add, and a loop gives forward/(1 ± loop gain) with + for negative feedback and − for positive.',
    },
    {
      id: 'block-diagrams/unity-loop-dynamic',
      skillId: 'block-diagrams',
      difficulty: 2,
      kind: 'mcq',
      prompt: 'G(s) = 10/(s + 1) is placed in a unity negative feedback loop. What is the closed-loop transfer function?',
      choices: ['10/(s + 11)', '10/(s + 1)', '10/(s − 9)', '(s + 1)/(s + 11)'],
      answer: 0,
      explanation: 'T = G/(1 + G) = 10/(s + 1 + 10) = 10/(s + 11). Feedback moved the pole from −1 to −11, making the loop 11× faster.',
    },
    {
      id: 'block-diagrams/high-loop-gain',
      skillId: 'block-diagrams',
      difficulty: 2,
      kind: 'true_false',
      prompt: 'True or false: with negative feedback and loop gain GH ≫ 1, the closed-loop gain is about 1/H, nearly independent of G.',
      answer: true,
      explanation: 'G/(1 + GH) → G/(GH) = 1/H when GH ≫ 1. That is why feedback makes a system insensitive to plant variations.',
    },
    {
      id: 'block-diagrams/move-pickoff',
      skillId: 'block-diagrams',
      difficulty: 3,
      kind: 'true_false',
      prompt: 'True or false: moving a pickoff point from the input of block G to its output requires inserting 1/G in the branch.',
      answer: true,
      explanation: 'The branch must still carry the original signal x. After the block the signal is Gx, so the branch needs 1/G to undo it.',
    },
    {
      id: 'block-diagrams/feedback-sensor-gain',
      skillId: 'block-diagrams',
      difficulty: 3,
      kind: 'numeric',
      prompt: 'Forward gain G = 100, feedback gain H = 0.5, negative feedback. What is the closed-loop gain Y/R? (2 decimals)',
      answer: 100 / 51,
      tolerance: { abs: 0.01 },
      explanation: 'T = 100/(1 + 100·0.5) = 100/51 ≈ 1.96, already close to 1/H = 2 because the loop gain of 50 is large.',
    },
    {
      id: 'block-diagrams/closed-loop-pole',
      skillId: 'block-diagrams',
      difficulty: 3,
      kind: 'numeric',
      prompt: 'G(s) = 7/(s + 3) in unity negative feedback. Where is the closed-loop pole? Enter its value of s.',
      answer: -10,
      tolerance: { abs: 0.01 },
      explanation: 'The characteristic equation is 1 + G = 0, i.e. s + 3 + 7 = 0, so s = −10.',
    },
    {
      id: 'block-diagrams/equivalent-forms',
      skillId: 'block-diagrams',
      difficulty: 3,
      kind: 'multi_select',
      prompt: 'Forward path G, negative feedback H. Which expressions equal the closed-loop Y/R?',
      choices: ['G/(1 + GH)', '1/(1/G + H)', 'G/(1 − GH)', 'GH/(1 + GH)', 'G·(1 + GH)⁻¹'],
      answer: [0, 1, 4],
      explanation: 'Dividing top and bottom of G/(1 + GH) by G gives 1/(1/G + H). GH/(1 + GH) is the response at the sensor output, not Y.',
    },
    {
      id: 'block-diagrams/series-loop-dc',
      skillId: 'block-diagrams',
      difficulty: 3,
      kind: 'numeric',
      prompt: 'Controller K = 2 in series with plant G(s) = 5/(s + 2), unity negative feedback. What is the closed-loop DC gain? (2 decimals)',
      answer: 10 / 12,
      tolerance: { abs: 0.01 },
      explanation: 'Loop gain L = 10/(s + 2), so T = 10/(s + 12) and T(0) = 10/12 ≈ 0.83. Short of 1, so a step leaves a steady-state error.',
    },
    {
      id: 'block-diagrams/positive-feedback',
      skillId: 'block-diagrams',
      difficulty: 4,
      kind: 'numeric',
      prompt: 'Forward gain G = 2 with positive feedback through H = 0.25. What is the closed-loop gain Y/R?',
      answer: 4,
      tolerance: {},
      explanation: 'Positive feedback uses a minus sign in the denominator: T = G/(1 − GH) = 2/(1 − 0.5) = 4. It amplifies, and blows up as GH → 1.',
    },
    {
      id: 'block-diagrams/nested-loop',
      skillId: 'block-diagrams',
      difficulty: 4,
      kind: 'numeric',
      prompt: 'Inner loop: 1/(s + 1) with negative feedback gain 2. It is cascaded with 4/s, and unity negative feedback closes the outer loop. The closed-loop denominator is s² + 3s + c. What is c?',
      answer: 4,
      tolerance: {},
      explanation: 'Inner loop: 1/(s + 1 + 2) = 1/(s + 3). Forward path 4/(s(s + 3)), so T = 4/(s² + 3s + 4).',
    },
    {
      id: 'block-diagrams/s-plus-t',
      skillId: 'block-diagrams',
      difficulty: 4,
      kind: 'true_false',
      prompt: 'True or false: for any loop gain L, the sensitivity S = 1/(1 + L) and complementary sensitivity T = L/(1 + L) satisfy S + T = 1.',
      answer: true,
      explanation: 'S + T = (1 + L)/(1 + L) = 1. You cannot make both small at the same frequency, which is a core trade-off in feedback design.',
    },
    {
      id: 'block-diagrams/disturbance-path',
      skillId: 'block-diagrams',
      difficulty: 5,
      kind: 'mcq',
      prompt: 'Unity feedback loop with controller C and plant P. A disturbance D adds to the plant input (between C and P). What is Y/D?',
      choices: ['P/(1 + CP)', 'CP/(1 + CP)', '1/(1 + CP)', 'P'],
      answer: 0,
      explanation: 'Y = P(D + C(R − Y)); set R = 0 and solve: Y/D = P/(1 + CP). Forward path from D is P alone, the loop is still CP.',
    },
  ],
  generators: [
    defineGenerator({
      id: 'block-feedback',
      skillId: 'block-diagrams',
      difficulties: [1, 2, 3],
      generate(rng, d) {
        const base = { skillId: 'block-diagrams', difficulty: d, kind: 'numeric' as const };
        if (d === 1) {
          const g = pick(rng, [1, 3, 4, 9, 19, 24, 49, 99]);
          const answer = g / (1 + g);
          return {
            ...base,
            prompt: `A static gain G = ${g} is in a unity negative feedback loop. What is the closed-loop gain Y/R? (2 decimals)`,
            answer,
            tolerance: { abs: 0.005 },
            explanation: `T = G/(1 + G) = ${g}/${g + 1} ≈ ${nice(answer)}. Higher loop gain pushes T toward 1 but never past it.`,
          };
        }
        if (d === 2) {
          const g = pick(rng, [2, 4, 5, 8, 10, 20, 50]);
          const h = pick(rng, [0.1, 0.2, 0.25, 0.5, 1, 2]);
          const answer = g / (1 + g * h);
          return {
            ...base,
            prompt: `Forward gain G = ${g}, feedback gain H = ${nice(h)}, negative feedback. What is the closed-loop gain Y/R? (2 decimals)`,
            answer,
            tolerance: { abs: 0.01 },
            explanation: `T = G/(1 + GH) = ${g}/(1 + ${nice(g * h)}) ≈ ${nice(answer)}. Compare 1/H = ${nice(1 / h)}: the larger GH, the closer T gets to it.`,
          };
        }
        if (chance(rng, 0.5)) {
          // Positive feedback with GH < 1.
          const [g, h] = pick(rng, [
            [2, 0.25],
            [2, 0.375],
            [3, 0.1],
            [3, 0.25],
            [4, 0.1],
            [4, 0.125],
            [4, 0.2],
            [5, 0.05],
            [5, 0.1],
          ] as const);
          const gh = g * h;
          const answer = g / (1 - gh);
          return {
            ...base,
            prompt: `Forward gain G = ${g} with POSITIVE feedback through H = ${nice(h)}. What is the closed-loop gain Y/R? (2 decimals)`,
            answer,
            tolerance: { abs: 0.01 },
            explanation: `Positive feedback: T = G/(1 − GH) = ${g}/(1 − ${nice(gh)}) = ${nice(answer)}. It is larger than G, and would blow up as GH → 1.`,
          };
        }
        // Dynamic plant, constant sensor: closed-loop DC gain.
        const a = int(rng, 1, 6);
        const k = int(rng, 2, 12);
        const h = pick(rng, [0.5, 1, 2]);
        const answer = k / (a + k * h);
        return {
          ...base,
          prompt: `G(s) = ${k}/(s + ${a}) with negative feedback gain H = ${nice(h)}. What is the closed-loop DC gain? (2 decimals)`,
          answer,
          tolerance: { abs: 0.01 },
          explanation: `T(s) = G/(1 + GH) = ${k}/(s + ${a} + ${nice(k * h)}), so T(0) = ${k}/${nice(a + k * h)} ≈ ${nice(answer)}.`,
        };
      },
    }),
  ],
});
