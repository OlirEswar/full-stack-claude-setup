import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.ts';
import { hashToken } from '../src/auth/tokens.ts';

const NOW = new Date('2026-03-10T12:00:00.000Z');

describe('auth', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp({ dbPath: ':memory:', now: () => NOW });
  });

  afterEach(async () => {
    await app.close();
  });

  function register(username = 'alice', password = 'correct horse', timezone?: string) {
    return app.inject({ method: 'POST', url: '/api/auth/register', payload: { username, password, timezone } });
  }

  async function tokenFor(username = 'alice'): Promise<string> {
    const res = await register(username);
    return res.json().token as string;
  }

  function me(token?: string) {
    return app.inject({
      method: 'GET',
      url: '/api/me',
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  }

  it('register returns 201 with token', async () => {
    const res = await register('alice', 'correct horse', 'Europe/Berlin');
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(typeof body.token).toBe('string');
    expect(body.token.length).toBeGreaterThanOrEqual(32);
    expect(body.user).toMatchObject({ username: 'alice', timezone: 'Europe/Berlin', dailyXpGoal: 20 });
    expect(typeof body.user.id).toBe('number');

    const stats = app.db.prepare('SELECT hearts, streak_current FROM user_stats WHERE user_id = ?').get(body.user.id);
    expect(stats).toEqual({ hearts: 5, streak_current: 0 });

    // Only the sha256 of the token is stored.
    const tokens = app.db.prepare('SELECT token_hash, expires_at FROM auth_tokens').all() as {
      token_hash: string;
      expires_at: string;
    }[];
    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.token_hash).toBe(hashToken(body.token));
    expect(tokens[0]!.token_hash).not.toBe(body.token);
    expect(tokens[0]!.expires_at).toBe('2026-04-09T12:00:00.000Z');
  });

  it('register rejects duplicate username with 409', async () => {
    expect((await register('alice')).statusCode).toBe(201);
    expect((await register('alice')).statusCode).toBe(409);
    expect((await register('ALICE')).statusCode).toBe(409);
  });

  it('percent-encoded /api paths still require auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/%61pi/me' });
    expect(res.statusCode).toBe(401);
  });

  it('register rejects short password with 400', async () => {
    const res = await register('bob', 'short');
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBeTypeOf('string');
  });

  it('register rejects invalid usernames and timezones with 400', async () => {
    expect((await register('ab')).statusCode).toBe(400);
    expect((await register('has space')).statusCode).toBe(400);
    expect((await register('a'.repeat(21))).statusCode).toBe(400);
    expect((await register('carol', 'correct horse', 'Mars/Olympus')).statusCode).toBe(400);
    const res = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { username: 'x' } });
    expect(res.statusCode).toBe(400);
  });

  it('register defaults timezone to UTC', async () => {
    const res = await register('dave');
    expect(res.json().user.timezone).toBe('UTC');
  });

  it('login with wrong password returns 401', async () => {
    await register('alice', 'correct horse');
    const bad = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'alice', password: 'wrong password' },
    });
    expect(bad.statusCode).toBe(401);
    const unknown = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'nobody', password: 'correct horse' },
    });
    expect(unknown.statusCode).toBe(401);
  });

  it('login with correct password returns 200 with a working token', async () => {
    await register('alice', 'correct horse');
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'Alice', password: 'correct horse' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user.username).toBe('alice');
    expect((await me(body.token)).statusCode).toBe(200);
  });

  it('GET /api/me without token returns 401', async () => {
    expect((await me()).statusCode).toBe(401);
    expect((await me('not-a-real-token')).statusCode).toBe(401);
  });

  it('GET /api/me with token returns username and stats.hearts === 5', async () => {
    const token = await tokenFor('alice');
    const res = await me(token);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user.username).toBe('alice');
    expect(body.stats.hearts).toBe(5);
    expect(body.stats).toMatchObject({
      xpTotal: 0,
      xpToday: 0,
      dailyXpGoal: 20,
      dailyGoalMet: false,
      streak: 0,
      longestStreak: 0,
      streakFreezes: 0,
      maxHearts: 5,
      nextHeartAt: null,
      dailyChallengeDone: false,
    });
  });

  it('expired tokens are rejected', async () => {
    const token = await tokenFor('alice');
    app.db.prepare('UPDATE auth_tokens SET expires_at = ?').run('2026-03-10T11:59:59.000Z');
    expect((await me(token)).statusCode).toBe(401);
  });

  it('logout revokes token', async () => {
    const token = await tokenFor('alice');
    expect((await me(token)).statusCode).toBe(200);
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(204);
    expect((await me(token)).statusCode).toBe(401);
  });

  it('PATCH /api/me rejects dailyXpGoal 15 with 400 and accepts 30', async () => {
    const token = await tokenFor('alice');
    const patch = (payload: unknown) =>
      app.inject({ method: 'PATCH', url: '/api/me', headers: { authorization: `Bearer ${token}` }, payload: payload as object });

    expect((await patch({ dailyXpGoal: 15 })).statusCode).toBe(400);
    const ok = await patch({ dailyXpGoal: 30 });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().user.dailyXpGoal).toBe(30);
    expect(ok.json().stats.dailyXpGoal).toBe(30);
    expect((await me(token)).json().user.dailyXpGoal).toBe(30);

    expect((await patch({ timezone: 'Not/AZone' })).statusCode).toBe(400);
    const tz = await patch({ timezone: 'America/New_York' });
    expect(tz.statusCode).toBe(200);
    expect(tz.json().user.timezone).toBe('America/New_York');
  });

  it('password hash is not stored in plaintext', async () => {
    const password = 'correct horse';
    await register('alice', password);
    await register('bob', password);
    const rows = app.db.prepare('SELECT password_hash, password_salt FROM users ORDER BY id').all() as {
      password_hash: string;
      password_salt: string;
    }[];
    for (const r of rows) {
      expect(r.password_hash).not.toContain(password);
      expect(r.password_hash).toMatch(/^[0-9a-f]{128}$/);
      expect(r.password_salt).toMatch(/^[0-9a-f]{32}$/);
    }
    // Random salt: same password yields different hashes.
    expect(rows[0]!.password_salt).not.toBe(rows[1]!.password_salt);
    expect(rows[0]!.password_hash).not.toBe(rows[1]!.password_hash);
  });
});
