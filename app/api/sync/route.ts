import { ok, handleError } from "@/lib/http";
import { requireAuth } from "@/lib/session";
import { ensureCalendarsFromGoogle, syncAllSelected } from "@/lib/sync";

export async function POST() {
  try {
    requireAuth();
    await ensureCalendarsFromGoogle();
    const result = await syncAllSelected();
    return ok({ ok: true, ...result });
  } catch (e) {
    return handleError(e);
  }
}
