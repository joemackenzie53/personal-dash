import { ok, handleError, bad } from "@/lib/http";
import { requireAuth } from "@/lib/session";
import { getDb, jsonStringify } from "@/lib/db";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    requireAuth();
    const id = params.id;
    const body = await req.json();
    const db = await getDb();

    const allowed: Record<string, any> = {};
    if (typeof body?.title === "string") allowed.title = body.title.trim();
    if (typeof body?.status === "string") allowed.status = body.status;
    if (typeof body?.priority === "string") allowed.priority = body.priority;
    if (typeof body?.startAt === "string" || body?.startAt === null) allowed.start_at = body.startAt;
    if (typeof body?.dueAt === "string" || body?.dueAt === null) allowed.due_at = body.dueAt;
    if (typeof body?.snoozeUntil === "string" || body?.snoozeUntil === null) allowed.snooze_until = body.snoozeUntil;
    if (Array.isArray(body?.tags)) allowed.tags = jsonStringify(body.tags);
    if (typeof body?.referenceUrl === "string" || body?.referenceUrl === null) allowed.reference_url = body.referenceUrl;
    if (Array.isArray(body?.checklist)) allowed.checklist = jsonStringify(body.checklist);

    const keys = Object.keys(allowed);
    if (!keys.length) return bad(400, "No updatable fields provided");

    const sets = keys.map((k) => `${k}=?`).join(", ");
    const vals = keys.map((k) => allowed[k]);
    await db.run(`UPDATE actions SET ${sets}, updated_at=datetime('now') WHERE id=?`, ...vals, id);

    return ok({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    requireAuth();
    const db = await getDb();
    await db.run("DELETE FROM actions WHERE id=?", params.id);
    return ok({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
