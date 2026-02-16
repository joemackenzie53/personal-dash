import { ok, bad, handleError } from "@/lib/http";
import { setSessionCookie, authIsRequired } from "@/lib/session";

export async function POST(req: Request) {
  try {
    if (!authIsRequired()) {
      // nothing to do, but allow clients to proceed
      setSessionCookie();
      return ok({ ok: true });
    }
    const body = await req.json();
    const password = typeof body?.password === "string" ? body.password : "";
    const expected = process.env.APP_PASSWORD || "";
    if (!expected) return bad(500, "APP_PASSWORD not set");
    if (password !== expected) return bad(401, "Invalid password");
    setSessionCookie();
    return ok({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
