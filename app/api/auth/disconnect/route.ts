import { ok, handleError } from "@/lib/http";
import { clearSessionCookie, requireAuth } from "@/lib/session";
import { getDb } from "@/lib/db";

export async function POST() {
  try {
    requireAuth();
    const db = await getDb();
    await db.run("UPDATE oauth_tokens SET refresh_token=NULL, access_token=NULL, access_token_expiry=NULL, updated_at=datetime('now') WHERE id=1");
    await db.run("DELETE FROM calendar_sync_state");
    await db.run("DELETE FROM calendars");
    await db.run("DELETE FROM events");
    await db.run("DELETE FROM event_meta");
    await db.run("UPDATE user_config SET selected_calendar_ids='[]', last_sync_at=NULL WHERE id=1");
    clearSessionCookie();
    return ok({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
