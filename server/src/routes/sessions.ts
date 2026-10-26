import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  answerQuestion,
  getSessionState,
  SessionError,
  startSession,
  type SessionDeps,
} from '../services/sessions.ts';

function parseId(raw: unknown): number | null {
  if (typeof raw !== 'string' || !/^[1-9]\d{0,15}$/.test(raw)) return null;
  return Number(raw);
}

export async function sessionRoutes(app: FastifyInstance): Promise<void> {
  const deps = (): SessionDeps => ({ db: app.db, registry: app.registry, now: app.now(), rng: app.rng });

  function handle<T>(reply: FastifyReply, fn: () => T): T | FastifyReply {
    try {
      return fn();
    } catch (err) {
      if (err instanceof SessionError) return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  }

  app.post('/api/sessions', async (request, reply) =>
    handle(reply, () => {
      const result = startSession(deps(), request.user!, request.body);
      reply.code(201);
      return result;
    }),
  );

  app.get('/api/sessions/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const id = parseId(request.params.id);
    if (id === null) return reply.code(404).send({ error: 'Session not found' });
    return handle(reply, () => getSessionState(deps(), request.user!.id, id));
  });

  app.post('/api/sessions/:id/answer', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const id = parseId(request.params.id);
    if (id === null) return reply.code(404).send({ error: 'Session not found' });
    return handle(reply, () => answerQuestion(deps(), request.user!.id, id, request.body));
  });
}
