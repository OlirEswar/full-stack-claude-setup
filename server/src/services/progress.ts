/**
 * Per-(user, skill) progress: reading/writing `skill_progress`, unlock state,
 * and the derived due/strength values used by GET /api/path.
 * Unlock/due/strength rules live in the engine; this module only adapts rows.
 */
import type { Db } from '../db/index.ts';
import { UNITS } from '../content/curriculum.ts';
import { isSkillUnlocked } from '../engine/select.ts';
import { DEFAULT_HALF_LIFE_DAYS, isDue, strength } from '../engine/spaced.ts';

export const MAX_LEVEL = 5;
export const LESSONS_PER_LEVEL = 3;

export interface SkillProgress {
  skillId: string;
  ability: number;
  attempts: number;
  correct: number;
  level: number;
  lessonsInLevel: number;
  halfLifeDays: number;
  /** ISO timestamp or null if never practiced. */
  lastPracticedAt: string | null;
  /** ISO timestamp or null if never scheduled. */
  nextDueAt: string | null;
}

interface ProgressRow {
  skill_id: string;
  ability: number;
  attempts: number;
  correct: number;
  level: number;
  lessons_in_level: number;
  half_life_days: number;
  last_practiced_at: string | null;
  next_due_at: string | null;
}

const COLUMNS =
  'skill_id, ability, attempts, correct, level, lessons_in_level, half_life_days, last_practiced_at, next_due_at';

function fromRow(r: ProgressRow): SkillProgress {
  return {
    skillId: r.skill_id,
    ability: r.ability,
    attempts: r.attempts,
    correct: r.correct,
    level: r.level,
    lessonsInLevel: r.lessons_in_level,
    halfLifeDays: r.half_life_days,
    lastPracticedAt: r.last_practiced_at,
    nextDueAt: r.next_due_at,
  };
}

/** Progress for a skill the user has never touched. */
export function defaultProgress(skillId: string): SkillProgress {
  return {
    skillId,
    ability: 0,
    attempts: 0,
    correct: 0,
    level: 0,
    lessonsInLevel: 0,
    halfLifeDays: DEFAULT_HALF_LIFE_DAYS,
    lastPracticedAt: null,
    nextDueAt: null,
  };
}

/** One skill's progress; defaults if no row exists. */
export function getSkillProgress(db: Db, userId: number, skillId: string): SkillProgress {
  const row = db
    .prepare(`SELECT ${COLUMNS} FROM skill_progress WHERE user_id = ? AND skill_id = ?`)
    .get(userId, skillId) as ProgressRow | undefined;
  return row ? fromRow(row) : defaultProgress(skillId);
}

/** All stored progress rows for a user, keyed by skill id (missing skills are unstarted). */
export function getAllSkillProgress(db: Db, userId: number): Map<string, SkillProgress> {
  const rows = db.prepare(`SELECT ${COLUMNS} FROM skill_progress WHERE user_id = ?`).all(userId) as unknown as ProgressRow[];
  return new Map(rows.map((r) => [r.skill_id, fromRow(r)]));
}

export type SkillProgressPatch = Partial<Omit<SkillProgress, 'skillId'>>;

/**
 * Merge `patch` into the user's progress for `skillId` (creating the row if
 * needed) and return the stored result.
 */
export function upsertSkillProgress(db: Db, userId: number, skillId: string, patch: SkillProgressPatch): SkillProgress {
  const next: SkillProgress = { ...getSkillProgress(db, userId, skillId), ...patch, skillId };
  db.prepare(
    `INSERT INTO skill_progress (user_id, ${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, skill_id) DO UPDATE SET
       ability = excluded.ability, attempts = excluded.attempts, correct = excluded.correct,
       level = excluded.level, lessons_in_level = excluded.lessons_in_level,
       half_life_days = excluded.half_life_days, last_practiced_at = excluded.last_practiced_at,
       next_due_at = excluded.next_due_at`,
  ).run(
    userId,
    skillId,
    next.ability,
    next.attempts,
    next.correct,
    next.level,
    next.lessonsInLevel,
    next.halfLifeDays,
    next.lastPracticedAt,
    next.nextDueAt,
  );
  return next;
}

/** Skill i is unlocked if i = 0 or skill i−1 has level ≥ 1. */
export function isUnlocked(progress: ReadonlyMap<string, SkillProgress>, skillId: string): boolean {
  return isSkillUnlocked(progress, skillId);
}

/** Convenience: unlock check straight from the DB. */
export function isSkillUnlockedForUser(db: Db, userId: number, skillId: string): boolean {
  return isUnlocked(getAllSkillProgress(db, userId), skillId);
}

export interface PathSkill {
  id: string;
  title: string;
  level: number;
  maxLevel: number;
  lessonsInLevel: number;
  lessonsPerLevel: number;
  unlocked: boolean;
  started: boolean;
  due: boolean;
  strength: number;
}

export interface PathUnit {
  id: string;
  title: string;
  description: string;
  skills: PathSkill[];
}

export function pathSkill(
  progress: ReadonlyMap<string, SkillProgress>,
  skill: { id: string; title: string },
  now: Date,
): PathSkill {
  const p = progress.get(skill.id) ?? defaultProgress(skill.id);
  return {
    id: skill.id,
    title: skill.title,
    level: p.level,
    maxLevel: MAX_LEVEL,
    lessonsInLevel: p.lessonsInLevel,
    lessonsPerLevel: LESSONS_PER_LEVEL,
    unlocked: isUnlocked(progress, skill.id),
    started: p.attempts > 0,
    due: isDue(p, now),
    strength: strength(p.lastPracticedAt, p.halfLifeDays, now),
  };
}

/** The GET /api/path payload: every unit, skills in curriculum order. */
export function buildPath(db: Db, userId: number, now: Date): { units: PathUnit[] } {
  const progress = getAllSkillProgress(db, userId);
  return {
    units: UNITS.map((u) => ({
      id: u.id,
      title: u.title,
      description: u.description,
      skills: u.skills.map((s) => pathSkill(progress, s, now)),
    })),
  };
}
