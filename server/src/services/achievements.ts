/**
 * Achievements: builds the stats snapshot the definitions in
 * content/achievements.ts read, unlocks newly earned ones into
 * `user_achievements` (once per user), and serves GET /api/achievements.
 */
import type { Db } from '../db/index.ts';
import { ACHIEVEMENTS, isEarned, type AchievementProgress, type AchievementStats } from '../content/achievements.ts';
import type { CompletionHook } from './complete.ts';

export interface AchievementView {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt: string | null;
  progress: AchievementProgress;
}

export interface UnlockedAchievement {
  id: string;
  title: string;
}

export interface StatsOverrides {
  /** Perfect lessons not yet persisted as completed (e.g. the one being completed right now). */
  extraPerfectLessons?: number;
}

interface TotalsRow {
  xp_total: number;
  correct_total: number;
  lessons_completed: number;
  mistakes_cleared: number;
  streak_current: number;
  streak_longest: number;
}

/** Snapshot of everything the achievement definitions look at. */
export function achievementStats(db: Db, userId: number, overrides: StatsOverrides = {}): AchievementStats {
  const t = (db
    .prepare(
      `SELECT xp_total, correct_total, lessons_completed, mistakes_cleared, streak_current, streak_longest
       FROM user_stats WHERE user_id = ?`,
    )
    .get(userId) as TotalsRow | undefined) ?? {
    xp_total: 0,
    correct_total: 0,
    lessons_completed: 0,
    mistakes_cleared: 0,
    streak_current: 0,
    streak_longest: 0,
  };

  const combo = db.prepare("SELECT COALESCE(MAX(max_combo), 0) AS m FROM sessions WHERE user_id = ? AND status = 'completed'").get(userId) as {
    m: number;
  };

  // Completed lessons in which every item was answered correctly.
  const perfect = db
    .prepare(
      `SELECT COUNT(*) AS n FROM sessions s
       WHERE s.user_id = ? AND s.kind = 'lesson' AND s.status = 'completed'
         AND (SELECT COUNT(*) FROM session_items i WHERE i.session_id = s.id AND i.correct = 1) = s.total`,
    )
    .get(userId) as { n: number };

  const levelRows = db.prepare('SELECT skill_id, level FROM skill_progress WHERE user_id = ?').all(userId) as unknown as {
    skill_id: string;
    level: number;
  }[];

  return {
    lessonsCompleted: t.lessons_completed,
    perfectLessons: Number(perfect.n) + (overrides.extraPerfectLessons ?? 0),
    bestStreak: Math.max(t.streak_longest, t.streak_current),
    maxCombo: Number(combo.m),
    correctTotal: t.correct_total,
    xpTotal: t.xp_total,
    mistakesCleared: t.mistakes_cleared,
    levels: new Map(levelRows.map((r) => [r.skill_id, r.level])),
  };
}

function unlockedMap(db: Db, userId: number): Map<string, string> {
  const rows = db
    .prepare('SELECT achievement_id, unlocked_at FROM user_achievements WHERE user_id = ?')
    .all(userId) as unknown as { achievement_id: string; unlocked_at: string }[];
  return new Map(rows.map((r) => [r.achievement_id, r.unlocked_at]));
}

/**
 * Unlock every achievement the user has newly earned and return those, in
 * definition order. Already-unlocked achievements are never returned again.
 */
export function evaluate(db: Db, userId: number, now: Date, overrides: StatsOverrides = {}): UnlockedAchievement[] {
  const stats = achievementStats(db, userId, overrides);
  const have = unlockedMap(db, userId);
  const insert = db.prepare(
    'INSERT OR IGNORE INTO user_achievements (user_id, achievement_id, unlocked_at) VALUES (?, ?, ?)',
  );
  const out: UnlockedAchievement[] = [];
  for (const def of ACHIEVEMENTS) {
    if (have.has(def.id) || !isEarned(def, stats)) continue;
    const res = insert.run(userId, def.id, now.toISOString());
    if (Number(res.changes) > 0) out.push({ id: def.id, title: def.title });
  }
  return out;
}

/** GET /api/achievements payload: all definitions with unlock state and progress. */
export function listAchievements(db: Db, userId: number): { achievements: AchievementView[] } {
  const stats = achievementStats(db, userId);
  const have = unlockedMap(db, userId);
  return {
    achievements: ACHIEVEMENTS.map((def) => {
      const unlockedAt = have.get(def.id) ?? null;
      const progress = def.progress(stats);
      return {
        id: def.id,
        title: def.title,
        description: def.description,
        icon: def.icon,
        unlocked: unlockedAt !== null,
        unlockedAt,
        // An unlocked achievement always shows as complete.
        progress: unlockedAt !== null ? { current: progress.target, target: progress.target } : progress,
      };
    }),
  };
}

/** Completion hook (runs last): unlocks earned achievements and reports them in the summary. */
export const achievementsHook: CompletionHook = (ctx, summary) => {
  const extraPerfectLessons = !ctx.failed && ctx.session.kind === 'lesson' && summary.perfect ? 1 : 0;
  summary.newAchievements = evaluate(ctx.db, ctx.user.id, ctx.now, { extraPerfectLessons });
};
