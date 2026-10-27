/**
 * Dev seed: creates the `demo` user (password `demopass1`) with some progress
 * plus a handful of fake users so the weekly leaderboard isn't empty.
 *
 * Everything goes through the real app (migrations via openDb, register,
 * sessions, answers, completion) using in-process `app.inject` calls, so the
 * seeded data is exactly what real play would produce.
 *
 * Rerunnable: users that already exist are skipped (left untouched).
 *
 * Usage: DB_PATH=/path/to/db npm run seed -w server
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.ts';

export const DEMO_USERNAME = 'demo';
export const DEMO_PASSWORD = 'demopass1';

interface FakeUser {
  username: string;
  /** Number of lessons to play on the first skill. */
  lessons: number;
  /** Positions (0-based) answered wrong in each session. */
  wrong: number[];
}

export const FAKE_USERS: readonly FakeUser[] = [
  { username: 'ada_loop', lessons: 3, wrong: [] },
  { username: 'bode_plotter', lessons: 2, wrong: [3] },
  { username: 'nyquist_nina', lessons: 2, wrong: [] },
  { username: 'pid_pete', lessons: 1, wrong: [1, 5] },
  { username: 'root_locus', lessons: 1, wrong: [] },
];
const FAKE_PASSWORD = 'fakepass1';

interface Question {
  itemId: number;
}

interface Started {
  session: { id: number };
  question: Question | null;
}

export interface SeedResult {
  created: string[];
  skipped: string[];
}

function responseFor(app: FastifyInstance, itemId: number, ok: boolean): unknown {
  const row = app.db.prepare('SELECT client_payload, answer_key FROM session_items WHERE id = ?').get(itemId) as {
    client_payload: string;
    answer_key: string;
  };
  const kind = (JSON.parse(row.client_payload) as { kind: string }).kind;
  const answer = (JSON.parse(row.answer_key) as { answer: unknown }).answer;
  switch (kind) {
    case 'mcq':
      return { choice: ok ? answer : (answer as number) === 0 ? 1 : 0 };
    case 'true_false':
      return { value: ok ? answer : !answer };
    case 'numeric':
      return { value: ok ? answer : (answer as number) * 10 + 1000 };
    case 'multi_select':
      return { choices: ok ? answer : [] };
    case 'match': {
      const a = answer as number[];
      return { pairs: ok ? a : a.map((_, i) => a[(i + 1) % a.length]) };
    }
    default:
      throw new Error(`Unknown question kind: ${kind}`);
  }
}

async function call(
  app: FastifyInstance,
  token: string,
  method: 'GET' | 'POST',
  url: string,
  payload?: object,
): Promise<unknown> {
  const res = await app.inject({
    method,
    url,
    headers: { authorization: `Bearer ${token}` },
    ...(payload !== undefined ? { payload } : {}),
  });
  if (res.statusCode >= 300) throw new Error(`${method} ${url} -> ${res.statusCode}: ${res.body}`);
  return res.json();
}

/** Answer every question in a started session, then complete it. */
async function playSession(app: FastifyInstance, token: string, start: Started, wrong: readonly number[]): Promise<void> {
  const id = start.session.id;
  let q = start.question;
  let i = 0;
  while (q) {
    const res = (await call(app, token, 'POST', `/api/sessions/${id}/answer`, {
      itemId: q.itemId,
      response: responseFor(app, q.itemId, !wrong.includes(i)),
      timeMs: 4000 + i * 500,
    })) as { next: Question | null };
    q = res.next;
    i++;
  }
  await call(app, token, 'POST', `/api/sessions/${id}/complete`);
}

/** Register a user; returns null if the username already exists. */
async function registerIfNew(app: FastifyInstance, username: string, password: string): Promise<string | null> {
  const res = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { username, password } });
  if (res.statusCode === 409) return null;
  if (res.statusCode !== 201) throw new Error(`register ${username} -> ${res.statusCode}: ${res.body}`);
  return (res.json() as { token: string }).token;
}

async function playLessons(app: FastifyInstance, token: string, n: number, wrong: readonly number[]): Promise<void> {
  const path = (await call(app, token, 'GET', '/api/path')) as { units: { skills: { id: string }[] }[] };
  const skillId = path.units[0].skills[0].id;
  for (let k = 0; k < n; k++) {
    const start = (await call(app, token, 'POST', '/api/sessions', { kind: 'lesson', skillId })) as Started;
    await playSession(app, token, start, wrong);
  }
}

/** Seed demo + fake users into the app's database. Existing users are skipped. */
export async function seedDemo(app: FastifyInstance): Promise<SeedResult> {
  const result: SeedResult = { created: [], skipped: [] };

  const demoToken = await registerIfNew(app, DEMO_USERNAME, DEMO_PASSWORD);
  if (demoToken) {
    // One lesson with a slip (so the mistakes review has content), one clean, then today's daily.
    await playLessons(app, demoToken, 1, [2]);
    await playLessons(app, demoToken, 1, []);
    const daily = (await call(app, demoToken, 'POST', '/api/daily/start')) as Started;
    await playSession(app, demoToken, daily, []);
    result.created.push(DEMO_USERNAME);
  } else {
    result.skipped.push(DEMO_USERNAME);
  }

  for (const u of FAKE_USERS) {
    const token = await registerIfNew(app, u.username, FAKE_PASSWORD);
    if (!token) {
      result.skipped.push(u.username);
      continue;
    }
    await playLessons(app, token, u.lessons, u.wrong);
    result.created.push(u.username);
  }
  return result;
}

async function main(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const dbPath = process.env.DB_PATH ?? resolve(here, '../../data/loopy.db');
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });

  const app = await buildApp({ dbPath });
  try {
    const { created, skipped } = await seedDemo(app);
    console.log(`Seeded ${dbPath}`);
    console.log(`  created: ${created.length ? created.join(', ') : '(none)'}`);
    console.log(`  skipped (already existed): ${skipped.length ? skipped.join(', ') : '(none)'}`);
    console.log(`  log in with ${DEMO_USERNAME} / ${DEMO_PASSWORD}`);
  } finally {
    await app.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
