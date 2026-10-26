import type { DatabaseSync } from 'node:sqlite';

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial schema',
    sql: `
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        timezone TEXT NOT NULL DEFAULT 'UTC',
        daily_xp_goal INTEGER NOT NULL DEFAULT 20,
        created_at TEXT NOT NULL
      );

      CREATE TABLE auth_tokens (
        token_hash TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );
      CREATE INDEX idx_auth_tokens_user ON auth_tokens(user_id);

      CREATE TABLE user_stats (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        xp_total INTEGER NOT NULL DEFAULT 0,
        hearts INTEGER NOT NULL DEFAULT 5,
        hearts_updated_at TEXT,
        streak_current INTEGER NOT NULL DEFAULT 0,
        streak_longest INTEGER NOT NULL DEFAULT 0,
        streak_last_date TEXT,
        streak_freezes INTEGER NOT NULL DEFAULT 0,
        correct_total INTEGER NOT NULL DEFAULT 0,
        answered_total INTEGER NOT NULL DEFAULT 0,
        lessons_completed INTEGER NOT NULL DEFAULT 0,
        mistakes_cleared INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE skill_progress (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        skill_id TEXT NOT NULL,
        ability REAL NOT NULL DEFAULT 0,
        attempts INTEGER NOT NULL DEFAULT 0,
        correct INTEGER NOT NULL DEFAULT 0,
        level INTEGER NOT NULL DEFAULT 0,
        lessons_in_level INTEGER NOT NULL DEFAULT 0,
        half_life_days REAL NOT NULL DEFAULT 1,
        last_practiced_at TEXT,
        next_due_at TEXT,
        PRIMARY KEY (user_id, skill_id)
      );

      CREATE TABLE sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind TEXT NOT NULL CHECK (kind IN ('lesson','practice','mistakes','daily')),
        skill_id TEXT NULL,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','failed','completed')),
        total INTEGER NOT NULL,
        combo INTEGER NOT NULL DEFAULT 0,
        max_combo INTEGER NOT NULL DEFAULT 0,
        hearts_lost INTEGER NOT NULL DEFAULT 0,
        xp_earned INTEGER NOT NULL DEFAULT 0,
        local_date TEXT NOT NULL,
        started_at TEXT NOT NULL,
        completed_at TEXT NULL
      );
      CREATE INDEX idx_sessions_user ON sessions(user_id, status);

      CREATE TABLE session_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        question_ref TEXT NOT NULL,
        skill_id TEXT NOT NULL,
        difficulty INTEGER NOT NULL,
        client_payload TEXT NOT NULL,
        answer_key TEXT NOT NULL,
        explanation TEXT NOT NULL DEFAULT '',
        response TEXT NULL,
        correct INTEGER NULL,
        time_ms INTEGER NULL,
        answered_at TEXT NULL,
        UNIQUE (session_id, position)
      );

      CREATE TABLE mistakes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        question_ref TEXT NOT NULL,
        skill_id TEXT NOT NULL,
        wrong_count INTEGER NOT NULL DEFAULT 1,
        last_wrong_at TEXT NOT NULL,
        cleared_at TEXT NULL,
        UNIQUE (user_id, question_ref)
      );

      CREATE TABLE xp_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount INTEGER NOT NULL,
        source TEXT NOT NULL,
        session_id INTEGER NULL REFERENCES sessions(id) ON DELETE SET NULL,
        local_date TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX idx_xp_events_user_date ON xp_events(user_id, local_date);
      CREATE INDEX idx_xp_events_created ON xp_events(created_at);

      CREATE TABLE daily_challenges (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        local_date TEXT NOT NULL,
        session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        completed_at TEXT NULL,
        PRIMARY KEY (user_id, local_date)
      );

      CREATE TABLE user_achievements (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        achievement_id TEXT NOT NULL,
        unlocked_at TEXT NOT NULL,
        PRIMARY KEY (user_id, achievement_id)
      );
    `,
  },
  {
    version: 2,
    name: 'session completion summary',
    // The completion summary is stored so POST /api/sessions/:id/complete is idempotent
    // (point-in-time fields like levelUp/streakExtended can't be recomputed later).
    sql: `ALTER TABLE sessions ADD COLUMN summary TEXT NULL;`,
  },
];

/** Apply any migrations not yet recorded in schema_migrations. Safe to call repeatedly. */
export function runMigrations(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
  const applied = new Set(
    (db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]).map((r) => r.version),
  );
  const record = db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)');
  for (const m of [...migrations].sort((a, b) => a.version - b.version)) {
    if (applied.has(m.version)) continue;
    db.exec('BEGIN');
    try {
      db.exec(m.sql);
      record.run(m.version, m.name, new Date().toISOString());
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
}
