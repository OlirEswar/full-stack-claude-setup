/**
 * Spaced repetition per (user, skill) (spec "Adaptive engine"):
 * strength(now) = 2^(−Δdays / halfLife); half-life adapts to session accuracy.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_HALF_LIFE_DAYS = 1;
export const HALF_LIFE_MIN = 0.5;
export const HALF_LIFE_MAX = 60;

/** Dates as Date objects, epoch milliseconds, or ISO strings (as stored in SQLite). */
export type TimeLike = Date | number | string;

export function toMs(t: TimeLike): number {
  if (t instanceof Date) return t.getTime();
  if (typeof t === 'number') return t;
  const ms = Date.parse(t);
  if (Number.isNaN(ms)) throw new Error(`invalid date: ${t}`);
  return ms;
}

/**
 * Memory strength in (0, 1]. A never-practiced skill (no lastPracticedAt) has
 * strength 0. Future timestamps (clock skew) count as Δ = 0.
 */
export function strength(
  lastPracticedAt: TimeLike | null | undefined,
  halfLifeDays: number,
  now: TimeLike,
): number {
  if (lastPracticedAt === null || lastPracticedAt === undefined) return 0;
  const deltaDays = Math.max(0, (toMs(now) - toMs(lastPracticedAt)) / DAY_MS);
  const h = halfLifeDays > 0 ? halfLifeDays : DEFAULT_HALF_LIFE_DAYS;
  return Math.pow(2, -deltaDays / h);
}

/** a ≥ 0.8 doubles, 0.5 ≤ a < 0.8 keeps, a < 0.5 halves; clamped to [0.5, 60]. */
export function nextHalfLife(halfLifeDays: number, accuracy: number): number {
  const h = halfLifeDays > 0 ? halfLifeDays : DEFAULT_HALF_LIFE_DAYS;
  let next = h;
  if (accuracy >= 0.8) next = h * 2;
  else if (accuracy < 0.5) next = h / 2;
  return Math.min(HALF_LIFE_MAX, Math.max(HALF_LIFE_MIN, next));
}

export interface Schedule {
  halfLifeDays: number;
  lastPracticedAt: Date;
  nextDueAt: Date;
}

/**
 * Schedule a skill after a completed session, given that skill's accuracy in
 * the session (correct / answered, in [0, 1]).
 */
export function scheduleAfterSession(halfLifeDays: number, accuracy: number, now: TimeLike): Schedule {
  const h = nextHalfLife(halfLifeDays, accuracy);
  const nowMs = toMs(now);
  return {
    halfLifeDays: h,
    lastPracticedAt: new Date(nowMs),
    nextDueAt: new Date(nowMs + h * DAY_MS),
  };
}

/**
 * Due when started (attempts > 0) and now ≥ nextDueAt. A started skill that was never
 * scheduled (only failed/abandoned sessions) is not due; it is still picked up as a weak skill.
 */
export function isDue(
  progress: { attempts: number; nextDueAt?: TimeLike | null },
  now: TimeLike,
): boolean {
  if (!(progress.attempts > 0)) return false;
  if (progress.nextDueAt === null || progress.nextDueAt === undefined) return false;
  return toMs(now) >= toMs(progress.nextDueAt);
}
