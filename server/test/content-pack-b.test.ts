import { describe, expect, it } from 'vitest';
import { grade } from '../src/content/grade.ts';
import { toClientQuestion } from '../src/content/present.ts';
import { createRegistry, registry } from '../src/content/registry.ts';
import { mulberry32 } from '../src/content/rng.ts';
import type { QuestionBody, QuestionResponse, StaticQuestion, UnitContent } from '../src/content/types.ts';
import u04, { percentOvershoot, secondOrderStep } from '../src/content/units/u04-second-order.ts';
import u05 from '../src/content/units/u05-stability.ts';
import u06, { poly } from '../src/content/units/u06-steady-state-error.ts';
import { validateQuestion } from '../src/content/validate.ts';

const PACK: UnitContent[] = [u04, u05, u06];
const SKILLS = [
  'second-order-params',
  'second-order-specs',
  'stability-poles',
  'routh-hurwitz',
  'system-type',
  'steady-state-error',
];
const GENERATORS = [
  'second-order-wn-zeta',
  'percent-overshoot',
  'settling-time',
  'peak-time',
  'stability-from-poles',
  'routh-k-range',
  'system-type',
  'ss-error-step',
  'ss-error-ramp',
];

const items: StaticQuestion[] = PACK.flatMap((u) => u.items);
const gens = PACK.flatMap((u) => u.generators);

/** The response a student who knows the answer would send, in displayed order. */
function correctResponse(q: StaticQuestion | QuestionBody, seed: number) {
  const { client, answerKey } = toClientQuestion(q, mulberry32(seed));
  let response: QuestionResponse;
  switch (q.kind) {
    case 'mcq':
      response = { choice: client.choices!.indexOf(q.choices[q.answer]!) };
      break;
    case 'multi_select':
      response = { choices: q.answer.map((a) => client.choices!.indexOf(q.choices[a]!)) };
      break;
    case 'match':
      response = { pairs: q.answer.map((a) => client.right!.indexOf(q.right[a]!)) };
      break;
    case 'true_false':
      response = { value: q.answer };
      break;
    case 'numeric':
      response = { value: q.answer };
      break;
  }
  return { client, answerKey, response };
}

