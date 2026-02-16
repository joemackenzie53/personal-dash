import { ok, handleError, bad } from "@/lib/http";
import { requireAuth } from "@/lib/session";
import { getDb, jsonParse, jsonStringify } from "@/lib/db";
import { newId } from "@/lib/id";

export async function GET(req: Request) {
  try {
    requireAuth();
    const url = new URL(req.url);
    const status = url.searchParams.get("status") || "active";
    const db = await getDb();

    const where = status === "all" ? "" : "WHERE status = ?";
    const rows = await db.all(
      `SELECT * FROM projects ${where} ORDER BY 
        CASE priority WHEN 'high' THEN 0 WHEN 'med' THEN 1 ELSE 2 END,
        updated_at DESC`,
      ...(status === "all" ? [] : [status])
    );

    const mapped = rows.map((r: any) => ({
      ...r,
      tags: jsonParse(r.tags, []),
      key_doc_urls: jsonParse(r.key_doc_urls, [])
    }));

    // counts
    const counts = await db.all<{ project_id: string; open_actions: number }>(
      `SELECT parent_id as project_id, COUNT(*) as open_actions FROM actions WHERE status='open' AND parent_type='project' GROUP BY parent_id`
    ).catch(() => [] as any);

    const byId = new Map<string, number>(counts.map((c: any) => [c.project_id, c.open_actions]));
    const withCounts = mapped.map((p: any) => ({ ...p, openActions: byId.get(p.id) || 0 }));

    return ok({ projects: withCounts });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    requireAuth();
    const body = await req.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) return bad(400, "name required");

    const db = await getDb();
    const id = newId("proj");

    await db.run(
      `INSERT INTO projects (id, name, status, priority, target_date, description, tags, drive_folder_url, key_doc_urls, created_at, updated_at)
       VALUES (?, ?, 'active', ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      id,
      name,
      body?.priority === "high" || body?.priority === "low" ? body.priority : "med",
      typeof body?.targetDate === "string" ? body.targetDate : null,
      typeof body?.description === "string" ? body.description : null,
      jsonStringify(Array.isArray(body?.tags) ? body.tags : []),
      typeof body?.driveFolderUrl === "string" ? body.driveFolderUrl : null,
      jsonStringify(Array.isArray(body?.keyDocUrls) ? body.keyDocUrls : [])
    );

    return ok({ ok: true, id });
  } catch (e) {
    return handleError(e);
  }
}
