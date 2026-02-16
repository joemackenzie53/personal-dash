import { open } from "sqlite";
import sqlite3 from "sqlite3";
import fs from "fs";
import path from "path";

const dbPath = process.env.DB_PATH || path.join(process.cwd(), "data", "personal-dash.sqlite");
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const schemaPath = path.join(process.cwd(), "scripts", "schema.sql");
const schema = fs.readFileSync(schemaPath, "utf-8");

const db = await open({ filename: dbPath, driver: sqlite3.Database });
await db.exec(schema);
await db.run(
  `INSERT OR IGNORE INTO user_config (id, horizon_days, refresh_interval_minutes, selected_calendar_ids)
   VALUES (1, 182, 10, '[]')`
);
console.log("DB initialized at", dbPath);
await db.close();
