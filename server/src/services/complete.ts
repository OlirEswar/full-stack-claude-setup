/**
 * Session completion (POST /api/sessions/:id/complete): XP with breakdown,
 * crowns/levels, spaced-repetition scheduling and daily-goal progress.
 *
 * Extension points for later tasks:
 *  - `XP_RULES`: per-kind base/perfect XP (lesson, practice, mistakes, daily).
 *  - `COMPLETION_HOOKS`: ordered post-completion hooks that run inside the
 *    completion transaction, after XP has been booked. Each receives the
 *    completion context and may mutate the summary (e.g. a daily-challenge
 *    streak hook sets `streak`/`streakExtended`, a practice hook refills a
 *    heart, an achievements hook fills `newAchievements`). Hooks decide for
 *    themselves whether they apply (kind, failed, ...).
 *
 * Completion is idempotent: the summary is stored on the session row and a
 * repeated call returns it unchanged without awarding anything again.
 * A failed lesson can be "completed" too: it yields a 0-XP summary and leaves
 * levels and scheduling untouched (its status stays 'failed').
 */
import type { Db } from '../db/index.ts';
import { scheduleAfterSession } from '../engine/spaced.ts';
import { getSkillProgress, LESSONS_PER_LEVEL, MAX_LEVEL, upsertSkillProgress } from './progress.ts';
import { comboBonusFor, loadOwnedSession, SessionError, tx, type SessionKind, type SessionRow } from './sessions.ts';
import { dailyStreakHook } from './daily.ts';
import { heartRefillHook } from './hearts.ts';
import { displayStreak } from './streak.ts';
import { awardXp, ensureUserStats, isDailyGoalMet, localDate, xpForDate } from './xp.ts';

/** Moved to services/streak.ts; re-exported for existing importers. */
export { displayedStreak } from './streak.ts';

export interface XpRule {
  base: number;
  baseLabel: string;
  perfectBonus: number;
  perfectLabel: string;
}

/** XP per session kind (spec "Gamification rules" → XP). */
export const XP_RULES: Record<SessionKind, XpRule> = {
  lesson: { base: 10, baseLabel: 'Lesson complete', perfectBonus: 5, perfectLabel: 'Perfect lesson' },
  practice: { base: 10, baseLabel: 'Practice complete', perfectBonus: 5, perfectLabel: 'Perfect practice' },
  mistakes: { base: 10, baseLabel: 'Mistakes reviewed', perfectBonus: 5, perfectLabel: 'Perfect review' },
  daily: { base: 15, baseLabel: 'Daily challenge', perfectBonus: 5, perfectLabel: 'Perfect challenge' },
};
export const COMBO_BONUS_LABEL = 'Combo bonus';

export interface XpBreakdownEntry {
  label: string;
  amount: number;
}

export interface CompletionSummary {
  xpEarned: number;
  xpBreakdown: XpBreakdownEntry[];
  correct: number;
  total: number;
  accuracy: number;
  maxCombo: number;
  perfect: boolean;
  streak: number;
  streakExtended: boolean;
  dailyGoalMet: boolean;
  xpToday: number;
  levelUp: { skillId: string; level: number } | null;
  newAchievements: { id: string; title: string }[];
}

export interface CompletionUser {
  id: number;
  timezone: string;
  dailyXpGoal: number;
}

export interface CompletedItem {
  position: number;
  skillId: string;
  correct: boolean;
}

export interface CompletionContext {
  db: Db;
  now: Date;
  user: CompletionUser;
  session: SessionRow;
  /** Answered items in position order. */
  items: CompletedItem[];
  /** True for a failed lesson: no XP, no level progress, no scheduling. */
  failed: boolean;
  /** The user's local date at completion time. */
  localDate: string;
}

export type CompletionHook = (ctx: CompletionContext, summary: CompletionSummary) => void;

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** Replay answers in order: max combo and total combo-bonus XP (+2 at each multiple of 5). */
export function replayCombo(correctInOrder: readonly boolean[]): { maxCombo: number; comboBonus: number } {
  let combo = 0;
  let maxCombo = 0;
  let comboBonus = 0;
  for (const ok of correctInOrder) {
    combo = ok ? combo + 1 : 0;
    maxCombo = Math.max(maxCombo, combo);
    if (ok) comboBonus += comboBonusFor(combo);
  }
  return { maxCombo, comboBonus };
}

/** XP breakdown for a session; empty for a failed one. */
export function computeXp(
  kind: SessionKind,
  opts: { failed: boolean; perfect: boolean; comboBonus: number },
): XpBreakdownEntry[] {
  if (opts.failed) return [];
  const rule = XP_RULES[kind];
  const out: XpBreakdownEntry[] = [{ label: rule.baseLabel, amount: rule.base }];
  if (opts.perfect && rule.perfectBonus > 0) out.push({ label: rule.perfectLabel, amount: rule.perfectBonus });
  if (opts.comboBonus > 0) out.push({ label: COMBO_BONUS_LABEL, amount: opts.comboBonus });
  return out;
}

