import { describe, expect, it } from 'vitest';
import { SKILLS } from '../src/content/curriculum.ts';
import { allGenerators, allStatic, staticItemsFor } from '../src/content/registry.ts';
import { QUESTION_KINDS } from '../src/content/types.ts';

// Global content targets from the spec. These pass only once all four content
// packs (A–D) are registered in units/index.ts.
describe('content totals', () => {
  it('at least 150 static items in total', () => {
    expect(allStatic().length).toBeGreaterThanOrEqual(150);
  });

  it('at least 15 generators in total', () => {
    expect(allGenerators().length).toBeGreaterThanOrEqual(15);
  });

  it('every one of the 20 skills has >= 8 static items', () => {
    expect(SKILLS).toHaveLength(20);
    const short = SKILLS.map((s) => [s.id, staticItemsFor(s.id).length] as const).filter(([, n]) => n < 8);
    expect(short).toEqual([]);
  });

  it('static item ids are unique', () => {
    const ids = allStatic().map((q) => q.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every question kind appears at least 10 times', () => {
    const counts = new Map<string, number>(QUESTION_KINDS.map((k) => [k, 0]));
    for (const q of allStatic()) counts.set(q.kind, (counts.get(q.kind) ?? 0) + 1);
    const rare = [...counts].filter(([, n]) => n < 10);
    expect(rare).toEqual([]);
  });

  it('at least 15 items carry a figure', () => {
    expect(allStatic().filter((q) => q.figure !== undefined).length).toBeGreaterThanOrEqual(15);
  });
});
