import { getDb } from "@/lib/db";
import { newId } from "@/lib/id";

type TemplateAction = {
  id: string;
  title: string;
  priority: string;
  parent_id: string;
};

export async function propagateTemplates(eventKey: string): Promise<number> {
  const db = await getDb();

  const event = await db.get<{
    event_key: string;
    title: string;
    recurring_event_id: string | null;
    calendar_id: string;
    start: string;
  }>(
    `SELECT event_key, title, recurring_event_id, calendar_id, "start" FROM events WHERE event_key=$1`,
    [eventKey]
  );
  if (!event) return 0;

  const templates = await findTemplatesForSeries(event);
  if (templates.length === 0) return 0;

  const existing = await db.all<{ generated_from_action_id: string }>(
    `SELECT generated_from_action_id FROM actions
     WHERE parent_type='event' AND parent_id=$1 AND generated_from_action_id IS NOT NULL`,
    [eventKey]
  );
  const alreadyGenerated = new Set(existing.map((r) => r.generated_from_action_id));

  let created = 0;
  for (const tpl of templates) {
    if (alreadyGenerated.has(tpl.id)) continue;

    const id = newId("act");
    await db.run(
      `INSERT INTO actions (id, title, status, priority, tags, parent_type, parent_id, checklist, is_template, generated_from_action_id, created_at, updated_at)
       VALUES ($1, $2, 'open', $3, '[]', 'event', $4, '[]', 0, $5, NOW()::TEXT, NOW()::TEXT)`,
      [id, tpl.title, tpl.priority, eventKey, tpl.id]
    );
    created++;
  }

  return created;
}

export async function propagateToAllSiblings(eventKey: string): Promise<number> {
  const db = await getDb();

  const event = await db.get<{
    event_key: string;
    title: string;
    recurring_event_id: string | null;
    calendar_id: string;
  }>(
    `SELECT event_key, title, recurring_event_id, calendar_id FROM events WHERE event_key=$1`,
    [eventKey]
  );
  if (!event) return 0;

  const siblings = await getSiblingKeys(event);
  let total = 0;
  for (const key of siblings) {
    total += await propagateTemplates(key);
  }
  total += await propagateTemplates(eventKey);
  return total;
}

export async function deleteTemplateAndCopies(templateActionId: string): Promise<void> {
  const db = await getDb();
  await db.run(
    `DELETE FROM actions WHERE generated_from_action_id=$1`,
    [templateActionId]
  );
  await db.run(
    `DELETE FROM actions WHERE id=$1`,
    [templateActionId]
  );
}

export async function getSeriesTemplates(eventKey: string): Promise<TemplateAction[]> {
  const db = await getDb();

  const event = await db.get<{
    event_key: string;
    title: string;
    recurring_event_id: string | null;
    calendar_id: string;
  }>(
    `SELECT event_key, title, recurring_event_id, calendar_id FROM events WHERE event_key=$1`,
    [eventKey]
  );
  if (!event) return [];

  return findTemplatesForSeries(event);
}

async function findTemplatesForSeries(event: {
  event_key: string;
  title: string;
  recurring_event_id: string | null;
  calendar_id: string;
}): Promise<TemplateAction[]> {
  const db = await getDb();
  const templates: TemplateAction[] = [];
  const seenIds = new Set<string>();

  const allKeys = await getSiblingKeys(event);
  allKeys.push(event.event_key);

  if (allKeys.length > 0) {
    const placeholders = allKeys.map((_, i) => `$${i + 1}`).join(",");
    const rows = await db.all<TemplateAction>(
      `SELECT id, title, priority, parent_id FROM actions
       WHERE is_template=1 AND parent_type='event' AND parent_id IN (${placeholders})`,
      allKeys
    );
    for (const r of rows) {
      if (!seenIds.has(r.id)) {
        seenIds.add(r.id);
        templates.push(r);
      }
    }
  }

  return templates;
}

async function getSiblingKeys(event: {
  event_key: string;
  title: string;
  recurring_event_id: string | null;
  calendar_id: string;
}): Promise<string[]> {
  const db = await getDb();

  if (event.recurring_event_id) {
    const rows = await db.all<{ event_key: string }>(
      `SELECT event_key FROM events
       WHERE recurring_event_id=$1 AND event_key != $2`,
      [event.recurring_event_id, event.event_key]
    );
    return rows.map((r) => r.event_key);
  }

  const normalizedTitle = (event.title || "").trim().toLowerCase();
  if (normalizedTitle) {
    const rows = await db.all<{ event_key: string }>(
      `SELECT event_key FROM events
       WHERE LOWER(TRIM(title))=$1 AND event_key != $2 AND calendar_id=$3`,
      [normalizedTitle, event.event_key, event.calendar_id]
    );
    return rows.map((r) => r.event_key);
  }

  return [];
}
