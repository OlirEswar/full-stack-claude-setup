import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.ts';
import { SKILLS } from '../src/content/curriculum.ts';
import { addDays } from '../src/routes/stats.ts';
import { upsertSkillProgress } from '../src/services/progress.ts';

// Tuesday 2026-03-10 12:00 UTC.
const T0 = new Date('2026-03-10T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

interface StatsBody {
  xpTotal: number;
  answered: number;
  accuracy: number;
  lessonsCompleted: number;
  longestStreak: number;
  last7Days: { date: string; xp: number }[];
  skills: {
    skillId: string;
    title: string;
    level: number;
    ability: number;
    accuracy: number;
    strength: number;
    started: boolean;
  }[];
}

describe('stats', () => {
  let app: FastifyInstance;
  let token: string;
  let userId: number;

  async function register(username: string, timezone?: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username, password: 'correct horse', ...(timezone ? { timezone } : {}) },
    });
    expect(res.statusCode).toBe(201);
    return { token: res.json().token as string, id: res.json().user.id as number };
  }

  async function getStats(t = token): Promise<StatsBody> {
    const res = await app.inject({ method: 'GET', url: '/api/stats', headers: { authorization: `Bearer ${t}` } });
    expect(res.statusCode).toBe(200);
    return res.json() as StatsBody;
  }

  function xpEvent(uid: number, amount: number, localDate: string, createdAt = T0): void {
    app.db
      .prepare(
        'INSERT INTO xp_events (user_id, amount, source, session_id, local_date, created_at) VALUES (?, ?, ?, NULL, ?, ?)',
      )
      .run(uid, amount, 'lesson', localDate, createdAt.toISOString());
  }

  beforeEach(async () => {
    app = await buildApp({ dbPath: ':memory:', now: () => T0 });
    ({ token, id: userId } = await register('alice'));
  });

  afterEach(async () => {
    await app.close();
  });

  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/stats' });
    expect(res.statusCode).toBe(401);
  });

  it('stats returns last7Days with 7 entries and zero-filled days', async () => {
    xpEvent(userId, 10, '2026-03-10');
    xpEvent(userId, 5, '2026-03-10');
    xpEvent(userId, 7, '2026-03-08');
    xpEvent(userId, 99, '2026-03-03'); // 8 days ago: outside the window
    xpEvent(userId, 50, '2026-03-11'); // future: outside the window

    const body = await getStats();
    expect(body.last7Days).toHaveLength(7);
    expect(body.last7Days).toEqual([
      { date: '2026-03-04', xp: 0 },
      { date: '2026-03-05', xp: 0 },
      { date: '2026-03-06', xp: 0 },
      { date: '2026-03-07', xp: 0 },
      { date: '2026-03-08', xp: 7 },
      { date: '2026-03-09', xp: 0 },
      { date: '2026-03-10', xp: 15 },
    ]);
  });

  it('last7Days follows the user time zone', async () => {
    // 12:00 UTC on 2026-03-10 is already 2026-03-11 in Kiritimati (UTC+14).
    const kiri = await register('bob', 'Pacific/Kiritimati');
    const body = await getStats(kiri.token);
    expect(body.last7Days[6].date).toBe('2026-03-11');
    expect(body.last7Days[0].date).toBe('2026-03-05');
  });

  it('addDays crosses month and year boundaries', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
  });

  it('stats accuracy equals correct/answered', async () => {
    let body = await getStats();
    expect(body.answered).toBe(0);
    expect(body.accuracy).toBe(0);

    app.db
      .prepare(
        `UPDATE user_stats SET answered_total = 40, correct_total = 30, xp_total = 123,
         lessons_completed = 4, streak_longest = 6 WHERE user_id = ?`,
      )
      .run(userId);
    body = await getStats();
    expect(body.answered).toBe(40);
    expect(body.accuracy).toBeCloseTo(30 / 40);
    expect(body.xpTotal).toBe(123);
    expect(body.lessonsCompleted).toBe(4);
    expect(body.longestStreak).toBe(6);
  });

  it('stats lists all 20 skills with level and strength', async () => {
    upsertSkillProgress(app.db, userId, 'laplace-basics', {
      level: 2,
      ability: 0.7,
      attempts: 10,
      correct: 8,
      halfLifeDays: 2,
      lastPracticedAt: new Date(T0.getTime() - 2 * DAY).toISOString(),
    });

    const body = await getStats();
    expect(body.skills).toHaveLength(20);
    expect(body.skills.map((s) => s.skillId)).toEqual(SKILLS.map((s) => s.id));
    for (const s of body.skills) {
      expect(typeof s.title).toBe('string');
      expect(typeof s.level).toBe('number');
      expect(typeof s.strength).toBe('number');
    }

    const first = body.skills[0];
    expect(first).toMatchObject({ skillId: 'laplace-basics', level: 2, ability: 0.7, started: true });
    expect(first.accuracy).toBeCloseTo(0.8);
    expect(first.strength).toBeCloseTo(0.5); // 2 days elapsed, 2-day half-life

    const untouched = body.skills[1];
    expect(untouched).toMatchObject({ level: 0, ability: 0, accuracy: 0, strength: 0, started: false });
  });
});
