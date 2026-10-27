import { describe, expect, it } from 'vitest';
import { createRegistry } from '../src/content/registry.ts';
import { mulberry32 } from '../src/content/rng.ts';
import type { Difficulty, Generator, StaticQuestion, UnitContent } from '../src/content/types.ts';
import fixtures from '../src/content/units/_fixtures.ts';
import {
  ABILITY_MAX,
  ABILITY_MIN,
  expectedSuccess,
  kFactor,
  pickDifficulty,
  updateAbility,
} from '../src/engine/ability.ts';
import {
  instantiate,
  selectDaily,
  selectPractice,
  selectQuestionsForSkill,
  type SelectionContext,
  type SkillState,
} from '../src/engine/select.ts';
import { DAY_MS, isDue, scheduleAfterSession, strength } from '../src/engine/spaced.ts';

const ALL: Difficulty[] = [1, 2, 3, 4, 5];

function item(skillId: string, slug: string, difficulty: Difficulty): StaticQuestion {
  return {
    id: `${skillId}/${slug}`,
    skillId,
    difficulty,
    kind: 'true_false',
    prompt: `${skillId} ${slug}?`,
    answer: true,
    explanation: 'Because.',
  };
}

/** n static items per difficulty in 1..5 for each skill. */
function itemsFor(skillIds: string[], perDifficulty: number): StaticQuestion[] {
  return skillIds.flatMap((s) => ALL.flatMap((d) => Array.from({ length: perDifficulty }, (_, i) => item(s, `d${d}-${i}`, d))));
}

function gen(id: string, skillId: string, difficulties: Difficulty[]): Generator {
  return {
    id,
    skillId,
    difficulties,
    generate: (rng, d) => ({
      skillId,
      difficulty: d,
      kind: 'numeric',
      prompt: `x = ${Math.floor(rng() * 1e9)}`,
      answer: 1,
      tolerance: {},
      explanation: 'gen',
    }),
  };
}

function unit(items: StaticQuestion[], generators: Generator[] = []): UnitContent {
  return { unitId: 'fixtures', items, generators };
}

function ctxOf(
  units: UnitContent[],
  progress: Record<string, SkillState> = {},
  extra: Partial<SelectionContext> = {},
): SelectionContext {
  return {
    registry: createRegistry(units),
    progress: new Map(Object.entries(progress)),
    recentStaticIds: new Set(),
    rng: mulberry32(42),
    now: new Date('2026-06-15T12:00:00Z'),
    ...extra,
  };
}

