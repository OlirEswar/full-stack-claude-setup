/** GET /api/mistakes: the user's uncleared mistakes, oldest first. */
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/index.ts';
import { getSkill } from '../content/curriculum.ts';
import { unclearedMistakes } from '../services/sessions.ts';

export interface MistakesResponse {
  count: number;
  items: { questionRef: string; skillId: string; skillTitle: string; lastWrongAt: string }[];
}

export function listMistakes(db: Db, userId: number): MistakesResponse {
  const items = unclearedMistakes(db, userId).map((m) => ({
    questionRef: m.question_ref,
    skillId: m.skill_id,
    skillTitle: getSkill(m.skill_id)?.title ?? m.skill_id,
    lastWrongAt: m.last_wrong_at,
  }));
  return { count: items.length, items };
}

export async function mistakesRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/mistakes', async (request) => listMistakes(app.db, request.user!.id));
}
