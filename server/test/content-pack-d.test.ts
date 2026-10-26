import { describe, expect, it } from 'vitest';
import { grade } from '../src/content/grade.ts';
import { toClientQuestion } from '../src/content/present.ts';
import { createRegistry } from '../src/content/registry.ts';
import { mulberry32 } from '../src/content/rng.ts';
import type { AnswerKey, Generator, QuestionBody, QuestionKind } from '../src/content/types.ts';
import u10 from '../src/content/units/u10-pid.ts';
import u11 from '../src/content/units/u11-state-space.ts';
import { validateQuestion } from '../src/content/validate.ts';

const SKILLS = ['pid-control', 'state-space-models', 'ss-eigenvalues', 'controllability-observability'];
const GENERATOR_IDS = ['ss-eigenvalues-2x2', 'controllability-2x2'];
const reg = createRegistry([u10, u11]);

/** The response a perfect student would send for a display-order answer key. */
function perfectResponse(kind: QuestionKind, key: AnswerKey): unknown {
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

/** Extract "NAME = [a b; c d]" (Unicode minus) from a prompt as numbers. */
function matrixIn(prompt: string, name: string): number[] {
  const m = new RegExp(`${name} = \\[([^\\]]*)\\]`).exec(prompt);
  if (!m?.[1]) throw new Error(`no matrix ${name} in "${prompt}"`);
  return m[1]
    .split(/[;\s]+/)
    .filter(Boolean)
    .map((t) => Number(t.replace('−', '-')));
}

function generator(id: string): Generator {
  const gen = reg.getGenerator(id);
  if (!gen) throw new Error(`missing generator ${id}`);
  return gen;
}

describe('content pack D (U10–U11)', () => {
  it('every pack-D static item passes validateQuestion', () => {
    const items = reg.allStatic();
    expect(items.length).toBeGreaterThanOrEqual(32);
    const problems = items.flatMap((q) => validateQuestion(q).map((e) => `${q.id}: ${e}`));
    expect(problems).toEqual([]);
  });

  it('each pack-D skill has >= 8 static items across >= 3 difficulties', () => {
    for (const skillId of SKILLS) {
      const items = reg.staticItemsFor(skillId);
      expect(items.length, skillId).toBeGreaterThanOrEqual(8);
      expect(new Set(items.map((q) => q.difficulty)).size, skillId).toBeGreaterThanOrEqual(3);
    }
  });

  it('pack D meets its content-shape requirements', () => {
    const pid = reg.staticItemsFor('pid-control');
    expect(pid.some((q) => q.kind === 'match')).toBe(true);
    expect(pid.filter((q) => q.figure?.type === 'step_response').length).toBeGreaterThanOrEqual(1);
    const kinds = new Set(reg.allStatic().map((q) => q.kind));
    expect([...kinds].sort()).toEqual(['match', 'mcq', 'multi_select', 'numeric', 'true_false']);
    expect(
      reg
        .allGenerators()
        .map((g) => g.id)
        .sort(),
    ).toEqual([...GENERATOR_IDS].sort());
  });

  it('each pack-D generator produces valid self-grading questions for 200 seeds', () => {
    for (const gen of reg.allGenerators()) {
      for (const d of gen.difficulties) {
        for (let seed = 0; seed < 200; seed++) {
          const q: QuestionBody = gen.generate(mulberry32(seed), d);
          const label = `${gen.id} d${d} seed ${seed}`;
          expect(validateQuestion(q), label).toEqual([]);
          expect(q.skillId, label).toBe(gen.skillId);
          expect(q.difficulty, label).toBe(d);
          const { client, answerKey } = toClientQuestion(q, mulberry32(seed + 1000));
          expect(grade(client.kind, answerKey, perfectResponse(client.kind, answerKey)), label).toBe(true);
        }
      }
    }
  });

  it('pack-D generators vary their numbers across seeds', () => {
    for (const gen of reg.allGenerators()) {
      for (const d of gen.difficulties) {
        const prompts = new Set<string>();
        for (let seed = 0; seed < 20; seed++) prompts.add(gen.generate(mulberry32(seed), d).prompt);
        expect(prompts.size, `${gen.id} d${d}`).toBeGreaterThanOrEqual(5);
      }
    }
  });

  it('ss-eigenvalues-2x2 answers are the true eigenvalues of the shown integer matrix', () => {
    const gen = generator('ss-eigenvalues-2x2');
    for (const d of gen.difficulties) {
      for (let seed = 0; seed < 200; seed++) {
        const q = gen.generate(mulberry32(seed), d);
        const label = `d${d} seed ${seed}: ${q.prompt}`;
        const [a, b, c, dd] = matrixIn(q.prompt, 'A') as [number, number, number, number];
        for (const x of [a, b, c, dd]) expect(Number.isInteger(x) && Math.abs(x) <= 12, label).toBe(true);
        const tr = a + dd;
        const det = a * dd - b * c;
        const disc = tr * tr - 4 * det;
        expect(disc, label).toBeGreaterThan(0); // real and distinct
        const hi = (tr + Math.sqrt(disc)) / 2;
        const lo = (tr - Math.sqrt(disc)) / 2;
        expect(Number.isInteger(hi) && Number.isInteger(lo), label).toBe(true);
        if (q.kind === 'numeric') {
          expect(q.answer, label).toBe(q.prompt.includes('larger') ? hi : lo);
        } else if (q.kind === 'mcq') {
          expect(q.answer, label).toBe(hi < 0 ? 0 : hi === 0 ? 1 : 2);
        } else {
          throw new Error(`unexpected kind ${q.kind}`);
        }
      }
    }
  });

  it('controllability-2x2 answer matches the rank of [B AB] and covers both outcomes', () => {
    const gen = generator('controllability-2x2');
    for (const d of gen.difficulties) {
      const outcomes = new Set<boolean>();
      for (let seed = 0; seed < 200; seed++) {
        const q = gen.generate(mulberry32(seed), d);
        if (q.kind !== 'true_false') throw new Error('expected true_false');
        const [a, b, c, dd] = matrixIn(q.prompt, 'A') as [number, number, number, number];
        const [b1, b2] = matrixIn(q.prompt, 'B') as [number, number];
        expect(b1 !== 0 || b2 !== 0).toBe(true);
        const det = b1 * (c * b1 + dd * b2) - b2 * (a * b1 + b * b2);
        expect(q.answer, q.prompt).toBe(det !== 0);
        outcomes.add(q.answer);
      }
      expect(outcomes.size).toBe(2);
    }
  });
});
