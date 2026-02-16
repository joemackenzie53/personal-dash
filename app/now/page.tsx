"use client";
import * as React from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Notice } from "@/components/Notice";
import { Badge } from "@/components/ui/Badge";
import { fmtDate, fmtTime, isAllDay } from "@/lib/format";

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
  category: string | null;
  is_major: number | null;
  deleted: number;
};

type ActionRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_at: string | null;
  parent_type: string | null;
  parent_id: string | null;
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
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  const [newTitle, setNewTitle] = React.useState("");
  const [newDue, setNewDue] = React.useState<string>("");

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const s = await api<Settings>("/api/settings");
      setSettings(s);

      // events next 14 days
      const from = startOfDay(new Date()).toISOString();
      const to = addDays(new Date(), 14).toISOString();
      const ev = await api<{ events: EventRow[] }>(`/api/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      setEvents(ev.events);

      const ac = await api<{ actions: ActionRow[] }>("/api/actions?status=open");
      setActions(ac.actions);
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
      await api("/api/actions", {
        method: "POST",
        body: JSON.stringify({ title: newTitle, dueAt })
      });
      setNewTitle("");
      setNewDue("");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to add");
    }
  }

  const overdue = actions.filter((a) => a.due_at && new Date(a.due_at) < new Date());
  const dueSoon = actions.filter((a) => a.due_at && new Date(a.due_at) >= new Date() && new Date(a.due_at) <= addDays(new Date(), 3));
  const unscheduled = actions.filter((a) => !a.due_at);

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
          <div className="grid gap-2 sm:grid-cols-[1fr,200px,auto]">
            <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Order Gizem’s birthday present" />
            <Input type="date" value={newDue} onChange={(e) => setNewDue(e.target.value)} />
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
                    <li key={a.id} className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium">{a.title}</div>
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
                    <li key={a.id} className="rounded-lg border border-neutral-200 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium">{a.title}</div>
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
                    <li key={a.id} className="rounded-lg border border-neutral-200 px-3 py-2">
                      <div className="text-sm font-medium">{a.title}</div>
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
                  <li key={e.event_key} className="rounded-lg border border-neutral-200 px-3 py-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">{e.title || "(no title)"}</div>
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
    </div>
  );
}
