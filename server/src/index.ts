import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp } from './app.ts';

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 3000);
const dbPath = process.env.DB_PATH ?? resolve(here, '../data/loopy.db');

if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });

const app = await buildApp({ dbPath, logger: true });

try {
  await app.listen({ port, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
