import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.ts';
import { mulberry32 } from '../src/content/rng.ts';
import type { ClientQuestion, QuestionKind } from '../src/content/types.ts';

const T0 = new Date('2026-03-10T12:00:00.000Z');
const DAY = 86_400_000;

interface StartBody {
  session: { id: number; kind: string; skillId: string | null; total: number; status: string; hearts: number };
  question: ClientQuestion | null;
}

describe('daily challenge', () => {
  let app: FastifyInstance;
  let clock: Date;
  let token: string;

  async function register(username: string, timezone?: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username, password: 'correct horse', ...(timezone ? { timezone } : {}) },
    });
    expect(res.statusCode).toBe(201);
    return res.json().token as string;
  }

  beforeEach(async () => {
    clock = T0;
    app = await buildApp({ dbPath: ':memory:', now: () => clock, rng: mulberry32(11) });
    token = await register('alice');
  });

  afterEach(async () => {
    await app.close();
  });

  const auth = () => ({ authorization: `Bearer ${token}` });

  function itemRow(itemId: number): { kind: QuestionKind; key: { answer: unknown } } {
    const row = app.db.prepare('SELECT client_payload, answer_key FROM session_items WHERE id = ?').get(itemId) as {
      client_payload: string;
      answer_key: string;
    };
    return { kind: JSON.parse(row.client_payload).kind, key: JSON.parse(row.answer_key) };
  }

  function correctResponse(itemId: number): unknown {
    const { kind, key } = itemRow(itemId);
    switch (kind) {
      case 'mcq':
        return { choice: key.answer };
      case 'true_false':
      case 'numeric':
        return { value: key.answer };
      case 'multi_select':
        return { choices: key.answer };
      case 'match':
        return { pairs: key.answer };
    }
  }

  function wrongResponse(itemId: number): unknown {
    const { kind, key } = itemRow(itemId);
    switch (kind) {
      case 'mcq':
        return { choice: (key.answer as number) === 0 ? 1 : 0 };
      case 'true_false':
        return { value: !key.answer };
      case 'numeric':
        return { value: (key.answer as number) * 10 + 1000 };
      case 'multi_select':
        return { choices: [] };
      case 'match': {
        const a = key.answer as number[];
        return { pairs: a.map((_, i) => a[(i + 1) % a.length]) };
      }
    }
  }

  const getDaily = async () => {
    const res = await app.inject({ method: 'GET', url: '/api/daily', headers: auth() });
    expect(res.statusCode).toBe(200);
    return res.json() as { date: string; status: string; sessionId: number | null; questionCount: number };
  };

  const startDaily = () => app.inject({ method: 'POST', url: '/api/daily/start', headers: auth() });

  async function answer(sessionId: number, q: ClientQuestion, ok: boolean) {
    const res = await app.inject({
      method: 'POST',
      url: `/api/sessions/${sessionId}/answer`,
      headers: auth(),
      payload: { itemId: q.itemId, response: ok ? correctResponse(q.itemId) : wrongResponse(q.itemId), timeMs: 2000 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().correct).toBe(ok);
    return res.json() as { correct: boolean; hearts: number; status: string; next: ClientQuestion | null };
  }

  async function answerAll(sessionId: number, first: ClientQuestion, ok: (i: number) => boolean) {
    let q: ClientQuestion | null = first;
    let i = 0;
    let last: Awaited<ReturnType<typeof answer>> | undefined;
    while (q) {
      last = await answer(sessionId, q, ok(i++));
      q = last.next;
    }
    return { last: last!, count: i };
  }

  async function complete(sessionId: number) {
    const res = await app.inject({ method: 'POST', url: `/api/sessions/${sessionId}/complete`, headers: auth() });
    expect(res.statusCode).toBe(200);
    return res.json() as {
      xpEarned: number;
      xpBreakdown: { label: string; amount: number }[];
      perfect: boolean;
      streak: number;
      streakExtended: boolean;
    };
  }

  /** Start and play today's daily all-correct, then complete it. */
  async function playDaily(ok: (i: number) => boolean = () => true) {
    const res = await startDaily();
    expect(res.statusCode).toBe(201);
    const body = res.json() as StartBody;
    await answerAll(body.session.id, body.question!, ok);
    return { sessionId: body.session.id, summary: await complete(body.session.id) };
  }

  const me = async () => (await app.inject({ method: 'GET', url: '/api/me', headers: auth() })).json().stats;

  it('requires auth', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/daily' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/daily/start' })).statusCode).toBe(401);
  });

  it('daily start returns 5 questions and no hearts are consumed on wrong answers', async () => {
    const res = await startDaily();
    expect(res.statusCode).toBe(201);
    const body = res.json() as StartBody;
    expect(body.session).toMatchObject({ kind: 'daily', skillId: null, total: 5, status: 'active', hearts: 5 });
    expect(body.question).toMatchObject({ position: 1, total: 5 });
    expect(body.question).not.toHaveProperty('answer');

    const { last, count } = await answerAll(body.session.id, body.question!, () => false);
    expect(count).toBe(5);
    expect(last.status).toBe('ready');
    expect(last.hearts).toBe(5);
    expect((await me()).hearts).toBe(5);

    const summary = await complete(body.session.id);
    expect(summary.xpEarned).toBe(15);
    expect(summary.perfect).toBe(false);
  });

  it('daily start works with 0 hearts', async () => {
    const uid = (app.db.prepare('SELECT id FROM users WHERE username = ?').get('alice') as { id: number }).id;
    app.db
      .prepare('UPDATE user_stats SET hearts = 0, hearts_updated_at = ? WHERE user_id = ?')
      .run(clock.toISOString(), uid);
    const res = await startDaily();
    expect(res.statusCode).toBe(201);
  });

  it('daily start twice the same day resumes the same session', async () => {
    const first = (await startDaily()).json() as StartBody;
    await answer(first.session.id, first.question!, true);

    clock = new Date(T0.getTime() + 60 * 60 * 1000);
    const res = await startDaily();
    expect(res.statusCode).toBe(201);
    const second = res.json() as StartBody;
    expect(second.session.id).toBe(first.session.id);
    expect(second.question!.position).toBe(2);

    const n = app.db.prepare("SELECT COUNT(*) AS n FROM sessions WHERE kind = 'daily'").get() as { n: number };
    expect(Number(n.n)).toBe(1);
  });

  it('daily start after completion returns 409', async () => {
    await playDaily();
    const res = await startDaily();
    expect(res.statusCode).toBe(409);
    expect((await me()).dailyChallengeDone).toBe(true);
  });

  it('GET /api/daily status transitions not_started → in_progress → completed', async () => {
    const a = await getDaily();
    expect(a).toEqual({ date: '2026-03-10', status: 'not_started', sessionId: null, questionCount: 5 });

    const start = (await startDaily()).json() as StartBody;
    const b = await getDaily();
    expect(b).toEqual({ date: '2026-03-10', status: 'in_progress', sessionId: start.session.id, questionCount: 5 });

    // Answered but not yet completed: still in progress.
    await answerAll(start.session.id, start.question!, () => true);
    expect((await getDaily()).status).toBe('in_progress');

    await complete(start.session.id);
    const c = await getDaily();
    expect(c).toEqual({ date: '2026-03-10', status: 'completed', sessionId: start.session.id, questionCount: 5 });
  });

  it('new calendar day in user timezone allows a new daily', async () => {
    token = await register('bob', 'America/Los_Angeles');
    // 2026-03-10T12:00Z is 05:00 on Mar 10 in Los Angeles (PDT, UTC−7).
    const { sessionId } = await playDaily();
    expect((await getDaily()).date).toBe('2026-03-10');

    // UTC has rolled over to Mar 11, Los Angeles is still on Mar 10.
    clock = new Date('2026-03-11T02:00:00.000Z');
    expect(await getDaily()).toMatchObject({ date: '2026-03-10', status: 'completed' });
    expect((await startDaily()).statusCode).toBe(409);

    // 01:00 on Mar 11 in Los Angeles.
    clock = new Date('2026-03-11T08:00:00.000Z');
    expect(await getDaily()).toMatchObject({ date: '2026-03-11', status: 'not_started', sessionId: null });
    const res = await startDaily();
    expect(res.statusCode).toBe(201);
    expect((res.json() as StartBody).session.id).not.toBe(sessionId);
    expect(await getDaily()).toMatchObject({ date: '2026-03-11', status: 'in_progress' });
  });

  it('completing daily sets streakExtended true and updates longest streak', async () => {
    const day1 = await playDaily();
    expect(day1.summary.streakExtended).toBe(true);
    expect(day1.summary.streak).toBe(1);
    expect(day1.summary.perfect).toBe(true);
    expect(day1.summary.xpBreakdown).toEqual([
      { label: 'Daily challenge', amount: 15 },
      { label: 'Perfect challenge', amount: 5 },
      { label: 'Combo bonus', amount: 2 },
    ]);
    expect(await me()).toMatchObject({ streak: 1, longestStreak: 1 });

    // Completing again is idempotent: no double counting.
    expect(await complete(day1.sessionId)).toEqual(day1.summary);
    expect(await me()).toMatchObject({ streak: 1, longestStreak: 1 });

    clock = new Date(T0.getTime() + DAY);
    const day2 = await playDaily();
    expect(day2.summary).toMatchObject({ streak: 2, streakExtended: true });
    expect(await me()).toMatchObject({ streak: 2, longestStreak: 2, streakFreezes: 0 });

    // A lesson does not extend the streak but reports the current one.
    const lesson = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: auth(),
      payload: { kind: 'lesson', skillId: 'laplace-basics' },
    });
    expect(lesson.statusCode).toBe(201);
    const lb = lesson.json() as StartBody;
    await answerAll(lb.session.id, lb.question!, () => true);
    expect(await complete(lb.session.id)).toMatchObject({ streak: 2, streakExtended: false });

    // Skip two days without freezes: displayed streak drops to 0, next daily restarts at 1, longest kept.
    clock = new Date(T0.getTime() + 4 * DAY);
    expect((await me()).streak).toBe(0);
    const day5 = await playDaily();
    expect(day5.summary).toMatchObject({ streak: 1, streakExtended: true });
    expect(await me()).toMatchObject({ streak: 1, longestStreak: 2 });
  });

  it('missing a day with a held freeze keeps the streak through the API', async () => {
    const uid = (app.db.prepare('SELECT id FROM users WHERE username = ?').get('alice') as { id: number }).id;
    await playDaily();
    app.db.prepare('UPDATE user_stats SET streak_current = 6, streak_longest = 6, streak_freezes = 1 WHERE user_id = ?').run(uid);

    clock = new Date(T0.getTime() + 2 * DAY); // skipped Mar 11
    expect((await me()).streak).toBe(6);
    const { summary } = await playDaily();
    expect(summary).toMatchObject({ streak: 7, streakExtended: true });
    // Freeze consumed for the gap, then one earned for reaching 7.
    expect(await me()).toMatchObject({ streak: 7, longestStreak: 7, streakFreezes: 1 });
  });
});
