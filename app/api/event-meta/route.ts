import { ok, handleError, bad } from "@/lib/http";
import { requireAuth } from "@/lib/session";
import { getDb } from "@/lib/db";

export async function PUT(req: Request) {
  try {
    requireAuth();
    const body = await req.json();
    const eventKey = body?.eventKey;
    if (!eventKey || typeof eventKey !== "string") return bad(400, "eventKey required");
    const category = typeof body?.category === "string" ? body.category : null;
    const isMajor = body?.isMajor ? 1 : 0;
    const projectId = typeof body?.projectId === "string" ? body.projectId : null;
    const notesUrl = typeof body?.notesUrl === "string" ? body.notesUrl : null;

    const db = await getDb();

    const existing = await db.get("SELECT event_key FROM event_meta WHERE event_key=?", eventKey);
    if (existing) {
      await db.run(
        `UPDATE event_meta
         SET category=COALESCE(?, category),
             is_major=?,
             project_id=?,
             notes_url=?,
             locked=1,
             updated_at=datetime('now')
         WHERE event_key=?`,
        category,
        isMajor,
        projectId,
        notesUrl,
        eventKey
      );
    } else {
      await db.run(
        `INSERT INTO event_meta (event_key, category, is_major, project_id, notes_url, locked, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, datetime('now'))`,
        eventKey,
        category || "unknown",
        isMajor,
        projectId,
        notesUrl
      );
    }

    return ok({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
