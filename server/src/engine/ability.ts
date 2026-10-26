/**
 * Ability model (spec "Adaptive engine"): a per-(user, skill) Elo/IRT-style
 * rating θ. Item difficulty d ∈ 1..5 maps to b = d − 3.
 */
import type { Difficulty } from '../content/types.ts';

export const ABILITY_MIN = -4;
export const ABILITY_MAX = 4;
export const TARGET_SUCCESS = 0.75;
export const K_MIN = 0.3;
export const ALL_DIFFICULTIES: readonly Difficulty[] = [1, 2, 3, 4, 5];

/** b = d − 3. */
export function difficultyToB(d: number): number {
  return d - 3;
}

export function clampAbility(theta: number): number {
  if (Number.isNaN(theta)) return 0;
  return Math.min(ABILITY_MAX, Math.max(ABILITY_MIN, theta));
}

/** P = 1 / (1 + e^(−(θ − b))). */
export function expectedSuccess(theta: number, d: number): number {
  return 1 / (1 + Math.exp(-(theta - difficultyToB(d))));
}

/** K = max(0.3, 1.2 / (1 + n/10)), n = prior attempts on the skill. */
export function kFactor(priorAttempts: number): number {
  return Math.max(K_MIN, 1.2 / (1 + Math.max(0, priorAttempts) / 10));
}

/** θ' = clamp(θ + K·(o − P)). */
export function updateAbility(theta: number, correct: boolean, d: number, priorAttempts: number): number {
  const p = expectedSuccess(theta, d);
  const o = correct ? 1 : 0;
  return clampAbility(theta + kFactor(priorAttempts) * (o - p));
}

/**
 * The available difficulty whose expected success is closest to 0.75
 * (ties go to the lower d). Throws if `available` is empty.
 */
export function pickDifficulty(theta: number, available: readonly number[] = ALL_DIFFICULTIES): Difficulty {
  if (available.length === 0) throw new Error('pickDifficulty: no difficulties available');
  const sorted = [...new Set(available)].sort((a, b) => a - b);
  let best = sorted[0] as number;
  let bestDist = Infinity;
  for (const d of sorted) {
    const dist = Math.abs(expectedSuccess(theta, d) - TARGET_SUCCESS);
    // Strict < keeps the lower d on ties (with a tiny epsilon for float noise).
    if (dist < bestDist - 1e-12) {
      best = d;
      bestDist = dist;
    }
  }
  return best as Difficulty;
}
