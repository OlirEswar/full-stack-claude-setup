import type { FastifyInstance } from 'fastify';
import { buildPath } from '../services/progress.ts';

export async function pathRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/path', async (request) => buildPath(app.db, request.user!.id, app.now()));
}
