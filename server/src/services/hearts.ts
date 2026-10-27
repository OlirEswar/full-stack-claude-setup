/**
 * Hearts (spec "Gamification rules"): max 5, −1 per wrong answer in a lesson,
 * +1 regenerated every 30 minutes, computed lazily from
 * `user_stats.hearts_updated_at`.
 *
 * `hearts_updated_at` is the regen anchor: the instant from which the next
 * heart is counted. It only matters while hearts < MAX_HEARTS. Materializing
 * regen (`syncHearts`) advances the anchor by whole regen periods so partial
 * progress towards the next heart is never lost.
 */
import type { Db } from '../db/index.ts';
import type { CompletionHook } from './complete.ts';

export const MAX_HEARTS = 5;
export const HEART_REGEN_MS = 30 * 60 * 1000;

export interface HeartState {
  hearts: number;
  /** ISO time the next heart arrives, or null when full. */
  nextHeartAt: string | null;
}

interface HeartRow {
  hearts: number;
  hearts_updated_at: string | null;
}

/**
 * Pure lazy-regen computation. Returns the effective hearts, when the next one
 * arrives, and the anchor to store if the result is materialized.
 */
export function computeHearts(
  stored: number,
  updatedAt: string | null,
  now: Date,
): HeartState & { anchor: string } {
  const nowIso = now.toISOString();
  let hearts = Math.max(0, Math.min(stored, MAX_HEARTS));
  if (hearts >= MAX_HEARTS) return { hearts, nextHeartAt: null, anchor: nowIso };
  const since = updatedAt ? Date.parse(updatedAt) : NaN;
  if (Number.isNaN(since)) {
    // No anchor yet: start the regen clock now.
    return { hearts, nextHeartAt: new Date(now.getTime() + HEART_REGEN_MS).toISOString(), anchor: nowIso };
  }
  const elapsed = Math.max(0, now.getTime() - since);
  const regen = Math.floor(elapsed / HEART_REGEN_MS);
  hearts = Math.min(MAX_HEARTS, hearts + regen);
  if (hearts >= MAX_HEARTS) return { hearts, nextHeartAt: null, anchor: nowIso };
  const anchorMs = since + regen * HEART_REGEN_MS;
  return {
    hearts,
    nextHeartAt: new Date(anchorMs + HEART_REGEN_MS).toISOString(),
    anchor: new Date(anchorMs).toISOString(),
  };
}

function readRow(db: Db, userId: number): HeartRow {
  const row = db.prepare('SELECT hearts, hearts_updated_at FROM user_stats WHERE user_id = ?').get(userId) as
    | HeartRow
    | undefined;
  return row ?? { hearts: MAX_HEARTS, hearts_updated_at: null };
}

function ensureRow(db: Db, userId: number, now: Date): void {
  db.prepare('INSERT OR IGNORE INTO user_stats (user_id, hearts, hearts_updated_at) VALUES (?, ?, ?)').run(
    userId,
    MAX_HEARTS,
    now.toISOString(),
  );
}

function write(db: Db, userId: number, hearts: number, anchor: string): void {
  db.prepare('UPDATE user_stats SET hearts = ?, hearts_updated_at = ? WHERE user_id = ?').run(hearts, anchor, userId);
}

/** Effective hearts right now (read-only). */
export function getHearts(db: Db, userId: number, now: Date): HeartState {
  const row = readRow(db, userId);
  const { hearts, nextHeartAt } = computeHearts(row.hearts, row.hearts_updated_at, now);
  return { hearts, nextHeartAt };
}

/** Persist any regenerated hearts and return the current state. */
export function syncHearts(db: Db, userId: number, now: Date): HeartState {
  ensureRow(db, userId, now);
  const row = readRow(db, userId);
  const s = computeHearts(row.hearts, row.hearts_updated_at, now);
  write(db, userId, s.hearts, s.anchor);
  return { hearts: s.hearts, nextHeartAt: s.nextHeartAt };
}

/** Spend one heart (never below 0). Dropping from full starts the regen clock now. */
export function loseHeart(db: Db, userId: number, now: Date): HeartState {
  ensureRow(db, userId, now);
  const row = readRow(db, userId);
  const s = computeHearts(row.hearts, row.hearts_updated_at, now);
  const hearts = Math.max(0, s.hearts - 1);
  // When full, computeHearts' anchor is `now`, so the first lost heart regenerates in 30 min.
  write(db, userId, hearts, s.anchor);
  return computeHearts(hearts, s.anchor, now);
}

/** Add `n` hearts (capped at MAX_HEARTS), e.g. the +1 for completing practice. */
export function addHearts(db: Db, userId: number, n: number, now: Date): HeartState {
  ensureRow(db, userId, now);
  const row = readRow(db, userId);
  const s = computeHearts(row.hearts, row.hearts_updated_at, now);
  const hearts = Math.min(MAX_HEARTS, s.hearts + Math.max(0, n));
  const anchor = hearts >= MAX_HEARTS ? now.toISOString() : s.anchor;
  write(db, userId, hearts, anchor);
  return computeHearts(hearts, anchor, now);
}

/** Completion hook: a completed practice or mistakes session refills one heart. */
export const heartRefillHook: CompletionHook = (ctx) => {
  if (ctx.failed || (ctx.session.kind !== 'practice' && ctx.session.kind !== 'mistakes')) return;
  addHearts(ctx.db, ctx.user.id, 1, ctx.now);
};
