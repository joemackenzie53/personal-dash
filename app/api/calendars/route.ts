import { ok, handleError } from "@/lib/http";
import { requireAuth } from "@/lib/session";
import { ensureCalendarsFromGoogle } from "@/lib/sync";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    requireAuth();
    // Refresh from Google, then return
    const rows = await ensureCalendarsFromGoogle();
    return ok({ calendars: rows });
  } catch (e) {
    return handleError(e);
  }
}
