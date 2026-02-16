"use client";
import * as React from "react";
import { api } from "@/lib/client";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Notice } from "@/components/Notice";
import { fmtDate } from "@/lib/format";

type Settings = {
  connected: boolean;
  horizonDays: number;
  refreshIntervalMinutes: number;
  selectedCalendarIds: string[];
  lastSyncAt: string | null;
};

type CalendarRow = {
  calendar_id: string;
  summary: string;
  primary_flag: number;
  is_holiday: number;
  selected: number;
};

export default function SettingsPage() {
  const [settings, setSettings] = React.useState<Settings | null>(null);
  const [calendars, setCalendars] = React.useState<CalendarRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);

  const [horizonDays, setHorizonDays] = React.useState(182);
  const [refreshIntervalMinutes, setRefreshIntervalMinutes] = React.useState(10);
  const [selected, setSelected] = React.useState<string[]>([]);

  async function load() {
    setLoading(true);
    setErr(null);
    setMsg(null);
    try {
      const s = await api<Settings>("/api/settings");
      setSettings(s);
      setHorizonDays(s.horizonDays);
      setRefreshIntervalMinutes(s.refreshIntervalMinutes);
      setSelected(s.selectedCalendarIds);

      // calendars need auth cookie; if not authed, it'll error. That's fine.
      try {
        const c = await api<{ calendars: CalendarRow[] }>("/api/calendars");
        setCalendars(c.calendars);
      } catch {
        setCalendars([]);
      }
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
  }, []);

  async function save() {
    setErr(null);
    setMsg(null);
    setSaving(true);
    try {
      await api("/api/settings", {
        method: "PUT",
        body: JSON.stringify({ horizonDays, refreshIntervalMinutes, selectedCalendarIds: selected })
      });
      setMsg("Saved.");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function sync() {
    setErr(null);
    setMsg(null);
    setSaving(true);
    try {
      const res = await api<any>("/api/sync", { method: "POST" });
      setMsg(`Synced: ${res.calendarsSynced} calendars, ${res.eventsUpserted} events.`);
      await load();
    } catch (e: any) {
      setErr(e?.message || "Sync failed");
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    setErr(null);
    setMsg(null);
    setSaving(true);
    try {
      await api("/api/auth/disconnect", { method: "POST" });
      setMsg("Disconnected.");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Disconnect failed");
    } finally {
      setSaving(false);
    }
  }

  function toggleCalendar(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-neutral-600">Connect Google, pick calendars, and set your horizon window.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={load} disabled={loading || saving}>Refresh</Button>
          <Button onClick={save} disabled={loading || saving}>Save</Button>
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
      {msg && <Notice tone="green">{msg}</Notice>}

      <Card>
        <CardHeader>
          <div className="text-sm font-semibold">Google Calendar</div>
          <div className="text-xs text-neutral-600">
            Uses OAuth (calendar.readonly). Tokens are stored locally in SQLite for this personal app.
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            Status:{" "}
            {settings?.connected ? (
              <span className="font-medium text-green-700">connected</span>
            ) : (
              <span className="font-medium text-neutral-700">not connected</span>
            )}
          </div>
          <div className="flex gap-2">
            {!settings?.connected ? (
              <a href="/api/auth/google/start">
                <Button>Connect</Button>
              </a>
            ) : (
              <>
                <Button onClick={sync} disabled={saving}>Sync now</Button>
                <Button variant="danger" onClick={disconnect} disabled={saving}>Disconnect</Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="text-sm font-semibold">Horizon config</div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <div className="text-xs font-medium text-neutral-600">Horizon days</div>
              <Input
                type="number"
                min={14}
                max={366}
                value={horizonDays}
                onChange={(e) => setHorizonDays(Number(e.target.value))}
              />
              <div className="text-xs text-neutral-500">Default is ~6 months (182 days).</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium text-neutral-600">Refresh interval (minutes)</div>
              <Input
                type="number"
                min={1}
                max={240}
                value={refreshIntervalMinutes}
                onChange={(e) => setRefreshIntervalMinutes(Number(e.target.value))}
              />
              <div className="text-xs text-neutral-500">Used later for auto-refresh; manual Sync already works.</div>
            </div>
            <div className="text-xs text-neutral-500">
              Last sync: {settings?.lastSyncAt ? fmtDate(settings.lastSyncAt) : "never"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="text-sm font-semibold">Calendars included</div>
            <div className="text-xs text-neutral-600">You said you keep everything in one calendar; that works. We also auto-include UK Holidays.</div>
          </CardHeader>
          <CardContent className="space-y-2">
            {!settings?.connected && <div className="text-sm text-neutral-500">Connect first to load calendars.</div>}
            {settings?.connected && calendars.length === 0 && (
              <Notice tone="amber">
                Calendar list not loaded (likely because you need the session cookie). Click <b>Connect</b> again, then refresh.
              </Notice>
            )}
            {calendars.map((c) => (
              <label key={c.calendar_id} className="flex items-start gap-3 rounded-lg border border-neutral-200 p-3">
                <input
                  type="checkbox"
                  checked={selected.includes(c.calendar_id)}
                  onChange={() => toggleCalendar(c.calendar_id)}
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium">{c.summary}</div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {c.primary_flag ? <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">primary</span> : null}
                    {c.is_holiday ? <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">UK holidays</span> : null}
                  </div>
                </div>
              </label>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="text-sm font-semibold">Environment variables</div>
          <div className="text-xs text-neutral-600">
            These must be set in your host (Replit, Vercel, etc.). See <code>.env.example</code>.
          </div>
        </CardHeader>
        <CardContent>
          <pre className="overflow-auto rounded-xl bg-neutral-900 p-4 text-xs text-neutral-100">
{`GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
SESSION_SECRET=`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
