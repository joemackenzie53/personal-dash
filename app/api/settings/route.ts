import { getDb, jsonParse, jsonStringify } from "@/lib/db";
import { ok, handleError, bad } from "@/lib/http";
import { getStoredRefreshToken } from "@/lib/google";
import { requireAuth } from "@/lib/session";

export async function GET() {
  try {
    const db = await getDb();
    const cfg = await db.get<any>("SELECT horizon_days, refresh_interval_minutes, selected_calendar_ids, last_sync_at FROM user_config WHERE id=1");
    const connected = !!(await getStoredRefreshToken());
    return ok({
      connected,
      horizonDays: cfg?.horizon_days ?? 182,
      refreshIntervalMinutes: cfg?.refresh_interval_minutes ?? 10,
      selectedCalendarIds: jsonParse<string[]>(cfg?.selected_calendar_ids, []),
      lastSyncAt: cfg?.last_sync_at ?? null
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function PUT(req: Request) {
  try {
    requireAuth();
    const body = await req.json();
    const db = await getDb();

    const horizonDays = Number(body?.horizonDays);
    const refreshIntervalMinutes = Number(body?.refreshIntervalMinutes);
    const selectedCalendarIds = Array.isArray(body?.selectedCalendarIds) ? body.selectedCalendarIds : null;

    if (Number.isFinite(horizonDays) && (horizonDays < 14 || horizonDays > 366)) {
      return bad(400, "horizonDays must be between 14 and 366");
    }
    if (Number.isFinite(refreshIntervalMinutes) && (refreshIntervalMinutes < 1 || refreshIntervalMinutes > 240)) {
      return bad(400, "refreshIntervalMinutes must be between 1 and 240");
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (Number.isFinite(horizonDays)) {
      updates.push("horizon_days=?");
      params.push(horizonDays);
    }
    if (Number.isFinite(refreshIntervalMinutes)) {
      updates.push("refresh_interval_minutes=?");
      params.push(refreshIntervalMinutes);
    }
    if (selectedCalendarIds) {
      updates.push("selected_calendar_ids=?");
      params.push(jsonStringify(selectedCalendarIds));
    }

    if (updates.length) {
      await db.run(`UPDATE user_config SET ${updates.join(", ")} WHERE id=1`, ...params);
    }

    // Reflect selection on calendars table
    if (selectedCalendarIds) {
      await db.run("UPDATE calendars SET selected=0");
      if (selectedCalendarIds.length) {
        const placeholders = selectedCalendarIds.map(() => "?").join(",");
        await db.run(`UPDATE calendars SET selected=1 WHERE calendar_id IN (${placeholders})`, ...selectedCalendarIds);
      }
    }

    return ok({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
