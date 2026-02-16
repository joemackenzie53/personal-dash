import path from "path";
import fs from "fs";
import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";

let dbPromise: Promise<Database> | null = null;

function getDbPath() {
  const p = process.env.DB_PATH || path.join(process.cwd(), "data", "personal-dash.sqlite");
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return p;
}

async function init(db: Database) {
  const schemaPath = path.join(process.cwd(), "scripts", "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf-8");
  await db.exec(schema);

  // Ensure singleton config row exists
  await db.run(
    `INSERT OR IGNORE INTO user_config (id, horizon_days, refresh_interval_minutes, selected_calendar_ids)
     VALUES (1, 182, 10, '[]')`
  );
}

export async function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await open({
        filename: getDbPath(),
        driver: sqlite3.Database
      });
      await init(db);
      return db;
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