/** Advance crown progress by one completed lesson. Level caps at MAX_LEVEL. */
export function advanceLevel(level: number, lessonsInLevel: number): { level: number; lessonsInLevel: number } {
  if (level >= MAX_LEVEL) return { level: MAX_LEVEL, lessonsInLevel: 0 };
  const n = lessonsInLevel + 1;
  if (n >= LESSONS_PER_LEVEL) return { level: level + 1, lessonsInLevel: 0 };
  return { level, lessonsInLevel: n };
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** Lessons: count the lesson and advance the skill's crown level. */
export const lessonProgressHook: CompletionHook = (ctx, summary) => {
  const { db, session, user, failed } = ctx;
  if (failed || session.kind !== 'lesson' || !session.skill_id) return;
  db.prepare('UPDATE user_stats SET lessons_completed = lessons_completed + 1 WHERE user_id = ?').run(user.id);
  const p = getSkillProgress(db, user.id, session.skill_id);
  const next = advanceLevel(p.level, p.lessonsInLevel);
  upsertSkillProgress(db, user.id, session.skill_id, next);
  if (next.level > p.level) summary.levelUp = { skillId: session.skill_id, level: next.level };
};

/** Spaced repetition: reschedule every skill practiced in the session by its accuracy there. */
export const spacedRepetitionHook: CompletionHook = (ctx) => {
  const { db, user, items, failed, now } = ctx;
  if (failed) return;
  const bySkill = new Map<string, { answered: number; correct: number }>();
  for (const it of items) {
    const s = bySkill.get(it.skillId) ?? { answered: 0, correct: 0 };
    s.answered += 1;
    if (it.correct) s.correct += 1;
    bySkill.set(it.skillId, s);
  }
  for (const [skillId, s] of bySkill) {
    const p = getSkillProgress(db, user.id, skillId);
    const sched = scheduleAfterSession(p.halfLifeDays, s.correct / s.answered, now);
    upsertSkillProgress(db, user.id, skillId, {
      halfLifeDays: sched.halfLifeDays,
      lastPracticedAt: sched.lastPracticedAt.toISOString(),
      nextDueAt: sched.nextDueAt.toISOString(),
    });
  }
};

/** Placeholder for achievements evaluation (task 15): fills `summary.newAchievements`. */
export const achievementsHook: CompletionHook = () => {};

/**
 * Ordered post-completion hooks. Later tasks insert theirs here (heart refill
 * for 'practice'/'mistakes'); achievements stay last so they see the final state.
 */
export const COMPLETION_HOOKS: CompletionHook[] = [
  lessonProgressHook,
  spacedRepetitionHook,
  dailyStreakHook,
  heartRefillHook,
  achievementsHook,
];

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export interface CompleteDeps {
  db: Db;
  now: Date;
  hooks?: readonly CompletionHook[];
}

/** POST /api/sessions/:id/complete. Throws SessionError for 404/409. */
export function completeSession(deps: CompleteDeps, user: CompletionUser, sessionId: number): CompletionSummary {
  const { db, now } = deps;
  const hooks = deps.hooks ?? COMPLETION_HOOKS;

  return tx(db, () => {
    const session = loadOwnedSession(db, user.id, sessionId);
    const stored = db.prepare('SELECT summary FROM sessions WHERE id = ?').get(session.id) as { summary: string | null };
    if (stored.summary) return JSON.parse(stored.summary) as CompletionSummary;
    if (session.status === 'completed') throw new SessionError(409, 'Session already completed');

    const rows = db
      .prepare(
        'SELECT position, skill_id, correct, answered_at FROM session_items WHERE session_id = ? ORDER BY position',
      )
      .all(session.id) as { position: number; skill_id: string; correct: number | null; answered_at: string | null }[];
    const failed = session.status === 'failed';
    if (!failed && rows.some((r) => r.answered_at === null)) {
      throw new SessionError(409, 'Answer all questions before completing the session');
    }

    const items: CompletedItem[] = rows
      .filter((r) => r.answered_at !== null)
      .map((r) => ({ position: r.position, skillId: r.skill_id, correct: r.correct === 1 }));
    const correct = items.filter((i) => i.correct).length;
    const perfect = !failed && items.length === session.total && correct === session.total;
    const { maxCombo, comboBonus } = replayCombo(items.map((i) => i.correct));

    const xpBreakdown = computeXp(session.kind, { failed, perfect, comboBonus });
    const xpEarned = xpBreakdown.reduce((sum, e) => sum + e.amount, 0);

    ensureUserStats(db, user.id, now);
    const date = awardXp(db, {
      userId: user.id,
      amount: xpEarned,
      source: session.kind,
      sessionId: session.id,
      now,
      timezone: user.timezone,
    });

    const streakRow = db
      .prepare('SELECT streak_current, streak_last_date, streak_freezes FROM user_stats WHERE user_id = ?')
      .get(user.id) as { streak_current: number; streak_last_date: string | null; streak_freezes: number };

    const summary: CompletionSummary = {
      xpEarned,
      xpBreakdown,
      correct,
      total: session.total,
      accuracy: items.length > 0 ? correct / items.length : 0,
      maxCombo,
      perfect,
      streak: displayStreak(
        { current: streakRow.streak_current, lastDate: streakRow.streak_last_date, freezes: streakRow.streak_freezes },
        date,
      ),
      streakExtended: false,
      dailyGoalMet: false,
      xpToday: 0,
      levelUp: null,
      newAchievements: [],
    };

    const ctx: CompletionContext = { db, now, user, session, items, failed, localDate: date };
    for (const hook of hooks) hook(ctx, summary);

    // Hooks may award XP too (e.g. bonuses), so read today's total last.
    summary.xpToday = xpForDate(db, user.id, localDate(now, user.timezone));
    summary.dailyGoalMet = isDailyGoalMet(summary.xpToday, user.dailyXpGoal);

    db.prepare(
      `UPDATE sessions SET status = ?, xp_earned = ?, completed_at = ?, summary = ? WHERE id = ?`,
    ).run(failed ? 'failed' : 'completed', summary.xpEarned, now.toISOString(), JSON.stringify(summary), session.id);

    return summary;
  });
}
