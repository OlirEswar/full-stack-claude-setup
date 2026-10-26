import { describe, expect, it } from 'vitest';
import { SKILLS, UNITS } from '../src/content/curriculum.ts';
import { grade, isValidResponse } from '../src/content/grade.ts';
import { answerText, toClientQuestion } from '../src/content/present.ts';
import { createRegistry, registry } from '../src/content/registry.ts';
import { int, mulberry32, pick, shuffle } from '../src/content/rng.ts';
import type { QuestionBody, StaticQuestion } from '../src/content/types.ts';
import fixtures from '../src/content/units/_fixtures.ts';
import { validateQuestion } from '../src/content/validate.ts';

const SKILL_ORDER = [
  'laplace-basics',
  'transfer-functions',
  'poles-zeros',
  'block-diagrams',
  'first-order',
  'second-order-params',
  'second-order-specs',
  'stability-poles',
  'routh-hurwitz',
  'system-type',
  'steady-state-error',
  'root-locus',
  'frequency-response',
  'bode-plots',
  'nyquist',
  'stability-margins',
  'pid-control',
  'state-space-models',
  'ss-eigenvalues',
  'controllability-observability',
];

const mcq: StaticQuestion = {
  id: 'laplace-basics/sample-mcq',
  skillId: 'laplace-basics',
  difficulty: 2,
  kind: 'mcq',
  prompt: 'Laplace transform of e^(−2t)?',
  choices: ['1/(s + 2)', '1/(s − 2)', '2/s', 's + 2', '1/s'],
  answer: 0,
  explanation: 'L{e^(−at)} = 1/(s + a).',
};

const multi: StaticQuestion = {
  id: 'stability-poles/sample-multi',
  skillId: 'stability-poles',
  difficulty: 2,
  kind: 'multi_select',
  prompt: 'Which pole locations give a stable system?',
  choices: ['s = −1', 's = 2', 's = −3 ± 2j', 's = j'],
  answer: [0, 2],
  explanation: 'Stable means every pole strictly in the left half-plane.',
};

const match: StaticQuestion = {
  id: 'pid-control/sample-match',
  skillId: 'pid-control',
  difficulty: 3,
  kind: 'match',
  prompt: 'Match each term to its main effect.',
  left: ['P', 'I', 'D'],
  right: ['Faster response', 'Removes steady-state error', 'Adds damping'],
  answer: [0, 1, 2],
  explanation: 'P speeds things up, I kills steady-state error, D damps.',
};

const numeric: StaticQuestion = {
  id: 'first-order/sample-numeric',
  skillId: 'first-order',
  difficulty: 1,
  kind: 'numeric',
  prompt: 'Time constant of 3/(s + 2)?',
  answer: 0.5,
  tolerance: {},
  unit: 's',
  explanation: 'τ = 1/a = 0.5 s.',
};

const tf: StaticQuestion = {
  id: 'stability-poles/sample-tf',
  skillId: 'stability-poles',
  difficulty: 1,
  kind: 'true_false',
  prompt: 'A pole at s = −3 is stable.',
  answer: true,
  explanation: 'It is in the left half-plane.',
  figure: { type: 'pole_zero', poles: [{ re: -3, im: 0 }], zeros: [] },
};

