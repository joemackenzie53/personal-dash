"use client";
import * as React from "react";
import { api } from "@/lib/client";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Notice } from "@/components/Notice";
import { Badge } from "@/components/ui/Badge";
import { fmtDate } from "@/lib/format";
import { ActionDetailModal } from "@/components/ActionDetailModal";

type ProjectRow = { id: string; name: string; status: string };

type EventOption = { event_key: string; title: string };

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

type EventRow = {
  event_key: string;
  title: string;
  start: string;
  end: string;
  all_day: number;
};

export default function ActionsPage() {
  const [actions, setActions] = React.useState<ActionRow[]>([]);
  const [projects, setProjects] = React.useState<ProjectRow[]>([]);
  const [events, setEvents] = React.useState<EventRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [selectedAction, setSelectedAction] = React.useState<ActionRow | null>(null);
  const [showDone, setShowDone] = React.useState(false);

  const [newTitle, setNewTitle] = React.useState("");
  const [newDue, setNewDue] = React.useState("");
  const [newParent, setNewParent] = React.useState("");

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const [ac, pr, ev] = await Promise.all([
        api<{ actions: ActionRow[] }>("/api/actions?status=all"),
        api<{ projects: ProjectRow[] }>("/api/projects?status=active"),
        api<{ events: EventRow[] }>(`/api/events?from=${encodeURIComponent(startOfDay().toISOString())}&to=${encodeURIComponent(addDays(new Date(), 30).toISOString())}`),
      ]);
      setActions(ac.actions);
      setProjects(pr.projects);
      setEvents(ev.events);
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
  }, []);

  async function addAction() {
    if (!newTitle.trim()) return;
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
        body: JSON.stringify({ title: newTitle.trim(), dueAt, parentType, parentId }),
      });
      setNewTitle("");
      setNewDue("");
      setNewParent("");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to add");
    }
  }

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

  const open = actions.filter((a) => a.status === "open");
  const done = actions.filter((a) => a.status === "done");

  const now = new Date();
  const overdue = open.filter((a) => a.due_at && new Date(a.due_at) < now);
  const dueSoon = open.filter((a) => a.due_at && new Date(a.due_at) >= now && new Date(a.due_at) <= addDays(now, 3));
  const upcoming = open.filter((a) => a.due_at && new Date(a.due_at) > addDays(now, 3));
  const unscheduled = open.filter((a) => !a.due_at);

  function renderActionRow(a: ActionRow, tone?: "red" | "amber") {
    return (
      <li
        key={a.id}
        className="cursor-pointer rounded-lg border border-neutral-200 px-3 py-2 hover:bg-neutral-50"
        onClick={() => setSelectedAction(a)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{a.title}</span>
              {a.priority === "high" && <Badge tone="red">high</Badge>}
              {a.priority === "low" && <Badge tone="neutral">low</Badge>}
            </div>
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
          {a.due_at && tone && <Badge tone={tone}>{fmtDate(a.due_at)}</Badge>}
        </div>
      </li>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Actions</h1>
          <p className="mt-1 text-sm text-neutral-600">
            All your action items in one place.
          </p>
        </div>
        <Button variant="secondary" onClick={load} disabled={loading}>Refresh</Button>
      </div>

      {err && (
        <Notice tone="red">
          {err === "Unauthorized" ? (
            <>Unauthorized. <a className="underline" href="/login">Log in</a>.</>
          ) : err}
        </Notice>
      )}

      <Card>
        <CardHeader>
          <div className="text-sm font-semibold">Add action</div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-[1fr,160px,180px,auto]">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="What needs to be done?"
              onKeyDown={(e) => { if (e.key === "Enter" && newTitle.trim()) addAction(); }}
            />
            <Input type="date" value={newDue} onChange={(e) => setNewDue(e.target.value)} />
            <Select value={newParent} onChange={(e) => setNewParent(e.target.value)} className="text-sm">
              <option value="">No link</option>
              {projects.length > 0 && (
                <optgroup label="Projects">
                  {projects.map((p) => (
                    <option key={p.id} value={`project:${p.id}`}>{p.name}</option>
                  ))}
                </optgroup>
              )}
              {events.length > 0 && (
                <optgroup label="Upcoming events">
                  {events.slice(0, 15).map((e) => (
                    <option key={e.event_key} value={`event:${e.event_key}`}>{e.title || "(no title)"}</option>
                  ))}
                </optgroup>
              )}
            </Select>
            <Button onClick={addAction} disabled={!newTitle.trim()}>Add</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Open actions</div>
            <div className="text-xs text-neutral-500">{open.length} total</div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && <div className="text-sm text-neutral-500">Loading...</div>}

          {!loading && open.length === 0 && (
            <div className="text-sm text-neutral-500">No open actions. Nice work!</div>
          )}

          {!!overdue.length && (
            <section className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-red-600">Overdue</div>
              <ul className="space-y-2">{overdue.map((a) => renderActionRow(a, "red"))}</ul>
            </section>
          )}

          {!!dueSoon.length && (
            <section className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-amber-600">Due soon</div>
              <ul className="space-y-2">{dueSoon.map((a) => renderActionRow(a, "amber"))}</ul>
            </section>
          )}

          {!!upcoming.length && (
            <section className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Upcoming</div>
              <ul className="space-y-2">{upcoming.map((a) => renderActionRow(a))}</ul>
            </section>
          )}

          {!!unscheduled.length && (
            <section className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Unscheduled</div>
              <ul className="space-y-2">{unscheduled.map((a) => renderActionRow(a))}</ul>
            </section>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <button
            className="flex w-full items-center justify-between text-left"
            onClick={() => setShowDone(!showDone)}
          >
            <div className="text-sm font-semibold">Completed</div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-500">{done.length} done</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`text-neutral-400 transition-transform ${showDone ? "rotate-180" : ""}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </button>
        </CardHeader>
        {showDone && (
          <CardContent>
            {done.length === 0 && <div className="text-sm text-neutral-500">No completed actions.</div>}
            <ul className="space-y-2">
              {done.map((a) => (
                <li
                  key={a.id}
                  className="cursor-pointer rounded-lg border border-neutral-200 px-3 py-2 hover:bg-neutral-50"
                  onClick={() => setSelectedAction(a)}
                >
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-green-500">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span className="text-sm text-neutral-500 line-through">{a.title}</span>
                    {a.due_at && <span className="text-xs text-neutral-400">{fmtDate(a.due_at)}</span>}
                    {parentLabel(a) && (
                      <span className="inline-flex items-center gap-1 rounded bg-neutral-200/60 px-1.5 py-0.5 text-xs text-neutral-500">
                        {parentLabel(a)}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        )}
      </Card>

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
