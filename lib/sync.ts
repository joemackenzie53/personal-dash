import { getDb, jsonParse, jsonStringify } from "@/lib/db";
import { getCalendarClient } from "@/lib/google";
import { classifyEvent } from "@/lib/classify";

function iso(d: Date) {
  return d.toISOString();
}

function addDays(d: Date, days: number) {
  const x = new Date(d.getTime());
  x.setDate(x.getDate() + days);
  return x;
}

function isUkHolidayCalendar(summary: string | null | undefined) {
  const s = (summary || "").toLowerCase();
  // covers common Google naming
  return s.includes("holidays in united kingdom") || (s.includes("holidays") && s.includes("united kingdom")) || s.includes("uk holidays");
}

export async function ensureCalendarsFromGoogle() {
  const cal = await getCalendarClient();
  const db = await getDb();

  const res = await cal.calendarList.list({ maxResults: 250 });
  const items = res.data.items || [];

  for (const c of items) {
    if (!c.id) continue;
    const primaryFlag = c.primary ? 1 : 0;
    const isHoliday = isUkHolidayCalendar(c.summary || "") ? 1 : 0;

    await db.run(
      `INSERT INTO calendars (calendar_id, summary, primary_flag, is_holiday, selected, updated_at)
       VALUES (?, ?, ?, ?, 0, datetime('now'))
       ON CONFLICT(calendar_id) DO UPDATE SET
         summary=excluded.summary,
         primary_flag=excluded.primary_flag,
         is_holiday=excluded.is_holiday,
         updated_at=datetime('now')`,
      c.id,
      c.summary || c.id,
      primaryFlag,
      isHoliday
    );
  }

  // If user has no selected calendars yet, default to primary + UK holidays if present
  const cfg = await db.get<{ selected_calendar_ids: string }>("SELECT selected_calendar_ids FROM user_config WHERE id=1");
  const selectedIds = jsonParse<string[]>(cfg?.selected_calendar_ids, []);
  if (selectedIds.length === 0) {
    const defaults = await db.all<{ calendar_id: string }>(
      `SELECT calendar_id FROM calendars WHERE primary_flag=1 OR is_holiday=1`
    );
    const ids = defaults.map((r) => r.calendar_id);
    await db.run(`UPDATE user_config SET selected_calendar_ids=? WHERE id=1`, jsonStringify(ids));
    await db.run(`UPDATE calendars SET selected=0`);
    if (ids.length) {
      const placeholders = ids.map(() => "?").join(",");
      await db.run(`UPDATE calendars SET selected=1 WHERE calendar_id IN (${placeholders})`, ...ids);
    }
  } else {
    // reflect selection flags
    await db.run(`UPDATE calendars SET selected=0`);
    if (selectedIds.length) {
      const placeholders = selectedIds.map(() => "?").join(",");
      await db.run(`UPDATE calendars SET selected=1 WHERE calendar_id IN (${placeholders})`, ...selectedIds);
    }
  }

  return await db.all(`SELECT * FROM calendars ORDER BY primary_flag DESC, is_holiday DESC, summary ASC`);
}

type SyncResult = {
  calendarsSynced: number;
  eventsUpserted: number;
  eventsDeletedMarked: number;
  lastSyncAt: string;
};

