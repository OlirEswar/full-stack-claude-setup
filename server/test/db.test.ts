import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from '../src/db/index.ts';
import { migrations, runMigrations } from '../src/db/migrations.ts';
import { buildApp } from '../src/app.ts';

const TABLES = [
  'users',
  'auth_tokens',
  'user_stats',
  'skill_progress',
  'sessions',
  'session_items',
  'mistakes',
  'xp_events',
  'daily_challenges',
  'user_achievements',
  'schema_migrations',
];

function insertUser(db: Db, username: string) {
  return db
    .prepare('INSERT INTO users (username, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?)')
    .run(username, 'h', 's', '2026-01-01T00:00:00.000Z');
}

describe('db', () => {
  let db: Db | undefined;

  afterEach(() => {
    db?.close();
    db = undefined;
  });

  it('creates all tables', () => {
    db = openDb(':memory:');
    const rows = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[];
    const names = rows.map((r) => r.name);
    for (const t of TABLES) expect(names).toContain(t);
  });

  it('migrations are idempotent', () => {
    db = openDb(':memory:');
    runMigrations(db);
    runMigrations(db);
    const rows = db
      .prepare('SELECT version, COUNT(*) AS n FROM schema_migrations GROUP BY version ORDER BY version')
      .all() as { version: number; n: number }[];
    expect(rows.map((r) => r.version)).toEqual(migrations.map((m) => m.version));
    for (const r of rows) expect(r.n).toBe(1);
  });

  it('enforces unique username case-insensitively', () => {
    db = openDb(':memory:');
    insertUser(db, 'Alice');
    expect(() => insertUser(db!, 'alice')).toThrow(/UNIQUE/);
    const row = db.prepare('SELECT id FROM users WHERE username = ?').get('ALICE');
    expect(row).toBeDefined();
  });

  it('enforces foreign keys', () => {
    db = openDb(':memory:');
    expect(() =>
      db!
        .prepare('INSERT INTO auth_tokens (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
        .run('x', 999, 'a', 'b'),
    ).toThrow(/FOREIGN KEY/);
  });

  it('uses WAL for file databases and persists migrations across reopen', () => {
    const dir = mkdtempSync(join(tmpdir(), 'loopy-db-'));
    try {
      const file = join(dir, 'test.db');
      const first = openDb(file);
      const mode = first.prepare('PRAGMA journal_mode').get() as { journal_mode: string };
      expect(mode.journal_mode).toBe('wal');
      first.close();
      db = openDb(file);
      const n = db.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get() as { n: number };
      expect(n.n).toBe(migrations.length);
    } finally {
      db?.close();
      db = undefined;
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('buildApp decorates app.db and closes it on app.close()', async () => {
    const app = await buildApp({ dbPath: ':memory:' });
    const row = app.db.prepare("SELECT name FROM sqlite_master WHERE name = 'users'").get();
    expect(row).toBeDefined();
    await app.close();
    expect(() => app.db.prepare('SELECT 1')).toThrow();
  });
});
