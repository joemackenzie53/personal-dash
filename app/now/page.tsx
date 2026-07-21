"use client";
import * as React from "react";
import { flushSync } from "react-dom";
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
  action_total: number;
  action_done: number;
};

type ProjectRow = { id: string; name: string; status: string };

type ActionRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_at: string | null;
  start_at: string | null;
  snooze_until: string | null;
  reference_url: string | null;
  tags: string | null;
  checklist: string | null;
  generated_from_action_id: string | null;
  due_days_before: number | null;
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

export default function NowPage() {
  const [settings, setSettings] = React.useState<Settings | null>(null);
  const [events, setEvents] = React.useState<EventRow[]>([]);
  const [actions, setActions] = React.useState<ActionRow[]>([]);
  const [projects, setProjects] = React.useState<ProjectRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = React.useState<EventRow | null>(null);
  const [selectedAction, setSelectedAction] = React.useState<ActionRow | null>(null);
  const [showExport, setShowExport] = React.useState(false);
  const [exportCopied, setExportCopied] = React.useState(false);

  const [newTitle, setNewTitle] = React.useState("");
  const [newDue, setNewDue] = React.useState<string>("");
  const [newParent, setNewParent] = React.useState<string>("");
  const [newPriority, setNewPriority] = React.useState("med");
  const [newStartAt, setNewStartAt] = React.useState("");
  const [newSnoozeUntil, setNewSnoozeUntil] = React.useState("");
  const [newDesc, setNewDesc] = React.useState("");
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [syncMsg, setSyncMsg] = React.useState<string | null>(null);

  const [selectMode, setSelectMode] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [bulkPanel, setBulkPanel] = React.useState<"due" | "start" | "priority" | "snooze" | null>(null);
  const [bulkValue, setBulkValue] = React.useState("");

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
    flushSync(() => {
      setSyncMsg("Sync in progress…");
      setSyncing(true);
    });
    try {
      const res = await api<any>("/api/sync", { method: "POST" });
      setSyncMsg(`Sync complete — ${res.calendarsSynced} calendar${res.calendarsSynced !== 1 ? "s" : ""}, ${res.eventsUpserted} events.`);
      await load();
    } catch (e: any) {
      setSyncMsg(`Sync failed: ${e?.message || "unknown error"}`);
    } finally {
      setSyncing(false);
    }
  }

  async function addAction() {
    if (!newTitle.trim() || adding) return;
    setAdding(true);
    setErr(null);
    try {
      const dueAt = newDue ? new Date(newDue).toISOString() : null;
      const startAt = newStartAt ? new Date(newStartAt).toISOString() : null;
      const snoozeUntil = newSnoozeUntil ? new Date(newSnoozeUntil).toISOString() : null;
      let parentType: string | null = null;
      let parentId: string | null = null;
      if (newParent) {
        const [type, ...rest] = newParent.split(":");
        parentType = type;
        parentId = rest.join(":");
      }
      await api("/api/actions", {
        method: "POST",
        body: JSON.stringify({
          title: newTitle.trim(),
          priority: newPriority,
          dueAt,
          startAt,
          snoozeUntil,
          description: newDesc.trim() || null,
          parentType,
          parentId,
        }),
      });
      setNewTitle("");
      setNewDue("");
      setNewParent("");
      setNewPriority("med");
      setNewStartAt("");
      setNewSnoozeUntil("");
      setNewDesc("");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to add action");
    } finally {
      setAdding(false);
    }
  }

  async function rescheduleOverdue() {
    setErr(null);
    try {
      await api("/api/actions/reschedule-overdue", { method: "POST" });
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to reschedule");
    }
  }

  async function toggleAction(e: React.MouseEvent, actionId: string) {
    e.stopPropagation();
    try {
      await api(`/api/actions/${actionId}`, {
        method: "PUT",
        body: JSON.stringify({ status: "done" }),
      });
      await load();
    } catch {}
  }

  function enterSelectMode() { setSelectMode(true); setSelectedIds(new Set()); setBulkPanel(null); setBulkValue(""); }
  function exitSelectMode() { setSelectMode(false); setSelectedIds(new Set()); setBulkPanel(null); setBulkValue(""); }
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function applyBulk(body: Record<string, unknown>) {
    if (!selectedIds.size) return;
    setErr(null);
    try {
      await Promise.all(
        [...selectedIds].map((id) =>
          api(`/api/actions/${id}`, { method: "PUT", body: JSON.stringify(body) })
        )
      );
      exitSelectMode();
      await load();
    } catch (e: any) {
      setErr(e?.message || "Bulk update failed");
    }
  }

  function isoDate(offsetDays: number) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().substring(0, 10);
  }

  const PRIORITY_ORDER: Record<string, number> = { very_high: 0, high: 1, med: 2, low: 3, very_low: 4 };
  function sortByPriority<T extends { priority: string }>(arr: T[]): T[] {
    return [...arr].sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 5) - (PRIORITY_ORDER[b.priority] ?? 5));
  }

  const todayStart = startOfDay(new Date());
  const tomorrowStart = addDays(todayStart, 1);
  const nowTs = new Date();

  // Exclude snoozed actions; exclude future-start actions unless already due/overdue
  const visibleActions = actions.filter((a) => {
    if (a.snooze_until && new Date(a.snooze_until) > nowTs) return false;
    if (a.start_at && new Date(a.start_at) > nowTs && !(a.due_at && new Date(a.due_at) < tomorrowStart)) return false;
    return true;
  });

  const pastDue = visibleActions.filter((a) => a.due_at && new Date(a.due_at) < todayStart);
  const overdue = sortByPriority(visibleActions.filter((a) => a.due_at && new Date(a.due_at) < tomorrowStart));
  const dueSoon = sortByPriority(visibleActions.filter((a) => a.due_at && new Date(a.due_at) >= tomorrowStart && new Date(a.due_at) <= addDays(todayStart, 4)));
  const unscheduled = sortByPriority(visibleActions.filter((a) => !a.due_at));

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

  function renderNowRow(a: ActionRow, tone?: "red" | "amber") {
    const selected = selectedIds.has(a.id);
    const bgClass = tone === "red" ? "bg-neutral-50" : "";
    const pl = parentLabel(a);
    return (
      <li
        key={a.id}
        className={`cursor-pointer rounded-lg border px-3 py-2 transition-colors ${selected ? "border-blue-400 bg-blue-50" : `border-neutral-200 ${bgClass} hover:bg-neutral-100`}`}
        onClick={() => selectMode ? toggleSelect(a.id) : setSelectedAction(a)}
      >
        <div className="flex items-start gap-2">
          {selectMode ? (
            <button
              onClick={(e) => { e.stopPropagation(); toggleSelect(a.id); }}
              className="-ml-1 flex-shrink-0 p-1.5"
              aria-label={selected ? "Deselect" : "Select"}
            >
              <span className={`flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 transition-colors ${selected ? "border-blue-500 bg-blue-500" : "border-neutral-400"}`}>
                {selected && <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
              </span>
            </button>
          ) : (
            <button onClick={(e) => toggleAction(e, a.id)} className="-ml-1 flex-shrink-0 p-1.5 rounded-full hover:bg-green-50 transition-colors" aria-label="Complete action">
              <span className="block h-[18px] w-[18px] rounded-full border-2 border-neutral-400 hover:border-green-500 transition-colors" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">{a.title}</span>
              {a.priority === "very_high" && <Badge tone="red">!! high</Badge>}
              {a.priority === "high" && <Badge tone="red">high</Badge>}
              {a.priority === "low" && <Badge tone="neutral">low</Badge>}
              {a.priority === "very_low" && <Badge tone="neutral">very low</Badge>}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-neutral-600">
              {a.due_at && !tone && <span>{fmtDate(a.due_at)}</span>}
              {pl && (
                <span className="inline-flex items-center gap-1 rounded bg-neutral-200/60 px-1.5 py-0.5 text-neutral-600">
                  {a.parent_type === "project" ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  )}
                  {pl}
                </span>
              )}
            </div>
          </div>
          {tone && <Badge tone={tone}>{fmtDate(a.due_at || "")}</Badge>}
        </div>
      </li>
    );
  }

  function buildExportJson(): string {
    const openActions = actions.filter((a) => a.status === "open");
    const payload = {
      exported_at: new Date().toISOString(),
      date: new Date().toISOString().substring(0, 10),
      actions: openActions.map((a) => ({
        id: a.id,
        title: a.title,
        status: a.status,
        priority: a.priority,
        due_at: a.due_at,
        start_at: a.start_at,
        snooze_until: a.snooze_until,
        parent_type: a.parent_type,
        parent_id: a.parent_id,
        reference_url: a.reference_url,
        description: a.description,
        tags: a.tags,
        checklist: a.checklist,
        generated_from_action_id: a.generated_from_action_id,
        due_days_before: a.due_days_before,
      })),
      events: events.map((e) => ({
        id: e.event_key,
        title: e.title,
        start: e.start,
        end: e.end,
        all_day: e.all_day,
        category: e.category,
        is_major: e.is_major,
        project_id: e.project_id,
        notes_url: e.notes_url,
        location: e.location,
        recurring_event_id: e.recurring_event_id,
      })),
    };
    return JSON.stringify(payload, null, 2);
  }

  async function copyExport() {
    try {
      await navigator.clipboard.writeText(buildExportJson());
      setExportCopied(true);
      setTimeout(() => setExportCopied(false), 2000);
    } catch {
      setExportCopied(false);
    }
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
          {pastDue.length > 0 && (
            <button
              onClick={rescheduleOverdue}
              disabled={loading}
              title={`Reschedule ${pastDue.length} past-due action${pastDue.length !== 1 ? "s" : ""} to today`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100 disabled:opacity-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 19 22 12 13 5 13 19"/>
                <polygon points="2 19 11 12 2 5 2 19"/>
              </svg>
              <span>{pastDue.length}</span>
            </button>
          )}
          <Button onClick={runSync} disabled={syncing || loading}>{syncing ? "Syncing…" : "Sync"}</Button>
          <Button variant="secondary" onClick={() => setShowExport(true)}>Export JSON</Button>
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

      {syncMsg && (
        <Notice tone={syncMsg === "Sync in progress…" ? "amber" : syncMsg.startsWith("Sync failed") ? "red" : "green"}>
          {syncMsg}
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
          <div className="grid grid-cols-[1fr,auto,auto] gap-2 sm:grid-cols-[1fr,160px,auto,auto]">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Order birthday present"
              onKeyDown={(e) => { if (e.key === "Enter" && newTitle.trim()) addAction(); }}
            />
            <Input type="date" value={newDue} onChange={(e) => setNewDue(e.target.value)} className="hidden sm:block" />
            <Button onClick={addAction} disabled={!newTitle.trim() || adding}>{adding ? "Adding…" : "Add"}</Button>
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 whitespace-nowrap"
            >
              {showAdvanced ? "Less ▴" : "More ▾"}
            </button>
          </div>

          {showAdvanced && (
            <div className="mt-3 space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <div className="text-xs font-medium text-neutral-600">Priority</div>
                  <Select value={newPriority} onChange={(e) => setNewPriority(e.target.value)} className="text-sm">
                    <option value="very_high">Very high</option>
                    <option value="high">High</option>
                    <option value="med">Medium</option>
                    <option value="low">Low</option>
                    <option value="very_low">Very low</option>
                  </Select>
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-medium text-neutral-600">Start date</div>
                  <Input type="date" value={newStartAt} onChange={(e) => setNewStartAt(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-medium text-neutral-600">Snooze until</div>
                  <Input type="date" value={newSnoozeUntil} onChange={(e) => setNewSnoozeUntil(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs font-medium text-neutral-600">Link to</div>
                <Select value={newParent} onChange={(e) => setNewParent(e.target.value)} className="text-sm">
                  <option value="">None</option>
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
              </div>
              <div className="space-y-1">
                <div className="text-xs font-medium text-neutral-600">Description</div>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Optional details…"
                  rows={2}
                  className="w-full resize-none rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 placeholder-neutral-400 focus:border-neutral-400 focus:outline-none"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold">Action queue</div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-500">{visibleActions.length} open</span>
                {!selectMode
                  ? <button onClick={enterSelectMode} className="rounded-lg border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50">Select</button>
                  : <button onClick={exitSelectMode} className="rounded-lg border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50">Cancel</button>
                }
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading && <div className="text-sm text-neutral-500">Loading…</div>}

            {!loading && visibleActions.length === 0 && (
              <div className="text-sm text-neutral-500">No open actions.</div>
            )}

            {!!overdue.length && (
              <section className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-red-600">Overdue / Today ({overdue.length})</div>
                <ul className="space-y-2">{overdue.map((a) => renderNowRow(a, "red"))}</ul>
              </section>
            )}

            {!!dueSoon.length && (
              <section className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-amber-600">Due soon ({dueSoon.length})</div>
                <ul className="space-y-2">{dueSoon.map((a) => renderNowRow(a, "amber"))}</ul>
              </section>
            )}

            {!!unscheduled.length && (
              <section className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Unscheduled ({unscheduled.length})</div>
                <ul className="space-y-2">{unscheduled.map((a) => renderNowRow(a))}</ul>
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
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-2">
                          {e.is_major ? <Badge tone="purple">Major</Badge> : null}
                          {e.category && e.category !== "unknown" ? <Badge>{e.category}</Badge> : <Badge tone="neutral">unknown</Badge>}
                        </div>
                        {e.action_total > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                            {e.action_done}/{e.action_total}
                          </span>
                        )}
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

      {selectMode && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-neutral-200 bg-white shadow-lg">
          <div className="mx-auto max-w-2xl px-4 py-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-neutral-700">
                {selectedIds.size} selected
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => { setBulkPanel(bulkPanel === "due" ? null : "due"); setBulkValue(""); }} className="rounded-lg border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50">Due date</button>
                <button onClick={() => { setBulkPanel(bulkPanel === "start" ? null : "start"); setBulkValue(""); }} className="rounded-lg border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50">Start date</button>
                <button onClick={() => { setBulkPanel(bulkPanel === "priority" ? null : "priority"); setBulkValue("med"); }} className="rounded-lg border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50">Priority</button>
                <button onClick={() => { setBulkPanel(bulkPanel === "snooze" ? null : "snooze"); setBulkValue(""); }} className="rounded-lg border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50">Snooze</button>
                <button onClick={() => applyBulk({ snoozeUntil: null })} disabled={!selectedIds.size} className="rounded-lg border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-40">Clear snooze</button>
                <button onClick={() => applyBulk({ status: "done" })} disabled={!selectedIds.size} className="rounded-lg border border-green-300 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-800 hover:bg-green-100 disabled:opacity-40">Mark done</button>
              </div>
            </div>

            {bulkPanel === "due" && (
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => applyBulk({ dueAt: new Date(isoDate(0)).toISOString() })} className="rounded-lg border border-neutral-200 px-2.5 py-1 text-xs font-medium hover:bg-neutral-50">Today</button>
                <button onClick={() => applyBulk({ dueAt: new Date(isoDate(1)).toISOString() })} className="rounded-lg border border-neutral-200 px-2.5 py-1 text-xs font-medium hover:bg-neutral-50">Tomorrow</button>
                <button onClick={() => { const d = new Date(); d.setDate(d.getDate() + (6 - d.getDay() + 6) % 7 || 7); applyBulk({ dueAt: d.toISOString() }); }} className="rounded-lg border border-neutral-200 px-2.5 py-1 text-xs font-medium hover:bg-neutral-50">Sat</button>
                <button onClick={() => { const d = new Date(); d.setDate(d.getDate() + (8 - d.getDay()) % 7 || 7); applyBulk({ dueAt: d.toISOString() }); }} className="rounded-lg border border-neutral-200 px-2.5 py-1 text-xs font-medium hover:bg-neutral-50">Mon</button>
                <Input type="date" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="h-7 w-36 text-xs" />
                <button onClick={() => bulkValue && applyBulk({ dueAt: new Date(bulkValue).toISOString() })} disabled={!bulkValue} className="rounded-lg border border-blue-300 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800 hover:bg-blue-100 disabled:opacity-40">Apply</button>
              </div>
            )}

            {bulkPanel === "start" && (
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => applyBulk({ startAt: new Date(isoDate(0)).toISOString() })} className="rounded-lg border border-neutral-200 px-2.5 py-1 text-xs font-medium hover:bg-neutral-50">Today</button>
                <button onClick={() => applyBulk({ startAt: new Date(isoDate(1)).toISOString() })} className="rounded-lg border border-neutral-200 px-2.5 py-1 text-xs font-medium hover:bg-neutral-50">Tomorrow</button>
                <Input type="date" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="h-7 w-36 text-xs" />
                <button onClick={() => bulkValue && applyBulk({ startAt: new Date(bulkValue).toISOString() })} disabled={!bulkValue} className="rounded-lg border border-blue-300 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800 hover:bg-blue-100 disabled:opacity-40">Apply</button>
              </div>
            )}

            {bulkPanel === "priority" && (
              <div className="flex flex-wrap items-center gap-1.5">
                {([["very_high", "!! high"], ["high", "High"], ["med", "Med"], ["low", "Low"], ["very_low", "Very low"]] as [string, string][]).map(([val, label]) => (
                  <button key={val} onClick={() => applyBulk({ priority: val })} disabled={!selectedIds.size}
                    className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40">{label}</button>
                ))}
              </div>
            )}

            {bulkPanel === "snooze" && (
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => applyBulk({ snoozeUntil: new Date(isoDate(1)).toISOString() })} className="rounded-lg border border-neutral-200 px-2.5 py-1 text-xs font-medium hover:bg-neutral-50">Tomorrow</button>
                <button onClick={() => applyBulk({ snoozeUntil: new Date(isoDate(3)).toISOString() })} className="rounded-lg border border-neutral-200 px-2.5 py-1 text-xs font-medium hover:bg-neutral-50">3 days</button>
                <button onClick={() => applyBulk({ snoozeUntil: new Date(isoDate(7)).toISOString() })} className="rounded-lg border border-neutral-200 px-2.5 py-1 text-xs font-medium hover:bg-neutral-50">1 week</button>
                <Input type="date" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="h-7 w-36 text-xs" />
                <button onClick={() => bulkValue && applyBulk({ snoozeUntil: new Date(bulkValue).toISOString() })} disabled={!bulkValue} className="rounded-lg border border-blue-300 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800 hover:bg-blue-100 disabled:opacity-40">Apply</button>
              </div>
            )}
          </div>
        </div>
      )}

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

      {showExport && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-16" onClick={() => setShowExport(false)}>
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <div className="text-sm font-semibold">Export planning JSON</div>
              <div className="flex items-center gap-2">
                <Button onClick={copyExport}>
                  {exportCopied ? "Copied!" : "Copy to clipboard"}
                </Button>
                <button onClick={() => setShowExport(false)} className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>
            <textarea
              readOnly
              value={buildExportJson()}
              className="h-96 w-full resize-none rounded-b-xl bg-neutral-50 p-4 font-mono text-xs text-neutral-800 focus:outline-none"
              onFocus={(e) => e.target.select()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
