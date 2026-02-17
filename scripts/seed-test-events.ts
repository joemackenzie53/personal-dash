import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const PREFIX = "test-seed-";
const CAL_ID = "test-calendar";

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function iso(d: Date) {
  return d.toISOString();
}

async function clean() {
  console.log("Cleaning up test data...");
  const r1 = await pool.query(`DELETE FROM event_meta WHERE event_key LIKE $1`, [`${PREFIX}%`]);
  console.log(`  Deleted ${r1.rowCount} event_meta rows`);
  const r2 = await pool.query(`DELETE FROM events WHERE event_key LIKE $1`, [`${PREFIX}%`]);
  console.log(`  Deleted ${r2.rowCount} event rows`);
  console.log("Done. All test data removed.");
}

async function seed() {
  console.log("Seeding test events...");

  const now = new Date();
  const events: {
    event_key: string;
    google_event_id: string;
    recurring_event_id: string | null;
    title: string;
    start: string;
    end: string;
    all_day: number;
    description: string;
    location: string;
  }[] = [];

  events.push({
    event_key: `${PREFIX}standalone-1`,
    google_event_id: `${PREFIX}standalone-1`,
    recurring_event_id: null,
    title: "[TEST] Dentist appointment",
    start: iso(addDays(now, 3)),
    end: iso(addDays(now, 3)),
    all_day: 0,
    description: "Annual checkup",
    location: "123 High Street",
  });

  events.push({
    event_key: `${PREFIX}standalone-2`,
    google_event_id: `${PREFIX}standalone-2`,
    recurring_event_id: null,
    title: "[TEST] Flight to Paris",
    start: iso(addDays(now, 10)),
    end: iso(addDays(now, 10)),
    all_day: 0,
    description: "",
    location: "Heathrow Terminal 5",
  });

  events.push({
    event_key: `${PREFIX}allday-1`,
    google_event_id: `${PREFIX}allday-1`,
    recurring_event_id: null,
    title: "[TEST] Bank Holiday",
    start: addDays(now, 20).toISOString().slice(0, 10),
    end: addDays(now, 21).toISOString().slice(0, 10),
    all_day: 1,
    description: "",
    location: "",
  });

  const recurringId1 = `${PREFIX}recurring-weekly-standup`;
  for (let i = 0; i < 8; i++) {
    const d = addDays(now, i * 7 + 1);
    d.setHours(9, 0, 0, 0);
    const dEnd = new Date(d);
    dEnd.setMinutes(30);
    events.push({
      event_key: `${PREFIX}weekly-standup-${i}`,
      google_event_id: `${PREFIX}weekly-standup-${i}`,
      recurring_event_id: recurringId1,
      title: "[TEST] Weekly standup",
      start: iso(d),
      end: iso(dEnd),
      all_day: 0,
      description: "Team sync",
      location: "Zoom",
    });
  }

  const recurringId2 = `${PREFIX}recurring-piano-lesson`;
  for (let i = 0; i < 6; i++) {
    const d = addDays(now, i * 7 + 3);
    d.setHours(17, 0, 0, 0);
    const dEnd = new Date(d);
    dEnd.setHours(18, 0, 0, 0);
    events.push({
      event_key: `${PREFIX}piano-lesson-${i}`,
      google_event_id: `${PREFIX}piano-lesson-${i}`,
      recurring_event_id: recurringId2,
      title: "[TEST] Piano lesson",
      start: iso(d),
      end: iso(dEnd),
      all_day: 0,
      description: "Grade 5 prep",
      location: "Music Academy",
    });
  }

  events.push({
    event_key: `${PREFIX}standalone-3`,
    google_event_id: `${PREFIX}standalone-3`,
    recurring_event_id: null,
    title: "[TEST] Birthday party",
    start: iso(addDays(now, 14)),
    end: iso(addDays(now, 14)),
    all_day: 0,
    description: "Surprise party",
    location: "The Red Lion",
  });

  for (const e of events) {
    await pool.query(
      `INSERT INTO events (event_key, calendar_id, google_event_id, ical_uid, recurring_event_id, title, description, location, "start", "end", all_day, updated, status, deleted, raw_json)
       VALUES ($1, $2, $3, NULL, $4, $5, $6, $7, $8, $9, $10, NOW()::TEXT, 'confirmed', 0, '{}')
       ON CONFLICT(event_key) DO UPDATE SET
         recurring_event_id=excluded.recurring_event_id,
         title=excluded.title,
         description=excluded.description,
         location=excluded.location,
         "start"=excluded."start",
         "end"=excluded."end",
         all_day=excluded.all_day`,
      [e.event_key, CAL_ID, e.google_event_id, e.recurring_event_id, e.title, e.description, e.location, e.start, e.end, e.all_day]
    );

    await pool.query(
      `INSERT INTO event_meta (event_key, category, is_major, project_id, notes_url, locked, updated_at)
       VALUES ($1, 'unknown', 0, NULL, NULL, 0, NOW()::TEXT)
       ON CONFLICT(event_key) DO NOTHING`,
      [e.event_key]
    );
  }

  console.log(`  Inserted ${events.length} test events`);
  console.log(`  - 4 standalone events (no recurring ID)`);
  console.log(`  - 8 weekly standup instances (recurring)`);
  console.log(`  - 6 piano lesson instances (recurring)`);
  console.log("Done. Run with --clean to remove all test data.");
}

async function main() {
  try {
    if (process.argv.includes("--clean")) {
      await clean();
    } else {
      await seed();
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
