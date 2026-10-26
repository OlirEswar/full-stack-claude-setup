import { createHash, randomBytes } from 'node:crypto';
import type { Db } from '../db/index.ts';

export const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Create a new 32-byte random bearer token; only its sha256 is persisted. */
export function issueToken(db: Db, userId: number, now: Date): string {
  const token = randomBytes(32).toString('base64url');
  const expires = new Date(now.getTime() + TOKEN_TTL_MS);
  db.prepare('INSERT INTO auth_tokens (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(
    hashToken(token),
    userId,
    now.toISOString(),
    expires.toISOString(),
  );
  return token;
}

/** Resolve a raw token to its user id, or null if unknown/expired. Expired tokens are deleted. */
export function lookupToken(db: Db, token: string, now: Date): number | null {
  const tokenHash = hashToken(token);
  const row = db.prepare('SELECT user_id, expires_at FROM auth_tokens WHERE token_hash = ?').get(tokenHash) as
    | { user_id: number; expires_at: string }
    | undefined;
  if (!row) return null;
  if (Date.parse(row.expires_at) <= now.getTime()) {
    db.prepare('DELETE FROM auth_tokens WHERE token_hash = ?').run(tokenHash);
    return null;
  }
  return row.user_id;
}

export function revokeToken(db: Db, token: string): void {
  db.prepare('DELETE FROM auth_tokens WHERE token_hash = ?').run(hashToken(token));
}