describe('ability', () => {
  it('expectedSuccess(0, 3) === 0.5', () => {
    expect(expectedSuccess(0, 3)).toBe(0.5);
  });

  it('pickDifficulty(0, [1..5]) returns 2', () => {
    expect(pickDifficulty(0, ALL)).toBe(2);
  });

  it('pickDifficulty(2, [1..5]) returns 4', () => {
    expect(pickDifficulty(2, ALL)).toBe(4);
  });

  it('pickDifficulty respects the available set and breaks ties low', () => {
    expect(pickDifficulty(0, [4, 5])).toBe(4);
    expect(pickDifficulty(-10, [1, 1, 2])).toBe(1);
    expect(() => pickDifficulty(0, [])).toThrow();
  });

  it('correct answer raises ability, wrong lowers it', () => {
    expect(updateAbility(0, true, 3, 0)).toBeGreaterThan(0);
    expect(updateAbility(0, false, 3, 0)).toBeLessThan(0);
    // θ' = θ + K(o − P) exactly: K(0) = 1.2, P = 0.5.
    expect(updateAbility(0, true, 3, 0)).toBeCloseTo(0.6, 12);
    expect(updateAbility(0, false, 3, 0)).toBeCloseTo(-0.6, 12);
  });

  it('K shrinks with attempts and floors at 0.3', () => {
    expect(kFactor(0)).toBeCloseTo(1.2, 12);
    expect(kFactor(10)).toBeCloseTo(0.6, 12);
    expect(kFactor(5)).toBeLessThan(kFactor(0));
    expect(kFactor(20)).toBeLessThan(kFactor(10));
    expect(kFactor(30)).toBeCloseTo(0.3, 12);
    expect(kFactor(1000)).toBe(0.3);
    const smallStep = updateAbility(0, true, 3, 1000) - 0;
    expect(smallStep).toBeCloseTo(0.3 * 0.5, 12);
  });

  it('ability is clamped to [-4, 4]', () => {
    expect(updateAbility(3.9, true, 5, 0)).toBe(ABILITY_MAX);
    expect(updateAbility(-3.9, false, 1, 0)).toBe(ABILITY_MIN);
    let theta = 0;
    for (let i = 0; i < 200; i++) theta = updateAbility(theta, true, 5, 0);
    expect(theta).toBe(4);
  });

  it('simulated learner converges to ~75% success', () => {
    const rng = mulberry32(12345);
    const trueTheta = 1.5;
    let theta = 0;
    const outcomes: boolean[] = [];
    const thetas: number[] = [];
    for (let n = 0; n < 300; n++) {
      const d = pickDifficulty(theta, ALL);
      const correct = rng() < expectedSuccess(trueTheta, d);
      outcomes.push(correct);
      theta = updateAbility(theta, correct, d, n);
      thetas.push(theta);
    }
    const last = outcomes.slice(-100);
    const rate = last.filter(Boolean).length / last.length;
    expect(rate).toBeGreaterThanOrEqual(0.65);
    expect(rate).toBeLessThanOrEqual(0.85);
    // The estimate wanders (K floors at 0.3) but its recent mean sits near the truth.
    const meanTheta = thetas.slice(-100).reduce((a, b) => a + b, 0) / 100;
    expect(Math.abs(meanTheta - trueTheta)).toBeLessThan(0.75);
  });
});

describe('spaced repetition', () => {
  const t0 = new Date('2026-06-01T00:00:00Z');

  it('strength halves after one half-life', () => {
    expect(strength(t0, 2, t0)).toBe(1);
    expect(strength(t0, 2, t0.getTime() + 2 * DAY_MS)).toBeCloseTo(0.5, 12);
    expect(strength(t0, 2, t0.getTime() + 4 * DAY_MS)).toBeCloseTo(0.25, 12);
    expect(strength(t0.toISOString(), 1, new Date(t0.getTime() + DAY_MS).toISOString())).toBeCloseTo(0.5, 12);
    expect(strength(null, 1, t0)).toBe(0);
  });

  it('accuracy >= 0.8 doubles half-life, < 0.5 halves it, capped to [0.5, 60]', () => {
    expect(scheduleAfterSession(4, 0.8, t0).halfLifeDays).toBe(8);
    expect(scheduleAfterSession(4, 1, t0).halfLifeDays).toBe(8);
    expect(scheduleAfterSession(4, 0.79, t0).halfLifeDays).toBe(4);
    expect(scheduleAfterSession(4, 0.5, t0).halfLifeDays).toBe(4);
    expect(scheduleAfterSession(4, 0.49, t0).halfLifeDays).toBe(2);
    expect(scheduleAfterSession(40, 1, t0).halfLifeDays).toBe(60);
    expect(scheduleAfterSession(60, 1, t0).halfLifeDays).toBe(60);
    expect(scheduleAfterSession(0.75, 0, t0).halfLifeDays).toBe(0.5);
    expect(scheduleAfterSession(0.5, 0, t0).halfLifeDays).toBe(0.5);
  });

  it('nextDueAt = now + halfLife days, and isDue compares against it', () => {
    const s = scheduleAfterSession(1, 0.9, t0);
    expect(s.lastPracticedAt.getTime()).toBe(t0.getTime());
    expect(s.nextDueAt.getTime()).toBe(t0.getTime() + 2 * DAY_MS);
    const p = { attempts: 3, nextDueAt: s.nextDueAt };
    expect(isDue(p, t0.getTime() + 2 * DAY_MS - 1)).toBe(false);
    expect(isDue(p, t0.getTime() + 2 * DAY_MS)).toBe(true);
    expect(isDue({ attempts: 0, nextDueAt: t0 }, t0.getTime() + 10 * DAY_MS)).toBe(false);
    // Started but never scheduled (e.g. only a failed lesson): not due.
    expect(isDue({ attempts: 3, nextDueAt: null }, t0.getTime() + 10 * DAY_MS)).toBe(false);
  });
});

