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
    if (typeof body?.name === "string") allowed.name = body.name.trim();
    if (typeof body?.status === "string") allowed.status = body.status;
    if (typeof body?.priority === "string") allowed.priority = body.priority;
    if (typeof body?.targetDate === "string" || body?.targetDate === null) allowed.target_date = body.targetDate;
    if (typeof body?.description === "string" || body?.description === null) allowed.description = body.description;
    if (Array.isArray(body?.tags)) allowed.tags = jsonStringify(body.tags);
    if (typeof body?.driveFolderUrl === "string" || body?.driveFolderUrl === null) allowed.drive_folder_url = body.driveFolderUrl;
    if (Array.isArray(body?.keyDocUrls)) allowed.key_doc_urls = jsonStringify(body.keyDocUrls);

    const keys = Object.keys(allowed);
    if (!keys.length) return bad(400, "No updatable fields provided");

    const sets = keys.map((k) => `${k}=?`).join(", ");
    const vals = keys.map((k) => allowed[k]);
    await db.run(`UPDATE projects SET ${sets}, updated_at=datetime('now') WHERE id=?`, ...vals, id);

    return ok({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    requireAuth();
    const db = await getDb();
    await db.run("DELETE FROM projects WHERE id=?", params.id);
    return ok({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
