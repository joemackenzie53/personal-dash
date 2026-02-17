import { ok, handleError, bad } from "@/lib/http";
import { requireAuth } from "@/lib/session";
import { getDb, jsonParse, jsonStringify } from "@/lib/db";
import { newId } from "@/lib/id";
import { propagateToAllSiblings } from "@/lib/templates";

export async function GET(req: Request) {
  try {
    await requireAuth();
    const url = new URL(req.url);
    const status = url.searchParams.get("status") || "open";
    const parentType = url.searchParams.get("parentType");
    const parentId = url.searchParams.get("parentId");

    const db = await getDb();
    const where: string[] = ["(is_template = 0 OR is_template IS NULL)"];
    const params: any[] = [];
    let idx = 1;

    if (status !== "all") {
      where.push(`status = $${idx++}`);
      params.push(status);
    }
    if (parentType && parentId) {
      where.push(`parent_type = $${idx++} AND parent_id = $${idx++}`);
      params.push(parentType, parentId);
    }

    const rows = await db.all(
      `SELECT * FROM actions ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY 
         CASE WHEN due_at IS NULL THEN 1 ELSE 0 END,
         due_at ASC,
         created_at DESC
       LIMIT 2000`,
      params
    );

    const mapped = rows.map((r: any) => ({
      ...r,
      tags: jsonParse(r.tags, []),
      checklist: jsonParse(r.checklist, [])
    }));

    return ok({ actions: mapped });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    await requireAuth();
    const body = await req.json();
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    if (!title) return bad(400, "title required");

    const db = await getDb();
    const id = newId("act");

    const isTemplate = body?.isTemplate ? 1 : 0;
    const dueDaysBefore = typeof body?.dueDaysBefore === "number" && body.dueDaysBefore >= 0 ? body.dueDaysBefore : null;

    const row = {
      id,
      title,
      status: "open",
      priority: body?.priority === "high" || body?.priority === "low" ? body.priority : "med",
      start_at: typeof body?.startAt === "string" ? body.startAt : null,
      due_at: typeof body?.dueAt === "string" ? body.dueAt : null,
      snooze_until: typeof body?.snoozeUntil === "string" ? body.snoozeUntil : null,
      tags: jsonStringify(Array.isArray(body?.tags) ? body.tags : []),
      parent_type: typeof body?.parentType === "string" ? body.parentType : null,
      parent_id: typeof body?.parentId === "string" ? body.parentId : null,
      reference_url: typeof body?.referenceUrl === "string" ? body.referenceUrl : null,
      checklist: jsonStringify(Array.isArray(body?.checklist) ? body.checklist : []),
      is_template: isTemplate,
      due_days_before: dueDaysBefore,
    };

    await db.run(
      `INSERT INTO actions (id, title, status, priority, start_at, due_at, snooze_until, tags, parent_type, parent_id, reference_url, checklist, is_template, due_days_before, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW()::TEXT, NOW()::TEXT)`,
      [row.id, row.title, row.status, row.priority, row.start_at, row.due_at, row.snooze_until, row.tags, row.parent_type, row.parent_id, row.reference_url, row.checklist, row.is_template, row.due_days_before]
    );

    if (isTemplate && row.parent_type === "event" && row.parent_id) {
      await propagateToAllSiblings(row.parent_id).catch(() => {});
    }

    return ok({ ok: true, id });
  } catch (e) {
    return handleError(e);
  }
}