export async function syncAllSelected(): Promise<SyncResult> {
  const cal = await getCalendarClient();
  const db = await getDb();

  const cfg = await db.get<{ horizon_days: number; selected_calendar_ids: string }>(
    "SELECT horizon_days, selected_calendar_ids FROM user_config WHERE id=1"
  );
  const horizonDays = cfg?.horizon_days ?? 182;
  const selected = jsonParse<string[]>(cfg?.selected_calendar_ids, []);
  const now = new Date();
  const windowStartDefault = addDays(now, -30); // buffer for edits near the past
  const windowEndDefault = addDays(now, horizonDays);

  let calendarsSynced = 0;
  let eventsUpserted = 0;
  let eventsDeletedMarked = 0;

  for (const calendarId of selected) {
    calendarsSynced++;

    const calRow = await db.get<{ summary: string; is_holiday: number }>(
      "SELECT summary, is_holiday FROM calendars WHERE calendar_id=?",
      calendarId
    );
    const calendarSummary = calRow?.summary ?? calendarId;
    const calendarIsHoliday = (calRow?.is_holiday ?? 0) === 1;

    // Determine whether to do incremental sync or full sync
    const state = await db.get<{ sync_token: string | null; window_start: string | null; window_end: string | null }>(
      "SELECT sync_token, window_start, window_end FROM calendar_sync_state WHERE calendar_id=?",
      calendarId
    );

    let syncToken: string | null = state?.sync_token ?? null;
    let windowStart = state?.window_start ? new Date(state.window_start) : windowStartDefault;
    let windowEnd = state?.window_end ? new Date(state.window_end) : windowEndDefault;

    // roll the window if it's too old (keeps timeMin/timeMax stable for incremental sync)
    const ageDays = (now.getTime() - windowStart.getTime()) / (1000 * 60 * 60 * 24);
    if (!syncToken || ageDays > 7 || now > windowEnd) {
      syncToken = null;
      windowStart = windowStartDefault;
      windowEnd = windowEndDefault;
    }

    const timeMin = iso(windowStart);
    const timeMax = iso(windowEnd);

    let pageToken: string | undefined = undefined;

    const fetchPage = async () => {
      return await cal.events.list({
        calendarId,
        timeMin,
        timeMax,
        singleEvents: true,
        showDeleted: true,
        maxResults: 2500,
        pageToken,
        ...(syncToken ? { syncToken } : {})
      });
    };

    let res;
    try {
      res = await fetchPage();
    } catch (e: any) {
      // If sync token expired, Google returns 410. Do a full sync.
      if (e?.code === 410 || e?.status === 410) {
        syncToken = null;
        pageToken = undefined;
        res = await cal.events.list({
          calendarId,
          timeMin,
          timeMax,
          singleEvents: true,
          showDeleted: true,
          maxResults: 2500
        });
      } else {
        throw e;
      }
    }

    while (true) {
      const items = res.data.items || [];
      for (const ev of items) {
        if (!ev.id) continue;
        const eventKey = `${calendarId}:${ev.id}`;
        const status = ev.status || "confirmed";
        const deleted = status === "cancelled" ? 1 : 0;

        const allDay = ev.start?.date ? 1 : 0;
        const start = ev.start?.dateTime || ev.start?.date || null;
        const end = ev.end?.dateTime || ev.end?.date || null;

        await db.run(
          `INSERT INTO events (event_key, calendar_id, google_event_id, ical_uid, title, description, location, start, end, all_day, updated, status, deleted, raw_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(event_key) DO UPDATE SET
             ical_uid=excluded.ical_uid,
             title=excluded.title,
             description=excluded.description,
             location=excluded.location,
             start=excluded.start,
             end=excluded.end,
             all_day=excluded.all_day,
             updated=excluded.updated,
             status=excluded.status,
             deleted=excluded.deleted,
             raw_json=excluded.raw_json`,
          eventKey,
          calendarId,
          ev.id,
          ev.iCalUID || null,
          ev.summary || "",
          ev.description || "",
          ev.location || "",
          start,
          end,
          allDay,
          ev.updated || null,
          status,
          deleted,
          JSON.stringify(ev)
        );
        eventsUpserted++;
        if (deleted) eventsDeletedMarked++;

        // Ensure event_meta exists, but do not overwrite if locked by user
        const meta = await db.get<{ locked: number }>("SELECT locked FROM event_meta WHERE event_key=?", eventKey);
        if (!meta) {
          const category = classifyEvent({ title: ev.summary || "", calendarIsHoliday, calendarSummary });
          await db.run(
            `INSERT INTO event_meta (event_key, category, is_major, project_id, notes_url, locked, updated_at)
             VALUES (?, ?, 0, NULL, NULL, 0, datetime('now'))`,
            eventKey,
            category
          );
        } else if (meta.locked === 0) {
          const category = classifyEvent({ title: ev.summary || "", calendarIsHoliday, calendarSummary });
          await db.run(
            `UPDATE event_meta SET category=?, updated_at=datetime('now') WHERE event_key=?`,
            category,
            eventKey
          );
        }
      }

      pageToken = res.data.nextPageToken || undefined;
      if (!pageToken) {
        // Store sync token + window
        const nextSyncToken = res.data.nextSyncToken || null;
        const lastSyncAt = new Date().toISOString();
        await db.run(
          `INSERT INTO calendar_sync_state (calendar_id, sync_token, window_start, window_end, last_sync_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(calendar_id) DO UPDATE SET
             sync_token=excluded.sync_token,
             window_start=excluded.window_start,
             window_end=excluded.window_end,
             last_sync_at=excluded.last_sync_at`,
          calendarId,
          nextSyncToken,
          timeMin,
          timeMax,
          lastSyncAt
        );
        break;
      }
      res = await cal.events.list({
        calendarId,
        timeMin,
        timeMax,
        singleEvents: true,
        showDeleted: true,
        maxResults: 2500,
        pageToken,
        ...(syncToken ? { syncToken } : {})
      });
    }
  }

  const lastSyncAt = new Date().toISOString();
  await db.run(`UPDATE user_config SET last_sync_at=? WHERE id=1`, lastSyncAt);

  return { calendarsSynced, eventsUpserted, eventsDeletedMarked, lastSyncAt };
}
