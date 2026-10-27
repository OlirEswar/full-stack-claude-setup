import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { lookupToken } from './tokens.ts';

export interface AuthUser {
  id: number;
  username: string;
  timezone: string;
  dailyXpGoal: number;
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by the auth preHandler on authenticated /api/* routes. */
    user: AuthUser | null;
    /** Raw bearer token of the current request (for logout). */
    authToken: string | null;
  }
  interface FastifyContextConfig {
    /** Set to false on /api/* routes that don't require a bearer token. */
    auth?: boolean;
  }
}

function extractBearer(header: string | undefined): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(\S+)\s*$/i.exec(header);
  return m ? m[1]! : null;
}

/**
 * Install the auth hook on the root instance (not encapsulated, so it applies
 * to every route). All `/api/*` routes require `Authorization: Bearer <token>`
 * unless registered with `config: { auth: false }`.
 */
export function installAuth(app: FastifyInstance): void {
  app.decorateRequest('user', null);
  app.decorateRequest('authToken', null);

  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    // Use the matched route pattern, not the raw URL: routing decodes the path,
    // so a percent-encoded `/%61pi/...` would otherwise reach an /api handler unauthenticated.
    if (!request.routeOptions.url?.startsWith('/api/')) return;
    if (request.routeOptions.config?.auth === false) return;

    const token = extractBearer(request.headers.authorization);
    const userId = token ? lookupToken(app.db, token, app.now()) : null;
    const row =
      userId === null
        ? undefined
        : (app.db.prepare('SELECT id, username, timezone, daily_xp_goal FROM users WHERE id = ?').get(userId) as
            | { id: number; username: string; timezone: string; daily_xp_goal: number }
            | undefined);
    if (!row) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    request.user = { id: row.id, username: row.username, timezone: row.timezone, dailyXpGoal: row.daily_xp_goal };
    request.authToken = token;
  });
}
