import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.ts';
import { defineGenerator, defineUnit } from '../src/content/authoring.ts';
import { SKILLS } from '../src/content/curriculum.ts';
import { createRegistry, type ContentRegistry } from '../src/content/registry.ts';
import { int, mulberry32 } from '../src/content/rng.ts';
import type { ClientQuestion, Difficulty, QuestionKind, StaticQuestion } from '../src/content/types.ts';
import { computeHearts, HEART_REGEN_MS, MAX_HEARTS } from '../src/services/hearts.ts';
import { getSkillProgress } from '../src/services/progress.ts';
import { comboBonusFor, recentStaticIds } from '../src/services/sessions.ts';

const T0 = new Date('2026-03-10T12:00:00.000Z');
const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const FIRST_SKILL = SKILLS[0]!.id;
const SECOND_SKILL = SKILLS[1]!.id;

// ---------------------------------------------------------------------------
// Inline content: enough first-skill items for several 8-question lessons,
// covering all five question kinds plus a generator.
// ---------------------------------------------------------------------------

function staticItem(i: number, difficulty: Difficulty): StaticQuestion {
  const base = {
    id: `${FIRST_SKILL}/test-${i}`,
    skillId: FIRST_SKILL,
    difficulty,
    explanation: `Explanation number ${i} for the test item.`,
  };
  switch (i % 5) {
    case 0:
      return { ...base, kind: 'mcq', prompt: `Q${i}: pick 1/s`, choices: ['1/s', '1', 's', '1/s²'], answer: 0 };
    case 1:
      return { ...base, kind: 'true_false', prompt: `Q${i}: L{δ(t)} = 1?`, answer: true };
    case 2:
      return { ...base, kind: 'numeric', prompt: `Q${i}: 2 + ${i}?`, answer: 2 + i, tolerance: {}, unit: 'rad/s' };
    case 3:
      return {
        ...base,
        kind: 'multi_select',
        prompt: `Q${i}: pick the linear ones`,
        choices: ['a', 'b', 'c', 'd'],
        answer: [1, 3],
      };
    default:
      return {
        ...base,
        kind: 'match',
        prompt: `Q${i}: match transforms`,
        left: ['u(t)', 'δ(t)', 't'],
        right: ['1/s', '1', '1/s²'],
        answer: [0, 1, 2],
      };
  }
}

function lessonRegistry(): ContentRegistry {
  const items: StaticQuestion[] = [];
  for (let i = 0; i < 12; i++) items.push(staticItem(i, 1));
  for (let i = 12; i < 16; i++) items.push(staticItem(i, 2));
  for (let i = 16; i < 18; i++) items.push(staticItem(i, 3));
  return createRegistry([
    defineUnit({
      unitId: 'fixtures',
      items,
      generators: [
        defineGenerator({
          id: 'test-sum',
          skillId: FIRST_SKILL,
          difficulties: [1, 2],
          generate(rng, d) {
            const a = int(rng, 2, 9);
            const b = int(rng, 2, 9);
            return {
              skillId: FIRST_SKILL,
              difficulty: d,
              kind: 'numeric',
              prompt: `What is ${a} + ${b}?`,
              answer: a + b,
              tolerance: {},
              explanation: `Add them: ${a + b}.`,
            };
          },
        }),
      ],
    }),
  ]);
}

/** 16 static d1 mcq items and no generators, so recently-seen exclusion is observable. */
function staticOnlyRegistry(): ContentRegistry {
  const items: StaticQuestion[] = [];
  for (let i = 0; i < 16; i++) {
    items.push({
      id: `${FIRST_SKILL}/only-${i}`,
      skillId: FIRST_SKILL,
      difficulty: 1,
      kind: 'mcq',
      prompt: `Only ${i}`,
      choices: ['x', 'y', 'z'],
      answer: 0,
      explanation: 'Because.',
    });
  }
  return createRegistry([defineUnit({ unitId: 'fixtures', items, generators: [] })]);
}

// ---------------------------------------------------------------------------

interface SessionView {
  id: number;
  kind: string;
  skillId: string | null;
  total: number;
  status: string;
  hearts: number;
}

