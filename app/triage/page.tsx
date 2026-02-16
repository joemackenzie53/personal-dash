"use client";
import * as React from "react";
import { api } from "@/lib/client";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/Notice";
import { Badge } from "@/components/ui/Badge";
import { fmtDate } from "@/lib/format";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";

type Settings = { connected: boolean; horizonDays: number };
type EventRow = {
  event_key: string;
  title: string;
  start: string;
  category: string | null;
  is_major: number | null;
  project_id: string | null;
  notes_url: string | null;
  locked: number | null;
  deleted: number;
};

type ProjectRow = { id: string; name: string; status: string };

const CATEGORIES = [
  "unknown",
  "holiday",
  "birthday",
  "anniversary",
  "christmas",
  "easter",
  "valentines",
  "travel",
  "social",
  "admin"
];

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

  async function save(e: EventRow, patch: Partial<EventRow>) {
    setErr(null);
    try {
      const next = { ...e, ...patch };
      await api("/api/event-meta", {
        method: "PUT",
        body: JSON.stringify({
          eventKey: next.event_key,
          category: next.category,
          isMajor: !!next.is_major,
          projectId: next.project_id,
          notesUrl: next.notes_url
        })
      });
      await load();
    } catch (err: any) {
      setErr(err?.message || "Save failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Triage</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Classify “unknown” events so the dashboard can surface the right prep actions.
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

      {!loading && events.length === 0 && <Notice tone="green">No events need triage right now 🎉</Notice>}

      <div className="space-y-3">
        {events.slice(0, 80).map((e) => (
          <Card key={e.event_key}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{e.title || "(no title)"}</div>
                  <div className="text-xs text-neutral-600">{fmtDate(e.start)}</div>
                </div>
                <Badge tone="amber">unknown</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <div className="text-xs font-medium text-neutral-600">Category</div>
                  <Select
                    value={e.category || "unknown"}
                    onChange={(ev) => save(e, { category: ev.target.value })}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-medium text-neutral-600">Project (optional)</div>
                  <Select
                    value={e.project_id || ""}
                    onChange={(ev) => save(e, { project_id: ev.target.value || null })}
                  >
                    <option value="">None</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-medium text-neutral-600">Notes link (optional)</div>
                  <Input
                    placeholder="Google Doc/Sheet link"
                    defaultValue={e.notes_url || ""}
                    onBlur={(ev) => save(e, { notes_url: ev.target.value || null })}
                  />
                </div>

                <div className="flex items-end gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      defaultChecked={!!e.is_major}
                      onChange={(ev) => save(e, { is_major: ev.target.checked ? 1 : 0 })}
                    />
                    Mark as major
                  </label>
                </div>
              </div>

              <div className="text-xs text-neutral-500">
                When you triage an event, the app locks that classification so auto-sync won’t overwrite it.
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
