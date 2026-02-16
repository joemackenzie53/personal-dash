import { ok, handleError, bad } from "@/lib/http";
import { requireAuth } from "@/lib/session";
import { getDb, jsonStringify } from "@/lib/db";

export async function POST(req: Request) {
  try {
    requireAuth();
    const body = await req.json();
    const ids = Array.isArray(body?.selectedCalendarIds) ? body.selectedCalendarIds : null;
    if (!ids) return bad(400, "selectedCalendarIds must be an array");
    const db = await getDb();
    await db.run("UPDATE user_config SET selected_calendar_ids=? WHERE id=1", jsonStringify(ids));
    await db.run("UPDATE calendars SET selected=0");
    if (ids.length) {
      const placeholders = ids.map(() => "?").join(",");
      await db.run(`UPDATE calendars SET selected=1 WHERE calendar_id IN (${placeholders})`, ...ids);
    }
    return ok({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
