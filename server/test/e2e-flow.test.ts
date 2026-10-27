import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.ts';
import { mulberry32 } from '../src/content/rng.ts';
import type { ClientQuestion, QuestionKind } from '../src/content/types.ts';
import { DEMO_PASSWORD, DEMO_USERNAME, FAKE_USERS, seedDemo } from '../src/scripts/seed-demo.ts';

const NOW = new Date('2026-03-11T12:00:00.000Z');

interface StartBody {
  session: { id: number; kind: string; skillId: string | null; total: number; status: string };
  question: ClientQuestion | null;
}

describe('e2e API flow', () => {
  let app: FastifyInstance;
  let token = '';

  beforeEach(async () => {
    app = await buildApp({ dbPath: ':memory:', now: () => NOW, rng: mulberry32(17) });
  });

  afterEach(async () => {
    await app.close();
  });

  const auth = () => ({ authorization: `Bearer ${token}` });

  function correctResponse(itemId: number): unknown {
    const row = app.db.prepare('SELECT client_payload, answer_key FROM session_items WHERE id = ?').get(itemId) as {
      client_payload: string;
      answer_key: string;
    };
    const kind = JSON.parse(row.client_payload).kind as QuestionKind;
    const answer = JSON.parse(row.answer_key).answer as unknown;
    switch (kind) {
      case 'mcq':
        return { choice: answer };
      case 'true_false':
      case 'numeric':
        return { value: answer };
      case 'multi_select':
        return { choices: answer };
      case 'match':
        return { pairs: answer };
    }
  }

  async function answerAll(start: StartBody): Promise<number> {
    let q = start.question;
    let n = 0;
    while (q) {
      const res = await app.inject({
        method: 'POST',
        url: `/api/sessions/${start.session.id}/answer`,
        headers: auth(),
        payload: { itemId: q.itemId, response: correctResponse(q.itemId), timeMs: 3000 },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as { correct: boolean; status: string; next: ClientQuestion | null };
      expect(body.correct).toBe(true);
      n++;
      if (!body.next) expect(body.status).toBe('ready');
      q = body.next;
    }
    return n;
  }

  async function complete(sessionId: number) {
    const res = await app.inject({ method: 'POST', url: `/api/sessions/${sessionId}/complete`, headers: auth() });
    expect(res.statusCode).toBe(200);
    return res.json() as { xpEarned: number; perfect: boolean; streak: number; streakExtended: boolean };
  }

  it('full flow: register → path → lesson (answer all) → complete → daily → complete → me shows streak 1 and xp > 0 → leaderboard rank 1', async () => {
    // Register
    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'e2e_user', password: 'correct horse' },
    });
    expect(reg.statusCode).toBe(201);
    token = reg.json().token;

    // Path: first skill is unlocked
    const pathRes = await app.inject({ method: 'GET', url: '/api/path', headers: auth() });
    expect(pathRes.statusCode).toBe(200);
    const path = pathRes.json() as { units: { skills: { id: string; unlocked: boolean; level: number }[] }[] };
    const first = path.units[0].skills[0];
    expect(first.unlocked).toBe(true);
    expect(first.level).toBe(0);

    // Lesson: answer all correctly, then complete
    const lessonRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: auth(),
      payload: { kind: 'lesson', skillId: first.id },
    });
    expect(lessonRes.statusCode).toBe(201);
    const lesson = lessonRes.json() as StartBody;
    expect(lesson.session).toMatchObject({ kind: 'lesson', skillId: first.id, total: 8, status: 'active' });
    expect(await answerAll(lesson)).toBe(8);
    const lessonSummary = await complete(lesson.session.id);
    expect(lessonSummary.xpEarned).toBeGreaterThan(0);
    expect(lessonSummary.perfect).toBe(true);

    // Lesson progress is reflected on the path
    const path2 = (await app.inject({ method: 'GET', url: '/api/path', headers: auth() })).json() as {
      units: { skills: { id: string; started: boolean; lessonsInLevel: number }[] }[];
    };
    expect(path2.units[0].skills[0]).toMatchObject({ started: true, lessonsInLevel: 1 });

    // Daily: start, answer all, complete
    const dailyRes = await app.inject({ method: 'POST', url: '/api/daily/start', headers: auth() });
    expect(dailyRes.statusCode).toBe(201);
    const daily = dailyRes.json() as StartBody;
    expect(daily.session).toMatchObject({ kind: 'daily', total: 5 });
    expect(await answerAll(daily)).toBe(5);
    const dailySummary = await complete(daily.session.id);
    expect(dailySummary.xpEarned).toBeGreaterThan(0);
    expect(dailySummary.streak).toBe(1);
    expect(dailySummary.streakExtended).toBe(true);

    const dailyView = (await app.inject({ method: 'GET', url: '/api/daily', headers: auth() })).json();
    expect(dailyView.status).toBe('completed');

    // Me: streak 1, xp > 0
    const meRes = await app.inject({ method: 'GET', url: '/api/me', headers: auth() });
    expect(meRes.statusCode).toBe(200);
    const me = meRes.json() as { user: { username: string }; stats: Record<string, unknown> };
    expect(me.user.username).toBe('e2e_user');
    expect(me.stats.streak).toBe(1);
    expect(me.stats.xpTotal as number).toBeGreaterThan(0);
    expect(me.stats.xpTotal).toBe(lessonSummary.xpEarned + dailySummary.xpEarned);
    expect(me.stats.dailyChallengeDone).toBe(true);

    // Leaderboard: rank 1
    const lbRes = await app.inject({ method: 'GET', url: '/api/leaderboard', headers: auth() });
    expect(lbRes.statusCode).toBe(200);
    const lb = lbRes.json() as {
      entries: { rank: number; username: string; xp: number; isMe: boolean }[];
      me: { rank: number; xp: number };
    };
    expect(lb.me.rank).toBe(1);
    expect(lb.me.xp).toBe(me.stats.xpTotal);
    expect(lb.entries[0]).toMatchObject({ rank: 1, username: 'e2e_user', isMe: true });
  });

  it('seed creates demo + 5 fake users with progress and is safe to rerun', async () => {
    const first = await seedDemo(app);
    expect(first.created).toEqual([DEMO_USERNAME, ...FAKE_USERS.map((u) => u.username)]);
    expect(first.skipped).toEqual([]);

    const second = await seedDemo(app);
    expect(second.created).toEqual([]);
    expect(second.skipped).toHaveLength(6);

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: DEMO_USERNAME, password: DEMO_PASSWORD },
    });
    expect(login.statusCode).toBe(200);
    token = login.json().token;

    const me = (await app.inject({ method: 'GET', url: '/api/me', headers: auth() })).json();
    expect(me.stats.streak).toBe(1);
    expect(me.stats.xpTotal).toBeGreaterThan(0);

    const lb = (await app.inject({ method: 'GET', url: '/api/leaderboard', headers: auth() })).json() as {
      entries: { username: string; xp: number }[];
    };
    expect(lb.entries).toHaveLength(6);
    for (const e of lb.entries) expect(e.xp).toBeGreaterThan(0);
  });
});
