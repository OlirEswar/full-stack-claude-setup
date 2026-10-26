/**
 * XP ledger (spec "Gamification rules" → XP, daily goal). Every award is an
 * `xp_events` row stamped with the user's *local* date at the time it was
 * earned, so "XP today" and the daily goal follow the user's time zone.
 */
import type { Db } from '../db/index.ts';
import { MAX_HEARTS } from './hearts.ts';

/** YYYY-MM-DD for `now` in IANA time zone `tz`. */
export function localDate(now: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    now,
  );
}

/** Make sure the user has a `user_stats` row (fresh rows start with full hearts). */
export function ensureUserStats(db: Db, userId: number, now: Date): void {
  db.prepare('INSERT OR IGNORE INTO user_stats (user_id, hearts, hearts_updated_at) VALUES (?, ?, ?)').run(
    userId,
    MAX_HEARTS,
    now.toISOString(),
  );
}

export interface XpAward {
  userId: number;
  amount: number;
  /** What earned it, e.g. the session kind ('lesson', 'daily', ...). */
  source: string;
  sessionId: number | null;
  now: Date;
  timezone: string;
}

/**
 * Record an XP award: insert an `xp_events` row for the user's local date and
 * bump `user_stats.xp_total`. Non-positive amounts are ignored.
 * Returns the local date the award was booked under.
 */
export function awardXp(db: Db, award: XpAward): string {
  const date = localDate(award.now, award.timezone);
  if (!(award.amount > 0)) return date;
  ensureUserStats(db, award.userId, award.now);
  db.prepare(
    'INSERT INTO xp_events (user_id, amount, source, session_id, local_date, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(award.userId, award.amount, award.source, award.sessionId, date, award.now.toISOString());
  db.prepare('UPDATE user_stats SET xp_total = xp_total + ? WHERE user_id = ?').run(award.amount, award.userId);
  return date;
}

/** Total XP the user earned on local date `date` (YYYY-MM-DD). */
export function xpForDate(db: Db, userId: number, date: string): number {
  const row = db
    .prepare('SELECT COALESCE(SUM(amount), 0) AS xp FROM xp_events WHERE user_id = ? AND local_date = ?')
    .get(userId, date) as { xp: number };
  return Number(row.xp);
}

/** XP earned "today" in the user's time zone. */
export function xpToday(db: Db, user: { id: number; timezone: string }, now: Date): number {
  return xpForDate(db, user.id, localDate(now, user.timezone));
}

export function isDailyGoalMet(xp: number, dailyXpGoal: number): boolean {
  return xp >= dailyXpGoal;
}
