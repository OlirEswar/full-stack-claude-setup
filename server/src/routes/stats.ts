/**
 * GET /api/stats: lifetime totals, last-7-days XP (user's local dates,
 * zero-filled, oldest first), and per-skill level / ability / accuracy / strength.
 */
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/index.ts';
import { SKILLS } from '../content/curriculum.ts';
import { strength } from '../engine/spaced.ts';
import { defaultProgress, getAllSkillProgress } from '../services/progress.ts';
import { localDate } from '../services/xp.ts';

export interface StatsResponse {
  xpTotal: number;
  answered: number;
  accuracy: number;
  lessonsCompleted: number;
  longestStreak: number;
  last7Days: { date: string; xp: number }[];
  skills: {
    skillId: string;
    title: string;
    level: number;
    ability: number;
    accuracy: number;
    strength: number;
    started: boolean;
  }[];
}

/** YYYY-MM-DD shifted by `days` (calendar arithmetic, time-zone independent). */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The 7 local dates ending `today`, oldest first, with XP per date (0 if none). */
export function last7Days(db: Db, userId: number, today: string): { date: string; xp: number }[] {
  const dates = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const rows = db
    .prepare(
      `SELECT local_date, SUM(amount) AS xp FROM xp_events
       WHERE user_id = ? AND local_date >= ? AND local_date <= ? GROUP BY local_date`,
    )
    .all(userId, dates[0], dates[6]) as unknown as { local_date: string; xp: number }[];
  const byDate = new Map(rows.map((r) => [r.local_date, Number(r.xp)]));
  return dates.map((date) => ({ date, xp: byDate.get(date) ?? 0 }));
}

interface TotalsRow {
  xp_total: number;
  answered_total: number;
  correct_total: number;
  lessons_completed: number;
  streak_longest: number;
}

export function buildStats(db: Db, user: { id: number; timezone: string }, now: Date): StatsResponse {
  const t = (db
    .prepare(
      `SELECT xp_total, answered_total, correct_total, lessons_completed, streak_longest
       FROM user_stats WHERE user_id = ?`,
    )
    .get(user.id) as TotalsRow | undefined) ?? {
    xp_total: 0,
    answered_total: 0,
    correct_total: 0,
    lessons_completed: 0,
    streak_longest: 0,
  };

  const progress = getAllSkillProgress(db, user.id);
  return {
    xpTotal: t.xp_total,
    answered: t.answered_total,
    accuracy: t.answered_total > 0 ? t.correct_total / t.answered_total : 0,
    lessonsCompleted: t.lessons_completed,
    longestStreak: t.streak_longest,
    last7Days: last7Days(db, user.id, localDate(now, user.timezone)),
    skills: SKILLS.map((s) => {
      const p = progress.get(s.id) ?? defaultProgress(s.id);
      return {
        skillId: s.id,
        title: s.title,
        level: p.level,
        ability: p.ability,
        accuracy: p.attempts > 0 ? p.correct / p.attempts : 0,
        strength: strength(p.lastPracticedAt, p.halfLifeDays, now),
        started: p.attempts > 0,
      };
    }),
  };
}

export async function statsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/stats', async (request) => buildStats(app.db, request.user!, app.now()));
}