describe('content-core', () => {
  it('curriculum has 11 units and 20 skills in path order', () => {
    expect(UNITS).toHaveLength(11);
    expect(SKILLS).toHaveLength(20);
    expect(SKILLS.map((s) => s.id)).toEqual(SKILL_ORDER);
    expect(SKILLS.map((s) => s.index)).toEqual(SKILL_ORDER.map((_, i) => i));
    expect(UNITS.map((u) => u.skills.length)).toEqual([3, 1, 1, 2, 2, 2, 1, 2, 2, 1, 3]);
    for (const u of UNITS) {
      expect(u.title.length).toBeGreaterThan(0);
      expect(u.description.length).toBeGreaterThan(0);
    }
    expect(registry.getSkill('bode-plots')).toMatchObject({ title: 'Bode plots', unitId: 'u8' });
  });

  it('grade numeric respects relative tolerance', () => {
    const key = { answer: 10, tolerance: { rel: 0.02 } };
    expect(grade('numeric', key, { value: 10.19 })).toBe(true);
    expect(grade('numeric', key, { value: 9.81 })).toBe(true);
    expect(grade('numeric', key, { value: 10.3 })).toBe(false);
    // Default tolerance is rel 0.02.
    expect(grade('numeric', { answer: 10, tolerance: {} }, { value: 10.19 })).toBe(true);
    expect(grade('numeric', { answer: 10, tolerance: {} }, { value: 10.3 })).toBe(false);
  });

  it('grade numeric respects absolute tolerance', () => {
    const key = { answer: 0, tolerance: { abs: 0.05 } };
    expect(grade('numeric', key, { value: 0.04 })).toBe(true);
    expect(grade('numeric', key, { value: -0.05 })).toBe(true);
    expect(grade('numeric', key, { value: 0.06 })).toBe(false);
    expect(grade('numeric', { answer: 100, tolerance: { abs: 1 } }, { value: 101.5 })).toBe(false);
    expect(grade('numeric', key, { value: Number.NaN })).toBe(false);
    expect(grade('numeric', key, { value: '0' })).toBe(false);
  });

  it('grade multi_select is order-insensitive and rejects partial', () => {
    const key = { answer: [0, 2, 3] };
    expect(grade('multi_select', key, { choices: [3, 0, 2] })).toBe(true);
    expect(grade('multi_select', key, { choices: [0, 2] })).toBe(false);
    expect(grade('multi_select', key, { choices: [0, 1, 2, 3] })).toBe(false);
    expect(grade('multi_select', key, { choices: [0, 2, 2] })).toBe(false);
    expect(grade('multi_select', key, { choices: [] })).toBe(false);
  });

  it('grade match requires all pairs', () => {
    const key = { answer: [2, 0, 1] };
    expect(grade('match', key, { pairs: [2, 0, 1] })).toBe(true);
    expect(grade('match', key, { pairs: [2, 1, 0] })).toBe(false);
    expect(grade('match', key, { pairs: [2, 0] })).toBe(false);
    expect(grade('mcq', { answer: 1 }, { choice: 1 })).toBe(true);
    expect(grade('mcq', { answer: 1 }, { choice: 2 })).toBe(false);
    expect(grade('true_false', { answer: false }, { value: false })).toBe(true);
    expect(grade('true_false', { answer: false }, { value: true })).toBe(false);
    expect(isValidResponse('match', { pairs: 'x' })).toBe(false);
  });

  it('toClientQuestion never includes answer fields', () => {
    const rng = mulberry32(1);
    for (const q of [mcq, multi, match, numeric, tf, ...fixtures.items]) {
      const { client, answerKey } = toClientQuestion(q, rng);
      const json = JSON.stringify(client);
      const parsed = JSON.parse(json) as Record<string, unknown>;
      expect(parsed).not.toHaveProperty('answer');
      expect(parsed).not.toHaveProperty('tolerance');
      expect(parsed).not.toHaveProperty('explanation');
      expect(parsed).not.toHaveProperty('id');
      expect(json).not.toMatch(/"answer"/);
      expect(parsed.kind).toBe(q.kind);
      expect(answerKey).toHaveProperty('answer');
    }
    const n = toClientQuestion(numeric, rng);
    expect(n.client.unit).toBe('s');
    expect(n.answerKey).toEqual({ answer: 0.5, tolerance: { rel: 0.02 } });
    expect(answerText(n.client, n.answerKey)).toBe('0.5 s');
  });

  it('shuffled mcq answer key still grades the right displayed choice', () => {
    const seenPositions = new Set<number>();
    for (let seed = 0; seed < 50; seed++) {
      const rng = mulberry32(seed);
      const { client, answerKey } = toClientQuestion(mcq, rng);
      const correctIdx = client.choices!.indexOf('1/(s + 2)');
      seenPositions.add(correctIdx);
      expect(grade('mcq', answerKey, { choice: correctIdx })).toBe(true);
      for (let i = 0; i < client.choices!.length; i++) {
        if (i !== correctIdx) expect(grade('mcq', answerKey, { choice: i })).toBe(false);
      }
      expect(answerText(client, answerKey)).toBe('1/(s + 2)');

      const ms = toClientQuestion(multi, rng);
      const want = ['s = −1', 's = −3 ± 2j'].map((c) => ms.client.choices!.indexOf(c));
      expect(grade('multi_select', ms.answerKey, { choices: want.reverse() })).toBe(true);

      const m = toClientQuestion(match, rng);
      const pairs = match.left.map((_, i) => m.client.right!.indexOf(match.right[match.answer[i]!]!));
      expect(m.client.left).toEqual(match.left);
      expect(grade('match', m.answerKey, { pairs })).toBe(true);
      expect(answerText(m.client, m.answerKey)).toBe(
        'P → Faster response; I → Removes steady-state error; D → Adds damping',
      );
    }
    // The shuffle actually moves the correct choice around.
    expect(seenPositions.size).toBeGreaterThan(2);
  });

  it('validateQuestion rejects LaTeX', () => {
    for (const q of [mcq, multi, match, numeric, tf, ...fixtures.items]) {
      expect(validateQuestion(q)).toEqual([]);
    }
    for (const bad of ['\\frac{1}{s}', 'costs $5', 's^{2} + 1', 'ω_{n}']) {
      expect(validateQuestion({ ...mcq, prompt: bad }).join()).toMatch(/LaTeX/);
    }
    expect(validateQuestion({ ...mcq, choices: ['1/s', '\\alpha', 's'] }).join()).toMatch(/LaTeX/);
    expect(validateQuestion({ ...mcq, explanation: '$x$' }).join()).toMatch(/LaTeX/);

    // Other rules.
    expect(validateQuestion({ ...mcq, prompt: '' })).not.toEqual([]);
    expect(validateQuestion({ ...mcq, explanation: 'x'.repeat(301) })).not.toEqual([]);
    expect(validateQuestion({ ...mcq, answer: 5 })).not.toEqual([]);
    expect(validateQuestion({ ...mcq, choices: ['a', 'b'], answer: 0 })).not.toEqual([]);
    expect(validateQuestion({ ...match, right: ['a', 'b'] })).not.toEqual([]);
    expect(validateQuestion({ ...numeric, answer: Number.POSITIVE_INFINITY })).not.toEqual([]);
    expect(validateQuestion({ ...multi, answer: [0, 9] })).not.toEqual([]);
    expect(validateQuestion({ ...tf, figure: { type: 'bode_mag', points: [[0, 1], [1, 2]] } })).not.toEqual([]);
    expect(validateQuestion({ ...mcq, id: 'wrong-skill/x' })).not.toEqual([]);
  });

  it('rng is deterministic for a given seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    expect(seqA).toEqual(seqB);
    expect(seqA.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(Array.from({ length: 20 }, mulberry32(43))).not.toEqual(seqA);

    const r1 = mulberry32(7);
    const r2 = mulberry32(7);
    expect([int(r1, 1, 6), pick(r1, ['a', 'b', 'c']), shuffle(r1, [1, 2, 3, 4, 5])]).toEqual([
      int(r2, 1, 6),
      pick(r2, ['a', 'b', 'c']),
      shuffle(r2, [1, 2, 3, 4, 5]),
    ]);
    const r = mulberry32(9);
    for (let i = 0; i < 200; i++) {
      const v = int(r, -3, 3);
      expect(Number.isInteger(v) && v >= -3 && v <= 3).toBe(true);
    }
    expect(shuffle(mulberry32(1), [1, 2, 3, 4]).sort()).toEqual([1, 2, 3, 4]);
  });

  it('registry indexes fixture items and generators', () => {
    const reg = createRegistry([fixtures]);
    expect(reg.allStatic()).toHaveLength(2);
    expect(reg.staticItemsFor('first-order').map((q) => q.id)).toEqual(['first-order/fixture-tau']);
    expect(reg.staticItemsFor('first-order', 1)).toEqual([]);
    expect(reg.generatorsFor('first-order', 2).map((g) => g.id)).toEqual(['fixture-dc-gain']);
    expect(reg.generatorsFor('first-order', 3)).toEqual([]);
    expect(reg.getStaticItem('laplace-basics/fixture-step')?.kind).toBe('mcq');

    const gen = reg.getGenerator('fixture-dc-gain')!;
    const prompts = new Set<string>();
    for (let seed = 0; seed < 50; seed++) {
      const q: QuestionBody = gen.generate(mulberry32(seed), 2);
      expect(validateQuestion(q)).toEqual([]);
      expect(q.difficulty).toBe(2);
      prompts.add(q.prompt);
      const { client, answerKey } = toClientQuestion(q, mulberry32(seed));
      expect(grade(client.kind, answerKey, { value: q.answer })).toBe(true);
    }
    expect(prompts.size).toBeGreaterThan(5);

    expect(() => createRegistry([fixtures, fixtures])).toThrow(/duplicate/);
    // The app registry never includes test fixtures.
    expect(registry.getStaticItem('first-order/fixture-tau')).toBeUndefined();
  });
});
