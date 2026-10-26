import { describe, expect, it } from 'vitest';
import { grade } from '../src/content/grade.ts';
import { toClientQuestion } from '../src/content/present.ts';
import { registry } from '../src/content/registry.ts';
import { mulberry32 } from '../src/content/rng.ts';
import type { ClientQuestionBody, QuestionBody, StaticQuestion } from '../src/content/types.ts';
import u07 from '../src/content/units/u07-root-locus.ts';
import u08, { asymptoteDb, magDb } from '../src/content/units/u08-frequency-response.ts';
import u09 from '../src/content/units/u09-nyquist-margins.ts';
import { validateQuestion } from '../src/content/validate.ts';

const PACK = [u07, u08, u09];
const SKILLS = ['root-locus', 'frequency-response', 'bode-plots', 'nyquist', 'stability-margins'];
const items: StaticQuestion[] = PACK.flatMap((u) => u.items);
const generators = PACK.flatMap((u) => u.generators);

/** The response a perfect student would give, in display order. */
function correctResponse(q: QuestionBody, client: ClientQuestionBody): unknown {
  switch (q.kind) {
    case 'mcq':
      return { choice: client.choices!.indexOf(q.choices[q.answer]!) };
    case 'multi_select':
      return { choices: q.answer.map((a) => client.choices!.indexOf(q.choices[a]!)) };
    case 'match':
      return { pairs: q.answer.map((a) => client.right!.indexOf(q.right[a]!)) };
    case 'true_false':
      return { value: q.answer };
    case 'numeric':
      return { value: q.answer };
  }
}

