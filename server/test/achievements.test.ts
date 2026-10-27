import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.ts';
import { ACHIEVEMENTS } from '../src/content/achievements.ts';
import { defineUnit } from '../src/content/authoring.ts';
import { SKILLS } from '../src/content/curriculum.ts';
import { createRegistry, type ContentRegistry } from '../src/content/registry.ts';
import { mulberry32 } from '../src/content/rng.ts';
import type { ClientQuestion, StaticQuestion } from '../src/content/types.ts';
import { achievementStats } from '../src/services/achievements.ts';

const T0 = new Date('2026-03-10T12:00:00.000Z');
const SEC = 1000;
const FIRST_SKILL = SKILLS[0]!;

/** Static mcq items (answer index stored in display order) for the first skill. */
function staticRegistry(n = 40): ContentRegistry {
  const items: StaticQuestion[] = Array.from({ length: n }, (_, i) => ({
    id: `${FIRST_SKILL.id}/a-${i}`,
    skillId: FIRST_SKILL.id,
    difficulty: 1 as const,
    kind: 'mcq' as const,
    prompt: `Achievement item ${i}`,
    choices: ['a', 'b', 'c'],
    answer: 0,
    explanation: `Because ${i}.`,
  }));
  return createRegistry([defineUnit({ unitId: 'fixtures', items, generators: [] })]);
}

interface StartBody {
  session: { id: number; kind: string; total: number };
  question: ClientQuestion;
}

interface AchievementView {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt: string | null;
  progress: { current: number; target: number };
}

interface Summary {
  perfect: boolean;
  newAchievements: { id: string; title: string }[];
}

