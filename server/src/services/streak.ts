/**
 * Streaks (spec "Gamification rules" → Streak). Pure functions only; the
 * daily-challenge completion hook in services/daily.ts persists the result.
 *
 * A streak is counted when the daily challenge for local date D completes:
 *  - last = D: no change.
 *  - last = D−1: streak + 1.
 *  - gap of g missed days with freezes ≥ g: consume g freezes, then streak + 1.
 *  - otherwise: streak = 1.
 * Each time the new streak value is a multiple of 7, +1 freeze (max 2 held).
 * The displayed streak is 0 when the gap since the last counted day can no
 * longer be covered by the freezes held.
 */

export const STREAK_FREEZE_EVERY = 7;
export const MAX_STREAK_FREEZES = 2;

export interface StreakState {
  current: number;
  longest: number;
  /** Local date (YYYY-MM-DD) of the last counted daily challenge. */
  lastDate: string | null;
  freezes: number;
}

export interface StreakUpdate {
  state: StreakState;
  /** True when `localDate` was newly counted (streak incremented or restarted at 1). */
  extended: boolean;
  freezesUsed: number;
  freezesEarned: number;
}

/** Whole calendar days from `a` to `b` (both YYYY-MM-DD). */
export function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** Count a completed daily challenge on `localDate`. Pure: returns the new state. */
export function applyStreak(state: StreakState, localDate: string): StreakUpdate {
  // Already counted today, or a date not after the last counted one (e.g. the
  // user moved to a time zone behind theirs): nothing changes.
  if (state.lastDate !== null && dayDiff(state.lastDate, localDate) <= 0) {
    return { state: { ...state }, extended: false, freezesUsed: 0, freezesEarned: 0 };
  }

  let current: number;
  let freezes = state.freezes;
  let freezesUsed = 0;
  if (state.lastDate === null || state.current <= 0) {
    current = 1;
  } else {
    const missed = dayDiff(state.lastDate, localDate) - 1;
    if (missed === 0) {
      current = state.current + 1;
    } else if (freezes >= missed) {
      freezesUsed = missed;
      freezes -= missed;
      current = state.current + 1;
    } else {
      current = 1;
    }
  }

  let freezesEarned = 0;
  if (current % STREAK_FREEZE_EVERY === 0 && freezes < MAX_STREAK_FREEZES) {
    freezes += 1;
    freezesEarned = 1;
  }

  return {
    state: { current, longest: Math.max(state.longest, current), lastDate: localDate, freezes },
    extended: true,
    freezesUsed,
    freezesEarned,
  };
}

/** Streak to show on `today`: 0 if the gap since the last counted day can't be covered by freezes. */
export function displayStreak(state: Pick<StreakState, 'current' | 'lastDate' | 'freezes'>, today: string): number {
  if (!state.lastDate) return state.current;
  const missed = dayDiff(state.lastDate, today) - 1;
  return missed > state.freezes ? 0 : state.current;
}

/** Positional form of `displayStreak` (kept for existing callers). */
export function displayedStreak(current: number, lastDate: string | null, freezes: number, today: string): number {
  return displayStreak({ current, lastDate, freezes }, today);
}
