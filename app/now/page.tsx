"use client";
import * as React from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Notice } from "@/components/Notice";
import { Badge } from "@/components/ui/Badge";
import { fmtDate, fmtTime, isAllDay } from "@/lib/format";
import { EventDetailModal } from "@/components/EventDetailModal";
import { ActionDetailModal } from "@/components/ActionDetailModal";

type Settings = {
  connected: boolean;
  horizonDays: number;
  refreshIntervalMinutes: number;
  selectedCalendarIds: string[];
  lastSyncAt: string | null;
};

type EventRow = {
  event_key: string;
  title: string;
  start: string;
  end: string;
  all_day: number;
  recurring_event_id: string | null;
  category: string | null;
  is_major: number | null;
  project_id: string | null;
  notes_url: string | null;
  locked: number | null;
  description: string | null;
  location: string | null;
  deleted: number;
};

type ProjectRow = { id: string; name: string; status: string };

type ActionRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_at: string | null;
  parent_type: string | null;
  parent_id: string | null;
  parent_name: string | null;
};

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

export default function NowPage() {
  const [settings, setSettings] = React.useState<Settings | null>(null);
  const [events, setEvents] = React.useState<EventRow[]>([]);
  const [actions, setActions] = React.useState<ActionRow[]>([]);
  const [projects, setProjects] = React.useState<ProjectRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = React.useState<EventRow | null>(null);
  const [selectedAction, setSelectedAction] = React.useState<ActionRow | null>(null);

  const [newTitle, setNewTitle] = React.useState("");
  const [newDue, setNewDue] = React.useState<string>("");
  const [newParent, setNewParent] = React.useState<string>("");

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const s = await api<Settings>("/api/settings");
      setSettings(s);

      const from = startOfDay(new Date()).toISOString();
      const to = addDays(new Date(), 14).toISOString();
      const ev = await api<{ events: EventRow[] }>(`/api/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      setEvents(ev.events);

      const ac = await api<{ actions: ActionRow[] }>("/api/actions?status=open");
      setActions(ac.actions);

      const pr = await api<{ projects: ProjectRow[] }>("/api/projects?status=active");
      setProjects(pr.projects);
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
  }, []);

  async function runSync() {
    setErr(null);
    try {
      await api("/api/sync", { method: "POST" });
      await load();
    } catch (e: any) {
      setErr(e?.message || "Sync failed");
    }
  }

  async function addAction() {
    setErr(null);
    try {
      const dueAt = newDue ? new Date(newDue).toISOString() : null;
      let parentType: string | null = null;
      let parentId: string | null = null;
      if (newParent) {
        const [type, ...rest] = newParent.split(":");
        parentType = type;
        parentId = rest.join(":");
      }
      await api("/api/actions", {
        method: "POST",
        body: JSON.stringify({ title: newTitle, dueAt, parentType, parentId })
      });
      setNewTitle("");
      setNewDue("");
      setNewParent("");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to add");
    }
  }

  const overdue = actions.filter((a) => a.due_at && new Date(a.due_at) < new Date());
  const dueSoon = actions.filter((a) => a.due_at && new Date(a.due_at) >= new Date() && new Date(a.due_at) <= addDays(new Date(), 3));
  const unscheduled = actions.filter((a) => !a.due_at);

  const projectMap = React.useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of projects) m[p.id] = p.name;
    return m;
  }, [projects]);

  const eventMap = React.useMemo(() => {
    const m: Record<string, string> = {};
    for (const e of events) m[e.event_key] = e.title || "(no title)";
    return m;
  }, [events]);

  function parentLabel(a: ActionRow) {
    if (!a.parent_type || !a.parent_id) return null;
    if (a.parent_name) return a.parent_name;
    if (a.parent_type === "project") return projectMap[a.parent_id] || "Project";
    if (a.parent_type === "event") return eventMap[a.parent_id] || "Event";
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Now</h1>
          <p className="mt-1 text-sm text-neutral-600">
            The action queue + your next couple of weeks of events.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={load} disabled={loading}>Refresh</Button>
          <Button onClick={runSync} disabled={loading}>Sync</Button>
        </div>
      </div>

      {err && (
        <Notice tone="red">
          {err === "Unauthorized" ? (
            <>
              Unauthorized. <a className="underline" href="/login">Log in</a>.
            </>
          ) : (
            err
          )}
        </Notice>
      )}

      {!settings?.connected && (
        <Notice tone="amber">
          You&apos;re not connected to Google Calendar yet.{" "}
          <Link className="underline" href="/settings">Go to Settings</Link> to connect.
        </Notice>
      )}

      <Card>
        <CardHeader>
          <div className="text-sm font-semibold">Quick add</div>
          <div className="text-xs text-neutral-600">Capture an action fast (you can triage later).</div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-[1fr,160px,180px,auto]">
            <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Order Gizem's birthday present" onKeyDown={(e) => { if (e.key === "Enter" && newTitle.trim()) addAction(); }} />
            <Input type="date" value={newDue} onChange={(e) => setNewDue(e.target.value)} />
            <Select value={newParent} onChange={(e) => setNewParent(e.target.value)} className="text-sm">
              <option value="">No link</option>
              {projects.length > 0 && <optgroup label="Projects">
                {projects.map((p) => (
                  <option key={p.id} value={`project:${p.id}`}>{p.name}</option>
                ))}
              </optgroup>}
              {events.length > 0 && <optgroup label="Upcoming events">
                {events.slice(0, 15).map((e) => (
                  <option key={e.event_key} value={`event:${e.event_key}`}>{e.title || "(no title)"}</option>
                ))}
              </optgroup>}
            </Select>
            <Button onClick={addAction} disabled={!newTitle.trim()}>Add</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Action queue</div>
              <div className="text-xs text-neutral-500">{actions.length} open</div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading && <div className="text-sm text-neutral-500">Loading…</div>}

            {!loading && actions.length === 0 && (
              <div className="text-sm text-neutral-500">No open actions.</div>
            )}

            {!!overdue.length && (
              <section className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Overdue</div>
                <ul className="space-y-2">
                  {overdue.slice(0, 8).map((a) => (
                    <li key={a.id} className="cursor-pointer rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 hover:bg-neutral-100" onClick={() => setSelectedAction(a)}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-medium">{a.title}</div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-neutral-600">
                            {a.due_at && <span>{fmtDate(a.due_at)}</span>}
                            {parentLabel(a) && (
                              <span className="inline-flex items-center gap-1 rounded bg-neutral-200/60 px-1.5 py-0.5 text-neutral-600">
                                {a.parent_type === "project" ? (
                                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                                ) : (
                                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                )}
                                {parentLabel(a)}
                              </span>
                            )}
                          </div>
                        </div>
                        <Badge tone="red">{fmtDate(a.due_at || "")}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {!!dueSoon.length && (
              <section className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Due soon</div>
                <ul className="space-y-2">
                  {dueSoon.slice(0, 8).map((a) => (
                    <li key={a.id} className="cursor-pointer rounded-lg border border-neutral-200 px-3 py-2 hover:bg-neutral-50" onClick={() => setSelectedAction(a)}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-medium">{a.title}</div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-neutral-600">
                            {a.due_at && <span>{fmtDate(a.due_at)}</span>}
                            {parentLabel(a) && (
                              <span className="inline-flex items-center gap-1 rounded bg-neutral-200/60 px-1.5 py-0.5 text-neutral-600">
                                {a.parent_type === "project" ? (
                                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                                ) : (
                                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                )}
                                {parentLabel(a)}
                              </span>
                            )}
                          </div>
                        </div>
                        <Badge tone="amber">{fmtDate(a.due_at || "")}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {!!unscheduled.length && (
              <section className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Unscheduled</div>
                <ul className="space-y-2">
                  {unscheduled.slice(0, 8).map((a) => (
                    <li key={a.id} className="cursor-pointer rounded-lg border border-neutral-200 px-3 py-2 hover:bg-neutral-50" onClick={() => setSelectedAction(a)}>
                      <div>
                        <div className="text-sm font-medium">{a.title}</div>
                        {parentLabel(a) && (
                          <div className="mt-0.5 text-xs">
                            <span className="inline-flex items-center gap-1 rounded bg-neutral-200/60 px-1.5 py-0.5 text-neutral-600">
                              {a.parent_type === "project" ? (
                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                              )}
                              {parentLabel(a)}
                            </span>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Upcoming events</div>
              <div className="text-xs text-neutral-500">next 14 days</div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading && <div className="text-sm text-neutral-500">Loading…</div>}
            {!loading && events.length === 0 && <div className="text-sm text-neutral-500">No events in this window.</div>}

            <ul className="space-y-2">
              {events.slice(0, 20).map((e) => {
                const allDay = isAllDay(e.start, e.all_day);
                return (
                  <li
                    key={e.event_key}
                    className="cursor-pointer rounded-lg border border-neutral-200 px-3 py-2 hover:bg-neutral-50"
                    onClick={() => setSelectedEvent(e)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-1.5 text-sm font-medium">
                          {e.recurring_event_id && (
                            <svg className="shrink-0 text-neutral-400" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="17 1 21 5 17 9" />
                              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                              <polyline points="7 23 3 19 7 15" />
                              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                            </svg>
                          )}
                          {e.title || "(no title)"}
                        </div>
                        <div className="text-xs text-neutral-600">
                          {fmtDate(e.start)}{" "}
                          {!allDay ? <>• {fmtTime(e.start)}</> : <span className="text-neutral-500">(all day)</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {e.is_major ? <Badge tone="purple">Major</Badge> : null}
                        {e.category && e.category !== "unknown" ? <Badge>{e.category}</Badge> : <Badge tone="neutral">unknown</Badge>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="pt-2">
              <Link href="/horizon" className="text-sm font-medium text-neutral-900 underline">
                View full horizon →
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <EventDetailModal
        event={selectedEvent}
        projects={projects}
        onClose={() => setSelectedEvent(null)}
        onSaved={load}
      />

      <ActionDetailModal
        action={selectedAction}
        projects={projects}
        events={events.slice(0, 15).map((e) => ({ event_key: e.event_key, title: e.title || "(no title)" }))}
        onClose={() => setSelectedAction(null)}
        onSaved={load}
      />
    </div>
  );
}
