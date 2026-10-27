import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.ts';
import { defineGenerator, defineUnit } from '../src/content/authoring.ts';
import { SKILLS } from '../src/content/curriculum.ts';
import { createRegistry, type ContentRegistry } from '../src/content/registry.ts';
import { int, mulberry32 } from '../src/content/rng.ts';
import type { ClientQuestion, StaticQuestion } from '../src/content/types.ts';
import { MAX_HEARTS } from '../src/services/hearts.ts';

const T0 = new Date('2026-03-10T12:00:00.000Z');
const SEC = 1000;
const FIRST_SKILL = SKILLS[0]!;

function staticItems(n: number): StaticQuestion[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${FIRST_SKILL.id}/p-${i}`,
    skillId: FIRST_SKILL.id,
    difficulty: 1 as const,
    kind: 'mcq' as const,
    prompt: `Practice item ${i}`,
    choices: ['a', 'b', 'c'],
    answer: 0,
    explanation: `Because ${i}.`,
  }));
}

/** Static-only content so every question_ref is a distinct static id. */
function staticRegistry(n = 24): ContentRegistry {
  return createRegistry([defineUnit({ unitId: 'fixtures', items: staticItems(n), generators: [] })]);
}

/** Generator-only content: every question is `gen:big-sum` with fresh numbers. */
function generatorRegistry(): ContentRegistry {
  return createRegistry([
    defineUnit({
      unitId: 'fixtures',
      items: [],
      generators: [
        defineGenerator({
          id: 'big-sum',
          skillId: FIRST_SKILL.id,
          difficulties: [1],
          generate(rng, d) {
            const a = int(rng, 100, 99999);
            const b = int(rng, 100, 99999);
            return {
              skillId: FIRST_SKILL.id,
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

interface StartBody {
  session: { id: number; kind: string; skillId: string | null; total: number; status: string; hearts: number };
  question: ClientQuestion;
}

describe('practice + mistakes sessions', () => {
  let app: FastifyInstance;
  let clock: Date;
  let token: string;
  let userId: number;

  async function setup(registry: ContentRegistry): Promise<void> {
    await app?.close();
    clock = T0;
    app = await buildApp({ dbPath: ':memory:', now: () => clock, rng: mulberry32(7), registry });
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'alice', password: 'correct horse' },
    });
    expect(res.statusCode).toBe(201);
    ({ token } = res.json());
    userId = res.json().user.id;
  }

  beforeEach(async () => {
    app = undefined as unknown as FastifyInstance;
    await setup(staticRegistry());
  });

  afterEach(async () => {
    await app.close();
  });

  const auth = () => ({ authorization: `Bearer ${token}` });
  const tick = () => {
    clock = new Date(clock.getTime() + SEC);
  };

  async function start(payload: Record<string, unknown>) {
    return app.inject({ method: 'POST', url: '/api/sessions', headers: auth(), payload });
  }

  async function startOk(payload: Record<string, unknown>): Promise<StartBody> {
    const res = await start(payload);
    expect(res.statusCode).toBe(201);
    return res.json();
  }

  function item(itemId: number): { kind: string; answer: unknown; ref: string; prompt: string } {
    const row = app.db
      .prepare('SELECT client_payload, answer_key, question_ref FROM session_items WHERE id = ?')
      .get(itemId) as { client_payload: string; answer_key: string; question_ref: string };
    const client = JSON.parse(row.client_payload) as { kind: string; prompt: string };
    return {
      kind: client.kind,
      prompt: client.prompt,
      answer: (JSON.parse(row.answer_key) as { answer: unknown }).answer,
      ref: row.question_ref,
    };
  }

  function response(itemId: number, correct: boolean): unknown {
    const { kind, answer } = item(itemId);
    if (kind === 'mcq') return { choice: correct ? answer : ((answer as number) + 1) % 3 };
    if (kind === 'numeric') return { value: correct ? answer : (answer as number) * 10 + 100 };
    throw new Error(`unexpected kind ${kind}`);
  }

  async function answer(sessionId: number, itemId: number, correct: boolean) {
    tick();
    const res = await app.inject({
      method: 'POST',
      url: `/api/sessions/${sessionId}/answer`,
      headers: auth(),
      payload: { itemId, response: response(itemId, correct), timeMs: 3000 },
    });
    expect(res.statusCode).toBe(200);
    return res.json() as { correct: boolean; hearts: number; status: string; next: ClientQuestion | null };
  }

  /** Answer every question; `pattern(i)` says whether answer i (0-based) is correct. Returns refs in order. */
  async function play(body: StartBody, pattern: (i: number) => boolean): Promise<{ refs: string[]; hearts: number[] }> {
    const refs: string[] = [];
    const hearts: number[] = [];
    let q: ClientQuestion | null = body.question;
    for (let i = 0; q; i++) {
      refs.push(item(q.itemId).ref);
      const r = await answer(body.session.id, q.itemId, pattern(i));
      hearts.push(r.hearts);
      q = r.next;
    }
    return { refs, hearts };
  }

  async function complete(sessionId: number) {
    const res = await app.inject({ method: 'POST', url: `/api/sessions/${sessionId}/complete`, headers: auth() });
    expect(res.statusCode).toBe(200);
    return res.json() as { xpEarned: number; perfect: boolean };
  }

  async function heartsNow(): Promise<number> {
    const res = await app.inject({ method: 'GET', url: '/api/me', headers: auth() });
    return res.json().stats.hearts as number;
  }

  async function mistakesList() {
    const res = await app.inject({ method: 'GET', url: '/api/mistakes', headers: auth() });
    expect(res.statusCode).toBe(200);
    return res.json() as {
      count: number;
      items: { questionRef: string; skillId: string; skillTitle: string; lastWrongAt: string }[];
    };
  }

  /** Play a lesson missing the first `misses` questions. Returns the missed refs in order. */
  async function lessonWithMisses(misses: number): Promise<string[]> {
    const body = await startOk({ kind: 'lesson', skillId: FIRST_SKILL.id });
    const { refs } = await play(body, (i) => i >= misses);
    await complete(body.session.id);
    return refs.slice(0, misses);
  }

  it('mistakes session with no mistakes returns 409', async () => {
    expect((await start({ kind: 'mistakes' })).statusCode).toBe(409);
    // Clearing every mistake brings it back to 409.
    await lessonWithMisses(1);
    const m = await startOk({ kind: 'mistakes' });
    await play(m, () => true);
    expect((await start({ kind: 'mistakes' })).statusCode).toBe(409);
  });

  it('mistakes session contains previously missed questions', async () => {
    const missed = await lessonWithMisses(3);
    const body = await startOk({ kind: 'mistakes' });
    expect(body.session).toMatchObject({ kind: 'mistakes', skillId: null, total: 3, status: 'active' });
    const { refs } = await play(body, () => true);
    // Oldest first.
    expect(refs).toEqual(missed);
  });

  it('mistakes session holds at most 8 mistakes, oldest first', async () => {
    const first = await lessonWithMisses(4);
    clock = new Date(clock.getTime() + 2 * 60 * 60 * 1000); // regenerate hearts
    const second = await lessonWithMisses(4);
    clock = new Date(clock.getTime() + 2 * 60 * 60 * 1000);
    const third = await lessonWithMisses(2);
    const all = [...first, ...second, ...third];
    expect(new Set(all).size).toBe(10);
    const body = await startOk({ kind: 'mistakes' });
    expect(body.session.total).toBe(8);
    const { refs } = await play(body, () => true);
    expect(refs).toEqual(all.slice(0, 8));
  });

  it('generated mistake is re-rolled with different numbers', async () => {
    await setup(generatorRegistry());
    const lesson = await startOk({ kind: 'lesson', skillId: FIRST_SKILL.id });
    const original = item(lesson.question.itemId);
    expect(original.ref).toBe('gen:big-sum');
    await answer(lesson.session.id, lesson.question.itemId, false);

    const body = await startOk({ kind: 'mistakes' });
    expect(body.session.total).toBe(1);
    const rerolled = item(body.question.itemId);
    expect(rerolled.ref).toBe('gen:big-sum');
    expect(body.question.prompt).toMatch(/^What is \d+ \+ \d+\?$/);
    expect(body.question.prompt).not.toBe(original.prompt);
    expect(rerolled.answer).not.toBe(original.answer);

    // Answering the re-rolled instance correctly clears the generator mistake.
    await answer(body.session.id, body.question.itemId, true);
    expect((await mistakesList()).count).toBe(0);
  });

  it('correct answer in mistakes session clears the mistake', async () => {
    const missed = await lessonWithMisses(2);
    const body = await startOk({ kind: 'mistakes' });
    const first = await answer(body.session.id, body.question.itemId, true);
    expect(first.correct).toBe(true);

    const row = (ref: string) =>
      app.db.prepare('SELECT cleared_at FROM mistakes WHERE user_id = ? AND question_ref = ?').get(userId, ref) as {
        cleared_at: string | null;
      };
    expect(row(missed[0]!).cleared_at).not.toBeNull();
    expect(row(missed[1]!).cleared_at).toBeNull();

    // A wrong answer in a mistakes session keeps the mistake uncleared.
    await answer(body.session.id, first.next!.itemId, false);
    expect(row(missed[1]!).cleared_at).toBeNull();

    const list = await mistakesList();
    expect(list.items.map((i) => i.questionRef)).toEqual([missed[1]]);
    const stats = app.db.prepare('SELECT mistakes_cleared FROM user_stats WHERE user_id = ?').get(userId) as {
      mistakes_cleared: number;
    };
    expect(stats.mistakes_cleared).toBe(1);
  });

  it('GET /api/mistakes lists uncleared mistakes with skill titles', async () => {
    expect(await mistakesList()).toEqual({ count: 0, items: [] });
    const missed = await lessonWithMisses(3);
    const list = await mistakesList();
    expect(list.count).toBe(3);
    expect(list.items.map((i) => i.questionRef)).toEqual(missed);
    for (const i of list.items) {
      expect(i).toMatchObject({ skillId: FIRST_SKILL.id, skillTitle: FIRST_SKILL.title });
      expect(Date.parse(i.lastWrongAt)).not.toBeNaN();
      expect(i).not.toHaveProperty('answer');
    }
    const unauth = await app.inject({ method: 'GET', url: '/api/mistakes' });
    expect(unauth.statusCode).toBe(401);
  });

  it('completing practice refills one heart', async () => {
    await lessonWithMisses(2);
    expect(await heartsNow()).toBe(MAX_HEARTS - 2);

    const body = await startOk({ kind: 'practice' });
    expect(body.session).toMatchObject({ kind: 'practice', skillId: null, total: 8 });
    await play(body, () => true);
    const summary = await complete(body.session.id);
    expect(summary).toMatchObject({ perfect: true });
    // 10 base + 5 perfect + 2 combo bonus (combo 5).
    expect(summary.xpEarned).toBe(17);
    expect(await heartsNow()).toBe(MAX_HEARTS - 1);

    // Completing a mistakes session refills one too, and hearts cap at MAX_HEARTS.
    const m = await startOk({ kind: 'mistakes' });
    await play(m, () => true);
    const ms = await complete(m.session.id);
    expect(ms.xpEarned).toBe(15);
    expect(await heartsNow()).toBe(MAX_HEARTS);

    const p2 = await startOk({ kind: 'practice' });
    await play(p2, () => true);
    await complete(p2.session.id);
    expect(await heartsNow()).toBe(MAX_HEARTS);

    // Repeating completion is idempotent: no extra heart.
    await lessonWithMisses(1);
    const p3 = await startOk({ kind: 'practice' });
    await play(p3, () => true);
    await complete(p3.session.id);
    expect(await heartsNow()).toBe(MAX_HEARTS);
    await lessonWithMisses(1);
    expect(await heartsNow()).toBe(MAX_HEARTS - 1);
    await complete(p3.session.id);
    expect(await heartsNow()).toBe(MAX_HEARTS - 1);
  });

  it('practice session does not cost hearts', async () => {
    const body = await startOk({ kind: 'practice' });
    expect(body.session.hearts).toBe(MAX_HEARTS);
    const { hearts } = await play(body, () => false);
    expect(hearts).toEqual(Array(8).fill(MAX_HEARTS));
    const state = await app.inject({ method: 'GET', url: `/api/sessions/${body.session.id}`, headers: auth() });
    expect(state.json().session.status).toBe('active');
    const summary = await complete(body.session.id);
    expect(summary).toMatchObject({ xpEarned: 10, perfect: false });
    expect(await heartsNow()).toBe(MAX_HEARTS);

    // Mistakes sessions don't cost hearts either, and practice works at 0 hearts.
    app.db.prepare('UPDATE user_stats SET hearts = 0, hearts_updated_at = ? WHERE user_id = ?').run(
      clock.toISOString(),
      userId,
    );
    const m = await startOk({ kind: 'mistakes' });
    const r = await play(m, () => false);
    expect(r.hearts.every((h) => h === 0)).toBe(true);
    expect((await start({ kind: 'practice' })).statusCode).toBe(201);
  });
});
