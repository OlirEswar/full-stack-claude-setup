/**
 * Sessions (spec "API surface" → /api/sessions): start, fetch (resume) and
 * answer, with server-side grading. The answer key never leaves the server:
 * `session_items.client_payload` holds only the whitelisted client fields
 * produced by `toClientQuestion`, `answer_key` holds the display-order key.
 *
 * Completion (XP, levels, spaced repetition) lives in services/complete.ts.
 * Practice and mistakes sessions are not implemented yet (task 14): starting
 * them yields 501.
 *
 * Positions are 1-based: the first question has `position: 1`.
 */
import type { Db } from '../db/index.ts';
import { getSkill } from '../content/curriculum.ts';
import { grade, isValidResponse } from '../content/grade.ts';
import { answerText, toClientQuestion } from '../content/present.ts';
import type { ContentRegistry } from '../content/registry.ts';
import type { Rng } from '../content/rng.ts';
import type { AnswerKey, ClientQuestion, ClientQuestionBody, Difficulty } from '../content/types.ts';
import { updateAbility } from '../engine/ability.ts';
import { instantiate, RECENT_WINDOW_DAYS, selectQuestionsForSkill, type SelectedQuestion } from '../engine/select.ts';
import { DAY_MS } from '../engine/spaced.ts';
import { getAllSkillProgress, getSkillProgress, isUnlocked, upsertSkillProgress } from './progress.ts';
import { getHearts, loseHeart, syncHearts } from './hearts.ts';
import { localDate } from './xp.ts';

export const LESSON_SIZE = 8;
/** Combo bonus: +2 XP every time the combo reaches a multiple of 5. */
export const COMBO_BONUS_EVERY = 5;
export const COMBO_BONUS_XP = 2;

export type SessionKind = 'lesson' | 'practice' | 'mistakes' | 'daily';
export type SessionStatus = 'active' | 'failed' | 'completed';

