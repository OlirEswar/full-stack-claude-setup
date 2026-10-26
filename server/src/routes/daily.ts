import type { FastifyInstance } from 'fastify';
import { getDaily, startDaily } from '../services/daily.ts';
import { SessionError } from '../services/sessions.ts';

export async function dailyRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/daily', async (request) => getDaily(app.db, request.user!, app.now()));

  app.post('/api/daily/start', async (request, reply) => {
    try {
      const result = startDaily(
        { db: app.db, registry: app.registry, now: app.now(), rng: app.rng },
        request.user!,
      );
      reply.code(201);
      return result;
    } catch (err) {
      if (err instanceof SessionError) return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });
}
