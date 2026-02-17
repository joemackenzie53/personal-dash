import { ok, handleError, bad } from "@/lib/http";
import { requireAuth } from "@/lib/session";
import { getSeriesTemplates } from "@/lib/templates";

export async function GET(req: Request) {
  try {
    await requireAuth();
    const url = new URL(req.url);
    const eventKey = url.searchParams.get("eventKey");
    if (!eventKey) return bad(400, "eventKey required");

    const templates = await getSeriesTemplates(eventKey);
    return ok({ templates });
  } catch (e) {
    return handleError(e);
  }
}
