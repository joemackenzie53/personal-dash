import pg from "pg";

const { Pool } = pg;

let poolInstance: pg.Pool | null = null;
let initialized = false;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS user_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  horizon_days INTEGER NOT NULL DEFAULT 182,
  refresh_interval_minutes INTEGER NOT NULL DEFAULT 10,
  selected_calendar_ids TEXT NOT NULL DEFAULT '[]',
  last_sync_at TEXT
);

CREATE TABLE IF NOT EXISTS oauth_tokens (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  refresh_token TEXT,
  access_token TEXT,
  access_token_expiry TEXT,
  updated_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
);

CREATE TABLE IF NOT EXISTS calendars (
  calendar_id TEXT PRIMARY KEY,
  summary TEXT,
  primary_flag INTEGER NOT NULL DEFAULT 0,
  is_holiday INTEGER NOT NULL DEFAULT 0,
  selected INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
);

CREATE TABLE IF NOT EXISTS calendar_sync_state (
  calendar_id TEXT PRIMARY KEY,
  sync_token TEXT,
  window_start TEXT,
  window_end TEXT,
  last_sync_at TEXT
);

CREATE TABLE IF NOT EXISTS events (
  event_key TEXT PRIMARY KEY,
  calendar_id TEXT NOT NULL,
  google_event_id TEXT NOT NULL,
  ical_uid TEXT,
  recurring_event_id TEXT,
  title TEXT,
  description TEXT,
  location TEXT,
  "start" TEXT,
  "end" TEXT,
  all_day INTEGER NOT NULL DEFAULT 0,
  updated TEXT,
  status TEXT,
  deleted INTEGER NOT NULL DEFAULT 0,
  raw_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_start ON events("start");
CREATE INDEX IF NOT EXISTS idx_events_calendar ON events(calendar_id);

CREATE TABLE IF NOT EXISTS event_meta (
  event_key TEXT PRIMARY KEY,
  category TEXT NOT NULL DEFAULT 'unknown',
  is_major INTEGER NOT NULL DEFAULT 0,
  project_id TEXT,
  notes_url TEXT,
  locked INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
);

CREATE INDEX IF NOT EXISTS idx_event_meta_category ON event_meta(category);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  priority TEXT NOT NULL DEFAULT 'med',
  target_date TEXT,
  description TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  drive_folder_url TEXT,
  key_doc_urls TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
  updated_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
);

CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

CREATE TABLE IF NOT EXISTS actions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'med',
  start_at TEXT,
  due_at TEXT,
  snooze_until TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  parent_type TEXT,
  parent_id TEXT,
  reference_url TEXT,
  checklist TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
  updated_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
);

CREATE INDEX IF NOT EXISTS idx_actions_status_due ON actions(status, due_at);
CREATE INDEX IF NOT EXISTS idx_actions_parent ON actions(parent_type, parent_id);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  pattern TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
);
`;

function getPool(): pg.Pool {
  if (!poolInstance) {
    poolInstance = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
  }
  return poolInstance;
}

async function initSchema(pool: pg.Pool) {
  if (initialized) return;
  await pool.query(SCHEMA_SQL);
  await pool.query(
    `INSERT INTO user_config (id, horizon_days, refresh_interval_minutes, selected_calendar_ids)
     VALUES (1, 182, 10, '[]')
     ON CONFLICT DO NOTHING`
  );

  const catCount = await pool.query("SELECT COUNT(*) as cnt FROM categories");
  if (parseInt(catCount.rows[0].cnt) === 0) {
    const defaults: Array<[string, string | null]> = [
      ["unknown", null],
      ["holiday", "calendar:holidays"],
      ["birthday", "\\bbirthday\\b|\\bbday\\b"],
      ["anniversary", "\\banniversary\\b"],
      ["christmas", "\\bchristmas\\b|\\bxmas\\b"],
      ["easter", "\\beaster\\b"],
      ["valentines", "\\bvalentine\\b"],
      ["travel", "\\bflight\\b|\\bhotel\\b|\\btrain\\b|\\bairport\\b|\\bairbnb\\b"],
      ["social", "\\bdinner\\b|\\blunch\\b|\\bdrinks\\b|\\bparty\\b"],
      ["admin", null],
    ];
    for (let i = 0; i < defaults.length; i++) {
      await pool.query(
        "INSERT INTO categories (id, name, pattern, sort_order) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING",
        [defaults[i][0], defaults[i][0], defaults[i][1], i]
      );
    }
  }

  initialized = true;
}

export interface DbWrapper {
  query(sql: string, params?: any[]): Promise<pg.QueryResult>;
  get<T = any>(sql: string, params?: any[]): Promise<T | undefined>;
  all<T = any>(sql: string, params?: any[]): Promise<T[]>;
  run(sql: string, params?: any[]): Promise<pg.QueryResult>;
}

let dbPromise: Promise<DbWrapper> | null = null;

export async function getDb(): Promise<DbWrapper> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const pool = getPool();
      await initSchema(pool);

      const wrapper: DbWrapper = {
        async query(sql: string, params?: any[]) {
          return pool.query(sql, params);
        },
        async get<T = any>(sql: string, params?: any[]): Promise<T | undefined> {
          const result = await pool.query(sql, params);
          return result.rows[0] as T | undefined;
        },
        async all<T = any>(sql: string, params?: any[]): Promise<T[]> {
          const result = await pool.query(sql, params);
          return result.rows as T[];
        },
        async run(sql: string, params?: any[]) {
          return pool.query(sql, params);
        },
      };

      return wrapper;
    })();
  }
  return dbPromise;
}

export function jsonParse<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

export function jsonStringify(v: unknown): string {
  return JSON.stringify(v ?? null);
}
