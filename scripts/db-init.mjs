import pg from "pg";
import fs from "fs";
import path from "path";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const schemaPath = path.join(process.cwd(), "scripts", "schema.sql");
const schema = fs.readFileSync(schemaPath, "utf-8");

await pool.query(schema);
await pool.query(
  `INSERT INTO user_config (id, horizon_days, refresh_interval_minutes, selected_calendar_ids)
   VALUES (1, 182, 10, '[]')
   ON CONFLICT DO NOTHING`
);
console.log("DB initialized (PostgreSQL)");
await pool.end();
