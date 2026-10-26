import { describe, expect, it } from 'vitest';
import { grade } from '../src/content/grade.ts';
import { toClientQuestion } from '../src/content/present.ts';
import { createRegistry } from '../src/content/registry.ts';
import { mulberry32 } from '../src/content/rng.ts';
import type { AnswerKey, QuestionBody, StaticQuestion } from '../src/content/types.ts';
import { QUESTION_KINDS } from '../src/content/types.ts';
import u01 from '../src/content/units/u01-laplace.ts';
import u02 from '../src/content/units/u02-block-diagrams.ts';
import u03 from '../src/content/units/u03-first-order.ts';
import { UNIT_CONTENT } from '../src/content/units/index.ts';
import { validateQuestion } from '../src/content/validate.ts';

const PACK = [u01, u02, u03];
const SKILLS = ['laplace-basics', 'transfer-functions', 'poles-zeros', 'block-diagrams', 'first-order'];
const GENERATOR_IDS = ['laplace-pair', 'final-value', 'tf-poles', 'block-feedback', 'first-order-tau'];

const items: StaticQuestion[] = PACK.flatMap((u) => u.items);
const generators = PACK.flatMap((u) => u.generators);

/** The response a student would send if they answered exactly as the key says (display order). */
function correctResponse(kind: StaticQuestion['kind'], key: AnswerKey): unknown {
  const answer = (key as { answer: unknown }).answer;
  switch (kind) {
    case 'mcq':
      return { choice: answer };
    case 'true_false':
    case 'numeric':
      return { value: answer };
    case 'multi_select':
      return { choices: answer };
    case 'match':
      return { pairs: answer };
  }
}

function selfGrades(q: StaticQuestion | QuestionBody, seed: number): boolean {
  const { client, answerKey } = toClientQuestion(q, mulberry32(seed));
  return grade(client.kind, answerKey, correctResponse(q.kind, answerKey));
}

describe('content pack A (U1–U3)', () => {
  it('every pack-A static item passes validateQuestion', () => {
    expect(items.length).toBeGreaterThanOrEqual(40);
    for (const q of items) {
      expect({ id: q.id, errors: validateQuestion(q) }).toEqual({ id: q.id, errors: [] });
      expect(SKILLS).toContain(q.skillId);
      expect(selfGrades(q, 1)).toBe(true);
    }
    expect(new Set(items.map((q) => q.id)).size).toBe(items.length);
  });

  it('each pack-A skill has >= 8 static items across >= 3 difficulties', () => {
    for (const skillId of SKILLS) {
      const mine = items.filter((q) => q.skillId === skillId);
      expect(mine.length, skillId).toBeGreaterThanOrEqual(8);
      expect(new Set(mine.map((q) => q.difficulty)).size, skillId).toBeGreaterThanOrEqual(3);
    }
  });

  it('pack A uses all 5 kinds and the required figures', () => {
    expect(new Set(items.map((q) => q.kind))).toEqual(new Set(QUESTION_KINDS));
    expect(items.filter((q) => q.figure?.type === 'pole_zero').length).toBeGreaterThanOrEqual(2);
    expect(items.filter((q) => q.figure?.type === 'step_response').length).toBeGreaterThanOrEqual(2);
  });

  it('pack A is registered and builds a registry without conflicts', () => {
    for (const u of PACK) expect(UNIT_CONTENT).toContain(u);
    const reg = createRegistry(PACK);
    expect(reg.allGenerators().map((g) => g.id).sort()).toEqual([...GENERATOR_IDS].sort());
  });

  it('each pack-A generator produces valid self-grading questions for 200 seeds', () => {
    for (const gen of generators) {
      expect(SKILLS).toContain(gen.skillId);
      for (let seed = 0; seed < 200; seed++) {
        const d = gen.difficulties[seed % gen.difficulties.length]!;
        const q = gen.generate(mulberry32(seed), d);
        expect({ gen: gen.id, seed, errors: validateQuestion(q) }).toEqual({ gen: gen.id, seed, errors: [] });
        expect(q.skillId).toBe(gen.skillId);
        expect(q.difficulty).toBe(d);
        expect(selfGrades(q, seed), `${gen.id} seed ${seed}`).toBe(true);
        // Same seed reproduces the same question.
        expect(gen.generate(mulberry32(seed), d)).toEqual(q);
      }
    }
  });

  it('pack-A generators vary their numbers across seeds', () => {
    for (const gen of generators) {
      for (const d of gen.difficulties) {
        const prompts = new Set<string>();
        for (let seed = 0; seed < 20; seed++) prompts.add(gen.generate(mulberry32(seed), d).prompt);
        expect(prompts.size, `${gen.id} d${d}`).toBeGreaterThanOrEqual(5);
      }
    }
  });

  it('generator answers are numerically correct on spot checks', () => {
    const byId = new Map(generators.map((g) => [g.id, g]));
    // final-value: answer = step size × G(0), recomputed from the prompt.
    for (let seed = 0; seed < 50; seed++) {
      const q = byId.get('final-value')!.generate(mulberry32(seed), 1);
      const m = /G\(s\) = (\d+)\/\(s \+ (\d+)\)/.exec(q.prompt)!;
      expect(q.kind === 'numeric' && q.answer).toBeCloseTo(Number(m[1]) / Number(m[2]), 9);
    }
    // tf-poles d1: the slower pole is a root of the polynomial.
    for (let seed = 0; seed < 50; seed++) {
      const q = byId.get('tf-poles')!.generate(mulberry32(seed), 1);
      const m = /1\/\(s² \+ (\d+)s \+ (\d+)\)/.exec(q.prompt)!;
      const p = q.kind === 'numeric' ? q.answer : NaN;
      expect(p * p + Number(m[1]) * p + Number(m[2])).toBe(0);
    }
    // tf-poles d3: the correct choice's poles are roots of the polynomial.
    for (let seed = 0; seed < 50; seed++) {
      const q = byId.get('tf-poles')!.generate(mulberry32(seed), 3);
      if (q.kind !== 'mcq') throw new Error('expected mcq');
      const poly = /1\/\(s²(?: ([+−]) (\d*)s)?(?: ([+−]) (\d+))?\)/.exec(q.prompt)!;
      const b = poly[1] ? (poly[1] === '−' ? -1 : 1) * Number(poly[2] || 1) : 0;
      const c = poly[3] ? (poly[3] === '−' ? -1 : 1) * Number(poly[4]) : 0;
      const roots = [...q.choices[q.answer]!.matchAll(/s = (−?\d+)/g)].map((r) => Number(r[1]!.replace('−', '-')));
      expect(roots).toHaveLength(2);
      for (const r of roots) expect(r * r + b * r + c).toBe(0);
    }
  });
});
