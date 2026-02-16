import fs from "fs";
import path from "path";
import pg from "pg";

const { Pool } = pg;

let poolInstance: pg.Pool | null = null;
let initialized = false;

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
  const schemaPath = path.join(process.cwd(), "scripts", "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf-8");
  await pool.query(schema);
  await pool.query(
    `INSERT INTO user_config (id, horizon_days, refresh_interval_minutes, selected_calendar_ids)
     VALUES (1, 182, 10, '[]')
     ON CONFLICT DO NOTHING`
  );
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
