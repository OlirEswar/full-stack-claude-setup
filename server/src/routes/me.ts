import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/index.ts';
import type { AuthUser } from '../auth/plugin.ts';

export const MAX_HEARTS = 5;
export const HEART_REGEN_MS = 30 * 60 * 1000;
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

/** YYYY-MM-DD for `now` in time zone `tz`. */
export function localDate(now: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    now,
  );
}

function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

interface StatsRow {
  xp_total: number;
  hearts: number;
  hearts_updated_at: string | null;
  streak_current: number;
  streak_longest: number;
  streak_last_date: string | null;
  streak_freezes: number;
}

export function buildMeResponse(db: Db, user: AuthUser, now: Date) {
  const s = (db
    .prepare(
      `SELECT xp_total, hearts, hearts_updated_at, streak_current, streak_longest, streak_last_date, streak_freezes
       FROM user_stats WHERE user_id = ?`,
    )
    .get(user.id) as StatsRow | undefined) ?? {
    xp_total: 0,
    hearts: MAX_HEARTS,
    hearts_updated_at: null,
    streak_current: 0,
    streak_longest: 0,
    streak_last_date: null,
    streak_freezes: 0,
  };

  const today = localDate(now, user.timezone);
  const xpRow = db
    .prepare('SELECT COALESCE(SUM(amount), 0) AS xp FROM xp_events WHERE user_id = ? AND local_date = ?')
    .get(user.id, today) as { xp: number };
  const xpToday = Number(xpRow.xp);

  // Lazy heart regeneration (read-only view).
  let hearts = Math.min(s.hearts, MAX_HEARTS);
  let nextHeartAt: string | null = null;
  if (hearts < MAX_HEARTS && s.hearts_updated_at) {
    const since = Date.parse(s.hearts_updated_at);
    const elapsed = Math.max(0, now.getTime() - since);
    const regen = Math.floor(elapsed / HEART_REGEN_MS);
    hearts = Math.min(MAX_HEARTS, hearts + regen);
    if (hearts < MAX_HEARTS) nextHeartAt = new Date(since + (regen + 1) * HEART_REGEN_MS).toISOString();
  }

  // Displayed streak is 0 if the gap since the last counted day can't be covered by freezes.
  let streak = s.streak_current;
  if (s.streak_last_date) {
    const missed = dayDiff(s.streak_last_date, today) - 1;
    if (missed > s.streak_freezes) streak = 0;
  }

  const daily = db
    .prepare('SELECT completed_at FROM daily_challenges WHERE user_id = ? AND local_date = ?')
    .get(user.id, today) as { completed_at: string | null } | undefined;

  return {
    user: { id: user.id, username: user.username, timezone: user.timezone, dailyXpGoal: user.dailyXpGoal },
    stats: {
      xpTotal: s.xp_total,
      xpToday,
      dailyXpGoal: user.dailyXpGoal,
      dailyGoalMet: xpToday >= user.dailyXpGoal,
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
