import type { FastifyInstance } from 'fastify';
import { dummyVerify, hashPassword, verifyPassword } from '../auth/password.ts';
import { issueToken, revokeToken } from '../auth/tokens.ts';
import { normalizeTimeZone } from './me.ts';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 256;

interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  password_salt: string;
  timezone: string;
  daily_xp_goal: number;
}

function publicUser(row: Pick<UserRow, 'id' | 'username' | 'timezone' | 'daily_xp_goal'>) {
  return { id: row.id, username: row.username, timezone: row.timezone, dailyXpGoal: row.daily_xp_goal };
}

function asObject(body: unknown): Record<string, unknown> | null {
  return typeof body === 'object' && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Error && /UNIQUE constraint failed/i.test(err.message);
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/auth/register', { config: { auth: false } }, async (request, reply) => {
    const body = asObject(request.body);
    if (!body) return reply.code(400).send({ error: 'Body must be a JSON object' });
    const { username, password, timezone } = body;

    if (typeof username !== 'string' || !USERNAME_RE.test(username)) {
      return reply.code(400).send({ error: 'Username must be 3-20 characters: letters, digits, underscore' });
    }
    if (typeof password !== 'string' || password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
      return reply.code(400).send({ error: `Password must be at least ${MIN_PASSWORD} characters` });
    }
    let tz = 'UTC';
    if (timezone !== undefined && timezone !== null) {
      const normalized = normalizeTimeZone(timezone);
      if (!normalized) return reply.code(400).send({ error: 'Invalid timezone' });
      tz = normalized;
    }

    const existing = app.db.prepare('SELECT 1 FROM users WHERE username = ?').get(username);
    if (existing) return reply.code(409).send({ error: 'Username already taken' });

    const { hash, salt } = await hashPassword(password);
    const now = app.now();
    const db = app.db;
    let userId: number;
    db.exec('BEGIN');
    try {
      const res = db
        .prepare('INSERT INTO users (username, password_hash, password_salt, timezone, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(username, hash, salt, tz, now.toISOString());
      userId = Number(res.lastInsertRowid);
      db.prepare('INSERT INTO user_stats (user_id, hearts, streak_current, hearts_updated_at) VALUES (?, 5, 0, ?)').run(
        userId,
        now.toISOString(),
      );
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      // Lost a race with a concurrent registration of the same name.
      if (isUniqueViolation(err)) return reply.code(409).send({ error: 'Username already taken' });
      throw err;
    }

    const token = issueToken(db, userId, now);
    const row = db.prepare('SELECT id, username, timezone, daily_xp_goal FROM users WHERE id = ?').get(userId) as unknown as UserRow;
    return reply.code(201).send({ token, user: publicUser(row) });
  });

  app.post('/api/auth/login', { config: { auth: false } }, async (request, reply) => {
    const body = asObject(request.body);
    if (!body) return reply.code(400).send({ error: 'Body must be a JSON object' });
    const { username, password } = body;
    if (typeof username !== 'string' || typeof password !== 'string' || password.length > MAX_PASSWORD) {
      return reply.code(400).send({ error: 'username and password are required' });
    }

    const row = app.db
      .prepare('SELECT id, username, password_hash, password_salt, timezone, daily_xp_goal FROM users WHERE username = ?')
      .get(username) as UserRow | undefined;
    const ok = row ? await verifyPassword(password, row.password_hash, row.password_salt) : await dummyVerify(password);
    if (!row || !ok) return reply.code(401).send({ error: 'Invalid username or password' });

    const token = issueToken(app.db, row.id, app.now());
    return { token, user: publicUser(row) };
  });

  app.post('/api/auth/logout', async (request, reply) => {
    if (request.authToken) revokeToken(app.db, request.authToken);
    return reply.code(204).send();
  });
}
