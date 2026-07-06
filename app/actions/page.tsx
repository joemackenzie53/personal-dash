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
  start_at: string | null;
  snooze_until: string | null;
  description: string | null;
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
  const [selectMode, setSelectMode] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [bulkPanel, setBulkPanel] = React.useState<"due" | "start" | "priority" | "snooze" | null>(null);
  const [bulkValue, setBulkValue] = React.useState("");

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

  function toggleSelect(id: string) {
    setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function enterSelectMode() {
    setSelectMode(true); setSelectedIds(new Set()); setBulkPanel(null); setBulkValue("");
  }

  function exitSelectMode() {
    setSelectMode(false); setSelectedIds(new Set()); setBulkPanel(null); setBulkValue("");
  }

  function pickPanel(p: "due" | "start" | "priority" | "snooze") {
    setBulkPanel((prev) => (prev === p ? null : p)); setBulkValue("");
  }

  async function applyBulk(updates: Record<string, unknown>) {
    if (!selectedIds.size) return;
    setErr(null);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          api(`/api/actions/${id}`, { method: "PUT", body: JSON.stringify(updates) })
        )
      );
      exitSelectMode();
      await load();
    } catch (e: any) {
      setErr(e?.message || "Bulk update failed");
    }
  }

  function bsTomorrow() { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); }
  function bsNextSat() { const d = new Date(); const day = d.getDay(); d.setDate(d.getDate() + (day === 6 ? 7 : 6 - day)); return d.toISOString().slice(0, 10); }
  function bsNextMon() { const d = new Date(); const day = d.getDay(); d.setDate(d.getDate() + (day === 1 ? 7 : (8 - day) % 7)); return d.toISOString().slice(0, 10); }

  async function toggleAction(e: React.MouseEvent, actionId: string, newStatus: string) {
    e.stopPropagation();
    try {
      await api(`/api/actions/${actionId}`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus }),
      });
      await load();
    } catch {}
  }

  const open = actions.filter((a) => a.status === "open");
  const done = actions.filter((a) => a.status === "done");

  const PRIORITY_ORDER: Record<string, number> = { high: 0, med: 1, low: 2 };
  function sortByPriority<T extends { priority: string }>(arr: T[]): T[] {
    return [...arr].sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3));
  }

  const todayStart = startOfDay(new Date());
  const tomorrowStart = addDays(todayStart, 1);
  const overdue = sortByPriority(open.filter((a) => a.due_at && new Date(a.due_at) < tomorrowStart));
  const dueSoon = sortByPriority(open.filter((a) => a.due_at && new Date(a.due_at) >= tomorrowStart && new Date(a.due_at) <= addDays(todayStart, 4)));
  const upcoming = sortByPriority(open.filter((a) => a.due_at && new Date(a.due_at) > addDays(todayStart, 4)));
  const unscheduled = sortByPriority(open.filter((a) => !a.due_at));

  function renderActionRow(a: ActionRow, tone?: "red" | "amber") {
    const isDone = a.status === "done";
    const isSelected = selectMode && selectedIds.has(a.id);
    const nowD = new Date();
    return (
      <li
        key={a.id}
        className={`cursor-pointer rounded-lg border px-3 py-2 transition-colors ${isSelected ? "border-blue-300 bg-blue-50" : "border-neutral-200 hover:bg-neutral-50"}`}
        onClick={() => selectMode ? toggleSelect(a.id) : setSelectedAction(a)}
      >
        <div className="flex items-start gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); selectMode ? toggleSelect(a.id) : toggleAction(e, a.id, isDone ? "open" : "done"); }}
            className="-ml-1 flex-shrink-0 p-1.5 rounded-full transition-colors hover:bg-blue-50"
            aria-label={selectMode ? (isSelected ? "Deselect" : "Select") : (isDone ? "Reopen" : "Complete")}
          >
            <span className={`flex items-center justify-center h-[18px] w-[18px] rounded-full border-2 transition-colors ${
              selectMode
                ? (isSelected ? "border-blue-500 bg-blue-500" : "border-neutral-300 hover:border-blue-400")
                : (isDone ? "border-green-500 bg-green-500" : "border-neutral-400 hover:border-green-500")
            }`}>
              {(isDone && !selectMode) && (
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              )}
              {isSelected && (
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              )}
            </span>
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${isDone ? "line-through text-neutral-400" : ""}`}>{a.title}</span>
              {a.priority === "high" && !isDone && <Badge tone="red">high</Badge>}
              {a.priority === "low" && !isDone && <Badge tone="neutral">low</Badge>}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500">
              {a.due_at && <span className="text-neutral-600">{fmtDate(a.due_at)}</span>}
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
              {!isDone && a.start_at && new Date(a.start_at) > nowD && (
                <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-500">starts {fmtDate(a.start_at)}</span>
              )}
              {!isDone && a.snooze_until && new Date(a.snooze_until) > nowD && (
                <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-500">snoozed {fmtDate(a.snooze_until)}</span>
              )}
            </div>
          </div>
          {a.due_at && tone && !selectMode && <Badge tone={tone}>{fmtDate(a.due_at)}</Badge>}
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
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold">Open actions</div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-500">{open.length} total</span>
              {!selectMode
                ? <button onClick={enterSelectMode} className="rounded-lg border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50">Select</button>
                : <button onClick={exitSelectMode} className="rounded-lg border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50">Cancel</button>
              }
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && <div className="text-sm text-neutral-500">Loading...</div>}

          {!loading && open.length === 0 && (
            <div className="text-sm text-neutral-500">No open actions. Nice work!</div>
          )}

          {!!overdue.length && (
            <section className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-red-600">Overdue / Today ({overdue.length})</div>
              <ul className="space-y-2">{overdue.map((a) => renderActionRow(a, "red"))}</ul>
            </section>
          )}

          {!!dueSoon.length && (
            <section className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-amber-600">Due soon ({dueSoon.length})</div>
              <ul className="space-y-2">{dueSoon.map((a) => renderActionRow(a, "amber"))}</ul>
            </section>
          )}

          {!!upcoming.length && (
            <section className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Upcoming ({upcoming.length})</div>
              <ul className="space-y-2">{upcoming.map((a) => renderActionRow(a))}</ul>
            </section>
          )}

          {!!unscheduled.length && (
            <section className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Unscheduled ({unscheduled.length})</div>
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
              {done.map((a) => renderActionRow(a))}
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

      {selectMode && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-neutral-200 bg-white shadow-[0_-2px_8px_rgba(0,0,0,0.08)]">
          <div className="mx-auto max-w-5xl space-y-2 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-neutral-800">
                {selectedIds.size} selected
              </span>
              <button onClick={exitSelectMode} className="text-xs font-medium text-neutral-500 underline hover:text-neutral-800">Cancel</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["due", "start", "priority", "snooze"] as const).map((p) => (
                <button key={p} onClick={() => pickPanel(p)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${bulkPanel === p ? "border-blue-300 bg-blue-50 text-blue-700" : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"}`}>
                  {p === "due" ? "Due date" : p === "start" ? "Start date" : p === "priority" ? "Priority" : "Snooze"}
                </button>
              ))}
              <button onClick={() => applyBulk({ status: "done" })} disabled={!selectedIds.size}
                className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40">
                Mark done
              </button>
            </div>
            {(bulkPanel === "due" || bulkPanel === "start") && (
              <div className="flex items-center gap-2">
                <Input type="date" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="text-sm" />
                <Button size="sm" onClick={() => bulkValue && applyBulk(bulkPanel === "due" ? { dueAt: new Date(bulkValue).toISOString() } : { startAt: new Date(bulkValue).toISOString() })} disabled={!bulkValue || !selectedIds.size}>Set</Button>
                {bulkPanel === "due" && <button onClick={() => applyBulk({ dueAt: null })} disabled={!selectedIds.size} className="text-xs text-neutral-500 underline hover:text-neutral-800 disabled:opacity-40">Clear</button>}
              </div>
            )}
            {bulkPanel === "priority" && (
              <div className="flex items-center gap-2">
                <Select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="text-sm">
                  <option value="">Pick…</option>
                  <option value="high">High</option>
                  <option value="med">Medium</option>
                  <option value="low">Low</option>
                </Select>
                <Button size="sm" onClick={() => bulkValue && applyBulk({ priority: bulkValue })} disabled={!bulkValue || !selectedIds.size}>Set</Button>
              </div>
            )}
            {bulkPanel === "snooze" && (
              <div className="space-y-1.5">
                <div className="flex flex-wrap gap-1.5">
                  {([["Tomorrow", bsTomorrow()], ["Saturday", bsNextSat()], ["Next week", bsNextMon()]] as [string, string][]).map(([label, val]) => (
                    <button key={label} onClick={() => applyBulk({ snoozeUntil: new Date(val).toISOString() })} disabled={!selectedIds.size}
                      className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40">{label}</button>
                  ))}
                  <button onClick={() => applyBulk({ snoozeUntil: null })} disabled={!selectedIds.size}
                    className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-500 hover:bg-neutral-50 disabled:opacity-40">Clear snooze</button>
                </div>
                <div className="flex items-center gap-2">
                  <Input type="date" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="text-sm" />
                  <Button size="sm" onClick={() => bulkValue && applyBulk({ snoozeUntil: new Date(bulkValue).toISOString() })} disabled={!bulkValue || !selectedIds.size}>Set</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
