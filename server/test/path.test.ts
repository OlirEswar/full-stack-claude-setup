import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.ts';
import { SKILLS, UNITS } from '../src/content/curriculum.ts';
import {
  getAllSkillProgress,
  getSkillProgress,
  isSkillUnlockedForUser,
  upsertSkillProgress,
} from '../src/services/progress.ts';

const T0 = new Date('2026-03-10T12:00:00.000Z');
const HOUR = 60 * 60 * 1000;

interface PathSkill {
  id: string;
  title: string;
  level: number;
  maxLevel: number;
  lessonsInLevel: number;
  lessonsPerLevel: number;
  unlocked: boolean;
  started: boolean;
  due: boolean;
  strength: number;
}
interface PathBody {
  units: { id: string; title: string; description: string; skills: PathSkill[] }[];
}

describe('path', () => {
  let app: FastifyInstance;
  let clock: Date;
  let token: string;
  let userId: number;

  beforeEach(async () => {
    clock = T0;
    app = await buildApp({ dbPath: ':memory:', now: () => clock });
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

  async function getPath(): Promise<PathBody> {
    const res = await app.inject({ method: 'GET', url: '/api/path', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    return res.json() as PathBody;
  }

  function flat(body: PathBody): PathSkill[] {
    return body.units.flatMap((u) => u.skills);
  }

  function seed(skillId: string, cols: Record<string, unknown>): void {
    const keys = Object.keys(cols);
    app.db
      .prepare(
        `INSERT INTO skill_progress (user_id, skill_id, ${keys.join(', ')}) VALUES (?, ?, ${keys.map(() => '?').join(', ')})`,
      )
      .run(userId, skillId, ...(Object.values(cols) as (string | number | null)[]));
  }

  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/path' });
    expect(res.statusCode).toBe(401);
  });

  it('path returns 11 units with skills in curriculum order', async () => {
    const body = await getPath();
    expect(body.units).toHaveLength(11);
    expect(body.units.map((u) => u.id)).toEqual(UNITS.map((u) => u.id));
    for (const [i, u] of body.units.entries()) {
      expect(u.title).toBe(UNITS[i]!.title);
      expect(u.description).toBe(UNITS[i]!.description);
    }
    const skills = flat(body);
    expect(skills).toHaveLength(20);
    expect(skills.map((s) => s.id)).toEqual(SKILLS.map((s) => s.id));
    expect(skills[0]).toEqual({
      id: 'laplace-basics',
      title: 'Laplace basics',
      level: 0,
      maxLevel: 5,
      lessonsInLevel: 0,
      lessonsPerLevel: 3,
      unlocked: true,
      started: false,
      due: false,
      strength: 0,
    });
  });

  it('new user sees only first skill unlocked', async () => {
    const skills = flat(await getPath());
    expect(skills.filter((s) => s.unlocked).map((s) => s.id)).toEqual(['laplace-basics']);
    expect(skills.every((s) => !s.started && !s.due && s.level === 0)).toBe(true);
  });

  it('skill 2 unlocks when skill 1 reaches level 1', async () => {
    seed('laplace-basics', { attempts: 8, correct: 6, level: 0, lessons_in_level: 2 });
    let skills = flat(await getPath());
    expect(skills.filter((s) => s.unlocked).map((s) => s.id)).toEqual(['laplace-basics']);
    expect(skills[0]).toMatchObject({ level: 0, lessonsInLevel: 2, started: true });

    app.db
      .prepare('UPDATE skill_progress SET level = 1, lessons_in_level = 0 WHERE user_id = ? AND skill_id = ?')
      .run(userId, 'laplace-basics');
    skills = flat(await getPath());
    expect(skills.filter((s) => s.unlocked).map((s) => s.id)).toEqual(['laplace-basics', 'transfer-functions']);
    expect(skills[0]).toMatchObject({ level: 1, lessonsInLevel: 0 });

    // Unlocking crosses unit boundaries: last U1 skill at level 1 unlocks U2's first skill.
    seed('poles-zeros', { attempts: 5, level: 1 });
    skills = flat(await getPath());
    expect(skills.find((s) => s.id === 'block-diagrams')!.unlocked).toBe(true);
    expect(skills.find((s) => s.id === 'poles-zeros')!.unlocked).toBe(false); // transfer-functions still level 0
  });

  it('due flag reflects next_due_at vs injected now', async () => {
    const last = new Date(T0.getTime() - 12 * HOUR).toISOString();
    const due = new Date(T0.getTime() + 12 * HOUR).toISOString();
    seed('laplace-basics', { attempts: 8, level: 1, half_life_days: 1, last_practiced_at: last, next_due_at: due });
    // Started-but-never-scheduled skills count as due; unstarted ones never are.
    seed('transfer-functions', { attempts: 0, next_due_at: new Date(T0.getTime() - HOUR).toISOString() });

    let skills = flat(await getPath());
    expect(skills[0]!.due).toBe(false);
    expect(skills[0]!.strength).toBeCloseTo(Math.SQRT1_2, 10); // 12 h into a 1-day half-life
    expect(skills[1]!.due).toBe(false);

    clock = new Date(T0.getTime() + 12 * HOUR - 1);
    expect(flat(await getPath())[0]!.due).toBe(false);

    clock = new Date(T0.getTime() + 12 * HOUR);
    skills = flat(await getPath());
    expect(skills[0]!.due).toBe(true);
    expect(skills[0]!.strength).toBeCloseTo(0.5, 10);
  });

  it('progress service upserts and reads back rows', () => {
    expect(getSkillProgress(app.db, userId, 'first-order')).toMatchObject({ attempts: 0, level: 0, halfLifeDays: 1 });
    expect(getAllSkillProgress(app.db, userId).size).toBe(0);

    upsertSkillProgress(app.db, userId, 'laplace-basics', { attempts: 3, correct: 2, ability: 0.4 });
    const updated = upsertSkillProgress(app.db, userId, 'laplace-basics', { level: 1, nextDueAt: T0.toISOString() });
    expect(updated).toMatchObject({ attempts: 3, correct: 2, ability: 0.4, level: 1, nextDueAt: T0.toISOString() });
    expect(getSkillProgress(app.db, userId, 'laplace-basics')).toEqual(updated);
    expect(getAllSkillProgress(app.db, userId).size).toBe(1);
    expect(isSkillUnlockedForUser(app.db, userId, 'transfer-functions')).toBe(true);
    expect(isSkillUnlockedForUser(app.db, userId, 'poles-zeros')).toBe(false);
    expect(isSkillUnlockedForUser(app.db, userId, 'no-such-skill')).toBe(false);
  });
});
