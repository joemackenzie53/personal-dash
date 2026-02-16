import { ok, handleError } from "@/lib/http";
import { requireAuth } from "@/lib/session";
import { getDb } from "@/lib/db";

export async function GET(req: Request) {
  try {
    await requireAuth();
    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const includeDeleted = url.searchParams.get("includeDeleted") === "1";

    const db = await getDb();
    const where: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (from) {
      where.push(`e."start" >= $${idx++}`);
      params.push(from);
    }
    if (to) {
      where.push(`e."start" <= $${idx++}`);
      params.push(to);
    }
    if (!includeDeleted) {
      where.push("e.deleted = 0");
    }

    const sql = `
      SELECT
        e.event_key, e.calendar_id, e.google_event_id, e.title, e.description, e.location,
        e."start", e."end", e.all_day, e.status, e.deleted,
        m.category, m.is_major, m.project_id, m.notes_url, m.locked
      FROM events e
      LEFT JOIN event_meta m ON m.event_key = e.event_key
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY e."start" ASC
      LIMIT 2000
    `;
    const rows = await db.all(sql, params);
    return ok({ events: rows });
  } catch (e) {
    return handleError(e);
  }
}
