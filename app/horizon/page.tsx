"use client";
import * as React from "react";
import { api } from "@/lib/client";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/Notice";
import { Badge } from "@/components/ui/Badge";
import { fmtDate, fmtTime, isAllDay } from "@/lib/format";
import { Select } from "@/components/ui/Select";

type Settings = {
  connected: boolean;
  horizonDays: number;
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
};

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function monthKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export default function HorizonPage() {
  const [settings, setSettings] = React.useState<Settings | null>(null);
  const [events, setEvents] = React.useState<EventRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<string>("all");

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const s = await api<Settings>("/api/settings");
      setSettings(s);

      const from = new Date().toISOString();
      const to = addDays(new Date(), s.horizonDays || 182).toISOString();
      const ev = await api<{ events: EventRow[] }>(`/api/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
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

  const filtered = filter === "all" ? events : events.filter((e) => (e.category || "unknown") === filter);

  const groups = React.useMemo(() => {
    const m = new Map<string, EventRow[]>();
    for (const e of filtered) {
      const k = monthKey(e.start);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    }
    return Array.from(m.entries()).sort(([a], [b]) => (a < b ? -1 : 1));
  }, [filtered]);

  const categories = React.useMemo(() => {
    const s = new Set<string>();
    for (const e of events) s.add(e.category || "unknown");
    return Array.from(s).sort();
  }, [events]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Horizon</h1>
          <p className="mt-1 text-sm text-neutral-600">Your forward-looking view, grouped by month.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="w-44">
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
          <Button variant="secondary" onClick={load} disabled={loading}>Refresh</Button>
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
          You&apos;re not connected to Google Calendar yet. Go to <a className="underline" href="/settings">Settings</a>.
        </Notice>
      )}

      {loading && <div className="text-sm text-neutral-500">Loading…</div>}

      {!loading && groups.length === 0 && (
        <div className="text-sm text-neutral-500">No events in this horizon.</div>
      )}

      <div className="space-y-4">
        {groups.map(([k, items]) => (
          <Card key={k}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">{monthLabel(k)}</div>
                <div className="text-xs text-neutral-500">{items.length} events</div>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {items.slice(0, 60).map((e) => {
                  const allDay = isAllDay(e.start, e.all_day);
                  const cat = e.category || "unknown";
                  return (
                    <li key={e.event_key} className="rounded-lg border border-neutral-200 px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium">{e.title || "(no title)"}</div>
                          <div className="text-xs text-neutral-600">
                            {fmtDate(e.start)} {!allDay ? <>• {fmtTime(e.start)}</> : <span className="text-neutral-500">(all day)</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {e.is_major ? <Badge tone="purple">Major</Badge> : null}
                          <Badge>{cat}</Badge>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