describe('content-pack-c', () => {
  it('every pack-C static item passes validateQuestion', () => {
    expect(items.length).toBeGreaterThanOrEqual(40);
    for (const q of items) {
      expect({ id: q.id, errors: validateQuestion(q) }).toEqual({ id: q.id, errors: [] });
      expect(SKILLS).toContain(q.skillId);
      // Static items grade their own answer as correct after shuffling.
      const { client, answerKey } = toClientQuestion(q, mulberry32(3));
      expect(grade(q.kind, answerKey, correctResponse(q, client))).toBe(true);
    }
    // Registered in the app registry.
    for (const q of items) expect(registry.getStaticItem(q.id)).toBe(q);
    for (const g of generators) expect(registry.getGenerator(g.id)).toBe(g);

    const figures = items.map((q) => q.figure?.type);
    expect(figures.filter((t) => t === 'bode_mag').length).toBeGreaterThanOrEqual(4);
    expect(figures.filter((t) => t === 'pole_zero').length).toBeGreaterThanOrEqual(2);
  });

  it('each pack-C skill has >= 8 static items across >= 3 difficulties', () => {
    for (const skill of SKILLS) {
      const mine = items.filter((q) => q.skillId === skill);
      expect({ skill, n: mine.length >= 8 }).toEqual({ skill, n: true });
      expect({ skill, d: new Set(mine.map((q) => q.difficulty)).size >= 3 }).toEqual({ skill, d: true });
    }
  });

  it('each pack-C generator produces valid self-grading questions for 200 seeds', () => {
    expect(generators.map((g) => g.id).sort()).toEqual(['bode-dc-gain', 'gain-margin-db', 'root-locus-centroid']);
    for (const gen of generators) {
      for (const d of gen.difficulties) {
        for (let seed = 0; seed < 200; seed++) {
          const q = gen.generate(mulberry32(seed), d);
          expect({ gen: gen.id, seed, d, errors: validateQuestion(q) }).toEqual({ gen: gen.id, seed, d, errors: [] });
          expect(q.skillId).toBe(gen.skillId);
          expect(q.difficulty).toBe(d);
          // Pure function of the seed.
          expect(gen.generate(mulberry32(seed), d)).toEqual(q);
          const { client, answerKey } = toClientQuestion(q, mulberry32(seed + 1));
          expect(grade(q.kind, answerKey, correctResponse(q, client))).toBe(true);
          if (q.kind === 'mcq') {
            for (let i = 0; i < client.choices!.length; i++) {
              if (client.choices![i] !== q.choices[q.answer]) expect(grade('mcq', answerKey, { choice: i })).toBe(false);
            }
          }
        }
      }
    }
  });

  it('pack-C generators vary their numbers across seeds', () => {
    for (const gen of generators) {
      for (const d of gen.difficulties) {
        const prompts = new Set<string>();
        for (let seed = 0; seed < 20; seed++) prompts.add(gen.generate(mulberry32(seed), d).prompt);
        expect({ gen: gen.id, d, varied: prompts.size >= 5 }).toEqual({ gen: gen.id, d, varied: true });
      }
    }
  });

  it('pack-C generator answers match independent formulas', () => {
    const centroid = registry.getGenerator('root-locus-centroid')!;
    for (let seed = 0; seed < 100; seed++) {
      const q = centroid.generate(mulberry32(seed), 3);
      if (q.kind !== 'numeric') throw new Error('expected numeric');
      const tf = /^L\(s\) = K(.*)\/\((.*)\)\./.exec(q.prompt)!;
      const roots = (s: string) => [...s.matchAll(/\(s \+ (\d+)\)|s/g)].map((m) => (m[1] ? -Number(m[1]) : 0));
      const z = roots(tf[1]!);
      const p = roots(tf[2]!);
      const sigma = (p.reduce((a, b) => a + b, 0) - z.reduce((a, b) => a + b, 0)) / (p.length - z.length);
      expect(Math.abs(q.answer - sigma)).toBeLessThan(0.01);
    }
    const gm = registry.getGenerator('gain-margin-db')!;
    for (let seed = 0; seed < 100; seed++) {
      const q = gm.generate(mulberry32(seed), 2);
      if (q.kind !== 'numeric') throw new Error('expected numeric');
      const mag = Number(/where \|L\| = (\d+(?:\.\d+)?)/.exec(q.prompt)![1]);
      expect(q.answer).toBeCloseTo(-20 * Math.log10(mag), 1);
    }
  });

  it('pack-C Bode figures are computed from their transfer functions', () => {
    // 10/(s/5 + 1): 20 dB plateau, −3 dB at the corner.
    expect(magDb({ k: 10, poles: [5] }, 1e-3)).toBeCloseTo(20, 3);
    expect(magDb({ k: 10, poles: [5] }, 5)).toBeCloseTo(20 - 3.0103, 3);
    expect(asymptoteDb({ k: 100, poles: [1, 10] }, 100)).toBeCloseTo(40 - 20 - 40, 6);

    const byId = (id: string) => items.find((q) => q.id === id)!;
    const pts = (id: string) => {
      const f = byId(id).figure!;
      if (f.type !== 'bode_mag') throw new Error('expected bode');
      return f.points;
    };
    const near = (p: [number, number][], w: number) =>
      p.reduce((best, cur) => (Math.abs(Math.log10(cur[0] / w)) < Math.abs(Math.log10(best[0] / w)) ? cur : best));

    expect(near(pts('bode-plots/read-dc-gain'), 0.01)[1]).toBeCloseTo(20, 1);
    expect(near(pts('bode-plots/read-corner'), 10)[1]).toBeCloseTo(20 * Math.log10(2) - 3.01, 1);
    // −40 dB/dec well above both corners.
    const slope = near(pts('bode-plots/read-slope'), 1000)[1] - near(pts('bode-plots/read-slope'), 100)[1];
    expect(slope).toBeCloseTo(-40, 0);
    // 100/(s(s + 10)) at ω = 1: |L| = 100/√101.
    expect(near(pts('bode-plots/read-kv'), 1)[1]).toBeCloseTo(20 * Math.log10(100 / Math.sqrt(101)), 1);
    // 10(s + 1)/(s + 10): 0 dB at DC, 20 dB at high frequency.
    expect(near(pts('bode-plots/identify-lead'), 0.01)[1]).toBeCloseTo(0, 1);
    expect(near(pts('bode-plots/identify-lead'), 1000)[1]).toBeCloseTo(20, 1);
  });
});
