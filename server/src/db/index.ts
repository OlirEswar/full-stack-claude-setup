import type { DatabaseSync as DatabaseSyncType } from 'node:sqlite';
import { createRequire } from 'node:module';
import { runMigrations } from './migrations.ts';

// Loaded via createRequire so bundlers/test runners that don't recognise the
// "node:"-only `sqlite` builtin still resolve it through the real Node runtime.
const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite');

export type Db = DatabaseSyncType;

/**
 * Open (or create) a SQLite database, enable foreign keys (and WAL for file
 * databases), and apply all pending migrations.
 */
export function openDb(path: string): Db {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON;');
  if (path !== ':memory:' && path !== '') {
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA busy_timeout = 5000;');
  }
  runMigrations(db);
  return db;
}

export { runMigrations };
