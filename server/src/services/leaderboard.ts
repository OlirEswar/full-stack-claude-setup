/**
 * Weekly leaderboard: XP earned during the current ISO week (Monday 00:00 UTC
 * onwards), summed from `xp_events.created_at` (UTC ISO timestamps).
 */
import type { Db } from '../db/index.ts';

export const LEADERBOARD_SIZE = 50;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Monday 00:00:00.000 UTC of the ISO week containing `now`. */
export function isoWeekStart(now: Date): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const daysSinceMonday = (d.getUTCDay() + 6) % 7; // Sun=0 -> 6, Mon=1 -> 0
  d.setUTCDate(d.getUTCDate() - daysSinceMonday);
  return d;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  xp: number;
  isMe: boolean;
}

export interface LeaderboardResponse {
  /** YYYY-MM-DD of the Monday (UTC) the week started. */
  weekStart: string;
  entries: LeaderboardEntry[];
  me: { rank: number; xp: number };
}

/** Case-insensitive username order (usernames are unique NOCASE), raw compare as tiebreak. */
function compareUsername(a: string, b: string): number {
  const la = a.toLowerCase();
  const lb = b.toLowerCase();
  if (la !== lb) return la < lb ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Ranks every user by this week's XP (desc, ties by username). `entries` holds
 * the top 50 users who earned XP this week; `me` is the caller's position in
 * the full ordering, so it is present even with 0 XP.
 */
export function buildLeaderboard(db: Db, userId: number, now: Date): LeaderboardResponse {
  const start = isoWeekStart(now);
  const end = new Date(start.getTime() + WEEK_MS);
  const rows = db
    .prepare(
      `SELECT u.id AS id, u.username AS username, COALESCE(SUM(e.amount), 0) AS xp
       FROM users u
       LEFT JOIN xp_events e ON e.user_id = u.id AND e.created_at >= ? AND e.created_at < ?
       GROUP BY u.id`,
    )
    .all(start.toISOString(), end.toISOString()) as unknown as { id: number; username: string; xp: number }[];

  const ranked = rows
    .map((r) => ({ id: Number(r.id), username: r.username, xp: Number(r.xp) }))
    .sort((a, b) => b.xp - a.xp || compareUsername(a.username, b.username));

  const entries: LeaderboardEntry[] = [];
  let me = { rank: ranked.length + 1, xp: 0 };
  ranked.forEach((r, i) => {
    const rank = i + 1;
    if (r.id === userId) me = { rank, xp: r.xp };
    if (r.xp > 0 && entries.length < LEADERBOARD_SIZE) {
      entries.push({ rank, username: r.username, xp: r.xp, isMe: r.id === userId });
    }
  });

  return { weekStart: start.toISOString().slice(0, 10), entries, me };
}
