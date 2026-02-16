"use client";
import * as React from "react";
import { api } from "@/lib/client";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/Notice";
import { Badge } from "@/components/ui/Badge";
import { fmtDate, fmtTime, isAllDay } from "@/lib/format";
import { EventDetailModal } from "@/components/EventDetailModal";

type Settings = { connected: boolean; horizonDays: number };
type EventRow = {
  event_key: string;
  title: string;
  start: string;
  end: string;
  all_day: number;
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

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

export default function TriagePage() {
  const [settings, setSettings] = React.useState<Settings | null>(null);
  const [events, setEvents] = React.useState<EventRow[]>([]);
  const [projects, setProjects] = React.useState<ProjectRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = React.useState<EventRow | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const s = await api<Settings>("/api/settings");
      setSettings(s);

      const from = new Date().toISOString();
      const to = addDays(new Date(), s.horizonDays || 182).toISOString();
      const ev = await api<{ events: EventRow[] }>(`/api/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      const triage = ev.events.filter((e) => (e.category || "unknown") === "unknown" && e.deleted === 0);
      setEvents(triage);

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Triage</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Classify &quot;unknown&quot; events so the dashboard can surface the right prep actions.
          </p>
        </div>
        <div className="flex gap-2">
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
          Not connected. Go to <a className="underline" href="/settings">Settings</a>.
        </Notice>
      )}

      {loading && <div className="text-sm text-neutral-500">Loading…</div>}

      {!loading && events.length === 0 && <Notice tone="green">No events need triage right now</Notice>}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Events needing triage</div>
            <div className="text-xs text-neutral-500">{events.length} events</div>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {events.slice(0, 80).map((e) => {
              const allDay = isAllDay(e.start, e.all_day);
              return (
                <li
                  key={e.event_key}
                  className="cursor-pointer rounded-lg border border-neutral-200 px-3 py-2 transition-colors hover:bg-neutral-50"
                  onClick={() => setSelectedEvent(e)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{e.title || "(no title)"}</div>
                      <div className="text-xs text-neutral-600">
                        {fmtDate(e.start)}{" "}
                        {!allDay ? <>• {fmtTime(e.start)}</> : <span className="text-neutral-500">(all day)</span>}
                      </div>
                    </div>
                    <Badge tone="amber">unknown</Badge>
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <EventDetailModal
        event={selectedEvent}
        projects={projects}
        onClose={() => setSelectedEvent(null)}
        onSaved={load}
      />
    </div>
  );
}
