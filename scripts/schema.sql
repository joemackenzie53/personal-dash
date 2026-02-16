PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

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
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS calendars (
  calendar_id TEXT PRIMARY KEY,
  summary TEXT,
  primary_flag INTEGER NOT NULL DEFAULT 0,
  is_holiday INTEGER NOT NULL DEFAULT 0,
  selected INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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
  title TEXT,
  description TEXT,
  location TEXT,
  start TEXT,
  end TEXT,
  all_day INTEGER NOT NULL DEFAULT 0,
  updated TEXT,
  status TEXT,
  deleted INTEGER NOT NULL DEFAULT 0,
  raw_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_start ON events(start);
CREATE INDEX IF NOT EXISTS idx_events_calendar ON events(calendar_id);

CREATE TABLE IF NOT EXISTS event_meta (
  event_key TEXT PRIMARY KEY,
  category TEXT NOT NULL DEFAULT 'unknown',
  is_major INTEGER NOT NULL DEFAULT 0,
  project_id TEXT,
  notes_url TEXT,
  locked INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_actions_status_due ON actions(status, due_at);
CREATE INDEX IF NOT EXISTS idx_actions_parent ON actions(parent_type, parent_id);
