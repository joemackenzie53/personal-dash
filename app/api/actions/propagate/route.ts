import { ok, handleError, bad } from "@/lib/http";
import { requireAuth } from "@/lib/session";
import { propagateTemplates } from "@/lib/templates";

export async function POST(req: Request) {
  try {
    await requireAuth();
    const body = await req.json();
    const eventKey = typeof body?.eventKey === "string" ? body.eventKey : "";
    if (!eventKey) return bad(400, "eventKey required");

    const created = await propagateTemplates(eventKey);
    return ok({ ok: true, created });
  } catch (e) {
    return handleError(e);
  }
}