describe('selection', () => {
  it('selectQuestionsForSkill excludes static items seen in last 3 days when pool allows', () => {
    const items = itemsFor(['laplace-basics'], 3);
    // θ = 0 → target d = 2. Mark two of the three d=2 items as recent.
    const recent = new Set(['laplace-basics/d2-0', 'laplace-basics/d2-1']);
    for (let seed = 0; seed < 20; seed++) {
      const ctx = ctxOf([unit(items)], {}, { recentStaticIds: recent, rng: mulberry32(seed) });
      const picked = selectQuestionsForSkill(ctx, 'laplace-basics', 4);
      expect(picked).toHaveLength(4);
      for (const q of picked) expect(recent.has(q.ref)).toBe(false);
      // First pick is the only fresh d=2 item; then fallback to d±1.
      expect(picked[0]?.ref).toBe('laplace-basics/d2-2');
      for (const q of picked.slice(1)) expect([1, 3]).toContain(q.difficulty);
      // No repeats within a session.
      expect(new Set(picked.map((q) => q.ref)).size).toBe(4);
    }

    // When the pool is too small, recently seen items come back rather than nothing.
    const tiny = [item('laplace-basics', 'a', 2), item('laplace-basics', 'b', 2)];
    const ctx = ctxOf([unit(tiny)], {}, { recentStaticIds: new Set(['laplace-basics/a']) });
    const picked = selectQuestionsForSkill(ctx, 'laplace-basics', 2);
    expect(picked.map((q) => q.ref)).toEqual(['laplace-basics/b', 'laplace-basics/a']);
  });

  it('selectQuestionsForSkill targets pickDifficulty(θ) for the skill', () => {
    const ctx = ctxOf([unit(itemsFor(['laplace-basics'], 3))], { 'laplace-basics': { ability: 2, attempts: 5 } });
    const picked = selectQuestionsForSkill(ctx, 'laplace-basics', 3);
    expect(picked.map((q) => q.difficulty)).toEqual([4, 4, 4]);
  });

  it('mixes in generators (~40%) with fresh seeds and never repeats static items in a session', () => {
    const items = Array.from({ length: 40 }, (_, i) => item('first-order', `s${i}`, 2));
    const ctx = ctxOf([unit(items, [gen('fo-gen', 'first-order', [2])])], {}, { rng: mulberry32(7) });
    const picked = selectQuestionsForSkill(ctx, 'first-order', 30);
    const gens = picked.filter((q) => q.source === 'generator');
    const statics = picked.filter((q) => q.source === 'static');
    expect(gens.length).toBeGreaterThan(4);
    expect(gens.length).toBeLessThan(20);
    expect(new Set(statics.map((q) => q.ref)).size).toBe(statics.length);
    const prompts = gens.map((q) => instantiate(q).prompt);
    expect(new Set(prompts).size).toBe(prompts.length);
    expect(gens.every((q) => q.ref === 'gen:fo-gen')).toBe(true);
  });

  it('works with the shared fixture pack', () => {
    const ctx = ctxOf([fixtures]);
    const picked = selectQuestionsForSkill(ctx, 'first-order', 5);
    expect(picked).toHaveLength(5);
    const staticRefs = picked.filter((q) => q.source === 'static').map((q) => q.ref);
    expect(new Set(staticRefs).size).toBe(staticRefs.length);
    for (const q of picked) expect(instantiate(q).skillId).toBe('first-order');
    expect(selectQuestionsForSkill(ctx, 'bode-plots', 3)).toEqual([]);
  });

  it('selectDaily returns 5 questions from due skills first, then weakest', () => {
    const skills = ['laplace-basics', 'transfer-functions', 'poles-zeros', 'block-diagrams', 'first-order'];
    const now = new Date('2026-06-15T12:00:00Z');
    const ago = (days: number) => new Date(now.getTime() - days * DAY_MS);
    const ahead = (days: number) => new Date(now.getTime() + days * DAY_MS);
    const progress: Record<string, SkillState> = {
      // Due, overdue by 1 day.
      'poles-zeros': { ability: 1, attempts: 10, level: 1, nextDueAt: ago(1) },
      // Due, overdue by 3 days (most overdue).
      'block-diagrams': { ability: 2, attempts: 10, level: 1, nextDueAt: ago(3) },
      // Not due; weakest of the rest.
      'transfer-functions': { ability: -1.5, attempts: 10, level: 1, nextDueAt: ahead(2) },
      'laplace-basics': { ability: 0.5, attempts: 10, level: 1, nextDueAt: ahead(2) },
      'first-order': { ability: 3, attempts: 10, level: 0, nextDueAt: ahead(5) },
    };
    const ctx = ctxOf([unit(itemsFor(skills, 3))], progress, { now });
    const daily = selectDaily(ctx);
    expect(daily).toHaveLength(5);
    expect(daily.map((q) => q.skillId)).toEqual([
      'block-diagrams',
      'block-diagrams',
      'poles-zeros',
      'poles-zeros',
      'transfer-functions',
    ]);
    // Each at pickDifficulty(θ_skill).
    expect(daily.map((q) => q.difficulty)).toEqual([4, 4, 3, 3, 1]);
    expect(new Set(daily.map((q) => q.ref)).size).toBe(5);

    // With nothing due, the weakest started skills fill the session.
    const notDue = Object.fromEntries(
      Object.entries(progress).map(([k, v]) => [k, { ...v, nextDueAt: ahead(1) }]),
    );
    const weakOnly = selectDaily(ctxOf([unit(itemsFor(skills, 3))], notDue, { now }));
    expect(weakOnly).toHaveLength(5);
    expect([...new Set(weakOnly.map((q) => q.skillId))]).toEqual([
      'transfer-functions',
      'laplace-basics',
      'poles-zeros',
    ]);
  });

  it('selectDaily for a new user uses the first skill', () => {
    const ctx = ctxOf([unit(itemsFor(['laplace-basics', 'transfer-functions'], 5))]);
    const daily = selectDaily(ctx);
    expect(daily).toHaveLength(5);
    expect(daily.every((q) => q.skillId === 'laplace-basics')).toBe(true);
    expect(daily.every((q) => q.difficulty === 2)).toBe(true);
    expect(new Set(daily.map((q) => q.ref)).size).toBe(5);

    // Also with the shared fixture pack (first skill has a single item: falls back, still 5).
    const fx = selectDaily(ctxOf([fixtures]));
    expect(fx).toHaveLength(5);
    expect(fx.every((q) => q.skillId === 'laplace-basics')).toBe(true);
  });

  it('selectPractice returns 8 questions from due skills, falling back to weak ones', () => {
    const skills = ['laplace-basics', 'transfer-functions', 'poles-zeros'];
    const now = new Date('2026-06-15T12:00:00Z');
    const progress: Record<string, SkillState> = {
      'laplace-basics': { ability: 1, attempts: 4, level: 1, nextDueAt: new Date(now.getTime() + DAY_MS) },
      'transfer-functions': { ability: 0, attempts: 4, level: 1, nextDueAt: new Date(now.getTime() - DAY_MS) },
    };
    const practice = selectPractice(ctxOf([unit(itemsFor(skills, 3))], progress, { now }));
    expect(practice).toHaveLength(8);
    expect(practice[0]?.skillId).toBe('transfer-functions');
    expect(new Set(practice.map((q) => q.skillId))).toEqual(new Set(['transfer-functions', 'laplace-basics']));
    expect(new Set(practice.map((q) => q.ref)).size).toBe(8);
  });
});
