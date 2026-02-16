import { ok, handleError } from "@/lib/http";
import { clearSessionCookie } from "@/lib/session";

export async function POST() {
  try {
    clearSessionCookie();
    return ok({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
