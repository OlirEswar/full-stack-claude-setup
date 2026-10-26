import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import { openDb, type Db } from './db/index.ts';
import { installAuth } from './auth/plugin.ts';
import { authRoutes } from './routes/auth.ts';
import { dailyRoutes } from './routes/daily.ts';
import { meRoutes } from './routes/me.ts';
import { pathRoutes } from './routes/path.ts';
import { sessionRoutes } from './routes/sessions.ts';
import { statsRoutes } from './routes/stats.ts';
import { leaderboardRoutes } from './routes/leaderboard.ts';
import { registry as defaultRegistry, type ContentRegistry } from './content/registry.ts';

export interface BuildAppOptions {
  /** SQLite file path, or ':memory:' for tests. */
  dbPath: string;
  /** Injectable clock for deterministic tests. */
  now?: () => Date;
  /** Injectable RNG in [0, 1) for deterministic tests. */
  rng?: () => number;
  /** Content registry; defaults to the app-wide one built from `content/units/`. Tests inject fixtures. */
  registry?: ContentRegistry;
  /** Enable Fastify request logging. */
  logger?: boolean;
}

declare module 'fastify' {
  interface FastifyInstance {
    config: { dbPath: string };
    db: Db;
    now: () => Date;
    rng: () => number;
    /** Content registry. Services must use this, never the module-level import. */
    registry: ContentRegistry;
  }
}

export async function buildApp(opts: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? false });

  app.decorate('config', { dbPath: opts.dbPath });
  app.decorate('now', opts.now ?? (() => new Date()));
  app.decorate('rng', opts.rng ?? Math.random);
  app.decorate('registry', opts.registry ?? defaultRegistry);

  const db = openDb(opts.dbPath);
  app.decorate('db', db);
  app.addHook('onClose', async () => {
    if (db.isOpen) db.close();
  });

  await app.register(cors, { origin: true });

  app.get('/health', async () => ({ ok: true }));

  installAuth(app);
  await app.register(authRoutes);
  await app.register(meRoutes);
  await app.register(pathRoutes);
  await app.register(sessionRoutes);
  await app.register(dailyRoutes);
  await app.register(statsRoutes);
  await app.register(leaderboardRoutes);

  return app;
}
