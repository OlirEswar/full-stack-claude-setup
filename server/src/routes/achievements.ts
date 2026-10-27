/** GET /api/achievements: every achievement with unlock state and progress. */
import type { FastifyInstance } from 'fastify';
import { listAchievements } from '../services/achievements.ts';

export async function achievementsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/achievements', async (request) => listAchievements(app.db, request.user!.id));
}
