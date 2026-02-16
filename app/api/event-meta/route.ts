import { ok, handleError, bad } from "@/lib/http";
import { requireAuth } from "@/lib/session";
import { getDb } from "@/lib/db";

export async function PUT(req: Request) {
  try {
    await requireAuth();
    const body = await req.json();
    const eventKey = body?.eventKey;
    if (!eventKey || typeof eventKey !== "string") return bad(400, "eventKey required");
    const category = typeof body?.category === "string" ? body.category : null;
    const isMajor = body?.isMajor ? 1 : 0;
    const projectId = typeof body?.projectId === "string" ? body.projectId : null;
    const notesUrl = typeof body?.notesUrl === "string" ? body.notesUrl : null;

    const db = await getDb();

    const existing = await db.get("SELECT event_key FROM event_meta WHERE event_key=$1", [eventKey]);
    if (existing) {
      await db.run(
        `UPDATE event_meta
         SET category=COALESCE($1, category),
             is_major=$2,
             project_id=$3,
             notes_url=$4,
             locked=1,
             updated_at=NOW()::TEXT
         WHERE event_key=$5`,
        [category, isMajor, projectId, notesUrl, eventKey]
      );
    } else {
      await db.run(
        `INSERT INTO event_meta (event_key, category, is_major, project_id, notes_url, locked, updated_at)
         VALUES ($1, $2, $3, $4, $5, 1, NOW()::TEXT)`,
        [eventKey, category || "unknown", isMajor, projectId, notesUrl]
      );
    }

    return ok({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
