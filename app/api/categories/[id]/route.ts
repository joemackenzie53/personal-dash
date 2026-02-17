import { ok, handleError, bad } from "@/lib/http";
import { requireAuth } from "@/lib/session";
import { getDb } from "@/lib/db";
import { invalidateClassifyCache } from "@/lib/classify";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await req.json();
    const db = await getDb();

    const updates: string[] = [];
    const vals: any[] = [];
    let idx = 1;

    if (typeof body?.name === "string" && body.name.trim()) {
      updates.push(`name=$${idx++}`);
      vals.push(body.name.trim());
    }
    if ("pattern" in body) {
      const pat = typeof body.pattern === "string" ? body.pattern.trim() || null : null;
      updates.push(`pattern=$${idx++}`);
      vals.push(pat);
    }
    if (typeof body?.sort_order === "number") {
      updates.push(`sort_order=$${idx++}`);
      vals.push(body.sort_order);
    }

    if (!updates.length) return bad(400, "No updatable fields");

    vals.push(id);
    await db.run(`UPDATE categories SET ${updates.join(", ")} WHERE id=$${idx}`, vals);
    invalidateClassifyCache();
    return ok({ ok: true });
  } catch (e: any) {
    if (e?.code === "23505") return bad(409, "Category name already exists");
    return handleError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    const db = await getDb();
    await db.run("DELETE FROM categories WHERE id=$1", [id]);
    invalidateClassifyCache();
    return ok({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
