import { ok, handleError } from "@/lib/http";
import { requireAuth } from "@/lib/session";
import { getDb } from "@/lib/db";

export async function POST() {
  try {
    await requireAuth();
    const db = await getDb();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();

    const result = await db.run(
      `UPDATE actions
       SET due_at = $1, updated_at = NOW()::TEXT
       WHERE status = 'open'
         AND (is_template = 0 OR is_template IS NULL)
         AND due_at IS NOT NULL
         AND due_at < $1`,
      [todayIso]
    );

    return ok({ updated: result.rowCount ?? 0 });
  } catch (e) {
    return handleError(e);
  }
}
