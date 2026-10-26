import type { FastifyInstance } from 'fastify';
import { buildLeaderboard } from '../services/leaderboard.ts';

export async function leaderboardRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/leaderboard', async (request) => buildLeaderboard(app.db, request.user!.id, app.now()));
}
