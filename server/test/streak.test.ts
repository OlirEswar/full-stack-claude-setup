import { describe, expect, it } from 'vitest';
import { applyStreak, dayDiff, displayStreak, MAX_STREAK_FREEZES, type StreakState } from '../src/services/streak.ts';

const fresh: StreakState = { current: 0, longest: 0, lastDate: null, freezes: 0 };

function state(p: Partial<StreakState>): StreakState {
  return { ...fresh, ...p };
}

describe('streak rules', () => {
  it('dayDiff counts calendar days across month and year boundaries', () => {
    expect(dayDiff('2026-01-31', '2026-02-01')).toBe(1);
    expect(dayDiff('2025-12-31', '2026-01-02')).toBe(2);
    expect(dayDiff('2026-03-07', '2026-03-09')).toBe(2); // across a DST change in many zones
  });

  it('first daily starts the streak at 1', () => {
    const r = applyStreak(fresh, '2026-03-10');
    expect(r.state).toEqual({ current: 1, longest: 1, lastDate: '2026-03-10', freezes: 0 });
    expect(r.extended).toBe(true);
  });

  it('consecutive days increment streak', () => {
    let s = fresh;
    for (const [i, d] of ['2026-03-10', '2026-03-11', '2026-03-12'].entries()) {
      const r = applyStreak(s, d);
      expect(r.extended).toBe(true);
      expect(r.state.current).toBe(i + 1);
      s = r.state;
    }
    expect(s.longest).toBe(3);
    expect(s.lastDate).toBe('2026-03-12');
  });

  it('same day is a no-change (not extended)', () => {
    const s = state({ current: 4, longest: 6, lastDate: '2026-03-10', freezes: 1 });
    const r = applyStreak(s, '2026-03-10');
    expect(r.state).toEqual(s);
    expect(r.extended).toBe(false);
  });

  it('missing a day with a freeze keeps the streak and consumes the freeze', () => {
    const r = applyStreak(state({ current: 5, longest: 5, lastDate: '2026-03-10', freezes: 1 }), '2026-03-12');
    expect(r.state.current).toBe(6);
    expect(r.state.freezes).toBe(0);
    expect(r.freezesUsed).toBe(1);

    // A two-day gap with two freezes consumes both.
    const r2 = applyStreak(state({ current: 3, longest: 3, lastDate: '2026-03-10', freezes: 2 }), '2026-03-13');
    expect(r2.state.current).toBe(4);
    expect(r2.state.freezes).toBe(0);
    expect(r2.freezesUsed).toBe(2);
  });

  it('missing a day without freeze resets streak to 1', () => {
    const r = applyStreak(state({ current: 5, longest: 9, lastDate: '2026-03-10', freezes: 0 }), '2026-03-12');
    expect(r.state.current).toBe(1);
    expect(r.state.longest).toBe(9);
    expect(r.extended).toBe(true);

    // Gap larger than the freezes held: reset and keep the freezes.
    const r2 = applyStreak(state({ current: 5, longest: 5, lastDate: '2026-03-10', freezes: 1 }), '2026-03-13');
    expect(r2.state.current).toBe(1);
    expect(r2.state.freezes).toBe(1);
    expect(r2.freezesUsed).toBe(0);
  });

  it('reaching streak 7 grants a freeze, max 2 held', () => {
    const r7 = applyStreak(state({ current: 6, longest: 6, lastDate: '2026-03-10', freezes: 0 }), '2026-03-11');
    expect(r7.state.current).toBe(7);
    expect(r7.state.freezes).toBe(1);
    expect(r7.freezesEarned).toBe(1);

    const r14 = applyStreak(state({ current: 13, longest: 13, lastDate: '2026-03-10', freezes: 1 }), '2026-03-11');
    expect(r14.state.freezes).toBe(2);

    const r21 = applyStreak(
      state({ current: 20, longest: 20, lastDate: '2026-03-10', freezes: MAX_STREAK_FREEZES }),
      '2026-03-11',
    );
    expect(r21.state.current).toBe(21);
    expect(r21.state.freezes).toBe(MAX_STREAK_FREEZES);
    expect(r21.freezesEarned).toBe(0);

    // Non-multiples of 7 earn nothing.
    const r8 = applyStreak(state({ current: 7, longest: 7, lastDate: '2026-03-10', freezes: 1 }), '2026-03-11');
    expect(r8.state.freezes).toBe(1);

    // Simulated 14 consecutive days from scratch: exactly 2 freezes, then capped.
    let s = fresh;
    const start = Date.parse('2026-03-01T00:00:00Z');
    for (let i = 0; i < 21; i++) {
      s = applyStreak(s, new Date(start + i * 86_400_000).toISOString().slice(0, 10)).state;
      if (i === 6) expect(s.freezes).toBe(1);
      if (i === 13) expect(s.freezes).toBe(2);
    }
    expect(s.current).toBe(21);
    expect(s.freezes).toBe(2);
  });

  it('displayed streak is 0 when the gap cannot be covered', () => {
    const s = state({ current: 5, longest: 5, lastDate: '2026-03-10', freezes: 1 });
    expect(displayStreak(s, '2026-03-10')).toBe(5); // done today
    expect(displayStreak(s, '2026-03-11')).toBe(5); // today still open
    expect(displayStreak(s, '2026-03-12')).toBe(5); // one missed day, one freeze
    expect(displayStreak(s, '2026-03-13')).toBe(0); // two missed days, one freeze
    expect(displayStreak({ ...s, freezes: 0 }, '2026-03-12')).toBe(0);
    expect(displayStreak(fresh, '2026-03-12')).toBe(0);
  });
});