/** A failure that maps directly onto an HTTP status. */
export class SessionError extends Error {
  readonly statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export interface SessionDeps {
  db: Db;
  registry: ContentRegistry;
  now: Date;
  rng: Rng;
}

export interface SessionUser {
  id: number;
  timezone: string;
}

export interface SessionSummaryView {
  id: number;
  kind: SessionKind;
  skillId: string | null;
  total: number;
  status: SessionStatus;
  hearts: number;
}

export interface SessionRow {
  id: number;
  user_id: number;
  kind: SessionKind;
  skill_id: string | null;
  status: SessionStatus;
  total: number;
  combo: number;
  max_combo: number;
  hearts_lost: number;
}

export interface ItemRow {
  id: number;
  session_id: number;
  position: number;
  question_ref: string;
  skill_id: string;
  difficulty: number;
  client_payload: string;
  answer_key: string;
  explanation: string;
  response: string | null;
}

/** Run `fn` inside a transaction (BEGIN/COMMIT, ROLLBACK on throw). */
export function tx<T>(db: Db, fn: () => T): T {
  db.exec('BEGIN');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Combo bonus XP earned by reaching `combo` (2 at 5, 10, 15, ...). */
export function comboBonusFor(combo: number): number {
  return combo > 0 && combo % COMBO_BONUS_EVERY === 0 ? COMBO_BONUS_XP : 0;
}

/** Static item ids the user answered within the last RECENT_WINDOW_DAYS days. */
export function recentStaticIds(db: Db, userId: number, now: Date): Set<string> {
  const since = new Date(now.getTime() - RECENT_WINDOW_DAYS * DAY_MS).toISOString();
  const rows = db
    .prepare(
      `SELECT DISTINCT si.question_ref AS ref FROM session_items si
       JOIN sessions s ON s.id = si.session_id
       WHERE s.user_id = ? AND si.answered_at IS NOT NULL AND si.answered_at >= ?
         AND si.question_ref NOT LIKE 'gen:%'`,
    )
    .all(userId, since) as { ref: string }[];
  return new Set(rows.map((r) => r.ref));
}

function toClient(item: ItemRow, total: number): ClientQuestion {
  const body = JSON.parse(item.client_payload) as ClientQuestionBody;
  return { itemId: item.id, position: item.position, total, ...body };
}

function sessionView(db: Db, row: SessionRow, now: Date): SessionSummaryView {
  return {
    id: row.id,
    kind: row.kind,
    skillId: row.skill_id,
    total: row.total,
    status: row.status,
    hearts: getHearts(db, row.user_id, now).hearts,
  };
}

export function loadOwnedSession(db: Db, userId: number, sessionId: number): SessionRow {
  const row = db
    .prepare(
      'SELECT id, user_id, kind, skill_id, status, total, combo, max_combo, hearts_lost FROM sessions WHERE id = ?',
    )
    .get(sessionId) as SessionRow | undefined;
  // Another user's session is indistinguishable from a missing one.
  if (!row || row.user_id !== userId) throw new SessionError(404, 'Session not found');
  return row;
}

function nextUnanswered(db: Db, sessionId: number): ItemRow | undefined {
  return db
    .prepare('SELECT * FROM session_items WHERE session_id = ? AND answered_at IS NULL ORDER BY position LIMIT 1')
    .get(sessionId) as ItemRow | undefined;
}

function answeredCount(db: Db, sessionId: number): number {
  const r = db
    .prepare('SELECT COUNT(*) AS n FROM session_items WHERE session_id = ? AND answered_at IS NOT NULL')
    .get(sessionId) as { n: number };
  return Number(r.n);
}

/**
 * Insert a session and its items (instantiating generators and shuffling
 * choices with `rng`). Returns the new session id. Shared by every session kind.
 */
export function createSession(
  deps: SessionDeps,
  user: SessionUser,
  kind: SessionKind,
  skillId: string | null,
  selections: readonly SelectedQuestion[],
): number {
  const { db, now, rng } = deps;
  return tx(db, () => {
    const res = db
      .prepare(
        `INSERT INTO sessions (user_id, kind, skill_id, status, total, local_date, started_at)
         VALUES (?, ?, ?, 'active', ?, ?, ?)`,
      )
      .run(user.id, kind, skillId, selections.length, localDate(now, user.timezone), now.toISOString());
    const sessionId = Number(res.lastInsertRowid);
    const insert = db.prepare(
      `INSERT INTO session_items (session_id, position, question_ref, skill_id, difficulty, client_payload, answer_key, explanation)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    selections.forEach((sel, i) => {
      const body = instantiate(sel);
      const { client, answerKey } = toClientQuestion(body, rng);
      insert.run(
        sessionId,
        i + 1,
        sel.ref,
        body.skillId,
        body.difficulty,
        JSON.stringify(client),
        JSON.stringify(answerKey),
        body.explanation,
      );
    });
    return sessionId;
  });
}

export interface StartResult {
  session: SessionSummaryView;
  question: ClientQuestion;
}

/** POST /api/sessions. Throws SessionError for 400/403/404/409/501/503. */
export function startSession(deps: SessionDeps, user: SessionUser, body: unknown): StartResult {
  if (!isObj(body)) throw new SessionError(400, 'Body must be a JSON object');
  const { kind, skillId } = body;
  if (kind === 'practice' || kind === 'mistakes') {
    throw new SessionError(501, `Session kind "${kind}" is not implemented yet`);
  }
  if (kind !== 'lesson') throw new SessionError(400, "kind must be 'lesson', 'practice' or 'mistakes'");
  if (typeof skillId !== 'string' || skillId.length === 0) throw new SessionError(400, 'skillId is required');
  return startLesson(deps, user, skillId);
}

function startLesson(deps: SessionDeps, user: SessionUser, skillId: string): StartResult {
  const { db, registry, now, rng } = deps;
  if (!getSkill(skillId)) throw new SessionError(404, 'Unknown skill');
  const progress = getAllSkillProgress(db, user.id);
  if (!isUnlocked(progress, skillId)) throw new SessionError(403, 'Skill is locked');
  if (syncHearts(db, user.id, now).hearts <= 0) throw new SessionError(409, 'No hearts left');

  const selections = selectQuestionsForSkill(
    { registry, progress, recentStaticIds: recentStaticIds(db, user.id, now), rng, now },
    skillId,
    LESSON_SIZE,
  );
  if (selections.length === 0) throw new SessionError(503, 'No content available for this skill yet');

  const id = createSession(deps, user, 'lesson', skillId, selections);
  return firstQuestion(db, id, now);
}

function firstQuestion(db: Db, sessionId: number, now: Date): StartResult {
  const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as unknown as SessionRow;
  const item = nextUnanswered(db, sessionId)!;
  return { session: sessionView(db, row, now), question: toClient(item, row.total) };
}

export interface SessionStateResult {
  session: SessionSummaryView;
  question: ClientQuestion | null;
  answered: number;
}

/** GET /api/sessions/:id: resume at the next unanswered question. */
export function getSessionState(deps: SessionDeps, userId: number, sessionId: number): SessionStateResult {
  const { db, now } = deps;
  const row = loadOwnedSession(db, userId, sessionId);
  const next = row.status === 'active' ? nextUnanswered(db, row.id) : undefined;
  return {
    session: sessionView(db, row, now),
    question: next ? toClient(next, row.total) : null,
    answered: answeredCount(db, row.id),
  };
}

export interface AnswerResult {
  correct: boolean;
  correctAnswer: unknown;
  correctAnswerText: string;
  explanation: string;
  combo: number;
  hearts: number;
  comboBonusXp: number;
  status: 'active' | 'failed' | 'ready';
  next: ClientQuestion | null;
}

/** POST /api/sessions/:id/answer. Throws SessionError for 400/404/409. */
export function answerQuestion(deps: SessionDeps, userId: number, sessionId: number, body: unknown): AnswerResult {
  const { db, now } = deps;
  const session = loadOwnedSession(db, userId, sessionId);

  if (!isObj(body)) throw new SessionError(400, 'Body must be a JSON object');
  const { itemId, response, timeMs } = body;
  if (typeof itemId !== 'number' || !Number.isInteger(itemId)) throw new SessionError(400, 'itemId must be an integer');
  if (timeMs !== undefined && timeMs !== null && (typeof timeMs !== 'number' || !Number.isFinite(timeMs) || timeMs < 0)) {
    throw new SessionError(400, 'timeMs must be a non-negative number');
  }

  if (session.status !== 'active') throw new SessionError(409, `Session is ${session.status}`);

  const item = db.prepare('SELECT * FROM session_items WHERE id = ? AND session_id = ?').get(itemId, session.id) as
    | ItemRow
    | undefined;
  if (!item) throw new SessionError(409, 'Item does not belong to this session');
  if (item.response !== null) throw new SessionError(409, 'Item already answered');
  const expected = nextUnanswered(db, session.id);
  if (!expected || expected.id !== item.id) throw new SessionError(409, 'Answer the current question first');

  const client = JSON.parse(item.client_payload) as ClientQuestionBody;
  if (!isValidResponse(client.kind, response)) {
    throw new SessionError(400, `Invalid response shape for a ${client.kind} question`);
  }
  const key = JSON.parse(item.answer_key) as AnswerKey;
  const correct = grade(client.kind, key, response);
  const nowIso = now.toISOString();

  return tx(db, () => {
    db.prepare('UPDATE session_items SET response = ?, correct = ?, time_ms = ?, answered_at = ? WHERE id = ?').run(
      JSON.stringify(response),
      correct ? 1 : 0,
      typeof timeMs === 'number' ? Math.round(timeMs) : null,
      nowIso,
      item.id,
    );

    // Ability / attempts on the item's skill.
    const p = getSkillProgress(db, userId, item.skill_id);
    upsertSkillProgress(db, userId, item.skill_id, {
      ability: updateAbility(p.ability, correct, item.difficulty as Difficulty, p.attempts),
      attempts: p.attempts + 1,
      correct: p.correct + (correct ? 1 : 0),
    });

    // Lifetime totals.
    db.prepare('INSERT OR IGNORE INTO user_stats (user_id, hearts_updated_at) VALUES (?, ?)').run(userId, nowIso);
    db.prepare(
      'UPDATE user_stats SET answered_total = answered_total + 1, correct_total = correct_total + ? WHERE user_id = ?',
    ).run(correct ? 1 : 0, userId);

    // Mistakes.
    if (!correct) {
      db.prepare(
        `INSERT INTO mistakes (user_id, question_ref, skill_id, wrong_count, last_wrong_at) VALUES (?, ?, ?, 1, ?)
         ON CONFLICT(user_id, question_ref) DO UPDATE SET
           wrong_count = wrong_count + 1, last_wrong_at = excluded.last_wrong_at,
           skill_id = excluded.skill_id, cleared_at = NULL`,
      ).run(userId, item.question_ref, item.skill_id, nowIso);
    } else if (session.kind === 'mistakes') {
      const res = db
        .prepare('UPDATE mistakes SET cleared_at = ? WHERE user_id = ? AND question_ref = ? AND cleared_at IS NULL')
        .run(nowIso, userId, item.question_ref);
      if (Number(res.changes) > 0) {
        db.prepare('UPDATE user_stats SET mistakes_cleared = mistakes_cleared + 1 WHERE user_id = ?').run(userId);
      }
    }

    // Combo.
    const combo = correct ? session.combo + 1 : 0;
    const maxCombo = Math.max(session.max_combo, combo);

    // Hearts (lessons only).
    let hearts: number;
    let heartsLost = session.hearts_lost;
    let status: SessionStatus = 'active';
    if (session.kind === 'lesson' && !correct) {
      hearts = loseHeart(db, userId, now).hearts;
      heartsLost += 1;
      if (hearts <= 0) status = 'failed';
    } else {
      hearts = getHearts(db, userId, now).hearts;
    }

    db.prepare('UPDATE sessions SET combo = ?, max_combo = ?, hearts_lost = ?, status = ? WHERE id = ?').run(
      combo,
      maxCombo,
      heartsLost,
      status,
      session.id,
    );

    const next = status === 'active' ? nextUnanswered(db, session.id) : undefined;
    return {
      correct,
      correctAnswer: (key as { answer: unknown }).answer,
      correctAnswerText: answerText(client, key),
      explanation: item.explanation,
      combo,
      hearts,
      comboBonusXp: correct ? comboBonusFor(combo) : 0,
      status: status === 'failed' ? 'failed' : next ? 'active' : 'ready',
      next: next ? toClient(next, session.total) : null,
    };
  });
}
