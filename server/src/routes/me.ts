import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/index.ts';
import type { AuthUser } from '../auth/plugin.ts';
import { getHearts, MAX_HEARTS } from '../services/hearts.ts';
import { displayStreak } from '../services/streak.ts';
import { isDailyGoalMet, localDate, xpForDate } from '../services/xp.ts';

export { HEART_REGEN_MS, MAX_HEARTS } from '../services/hearts.ts';
export const DAILY_XP_GOALS = [10, 20, 30, 50] as const;

/** Returns the canonical IANA name if `tz` is a valid time zone, else null. */
export function normalizeTimeZone(tz: unknown): string | null {
  if (typeof tz !== 'string' || tz.length === 0 || tz.length > 64) return null;
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: tz }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}


interface StatsRow {
  xp_total: number;
  streak_current: number;
  streak_longest: number;
  streak_last_date: string | null;
  streak_freezes: number;
}

export function buildMeResponse(db: Db, user: AuthUser, now: Date) {
  const s = (db
    .prepare(
      `SELECT xp_total, streak_current, streak_longest, streak_last_date, streak_freezes
       FROM user_stats WHERE user_id = ?`,
    )
    .get(user.id) as StatsRow | undefined) ?? {
    xp_total: 0,
    streak_current: 0,
    streak_longest: 0,
    streak_last_date: null,
    streak_freezes: 0,
  };

  const today = localDate(now, user.timezone);
  const xpToday = xpForDate(db, user.id, today);

  const { hearts, nextHeartAt } = getHearts(db, user.id, now);

  const streak = displayStreak(
    { current: s.streak_current, lastDate: s.streak_last_date, freezes: s.streak_freezes },
    today,
  );

  const daily = db
    .prepare('SELECT completed_at FROM daily_challenges WHERE user_id = ? AND local_date = ?')
    .get(user.id, today) as { completed_at: string | null } | undefined;

  return {
    user: { id: user.id, username: user.username, timezone: user.timezone, dailyXpGoal: user.dailyXpGoal },
    stats: {
      xpTotal: s.xp_total,
      xpToday,
      dailyXpGoal: user.dailyXpGoal,
      dailyGoalMet: isDailyGoalMet(xpToday, user.dailyXpGoal),
      streak,
      longestStreak: s.streak_longest,
      streakFreezes: s.streak_freezes,
      hearts,
      maxHearts: MAX_HEARTS,
      nextHeartAt,
      dailyChallengeDone: Boolean(daily?.completed_at),
    },
  };
}

export async function meRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/me', async (request) => buildMeResponse(app.db, request.user!, app.now()));

  app.patch('/api/me', async (request, reply) => {
    const body = request.body;
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return reply.code(400).send({ error: 'Body must be a JSON object' });
    }
    const { timezone, dailyXpGoal } = body as Record<string, unknown>;
    const user = { ...request.user! };

    if (timezone !== undefined) {
      const tz = normalizeTimeZone(timezone);
      if (!tz) return reply.code(400).send({ error: 'Invalid timezone' });
      user.timezone = tz;
    }
    if (dailyXpGoal !== undefined) {
      if (typeof dailyXpGoal !== 'number' || !(DAILY_XP_GOALS as readonly number[]).includes(dailyXpGoal)) {
        return reply.code(400).send({ error: `dailyXpGoal must be one of ${DAILY_XP_GOALS.join(', ')}` });
      }
      user.dailyXpGoal = dailyXpGoal;
    }

    app.db
      .prepare('UPDATE users SET timezone = ?, daily_xp_goal = ? WHERE id = ?')
      .run(user.timezone, user.dailyXpGoal, user.id);
    request.user = user;
    return buildMeResponse(app.db, user, app.now());
  });
}