describe('sessions', () => {
  let app: FastifyInstance;
  let clock: Date;
  let token: string;
  let userId: number;

  async function setup(registry: ContentRegistry = lessonRegistry()): Promise<void> {
    clock = T0;
    app = await buildApp({ dbPath: ':memory:', now: () => clock, rng: mulberry32(42), registry });
    ({ token, userId } = await register('alice'));
  }

  beforeEach(async () => {
    await setup();
  });

  afterEach(async () => {
    await app.close();
  });

  async function register(username: string): Promise<{ token: string; userId: number }> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username, password: 'correct horse' },
    });
    expect(res.statusCode).toBe(201);
    return { token: res.json().token, userId: res.json().user.id };
  }

  const auth = (t = token) => ({ authorization: `Bearer ${t}` });

  async function startLesson(skillId = FIRST_SKILL, t = token) {
    return app.inject({ method: 'POST', url: '/api/sessions', headers: auth(t), payload: { kind: 'lesson', skillId } });
  }

  async function startOk(): Promise<{ session: SessionView; question: ClientQuestion }> {
    const res = await startLesson();
    expect(res.statusCode).toBe(201);
    return res.json();
  }

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
        return { choice: ((key.answer as number) + 1) % 3 };
      case 'true_false':
        return { value: !key.answer };
      case 'numeric':
        return { value: (key.answer as number) * 10 + 100 };
      case 'multi_select':
        return { choices: [] };
      case 'match': {
        const a = key.answer as number[];
        return { pairs: a.map((_, i) => a[(i + 1) % a.length]) };
      }
    }
  }

  async function answer(sessionId: number, itemId: number, response: unknown, t = token) {
    return app.inject({
      method: 'POST',
      url: `/api/sessions/${sessionId}/answer`,
      headers: auth(t),
      payload: { itemId, response, timeMs: 4200 },
    });
  }

  async function getSession(sessionId: number, t = token) {
    return app.inject({ method: 'GET', url: `/api/sessions/${sessionId}`, headers: auth(t) });
  }

  async function me() {
    const res = await app.inject({ method: 'GET', url: '/api/me', headers: auth() });
    return res.json().stats as { hearts: number; nextHeartAt: string | null };
  }

  /** Answer wrong until the lesson fails. Returns the session id. */
  async function failLesson(): Promise<number> {
    const { session, question } = await startOk();
    let q: ClientQuestion | null = question;
    for (let i = 0; i < MAX_HEARTS; i++) {
      const res = await answer(session.id, q!.itemId, wrongResponse(q!.itemId));
      expect(res.statusCode).toBe(200);
      q = res.json().next;
    }
    return session.id;
  }

  it('starting a lesson returns 8-question session and a ClientQuestion without answer', async () => {
    const { session, question } = await startOk();
    expect(session).toMatchObject({ kind: 'lesson', skillId: FIRST_SKILL, total: 8, status: 'active', hearts: 5 });
    expect(question).toMatchObject({ position: 1, total: 8, skillId: FIRST_SKILL });
    expect(typeof question.itemId).toBe('number');
    expect(typeof question.prompt).toBe('string');
    expect(question).not.toHaveProperty('answer');
    expect(question).not.toHaveProperty('tolerance');
    expect(question).not.toHaveProperty('explanation');
    const n = app.db.prepare('SELECT COUNT(*) AS n FROM session_items WHERE session_id = ?').get(session.id) as {
      n: number;
    };
    expect(Number(n.n)).toBe(8);
  });

  it('no session_items client_payload contains the answer key', async () => {
    for (let i = 0; i < 3; i++) await startOk();
    const rows = app.db.prepare('SELECT client_payload, answer_key, explanation FROM session_items').all() as {
      client_payload: string;
      answer_key: string;
      explanation: string;
    }[];
    expect(rows.length).toBe(24);
    const kinds = new Set<string>();
    for (const r of rows) {
      const payload = JSON.parse(r.client_payload) as Record<string, unknown>;
      kinds.add(payload.kind as string);
      for (const forbidden of ['answer', 'tolerance', 'explanation', 'answerKey', 'answer_key']) {
        expect(payload).not.toHaveProperty(forbidden);
      }
      expect(r.client_payload).not.toContain(r.explanation);
      expect(JSON.parse(r.answer_key)).toHaveProperty('answer');
    }
    expect(kinds.size).toBeGreaterThanOrEqual(3);
  });

  it('locked skill returns 403, unknown skill 404', async () => {
    expect((await startLesson(SECOND_SKILL)).statusCode).toBe(403);
    expect((await startLesson('no-such-skill')).statusCode).toBe(404);
    const bad = await app.inject({ method: 'POST', url: '/api/sessions', headers: auth(), payload: { kind: 'nope' } });
    expect(bad.statusCode).toBe(400);
    const practice = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: auth(),
      payload: { kind: 'practice' },
    });
    expect(practice.statusCode).toBe(201);
    const unauth = await app.inject({ method: 'POST', url: '/api/sessions', payload: { kind: 'lesson' } });
    expect(unauth.statusCode).toBe(401);
  });

  it('correct answer returns correct:true, explanation, combo 1', async () => {
    const { session, question } = await startOk();
    const res = await answer(session.id, question.itemId, correctResponse(question.itemId));
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ correct: true, combo: 1, hearts: 5, comboBonusXp: 0, status: 'active' });
    expect(body.explanation.length).toBeGreaterThan(0);
    expect(typeof body.correctAnswerText).toBe('string');
    expect(body.correctAnswer).toEqual(itemRow(question.itemId).key.answer);
    expect(body.next).toMatchObject({ position: 2, total: 8 });

    const stats = app.db
      .prepare('SELECT answered_total, correct_total FROM user_stats WHERE user_id = ?')
      .get(userId) as { answered_total: number; correct_total: number };
    expect(stats).toEqual({ answered_total: 1, correct_total: 1 });
    const s = app.db.prepare('SELECT combo, max_combo FROM sessions WHERE id = ?').get(session.id) as {
      combo: number;
      max_combo: number;
    };
    expect(s).toEqual({ combo: 1, max_combo: 1 });
  });

  it('combo bonus is +2 XP at every multiple of 5', () => {
    expect([1, 4, 5, 6, 10, 15].map(comboBonusFor)).toEqual([0, 0, 2, 0, 2, 2]);
  });

  it('wrong answer in lesson costs a heart and records a mistake', async () => {
    const { session, question } = await startOk();
    // Build a combo first so we can see it reset.
    const r1 = await answer(session.id, question.itemId, correctResponse(question.itemId));
    const q2 = r1.json().next as ClientQuestion;
    const res = await answer(session.id, q2.itemId, wrongResponse(q2.itemId));
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ correct: false, combo: 0, hearts: 4, status: 'active' });
    expect((await me()).hearts).toBe(4);

    const ref = app.db.prepare('SELECT question_ref FROM session_items WHERE id = ?').get(q2.itemId) as {
      question_ref: string;
    };
    const mistake = app.db
      .prepare('SELECT skill_id, wrong_count, cleared_at FROM mistakes WHERE user_id = ? AND question_ref = ?')
      .get(userId, ref.question_ref) as { skill_id: string; wrong_count: number; cleared_at: string | null };
    expect(mistake).toEqual({ skill_id: FIRST_SKILL, wrong_count: 1, cleared_at: null });

    const s = app.db.prepare('SELECT combo, max_combo, hearts_lost FROM sessions WHERE id = ?').get(session.id) as {
      combo: number;
      max_combo: number;
      hearts_lost: number;
    };
    expect(s).toEqual({ combo: 0, max_combo: 1, hearts_lost: 1 });
    const stats = app.db
      .prepare('SELECT answered_total, correct_total FROM user_stats WHERE user_id = ?')
      .get(userId) as { answered_total: number; correct_total: number };
    expect(stats).toEqual({ answered_total: 2, correct_total: 1 });
  });

  it('losing 5 hearts fails the lesson and further answers return 409', async () => {
    const { session, question } = await startOk();
    let q: ClientQuestion | null = question;
    let last: Record<string, unknown> = {};
    for (let i = 0; i < 5; i++) {
      const res = await answer(session.id, q!.itemId, wrongResponse(q!.itemId));
      expect(res.statusCode).toBe(200);
      last = res.json();
      expect(last.hearts).toBe(4 - i);
      q = last.next as ClientQuestion | null;
    }
    expect(last).toMatchObject({ status: 'failed', hearts: 0, next: null });

    const sixth = app.db
      .prepare('SELECT id FROM session_items WHERE session_id = ? AND position = 6')
      .get(session.id) as { id: number };
    const res = await answer(session.id, sixth.id, { choice: 0 });
    expect(res.statusCode).toBe(409);

    const state = (await getSession(session.id)).json();
    expect(state.session.status).toBe('failed');
    expect(state.question).toBeNull();
    expect(state.answered).toBe(5);
  });

  it('cannot start a lesson with 0 hearts (409)', async () => {
    await failLesson();
    const res = await startLesson();
    expect(res.statusCode).toBe(409);
  });

  it('hearts regenerate one per 30 minutes using injected clock', async () => {
    await failLesson(); // hearts 0, regen anchor at T0
    expect((await me()).hearts).toBe(0);

    clock = new Date(T0.getTime() + 29 * MIN);
    expect((await me()).hearts).toBe(0);
    expect((await startLesson()).statusCode).toBe(409);

    clock = new Date(T0.getTime() + 30 * MIN);
    let stats = await me();
    expect(stats.hearts).toBe(1);
    expect(stats.nextHeartAt).toBe(new Date(T0.getTime() + 60 * MIN).toISOString());

    // Starting a lesson at +45 min materializes regen but keeps the partial progress.
    clock = new Date(T0.getTime() + 45 * MIN);
    expect((await startLesson()).statusCode).toBe(201);
    clock = new Date(T0.getTime() + 60 * MIN);
    expect((await me()).hearts).toBe(2);

    clock = new Date(T0.getTime() + 10 * 60 * MIN);
    stats = await me();
    expect(stats.hearts).toBe(MAX_HEARTS);
    expect(stats.nextHeartAt).toBeNull();
  });

  it('computeHearts caps at max and starts the clock when unanchored', () => {
    const now = new Date(T0.getTime() + 3 * HEART_REGEN_MS + 5 * MIN);
    expect(computeHearts(1, T0.toISOString(), now).hearts).toBe(4);
    expect(computeHearts(1, T0.toISOString(), now).anchor).toBe(
      new Date(T0.getTime() + 3 * HEART_REGEN_MS).toISOString(),
    );
    expect(computeHearts(4, T0.toISOString(), now)).toMatchObject({ hearts: 5, nextHeartAt: null });
    expect(computeHearts(2, null, T0).hearts).toBe(2);
  });

  it('answering same item twice returns 409', async () => {
    const { session, question } = await startOk();
    expect((await answer(session.id, question.itemId, correctResponse(question.itemId))).statusCode).toBe(200);
    expect((await answer(session.id, question.itemId, correctResponse(question.itemId))).statusCode).toBe(409);
  });

  it('answering out of order or with a foreign item returns 409', async () => {
    const { session } = await startOk();
    const other = await startOk();
    const third = app.db
      .prepare('SELECT id FROM session_items WHERE session_id = ? AND position = 3')
      .get(session.id) as { id: number };
    expect((await answer(session.id, third.id, correctResponse(third.id))).statusCode).toBe(409);
    const foreign = other.question.itemId;
    expect((await answer(session.id, foreign, correctResponse(foreign))).statusCode).toBe(409);
  });

  it('invalid response shapes return 400', async () => {
    const { session, question } = await startOk();
    const kind = itemRow(question.itemId).kind;
    const bad = kind === 'true_false' ? { value: 'yes' } : { nonsense: true };
    expect((await answer(session.id, question.itemId, bad)).statusCode).toBe(400);
    expect((await answer(session.id, question.itemId, 'string')).statusCode).toBe(400);
    const noItem = await app.inject({
      method: 'POST',
      url: `/api/sessions/${session.id}/answer`,
      headers: auth(),
      payload: { response: correctResponse(question.itemId) },
    });
    expect(noItem.statusCode).toBe(400);
    // Nothing was recorded, so the question is still answerable.
    expect((await answer(session.id, question.itemId, correctResponse(question.itemId))).statusCode).toBe(200);
  });

  it("other user's session returns 404", async () => {
    const { session, question } = await startOk();
    const bob = await register('bob');
    expect((await getSession(session.id, bob.token)).statusCode).toBe(404);
    expect((await answer(session.id, question.itemId, correctResponse(question.itemId), bob.token)).statusCode).toBe(
      404,
    );
    expect((await getSession(999999)).statusCode).toBe(404);
    expect((await getSession(Number.NaN)).statusCode).toBe(404);
  });

  it('ability for the skill changes after answering', async () => {
    expect(getSkillProgress(app.db, userId, FIRST_SKILL)).toMatchObject({ ability: 0, attempts: 0, correct: 0 });
    const { session, question } = await startOk();
    const r1 = await answer(session.id, question.itemId, correctResponse(question.itemId));
    const p1 = getSkillProgress(app.db, userId, FIRST_SKILL);
    expect(p1.ability).toBeGreaterThan(0);
    expect(p1).toMatchObject({ attempts: 1, correct: 1 });

    const q2 = r1.json().next as ClientQuestion;
    await answer(session.id, q2.itemId, wrongResponse(q2.itemId));
    const p2 = getSkillProgress(app.db, userId, FIRST_SKILL);
    expect(p2.ability).toBeLessThan(p1.ability);
    expect(p2).toMatchObject({ attempts: 2, correct: 1 });
  });

  it('GET /api/sessions/:id resumes at the next unanswered question', async () => {
    const { session, question } = await startOk();
    const fresh = (await getSession(session.id)).json();
    expect(fresh.answered).toBe(0);
    expect(fresh.question).toEqual(question);

    const r1 = await answer(session.id, question.itemId, correctResponse(question.itemId));
    const q2 = r1.json().next as ClientQuestion;
    await answer(session.id, q2.itemId, wrongResponse(q2.itemId));

    const res = await getSession(session.id);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.answered).toBe(2);
    expect(body.session).toMatchObject({ id: session.id, status: 'active', total: 8, hearts: 4 });
    const third = app.db
      .prepare('SELECT id FROM session_items WHERE session_id = ? AND position = 3')
      .get(session.id) as { id: number };
    expect(body.question).toMatchObject({ itemId: third.id, position: 3, total: 8 });
    expect(body.question).not.toHaveProperty('answer');
  });

  it('answering every question makes the session ready', async () => {
    const { session, question } = await startOk();
    let q: ClientQuestion | null = question;
    let last: Record<string, unknown> = {};
    let bonus = 0;
    while (q) {
      const res = await answer(session.id, q.itemId, correctResponse(q.itemId));
      expect(res.statusCode).toBe(200);
      last = res.json();
      bonus += last.comboBonusXp as number;
      q = last.next as ClientQuestion | null;
    }
    expect(last).toMatchObject({ status: 'ready', combo: 8, next: null });
    expect(bonus).toBe(2);
    const state = (await getSession(session.id)).json();
    expect(state).toMatchObject({ answered: 8, question: null });
  });

  it('correct answer in a mistakes session clears the mistake', async () => {
    // Mistakes sessions are started by task 14; exercise the answer path directly.
    const { session, question } = await startOk();
    await answer(session.id, question.itemId, wrongResponse(question.itemId));
    const ref = (
      app.db.prepare('SELECT question_ref FROM session_items WHERE id = ?').get(question.itemId) as {
        question_ref: string;
      }
    ).question_ref;
    app.db.prepare("UPDATE sessions SET kind = 'mistakes' WHERE id = ?").run(session.id);
    const second = (await getSession(session.id)).json().question as ClientQuestion;
    app.db.prepare('UPDATE session_items SET question_ref = ? WHERE id = ?').run(ref, second.itemId);

    const res = await answer(session.id, second.itemId, correctResponse(second.itemId));
    expect(res.json()).toMatchObject({ correct: true, hearts: 4 });
    const m = app.db.prepare('SELECT cleared_at FROM mistakes WHERE user_id = ? AND question_ref = ?').get(userId, ref) as {
      cleared_at: string | null;
    };
    expect(m.cleared_at).toBe(T0.toISOString());
    const stats = app.db.prepare('SELECT mistakes_cleared FROM user_stats WHERE user_id = ?').get(userId) as {
      mistakes_cleared: number;
    };
    expect(stats.mistakes_cleared).toBe(1);
  });

  describe('recently seen static items', () => {
    beforeEach(async () => {
      await app.close();
      await setup(staticOnlyRegistry());
    });

    it('are excluded from the next lesson for 3 days', async () => {
      const first = await startOk();
      let q: ClientQuestion | null = first.question;
      while (q) {
        const res = await answer(first.session.id, q.itemId, correctResponse(q.itemId));
        q = res.json().next;
      }
      const refsOf = (sessionId: number) =>
        (
          app.db.prepare('SELECT question_ref FROM session_items WHERE session_id = ?').all(sessionId) as {
            question_ref: string;
          }[]
        ).map((r) => r.question_ref);
      const seen = new Set(refsOf(first.session.id));
      expect(seen.size).toBe(8);
      expect(recentStaticIds(app.db, userId, clock)).toEqual(seen);

      const second = await startOk();
      expect(refsOf(second.session.id).filter((r) => seen.has(r))).toEqual([]);

      clock = new Date(T0.getTime() + 3 * DAY + MIN);
      expect(recentStaticIds(app.db, userId, clock).size).toBe(0);
    });
  });
});
