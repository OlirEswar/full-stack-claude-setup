/**
 * Achievement definitions (spec "Gamification rules" → Achievements).
 *
 * Each achievement derives its progress from an `AchievementStats` snapshot
 * (built by services/achievements.ts). `progress(stats).current` is clamped to
 * `target`; an achievement is earned when current >= target.
 */
import { UNITS } from './curriculum.ts';

export interface AchievementStats {
  lessonsCompleted: number;
  perfectLessons: number;
  /** Best streak ever reached (streak_longest, or the current streak if higher). */
  bestStreak: number;
  /** Highest in-session combo ever reached. */
  maxCombo: number;
  correctTotal: number;
  xpTotal: number;
  mistakesCleared: number;
  /** Crown level per skill id; missing skills are level 0. */
  levels: ReadonlyMap<string, number>;
}

export interface AchievementProgress {
  current: number;
  target: number;
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  /** Icon name hint for the client (emoji-free identifier). */
  icon: string;
  progress(stats: AchievementStats): AchievementProgress;
}

const clamp = (current: number, target: number): AchievementProgress => ({
  current: Math.max(0, Math.min(current, target)),
  target,
});

const level = (s: AchievementStats, skillId: string): number => s.levels.get(skillId) ?? 0;

function unitSkillIds(unitId: string): string[] {
  const unit = UNITS.find((u) => u.id === unitId);
  if (!unit) throw new Error(`Unknown unit ${unitId}`);
  return unit.skills.map((sk) => sk.id);
}

/** Progress = number of the unit's skills at level >= minLevel; target = all of them. */
function unitLevel(unitId: string, minLevel: number) {
  const ids = unitSkillIds(unitId);
  return (s: AchievementStats): AchievementProgress =>
    clamp(ids.filter((id) => level(s, id) >= minLevel).length, ids.length);
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  {
    id: 'first-steps',
    title: 'First Steps',
    description: 'Complete your first lesson.',
    icon: 'footsteps',
    progress: (s) => clamp(s.lessonsCompleted, 1),
  },
  {
    id: 'streak-3',
    title: 'Warming Up',
    description: 'Reach a 3-day streak.',
    icon: 'flame',
    progress: (s) => clamp(s.bestStreak, 3),
  },
  {
    id: 'streak-7',
    title: 'Steady State',
    description: 'Reach a 7-day streak.',
    icon: 'flame',
    progress: (s) => clamp(s.bestStreak, 7),
  },
  {
    id: 'streak-30',
    title: 'Closed Loop',
    description: 'Reach a 30-day streak.',
    icon: 'flame',
    progress: (s) => clamp(s.bestStreak, 30),
  },
  {
    id: 'perfectionist',
    title: 'Perfectionist',
    description: 'Finish a lesson without a single mistake.',
    icon: 'star',
    progress: (s) => clamp(s.perfectLessons, 1),
  },
  {
    id: 'combo-10',
    title: 'Positive Feedback',
    description: 'Hit a combo of 10 correct answers in a row.',
    icon: 'bolt',
    progress: (s) => clamp(s.maxCombo, 10),
  },
  {
    id: 'sharpshooter',
    title: 'Sharpshooter',
    description: 'Answer 100 questions correctly.',
    icon: 'target',
    progress: (s) => clamp(s.correctTotal, 100),
  },
  {
    id: 'xp-500',
    title: 'Gaining Momentum',
    description: 'Earn 500 XP.',
    icon: 'trending-up',
    progress: (s) => clamp(s.xpTotal, 500),
  },
  {
    id: 'xp-2000',
    title: 'High Gain',
    description: 'Earn 2000 XP.',
    icon: 'rocket',
    progress: (s) => clamp(s.xpTotal, 2000),
  },
  {
    id: 'stable-genius',
    title: 'Stable Genius',
    description: 'Reach level 1 in both Stability skills.',
    icon: 'shield',
    progress: unitLevel('u5', 1),
  },
  {
    id: 'bode-boss',
    title: 'Bode Boss',
    description: 'Reach level 3 in Bode plots.',
    icon: 'chart',
    progress: (s) => clamp(level(s, 'bode-plots'), 3),
  },
  {
    id: 'full-state',
    title: 'Full State Feedback',
    description: 'Reach level 1 in every State Space skill.',
    icon: 'grid',
    progress: unitLevel('u11', 1),
  },
  {
    id: 'mistake-mender',
    title: 'Mistake Mender',
    description: 'Clear 10 mistakes.',
    icon: 'bandage',
    progress: (s) => clamp(s.mistakesCleared, 10),
  },
  {
    id: 'legendary',
    title: 'Legendary',
    description: 'Reach level 5 in any skill.',
    icon: 'crown',
    progress: (s) => clamp(Math.max(0, ...s.levels.values()), 5),
  },
];

export function isEarned(def: AchievementDef, stats: AchievementStats): boolean {
  const p = def.progress(stats);
  return p.current >= p.target;
}
