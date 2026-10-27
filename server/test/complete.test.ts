import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.ts';
import { SKILLS } from '../src/content/curriculum.ts';
import { mulberry32 } from '../src/content/rng.ts';
import type { ClientQuestion, QuestionKind } from '../src/content/types.ts';
import { selectQuestionsForSkill } from '../src/engine/select.ts';
import { DAY_MS, scheduleAfterSession } from '../src/engine/spaced.ts';
import { advanceLevel, computeXp, replayCombo } from '../src/services/complete.ts';
import { getAllSkillProgress, getSkillProgress, upsertSkillProgress } from '../src/services/progress.ts';
import { createSession } from '../src/services/sessions.ts';
import { localDate } from '../src/services/xp.ts';

const T0 = new Date('2026-03-10T12:00:00.000Z');
const FIRST_SKILL = SKILLS[0]!.id;

interface Summary {
  xpEarned: number;
  xpBreakdown: { label: string; amount: number }[];
  correct: number;
  total: number;
  accuracy: number;
  maxCombo: number;
  perfect: boolean;
  streak: number;
  streakExtended: boolean;
  dailyGoalMet: boolean;
  xpToday: number;
  levelUp: { skillId: string; level: number } | null;
  newAchievements: { id: string; title: string }[];
}

describe('session completion', () => {
  let app: FastifyInstance;
  let clock: Date;
  let token: string;
  let userId: number;

  async function register(username: string, timezone?: string): Promise<{ token: string; userId: number }> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username, password: 'correct horse', ...(timezone ? { timezone } : {}) },
    });
    expect(res.statusCode).toBe(201);
    return { token: res.json().token, userId: res.json().user.id };
  }

  beforeEach(async () => {
    clock = T0;
    app = await buildApp({ dbPath: ':memory:', now: () => clock, rng: mulberry32(7) });
    ({ token, userId } = await register('alice'));
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

  async function startLesson(skillId = FIRST_SKILL): Promise<{ id: number; question: ClientQuestion }> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: auth(),
      payload: { kind: 'lesson', skillId },
    });
    expect(res.statusCode).toBe(201);
    return { id: res.json().session.id, question: res.json().question };
  }

  /** Answer from the given question on; `pattern[i]` false = answer item i wrong. Stops when no next question. */
  async function answerAll(sessionId: number, first: ClientQuestion, pattern: (i: number) => boolean) {
    let q: ClientQuestion | null = first;
    let i = 0;
    let last: { status: string } | undefined;
    while (q) {
      const response = pattern(i) ? correctResponse(q.itemId) : wrongResponse(q.itemId);
      const res: { statusCode: number; json: () => { correct: boolean; status: string; next: ClientQuestion | null } } =
        await app.inject({
          method: 'POST',
          url: `/api/sessions/${sessionId}/answer`,
          headers: auth(),
          payload: { itemId: q.itemId, response, timeMs: 3000 },
        });
      expect(res.statusCode).toBe(200);
      expect(res.json().correct).toBe(pattern(i));
      last = res.json();
      q = res.json().next;
      i++;
    }
    return last!;
  }

  async function complete(sessionId: number) {
    return app.inject({ method: 'POST', url: `/api/sessions/${sessionId}/complete`, headers: auth() });
  }

  async function playLesson(pattern: (i: number) => boolean = () => true, skillId = FIRST_SKILL): Promise<Summary> {
    const { id, question } = await startLesson(skillId);
    await answerAll(id, question, pattern);
    const res = await complete(id);
    expect(res.statusCode).toBe(200);
    return res.json();
  }

  async function me() {
    const res = await app.inject({ method: 'GET', url: '/api/me', headers: auth() });
    expect(res.statusCode).toBe(200);
    return res.json().stats as { xpToday: number; dailyXpGoal: number; dailyGoalMet: boolean; xpTotal: number };
  }

  function xpEventCount(): number {
    const r = app.db.prepare('SELECT COUNT(*) AS n FROM xp_events WHERE user_id = ?').get(userId) as { n: number };
    return Number(r.n);
  }

  it('completing a perfect lesson awards 15 XP with breakdown', async () => {
    // A lesson is normally 8 questions, and 8 straight correct answers also earn a
    // combo bonus. A 4-question lesson isolates completion (10) + perfect (5).
    const user = { id: userId, timezone: 'UTC' };
    const selections = selectQuestionsForSkill(
      { registry: app.registry, progress: getAllSkillProgress(app.db, userId), rng: mulberry32(3), now: clock },
      FIRST_SKILL,
      4,
    );
    const id = createSession(
      { db: app.db, registry: app.registry, now: clock, rng: mulberry32(4) },
      user,
      'lesson',
      FIRST_SKILL,
      selections,
    );
    const state = await app.inject({ method: 'GET', url: `/api/sessions/${id}`, headers: auth() });
    const last = await answerAll(id, state.json().question, () => true);
    expect(last.status).toBe('ready');

    const res = await complete(id);
    expect(res.statusCode).toBe(200);
    const s = res.json() as Summary;
    expect(s.xpEarned).toBe(15);
    expect(s.xpBreakdown).toEqual([
      { label: 'Lesson complete', amount: 10 },
      { label: 'Perfect lesson', amount: 5 },
    ]);
    expect(s).toMatchObject({
      correct: 4,
      total: 4,
      accuracy: 1,
      maxCombo: 4,
      perfect: true,
      streak: 0,
      streakExtended: false,
      xpToday: 15,
      levelUp: null,
      newAchievements: [
        { id: 'first-steps', title: 'First Steps' },
        { id: 'perfectionist', title: 'Perfectionist' },
      ],
    });
    const stats = await me();
    expect(stats.xpTotal).toBe(15);
    expect(stats.xpToday).toBe(15);
    const ev = app.db.prepare('SELECT amount, source, session_id, local_date FROM xp_events WHERE user_id = ?').all(userId);
    expect(ev).toEqual([{ amount: 15, source: 'lesson', session_id: id, local_date: '2026-03-10' }]);
    const row = app.db.prepare('SELECT status, xp_earned, completed_at FROM sessions WHERE id = ?').get(id);
    expect(row).toEqual({ status: 'completed', xp_earned: 15, completed_at: T0.toISOString() });
  });

  it('combo bonus adds 2 XP at combo 5', async () => {
    // Wrong on the 7th answer: combo reached 5 once (+2), not perfect → 10 + 2.
    const s = await playLesson((i) => i !== 6);
    expect(s.total).toBe(8);
    expect(s.correct).toBe(7);
    expect(s.maxCombo).toBe(6);
    expect(s.perfect).toBe(false);
    expect(s.xpBreakdown).toEqual([
      { label: 'Lesson complete', amount: 10 },
      { label: 'Combo bonus', amount: 2 },
    ]);
    expect(s.xpEarned).toBe(12);

    // A perfect 8-question lesson: 10 + 5 perfect + 2 combo.
    const p = await playLesson();
    expect(p.xpEarned).toBe(17);
    expect(p.maxCombo).toBe(8);
    expect(p.xpBreakdown).toContainEqual({ label: 'Combo bonus', amount: 2 });

    // Two wrong answers break the combo before it ever reaches 5: no bonus.
    const n = await playLesson((i) => i !== 3 && i !== 7);
    expect(n.maxCombo).toBe(3);
    expect(n.xpEarned).toBe(10);

    // Pure helpers.
    expect(replayCombo(Array(10).fill(true))).toEqual({ maxCombo: 10, comboBonus: 4 });
    expect(replayCombo([true, true, true, true, false, true, true, true, true, true])).toEqual({
      maxCombo: 5,
      comboBonus: 2,
    });
    expect(computeXp('daily', { failed: false, perfect: true, comboBonus: 2 }).map((e) => e.amount)).toEqual([
      15, 5, 2,
    ]);
  });

  it('failed lesson awards 0 XP and no level progress', async () => {
    const { id, question } = await startLesson();
    const last = await answerAll(id, question, () => false);
    expect(last.status).toBe('failed');

    const res = await complete(id);
    expect(res.statusCode).toBe(200);
    const s = res.json() as Summary;
    expect(s.xpEarned).toBe(0);
    expect(s.xpBreakdown).toEqual([]);
    expect(s.perfect).toBe(false);
    expect(s.levelUp).toBeNull();
    expect(s.correct).toBe(0);
    expect(xpEventCount()).toBe(0);

    const p = getSkillProgress(app.db, userId, FIRST_SKILL);
    expect(p.level).toBe(0);
    expect(p.lessonsInLevel).toBe(0);
    expect(p.lastPracticedAt).toBeNull();
    expect(p.nextDueAt).toBeNull();
    const row = app.db.prepare('SELECT status, xp_earned FROM sessions WHERE id = ?').get(id);
    expect(row).toEqual({ status: 'failed', xp_earned: 0 });
    const stats = app.db.prepare('SELECT lessons_completed, xp_total FROM user_stats WHERE user_id = ?').get(userId);
    expect(stats).toEqual({ lessons_completed: 0, xp_total: 0 });
  });

  it('3 completed lessons raise skill level from 0 to 1', async () => {
    const a = await playLesson();
    expect(a.levelUp).toBeNull();
    expect(getSkillProgress(app.db, userId, FIRST_SKILL)).toMatchObject({ level: 0, lessonsInLevel: 1 });
    const b = await playLesson((i) => i !== 0);
    expect(b.levelUp).toBeNull();
    expect(getSkillProgress(app.db, userId, FIRST_SKILL)).toMatchObject({ level: 0, lessonsInLevel: 2 });
    const c = await playLesson();
    expect(c.levelUp).toEqual({ skillId: FIRST_SKILL, level: 1 });
    expect(getSkillProgress(app.db, userId, FIRST_SKILL)).toMatchObject({ level: 1, lessonsInLevel: 0 });

    // The next skill unlocks.
    const path = await app.inject({ method: 'GET', url: '/api/path', headers: auth() });
    const skills = path.json().units.flatMap((u: { skills: { id: string; unlocked: boolean; level: number }[] }) => u.skills);
    expect(skills[0]).toMatchObject({ id: FIRST_SKILL, level: 1 });
    expect(skills[1].unlocked).toBe(true);
    const stats = app.db.prepare('SELECT lessons_completed FROM user_stats WHERE user_id = ?').get(userId);
    expect(stats).toEqual({ lessons_completed: 3 });
  });

  it('level caps at 5', async () => {
    upsertSkillProgress(app.db, userId, FIRST_SKILL, { level: 4, lessonsInLevel: 2 });
    const up = await playLesson();
    expect(up.levelUp).toEqual({ skillId: FIRST_SKILL, level: 5 });
    for (let i = 0; i < 3; i++) {
      const s = await playLesson();
      expect(s.levelUp).toBeNull();
      expect(s.xpEarned).toBeGreaterThan(0);
    }
    expect(getSkillProgress(app.db, userId, FIRST_SKILL)).toMatchObject({ level: 5, lessonsInLevel: 0 });

    expect(advanceLevel(5, 0)).toEqual({ level: 5, lessonsInLevel: 0 });
    expect(advanceLevel(5, 2)).toEqual({ level: 5, lessonsInLevel: 0 });
    expect(advanceLevel(4, 2)).toEqual({ level: 5, lessonsInLevel: 0 });
    expect(advanceLevel(0, 0)).toEqual({ level: 0, lessonsInLevel: 1 });
  });

  it('complete before all items answered returns 409', async () => {
    const { id, question } = await startLesson();
    expect((await complete(id)).statusCode).toBe(409);
    await app.inject({
      method: 'POST',
      url: `/api/sessions/${id}/answer`,
      headers: auth(),
      payload: { itemId: question.itemId, response: correctResponse(question.itemId), timeMs: 1000 },
    });
    expect((await complete(id)).statusCode).toBe(409);
    expect(xpEventCount()).toBe(0);
    const row = app.db.prepare('SELECT status FROM sessions WHERE id = ?').get(id);
    expect(row).toEqual({ status: 'active' });

    // Unknown / foreign sessions are 404.
    expect((await complete(999999)).statusCode).toBe(404);
    const other = await register('bob');
    const res = await app.inject({
      method: 'POST',
      url: `/api/sessions/${id}/complete`,
      headers: { authorization: `Bearer ${other.token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('complete is idempotent (second call returns same summary, no extra XP)', async () => {
    const { id, question } = await startLesson();
    await answerAll(id, question, () => true);
    const first = await complete(id);
    expect(first.statusCode).toBe(200);
    const xpTotal = (await me()).xpTotal;
    const progress = getSkillProgress(app.db, userId, FIRST_SKILL);

    clock = new Date(T0.getTime() + 60_000);
    const second = await complete(id);
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual(first.json());
    expect(xpEventCount()).toBe(1);
    expect((await me()).xpTotal).toBe(xpTotal);
    expect(getSkillProgress(app.db, userId, FIRST_SKILL)).toEqual(progress);

    // Further answers on a completed session are rejected.
    const again = await app.inject({
      method: 'POST',
      url: `/api/sessions/${id}/answer`,
      headers: auth(),
      payload: { itemId: question.itemId, response: correctResponse(question.itemId), timeMs: 1000 },
    });
    expect(again.statusCode).toBe(409);
  });

  it('half-life and next_due_at updated for practiced skills', async () => {
    // Perfect lesson: accuracy 1 ≥ 0.8 → half-life doubles from 1 to 2 days.
    await playLesson();
    let p = getSkillProgress(app.db, userId, FIRST_SKILL);
    expect(p.halfLifeDays).toBe(2);
    expect(p.lastPracticedAt).toBe(T0.toISOString());
    expect(p.nextDueAt).toBe(new Date(T0.getTime() + 2 * DAY_MS).toISOString());

    // 5/8 correct = 0.625 → half-life kept.
    clock = new Date(T0.getTime() + DAY_MS);
    await playLesson((i) => i < 5);
    p = getSkillProgress(app.db, userId, FIRST_SKILL);
    expect(p.halfLifeDays).toBe(2);
    expect(p.nextDueAt).toBe(new Date(clock.getTime() + 2 * DAY_MS).toISOString());

    // Halving (accuracy < 0.5) can't happen in a non-failed 8-question lesson
    // (5 wrong answers cost all hearts), so check that rule on the engine directly.
    expect(scheduleAfterSession(2, 0.375, clock).halfLifeDays).toBe(1);
  });

  it("xpToday uses the user's timezone", async () => {
    await app.close();
    // 10:50Z on 2026-03-10 is 23:50 on 2026-03-10 in Auckland (NZDT, UTC+13).
    clock = new Date('2026-03-10T10:50:00.000Z');
    app = await buildApp({ dbPath: ':memory:', now: () => clock, rng: mulberry32(11) });
    ({ token, userId } = await register('kiwi', 'Pacific/Auckland'));

    const first = await playLesson();
    expect(first.xpToday).toBe(first.xpEarned);
    const ev1 = app.db.prepare('SELECT local_date FROM xp_events WHERE user_id = ?').get(userId);
    expect(ev1).toEqual({ local_date: '2026-03-10' });
    expect((await me()).xpToday).toBe(first.xpEarned);

    // 20 minutes later it is still 2026-03-10 in UTC, but already 2026-03-11 in Auckland.
    clock = new Date('2026-03-10T11:10:00.000Z');
    expect(localDate(clock, 'UTC')).toBe('2026-03-10');
    expect(localDate(clock, 'Pacific/Auckland')).toBe('2026-03-11');
    expect((await me()).xpToday).toBe(0);

    const second = await playLesson();
    expect(second.xpToday).toBe(second.xpEarned);
    const dates = app.db
      .prepare('SELECT local_date FROM xp_events WHERE user_id = ? ORDER BY id')
      .all(userId)
      .map((r) => (r as { local_date: string }).local_date);
    expect(dates).toEqual(['2026-03-10', '2026-03-11']);
    expect((await me()).xpToday).toBe(second.xpEarned);
  });

  it('dailyGoalMet true once xpToday >= dailyXpGoal', async () => {
    const patch = await app.inject({ method: 'PATCH', url: '/api/me', headers: auth(), payload: { dailyXpGoal: 20 } });
    expect(patch.statusCode).toBe(200);
    expect((await me()).dailyGoalMet).toBe(false);

    // 10 XP (no combo, not perfect): below the goal.
    const a = await playLesson((i) => i !== 3 && i !== 7);
    expect(a.xpEarned).toBe(10);
    expect(a.xpToday).toBe(10);
    expect(a.dailyGoalMet).toBe(false);
    expect((await me()).dailyGoalMet).toBe(false);

    // Another 10 XP: exactly the goal.
    const b = await playLesson((i) => i !== 3 && i !== 7);
    expect(b.xpToday).toBe(20);
    expect(b.dailyGoalMet).toBe(true);
    const stats = await me();
    expect(stats).toMatchObject({ xpToday: 20, dailyXpGoal: 20, dailyGoalMet: true });

    // Raising the goal un-meets it; the next local day starts from zero.
    await app.inject({ method: 'PATCH', url: '/api/me', headers: auth(), payload: { dailyXpGoal: 30 } });
    expect((await me()).dailyGoalMet).toBe(false);
    clock = new Date(T0.getTime() + DAY_MS);
    expect((await me()).xpToday).toBe(0);
  });
});
