"use client";
import * as React from "react";
import { api } from "@/lib/client";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/Notice";
import { Badge } from "@/components/ui/Badge";
import { fmtDate, fmtTime, isAllDay } from "@/lib/format";
import { EventDetailModal } from "@/components/EventDetailModal";
import { ActionDetailModal } from "@/components/ActionDetailModal";

type Settings = { connected: boolean; horizonDays: number };
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

type EventOption = { event_key: string; title: string };

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function startOfDay() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function TriagePage() {
  const [settings, setSettings] = React.useState<Settings | null>(null);
  const [events, setEvents] = React.useState<EventRow[]>([]);
  const [projects, setProjects] = React.useState<ProjectRow[]>([]);
  const [actions, setActions] = React.useState<ActionRow[]>([]);
  const [eventOptions, setEventOptions] = React.useState<EventOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = React.useState<EventRow | null>(null);
  const [selectedAction, setSelectedAction] = React.useState<ActionRow | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const s = await api<Settings>("/api/settings");
      setSettings(s);

      const from = new Date().toISOString();
      const to = addDays(new Date(), s.horizonDays || 182).toISOString();

      const [ev, pr, ac, evOpts] = await Promise.all([
        api<{ events: EventRow[] }>(`/api/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
        api<{ projects: ProjectRow[] }>("/api/projects?status=active"),
        api<{ actions: ActionRow[] }>("/api/actions?status=all"),
        api<{ events: EventOption[] }>(`/api/events?from=${encodeURIComponent(startOfDay().toISOString())}&to=${encodeURIComponent(addDays(new Date(), 30).toISOString())}`),
      ]);

      const triage = ev.events.filter((e) => (e.category || "unknown") === "unknown" && e.deleted === 0);
      setEvents(triage);
      setProjects(pr.projects);

      const untriaged = ac.actions.filter((a) => !a.due_at && a.status !== "done");
      setActions(untriaged);

      setEventOptions(evOpts.events.map((e) => ({ event_key: e.event_key, title: e.title })));
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
  }, []);

  const allClear = !loading && events.length === 0 && actions.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Triage</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Classify events and set due dates on actions so nothing slips through.
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

      {allClear && <Notice tone="green">Nothing needs triage right now</Notice>}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Events needing triage</div>
            <div className="text-xs text-neutral-500">{events.length} events</div>
          </div>
        </CardHeader>
        <CardContent>
          {events.length === 0 && !loading && (
            <div className="text-sm text-neutral-500">All events are classified.</div>
          )}
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
                    <Badge tone="amber">unknown</Badge>
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Actions needing triage</div>
            <div className="text-xs text-neutral-500">{actions.length} actions</div>
          </div>
        </CardHeader>
        <CardContent>
          {actions.length === 0 && !loading && (
            <div className="text-sm text-neutral-500">All actions have due dates.</div>
          )}
          <ul className="space-y-2">
            {actions.map((a) => {
              const parentLabel = a.parent_type === "project"
                ? projects.find((p) => p.id === a.parent_id)?.name
                : a.parent_type === "event"
                  ? eventOptions.find((e) => e.event_key === a.parent_id)?.title
                  : null;
              return (
                <li
                  key={a.id}
                  className="cursor-pointer rounded-lg border border-neutral-200 px-3 py-2 transition-colors hover:bg-neutral-50"
                  onClick={() => setSelectedAction(a)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{a.title}</div>
                      {parentLabel && (
                        <div className="flex items-center gap-1 text-xs text-neutral-500">
                          {a.parent_type === "project" ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                          )}
                          {parentLabel}
                        </div>
                      )}
                    </div>
                    <Badge tone="amber">no due date</Badge>
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

      <ActionDetailModal
        action={selectedAction}
        projects={projects}
        events={eventOptions}
        onClose={() => setSelectedAction(null)}
        onSaved={load}
      />
    </div>
  );
}