describe('achievements', () => {
  let app: FastifyInstance;
  let clock: Date;
  let token: string;
  let userId: number;

  beforeEach(async () => {
    clock = T0;
    app = await buildApp({ dbPath: ':memory:', now: () => clock, rng: mulberry32(11), registry: staticRegistry() });
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'alice', password: 'correct horse' },
    });
    expect(res.statusCode).toBe(201);
    token = res.json().token;
    userId = res.json().user.id;
  });

  afterEach(async () => {
    await app.close();
  });

  const auth = () => ({ authorization: `Bearer ${token}` });

  function response(itemId: number, correct: boolean): unknown {
    const row = app.db.prepare('SELECT answer_key FROM session_items WHERE id = ?').get(itemId) as {
      answer_key: string;
    };
    const answer = (JSON.parse(row.answer_key) as { answer: number }).answer;
    return { choice: correct ? answer : (answer + 1) % 3 };
  }

  async function play(url: string, payload: Record<string, unknown> | undefined, pattern: (i: number) => boolean) {
    const start = await app.inject({ method: 'POST', url, headers: auth(), ...(payload ? { payload } : {}) });
    expect(start.statusCode).toBe(201);
    const body = start.json() as StartBody;
    let q: ClientQuestion | null = body.question;
    for (let i = 0; q; i++) {
      clock = new Date(clock.getTime() + SEC);
      const res: { statusCode: number; json: () => unknown } = await app.inject({
        method: 'POST',
        url: `/api/sessions/${body.session.id}/answer`,
        headers: auth(),
        payload: { itemId: q.itemId, response: response(q.itemId, pattern(i)), timeMs: 2000 },
      });
      expect(res.statusCode).toBe(200);
      q = (res.json() as { next: ClientQuestion | null }).next;
    }
    const done = await app.inject({ method: 'POST', url: `/api/sessions/${body.session.id}/complete`, headers: auth() });
    expect(done.statusCode).toBe(200);
    return { sessionId: body.session.id, summary: done.json() as Summary };
  }

  const lesson = (pattern: (i: number) => boolean) => play('/api/sessions', { kind: 'lesson', skillId: FIRST_SKILL.id }, pattern);

  async function list(): Promise<AchievementView[]> {
    const res = await app.inject({ method: 'GET', url: '/api/achievements', headers: auth() });
    expect(res.statusCode).toBe(200);
    return (res.json() as { achievements: AchievementView[] }).achievements;
  }

  const byId = async (id: string) => (await list()).find((a) => a.id === id)!;

  it('GET /api/achievements returns all 14 with progress', async () => {
    const all = await list();
    expect(all).toHaveLength(14);
    expect(all.map((a) => a.id)).toEqual([
      'first-steps',
      'streak-3',
      'streak-7',
      'streak-30',
      'perfectionist',
      'combo-10',
      'sharpshooter',
      'xp-500',
      'xp-2000',
      'stable-genius',
      'bode-boss',
      'full-state',
      'mistake-mender',
      'legendary',
    ]);
    for (const a of all) {
      expect(a.title.length).toBeGreaterThan(0);
      expect(a.description.length).toBeGreaterThan(0);
      expect(a.icon.length).toBeGreaterThan(0);
      expect(a).toMatchObject({ unlocked: false, unlockedAt: null });
      expect(a.progress.current).toBe(0);
      expect(a.progress.target).toBeGreaterThan(0);
    }
    const targets = Object.fromEntries(all.map((a) => [a.id, a.progress.target]));
    expect(targets).toMatchObject({
      'first-steps': 1,
      'streak-3': 3,
      'streak-30': 30,
      perfectionist: 1,
      'combo-10': 10,
      sharpshooter: 100,
      'xp-500': 500,
      'xp-2000': 2000,
      'stable-genius': 2,
      'bode-boss': 3,
      'full-state': 3,
      'mistake-mender': 10,
      legendary: 5,
    });

    // Progress tracks stats and is clamped to the target.
    app.db
      .prepare('UPDATE user_stats SET correct_total = 42, xp_total = 900, mistakes_cleared = 3 WHERE user_id = ?')
      .run(userId);
    app.db
      .prepare("INSERT INTO skill_progress (user_id, skill_id, level) VALUES (?, 'bode-plots', 2), (?, 'routh-hurwitz', 1)")
      .run(userId, userId);
    const p = Object.fromEntries((await list()).map((a) => [a.id, a.progress]));
    expect(p.sharpshooter).toEqual({ current: 42, target: 100 });
    expect(p['xp-500']).toEqual({ current: 500, target: 500 });
    expect(p['xp-2000']).toEqual({ current: 900, target: 2000 });
    expect(p['mistake-mender']).toEqual({ current: 3, target: 10 });
    expect(p['bode-boss']).toEqual({ current: 2, target: 3 });
    expect(p['stable-genius']).toEqual({ current: 1, target: 2 });
    expect(p.legendary).toEqual({ current: 2, target: 5 });

    expect((await app.inject({ method: 'GET', url: '/api/achievements' })).statusCode).toBe(401);
  });

  it('first lesson completion unlocks first-steps and returns it in newAchievements', async () => {
    // One miss: not perfect, so only first-steps unlocks.
    const { summary } = await lesson((i) => i !== 0);
    expect(summary.perfect).toBe(false);
    expect(summary.newAchievements).toEqual([{ id: 'first-steps', title: 'First Steps' }]);

    const a = await byId('first-steps');
    expect(a.unlocked).toBe(true);
    expect(a.unlockedAt).toBe(clock.toISOString());
    expect(a.progress).toEqual({ current: 1, target: 1 });
    expect((await byId('perfectionist')).unlocked).toBe(false);
  });

  it('perfect lesson unlocks perfectionist', async () => {
    await lesson((i) => i !== 3);
    expect((await byId('perfectionist')).progress).toEqual({ current: 0, target: 1 });

    const { summary } = await lesson(() => true);
    expect(summary.perfect).toBe(true);
    expect(summary.newAchievements).toEqual([{ id: 'perfectionist', title: 'Perfectionist' }]);
    expect(await byId('perfectionist')).toMatchObject({ unlocked: true, progress: { current: 1, target: 1 } });
    expect(achievementStats(app.db, userId).perfectLessons).toBe(1);
  });

  it('achievements are only unlocked once', async () => {
    const first = await lesson(() => true);
    expect(first.summary.newAchievements.map((a) => a.id)).toEqual(['first-steps', 'perfectionist']);

    // Repeating completion returns the stored summary; no duplicate rows.
    const again = await app.inject({ method: 'POST', url: `/api/sessions/${first.sessionId}/complete`, headers: auth() });
    expect(again.json().newAchievements).toEqual(first.summary.newAchievements);

    const second = await lesson(() => true);
    expect(second.summary.newAchievements).toEqual([]);

    const rows = app.db
      .prepare('SELECT achievement_id, unlocked_at FROM user_achievements WHERE user_id = ? ORDER BY achievement_id')
      .all(userId);
    expect(rows).toEqual([
      { achievement_id: 'first-steps', unlocked_at: expect.any(String) },
      { achievement_id: 'perfectionist', unlocked_at: expect.any(String) },
    ]);
    const unlockedAt = (await byId('first-steps')).unlockedAt;
    expect(Date.parse(unlockedAt!)).toBeLessThan(clock.getTime());
  });

  it('streak-7 progress reports {current, target: 7}', async () => {
    expect((await byId('streak-7')).progress).toEqual({ current: 0, target: 7 });

    // Completing a daily challenge starts the streak.
    const { summary } = await play('/api/daily/start', undefined, () => true);
    expect(summary.newAchievements.map((a) => a.id)).not.toContain('streak-3');
    expect((await byId('streak-7')).progress).toEqual({ current: 1, target: 7 });

    app.db.prepare('UPDATE user_stats SET streak_current = 4, streak_longest = 4 WHERE user_id = ?').run(userId);
    expect((await byId('streak-7')).progress).toEqual({ current: 4, target: 7 });
    expect((await byId('streak-3')).progress).toEqual({ current: 3, target: 3 });

    // Reaching 7 on the next daily unlocks streak-3 and streak-7 together.
    app.db.prepare('UPDATE user_stats SET streak_current = 6, streak_longest = 6 WHERE user_id = ?').run(userId);
    clock = new Date(clock.getTime() + 24 * 60 * 60 * SEC);
    const next = await play('/api/daily/start', undefined, () => true);
    expect(next.summary.newAchievements.map((a) => a.id)).toEqual(['streak-3', 'streak-7']);
    expect(await byId('streak-7')).toMatchObject({ unlocked: true, progress: { current: 7, target: 7 } });
    expect(ACHIEVEMENTS.find((a) => a.id === 'streak-30')!.progress(achievementStats(app.db, userId))).toEqual({
      current: 7,
      target: 30,
    });
  });
});