describe('content-pack-b', () => {
  it('every pack-B static item passes validateQuestion', () => {
    expect(items.length).toBeGreaterThanOrEqual(48);
    for (const q of items) {
      expect({ id: q.id, errors: validateQuestion(q) }).toEqual({ id: q.id, errors: [] });
      expect(SKILLS).toContain(q.skillId);
      const { client, answerKey, response } = correctResponse(q, 1);
      expect(grade(client.kind, answerKey, response)).toBe(true);
    }
    // All five kinds used, plus the required figures.
    expect(new Set(items.map((q) => q.kind))).toEqual(new Set(['mcq', 'true_false', 'numeric', 'multi_select', 'match']));
    expect(items.filter((q) => q.figure?.type === 'step_response').length).toBeGreaterThanOrEqual(3);
    expect(items.filter((q) => q.figure?.type === 'pole_zero').length).toBeGreaterThanOrEqual(3);
    // Registered in the app registry, no id clashes.
    expect(() => createRegistry(PACK)).not.toThrow();
    for (const q of items) expect(registry.getStaticItem(q.id)).toBe(q);
    for (const id of GENERATORS) expect(registry.getGenerator(id)).toBeDefined();
  });

  it('each pack-B skill has >= 8 static items across >= 3 difficulties', () => {
    for (const skill of SKILLS) {
      const own = items.filter((q) => q.skillId === skill);
      expect({ skill, n: own.length >= 8 }).toEqual({ skill, n: true });
      expect({ skill, d: new Set(own.map((q) => q.difficulty)).size >= 3 }).toEqual({ skill, d: true });
    }
  });

  it('each pack-B generator produces valid self-grading questions for 200 seeds', () => {
    expect(gens.map((g) => g.id).sort()).toEqual([...GENERATORS].sort());
    for (const gen of gens) {
      for (const d of gen.difficulties) {
        for (let seed = 0; seed < 200; seed++) {
          const q = gen.generate(mulberry32(seed), d);
          const errors = validateQuestion(q);
          expect({ gen: gen.id, d, seed, errors }).toEqual({ gen: gen.id, d, seed, errors: [] });
          expect(q.skillId).toBe(gen.skillId);
          expect(q.difficulty).toBe(d);
          const { client, answerKey, response } = correctResponse(q, seed);
          expect(grade(client.kind, answerKey, response)).toBe(true);
          // Deterministic for a given seed.
          expect(gen.generate(mulberry32(seed), d)).toEqual(q);
        }
      }
    }
  });

  it('pack-B generators vary their numbers across seeds', () => {
    for (const gen of gens) {
      for (const d of gen.difficulties) {
        const prompts = new Set<string>();
        for (let seed = 0; seed < 20; seed++) prompts.add(gen.generate(mulberry32(seed), d).prompt);
        expect({ gen: gen.id, d, distinct: prompts.size >= 5 }).toEqual({ gen: gen.id, d, distinct: true });
      }
    }
  });

  it('pack-B generator answers match the textbook formulas', () => {
    const num = (s: string) => Number(s.replace('−', '-'));
    for (let seed = 0; seed < 200; seed++) {
      // Settling time from poles: Ts = 4/σ.
      const ts = registry.getGenerator('settling-time')!.generate(mulberry32(seed), 4);
      const [, sig] = /s = −([\d.]+) ±/.exec(ts.prompt)!;
      expect(ts.answer).toBeCloseTo(4 / num(sig!), 9);

      // Peak time from poles: Tp = π/ωd.
      const tp = registry.getGenerator('peak-time')!.generate(mulberry32(seed), 2);
      const [, wd] = /± (\d*)j/.exec(tp.prompt)!;
      expect(tp.answer).toBeCloseTo(Math.PI / (wd ? num(wd) : 1), 9);

      // Routh: K_max = a·b.
      const rk = registry.getGenerator('routh-k-range')!.generate(mulberry32(seed), 2);
      const [, a, b] = /s³ \+ (\d*)s² \+ (\d*)s \+ K/.exec(rk.prompt)!;
      expect(rk.answer).toBe((a ? num(a) : 1) * (b ? num(b) : 1));

      // %OS: correct choice equals 100·e^(−ζπ/√(1−ζ²)).
      const os = registry.getGenerator('percent-overshoot')!.generate(mulberry32(seed), 2);
      if (os.kind !== 'mcq') throw new Error('percent-overshoot must be mcq');
      const [, z] = /ζ = (\d+(?:\.\d+)?)/.exec(os.prompt)!;
      expect(num(os.choices[os.answer]!.replace('%', ''))).toBeCloseTo(percentOvershoot(num(z!)), 1);

      // Step error: e = 1/(1 + Kp) with Kp = K/a.
      const se = registry.getGenerator('ss-error-step')!.generate(mulberry32(seed), 1);
      const [, k, pa] = /G\(s\) = (\d+)\/\(s \+ (\d+)\)/.exec(se.prompt)!;
      expect(se.answer).toBeCloseTo(1 / (1 + num(k!) / num(pa!)), 9);

      // Ramp error: e = 1/Kv with Kv = K/a.
      const re = registry.getGenerator('ss-error-ramp')!.generate(mulberry32(seed), 2);
      const [, rk2, ra] = /G\(s\) = ([\d.]+)\/\(s\(s \+ (\d+)\)\)/.exec(re.prompt)!;
      expect(re.answer).toBeCloseTo(num(ra!) / num(rk2!), 9);
    }

    // Classic %OS values and step-response shapes behind the "which ζ?" figures.
    expect(percentOvershoot(0.5)).toBeCloseTo(16.3, 1);
    expect(percentOvershoot(0.7)).toBeCloseTo(4.6, 1);
    expect(secondOrderStep(1, 1, 5)).toBeCloseTo(0.96, 2);
    expect(secondOrderStep(2, 1, 5)).toBeCloseTo(0.72, 2);
    expect(secondOrderStep(0.3, 2, 0)).toBeCloseTo(0, 9);
    expect(1 + percentOvershoot(0.3) / 100).toBeCloseTo(
      secondOrderStep(0.3, 2, Math.PI / (2 * Math.sqrt(1 - 0.09))),
      6,
    );
    expect(poly([1, 5, 6, 0])).toBe('s³ + 5s² + 6s');
    expect(poly([1, 0, -2, 1])).toBe('s³ − 2s + 1');
  });

  it('stability-from-poles labels match the pole locations', () => {
    const gen = registry.getGenerator('stability-from-poles')!;
    const seen = new Set<number>();
    for (const d of gen.difficulties) {
      for (let seed = 0; seed < 200; seed++) {
        const q = gen.generate(mulberry32(seed), d);
        if (q.kind !== 'mcq' || q.figure?.type !== 'pole_zero') throw new Error('expected mcq with pole_zero figure');
        const poles = q.figure.poles;
        const key = (p: { re: number; im: number }) => `${p.re},${p.im}`;
        const counts = new Map<string, number>();
        for (const p of poles) counts.set(key(p), (counts.get(key(p)) ?? 0) + 1);
        const rhp = poles.some((p) => p.re > 0);
        const repeatedAxis = poles.some((p) => p.re === 0 && counts.get(key(p))! > 1);
        const onAxis = poles.some((p) => p.re === 0);
        const expected = rhp || repeatedAxis ? 2 : onAxis ? 1 : 0;
        expect(q.answer).toBe(expected);
        seen.add(q.answer);
      }
    }
    expect(seen).toEqual(new Set([0, 1, 2]));
  });
});
