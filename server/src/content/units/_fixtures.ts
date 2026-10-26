/**
 * Test-only sample content. NOT registered in `units/index.ts`; tests build a
 * registry from it with `createRegistry([fixtures])`. Also serves as a minimal
 * example of the authoring format.
 */
import { defineGenerator, defineUnit, nice } from '../authoring.ts';
import { int } from '../rng.ts';

const fixtures = defineUnit({
  unitId: 'fixtures',
  items: [
    {
      id: 'laplace-basics/fixture-step',
      skillId: 'laplace-basics',
      difficulty: 1,
      kind: 'mcq',
      prompt: 'What is the Laplace transform of the unit step u(t)?',
      choices: ['1/s', '1', 's', '1/s²'],
      answer: 0,
      explanation: 'The integral of e^(−st) from 0 to ∞ is 1/s for Re(s) > 0.',
    },
    {
      id: 'first-order/fixture-tau',
      skillId: 'first-order',
      difficulty: 2,
      kind: 'numeric',
      prompt: 'G(s) = 5/(2s + 1). What is the time constant τ?',
      answer: 2,
      tolerance: {},
      unit: 's',
      explanation: 'Written as K/(τs + 1), the coefficient of s is τ, so τ = 2 s.',
      figure: {
        type: 'step_response',
        points: [
          [0, 0],
          [2, 3.16],
          [4, 4.32],
          [8, 4.91],
        ],
        finalValue: 5,
        xLabel: 't (s)',
        yLabel: 'y',
      },
    },
  ],
  generators: [
    defineGenerator({
      id: 'fixture-dc-gain',
      skillId: 'first-order',
      difficulties: [1, 2],
      generate(rng, d) {
        const k = int(rng, 2, 9);
        const a = int(rng, 1, 5);
        return {
          skillId: 'first-order',
          difficulty: d,
          kind: 'numeric',
          prompt: `G(s) = ${nice(k * a)}/(s + ${a}). What is the DC gain G(0)?`,
          answer: k,
          tolerance: {},
          explanation: `Set s = 0: G(0) = ${nice(k * a)}/${a} = ${k}.`,
        };
      },
    }),
  ],
});

export default fixtures;
