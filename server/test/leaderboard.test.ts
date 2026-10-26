import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.ts';
import { isoWeekStart } from '../src/services/leaderboard.ts';

// Wednesday 2026-03-11 12:00 UTC; ISO week started Monday 2026-03-09 00:00 UTC.
const NOW = new Date('2026-03-11T12:00:00.000Z');
const WEEK_START = new Date('2026-03-09T00:00:00.000Z');

interface LeaderboardBody {
  weekStart: string;
  entries: { rank: number; username: string; xp: number; isMe: boolean }[];
  me: { rank: number; xp: number };
}

describe('leaderboard', () => {
  let app: FastifyInstance;
  let token: string;
  let userId: number;

  /** Insert a user directly (avoids password hashing for bulk fixtures). */
  function addUser(username: string): number {
    const r = app.db
      .prepare('INSERT INTO users (username, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?)')
      .run(username, 'x', 'x', NOW.toISOString());
    return Number(r.lastInsertRowid);
  }

  function xpEvent(uid: number, amount: number, createdAt: Date): void {
    app.db
      .prepare(
        'INSERT INTO xp_events (user_id, amount, source, session_id, local_date, created_at) VALUES (?, ?, ?, NULL, ?, ?)',
      )
      .run(uid, amount, 'lesson', createdAt.toISOString().slice(0, 10), createdAt.toISOString());
  }

  async function getBoard(): Promise<LeaderboardBody> {
    const res = await app.inject({
      method: 'GET',
      url: '/api/leaderboard',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    return res.json() as LeaderboardBody;
  }

  beforeEach(async () => {
    app = await buildApp({ dbPath: ':memory:', now: () => NOW });
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'alice', password: 'correct horse' },
    });
    token = res.json().token;
    userId = res.json().user.id;
  });

  afterEach(async () => {
    await app.close();
  });

  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/leaderboard' });
    expect(res.statusCode).toBe(401);
  });

  it('isoWeekStart is Monday 00:00 UTC', () => {
    expect(isoWeekStart(NOW).toISOString()).toBe(WEEK_START.toISOString());
    expect(isoWeekStart(new Date('2026-03-09T00:00:00.000Z')).toISOString()).toBe(WEEK_START.toISOString());
    // Sunday late night still belongs to the week that started the previous Monday.
    expect(isoWeekStart(new Date('2026-03-15T23:59:59.999Z')).toISOString()).toBe(WEEK_START.toISOString());
    expect(isoWeekStart(new Date('2026-03-08T23:59:59.999Z')).toISOString()).toBe('2026-03-02T00:00:00.000Z');
  });

  it("leaderboard sums only this week's XP", async () => {
    xpEvent(userId, 10, WEEK_START); // boundary: counts
    xpEvent(userId, 5, new Date('2026-03-11T08:00:00.000Z'));
    xpEvent(userId, 100, new Date('2026-03-08T23:59:59.999Z')); // last week
    xpEvent(userId, 100, new Date('2026-02-01T10:00:00.000Z')); // long ago

    const body = await getBoard();
    expect(body.weekStart).toBe('2026-03-09');
    expect(body.entries).toEqual([{ rank: 1, username: 'alice', xp: 15, isMe: true }]);
    expect(body.me).toEqual({ rank: 1, xp: 15 });
  });

  it('leaderboard orders by xp desc then username and caps at 50', async () => {
    // 60 other users; xp = 10 * (i % 7) + 1 creates plenty of ties.
    for (let i = 0; i < 60; i++) {
      const id = addUser(`user${String(i).padStart(2, '0')}`);
      xpEvent(id, 10 * (i % 7) + 1, new Date('2026-03-10T09:00:00.000Z'));
    }

    const body = await getBoard();
    expect(body.entries).toHaveLength(50);
    expect(body.entries.map((e) => e.rank)).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
    for (let i = 1; i < body.entries.length; i++) {
      const a = body.entries[i - 1];
      const b = body.entries[i];
      expect(a.xp >= b.xp).toBe(true);
      if (a.xp === b.xp) expect(a.username < b.username).toBe(true);
    }
    // Top tie group: i % 7 === 6 -> user06, user13, user20, ... all with 61 XP.
    expect(body.entries[0]).toMatchObject({ username: 'user06', xp: 61 });
    expect(body.entries[1]).toMatchObject({ username: 'user13', xp: 61 });
  });

  it('leaderboard me shows rank even with 0 XP', async () => {
    const bob = addUser('bob');
    const carol = addUser('carol');
    xpEvent(bob, 20, new Date('2026-03-10T09:00:00.000Z'));
    xpEvent(carol, 30, new Date('2026-03-10T09:00:00.000Z'));
    xpEvent(userId, 500, new Date('2026-03-01T09:00:00.000Z')); // last week only

    const body = await getBoard();
    expect(body.me).toEqual({ rank: 3, xp: 0 });
    expect(body.entries.map((e) => e.username)).toEqual(['carol', 'bob']);
    expect(body.entries.some((e) => e.isMe)).toBe(false);
  });

  it('leaderboard isMe flags the caller', async () => {
    const bob = addUser('bob');
    const zed = addUser('zed');
    xpEvent(bob, 40, new Date('2026-03-10T09:00:00.000Z'));
    xpEvent(userId, 25, new Date('2026-03-10T09:00:00.000Z'));
    xpEvent(zed, 25, new Date('2026-03-10T09:00:00.000Z'));

    const body = await getBoard();
    expect(body.entries).toEqual([
      { rank: 1, username: 'bob', xp: 40, isMe: false },
      { rank: 2, username: 'alice', xp: 25, isMe: true },
      { rank: 3, username: 'zed', xp: 25, isMe: false },
    ]);
    expect(body.me).toEqual({ rank: 2, xp: 25 });
  });
});
