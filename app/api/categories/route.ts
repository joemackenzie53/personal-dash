import { ok, handleError, bad } from "@/lib/http";
import { requireAuth } from "@/lib/session";
import { getDb } from "@/lib/db";
import { invalidateClassifyCache } from "@/lib/classify";
import crypto from "crypto";

export async function GET() {
  try {
    await requireAuth();
    const db = await getDb();
    const categories = await db.all("SELECT id, name, pattern, sort_order FROM categories ORDER BY sort_order ASC, name ASC");
    return ok({ categories });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    await requireAuth();
    const body = await req.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) return bad(400, "Name is required");
    const pattern = typeof body?.pattern === "string" ? body.pattern.trim() || null : null;

    const db = await getDb();
    const id = crypto.randomUUID();
    const maxOrder = await db.get<{ mx: number }>("SELECT COALESCE(MAX(sort_order), 0) as mx FROM categories");
    const sortOrder = (maxOrder?.mx ?? 0) + 1;

    await db.run(
      "INSERT INTO categories (id, name, pattern, sort_order) VALUES ($1, $2, $3, $4)",
      [id, name, pattern, sortOrder]
    );
    invalidateClassifyCache();
    return ok({ id, name, pattern, sort_order: sortOrder });
  } catch (e: any) {
    if (e?.code === "23505") return bad(409, "Category already exists");
    return handleError(e);
  }
}
