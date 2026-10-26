/**
 * Daily challenge (spec "Core user flows" 4, API GET /api/daily and
 * POST /api/daily/start): 5 questions from due + weak skills, no hearts, one
 * per calendar day in the user's time zone. Completing it (through the usual
 * POST /api/sessions/:id/complete) counts the streak via `dailyStreakHook`.
 *
 * `daily_challenges(user_id, local_date)` links each local day to its session;
 * `completed_at` is set by the completion hook.
 */
import type { Db } from '../db/index.ts';
import { DAILY_SIZE, selectDaily } from '../engine/select.ts';
import type { CompletionHook } from './complete.ts';
import { getAllSkillProgress } from './progress.ts';
import {
  createSession,
  getSessionState,
  recentStaticIds,
  SessionError,
  type SessionDeps,
  type SessionUser,
  type StartResult,
} from './sessions.ts';
import { applyStreak, type StreakState } from './streak.ts';
import { localDate } from './xp.ts';

export type DailyStatus = 'not_started' | 'in_progress' | 'completed';

export interface DailyView {
  date: string;
  status: DailyStatus;
  sessionId: number | null;
  questionCount: number;
}

interface DailyRow {
  session_id: number;
  completed_at: string | null;
}

function dailyRow(db: Db, userId: number, date: string): DailyRow | undefined {
  return db
    .prepare('SELECT session_id, completed_at FROM daily_challenges WHERE user_id = ? AND local_date = ?')
    .get(userId, date) as DailyRow | undefined;
}

/** GET /api/daily: today's (local) challenge status. */
export function getDaily(db: Db, user: SessionUser, now: Date): DailyView {
  const date = localDate(now, user.timezone);
  const row = dailyRow(db, user.id, date);
  return {
    date,
    status: !row ? 'not_started' : row.completed_at ? 'completed' : 'in_progress',
    sessionId: row?.session_id ?? null,
    questionCount: DAILY_SIZE,
  };
}

/** Same shape as POST /api/sessions; `question` is null if every item is already answered. */
export type DailyStartResult = Omit<StartResult, 'question'> & { question: StartResult['question'] | null };

/**
 * POST /api/daily/start: resumes today's in-progress challenge, or creates a
 * new one. Throws SessionError 409 if today's challenge is already completed, 503 if
 * there is no content to draw from.
 */
export function startDaily(deps: SessionDeps, user: SessionUser): DailyStartResult {
  const { db, registry, now, rng } = deps;
  const date = localDate(now, user.timezone);
  const existing = dailyRow(db, user.id, date);
  if (existing?.completed_at) throw new SessionError(409, "Today's daily challenge is already completed");
  if (existing) {
    const { session, question } = getSessionState(deps, user.id, existing.session_id);
    return { session, question };
  }

  const selections = selectDaily({
    registry,
    progress: getAllSkillProgress(db, user.id),
    recentStaticIds: recentStaticIds(db, user.id, now),
    rng,
    now,
  });
  if (selections.length === 0) throw new SessionError(503, 'No content available for a daily challenge yet');

  const sessionId = createSession(deps, user, 'daily', null, selections);
  db.prepare('INSERT INTO daily_challenges (user_id, local_date, session_id) VALUES (?, ?, ?)').run(
    user.id,
    date,
    sessionId,
  );
  const { session, question } = getSessionState(deps, user.id, sessionId);
  return { session, question };
}

interface StreakRow {
  streak_current: number;
  streak_longest: number;
  streak_last_date: string | null;
  streak_freezes: number;
}

/**
 * Completion hook for `daily` sessions: marks the challenge completed and
 * counts the streak for the challenge's local date. Sets `summary.streak`
 * and `summary.streakExtended`.
 */
export const dailyStreakHook: CompletionHook = (ctx, summary) => {
  const { db, session, user, now, failed } = ctx;
  if (failed || session.kind !== 'daily') return;

  const challenge = db.prepare('SELECT local_date FROM daily_challenges WHERE session_id = ?').get(session.id) as
    | { local_date: string }
    | undefined;
  db.prepare('UPDATE daily_challenges SET completed_at = ? WHERE session_id = ? AND completed_at IS NULL').run(
    now.toISOString(),
    session.id,
  );
  const date = challenge?.local_date ?? ctx.localDate;

  const row = db
    .prepare('SELECT streak_current, streak_longest, streak_last_date, streak_freezes FROM user_stats WHERE user_id = ?')
    .get(user.id) as StreakRow | undefined;
  if (!row) return; // completeSession ensures the stats row exists before hooks run
  const before: StreakState = {
    current: row.streak_current,
    longest: row.streak_longest,
    lastDate: row.streak_last_date,
    freezes: row.streak_freezes,
  };
  const { state, extended } = applyStreak(before, date);
  db.prepare(
    `UPDATE user_stats SET streak_current = ?, streak_longest = ?, streak_last_date = ?, streak_freezes = ?
     WHERE user_id = ?`,
  ).run(state.current, state.longest, state.lastDate, state.freezes, user.id);

  summary.streak = state.current;
  summary.streakExtended = extended;
};
