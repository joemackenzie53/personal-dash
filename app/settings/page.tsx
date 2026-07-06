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

type CategoryRow = {
  id: string;
  name: string;
  pattern: string | null;
  sort_order: number;
};

export default function SettingsPage() {
  const [settings, setSettings] = React.useState<Settings | null>(null);
  const [calendars, setCalendars] = React.useState<CalendarRow[]>([]);
  const [categories, setCategories] = React.useState<CategoryRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [syncMsg, setSyncMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);

  const [horizonDays, setHorizonDays] = React.useState(182);
  const [refreshIntervalMinutes, setRefreshIntervalMinutes] = React.useState(10);
  const [selected, setSelected] = React.useState<string[]>([]);

  const [newCatName, setNewCatName] = React.useState("");
  const [newCatPattern, setNewCatPattern] = React.useState("");
  const [editingCat, setEditingCat] = React.useState<string | null>(null);
  const [editCatName, setEditCatName] = React.useState("");
  const [editCatPattern, setEditCatPattern] = React.useState("");

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

      try {
        const c = await api<{ calendars: CalendarRow[] }>("/api/calendars");
        setCalendars(c.calendars);
      } catch {
        setCalendars([]);
      }

      try {
        const cats = await api<{ categories: CategoryRow[] }>("/api/categories");
        setCategories(cats.categories);
      } catch {
        setCategories([]);
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
    setSyncMsg("Sync in progress…");
    setErr(null);
    setSyncing(true);
    const started = Date.now();
    const minDelay = () => {
      const elapsed = Date.now() - started;
      return elapsed < 500 ? new Promise<void>((r) => setTimeout(r, 500 - elapsed)) : Promise.resolve();
    };
    try {
      const res = await api<any>("/api/sync", { method: "POST" });
      await minDelay();
      setSyncMsg(`Sync complete — ${res.calendarsSynced} calendar${res.calendarsSynced !== 1 ? "s" : ""}, ${res.eventsUpserted} events.`);
      await load();
    } catch (e: any) {
      await minDelay();
      setSyncMsg(`Sync failed: ${e?.message || "unknown error"}`);
    } finally {
      setSyncing(false);
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

  async function addCategory() {
    if (!newCatName.trim()) return;
    setErr(null);
    try {
      await api("/api/categories", {
        method: "POST",
        body: JSON.stringify({ name: newCatName.trim(), pattern: newCatPattern.trim() || null }),
      });
      setNewCatName("");
      setNewCatPattern("");
      const cats = await api<{ categories: CategoryRow[] }>("/api/categories");
      setCategories(cats.categories);
    } catch (e: any) {
      setErr(e?.message || "Failed to add category");
    }
  }

  async function updateCategory(id: string, name: string, pattern: string) {
    if (!name.trim()) return;
    setErr(null);
    try {
      await api(`/api/categories/${id}`, {
        method: "PUT",
        body: JSON.stringify({ name: name.trim(), pattern: pattern.trim() || null }),
      });
      setEditingCat(null);
      const cats = await api<{ categories: CategoryRow[] }>("/api/categories");
      setCategories(cats.categories);
    } catch (e: any) {
      setErr(e?.message || "Failed to update category");
    }
  }

  async function deleteCategory(id: string) {
    setErr(null);
    try {
      await api(`/api/categories/${id}`, { method: "DELETE" });
      const cats = await api<{ categories: CategoryRow[] }>("/api/categories");
      setCategories(cats.categories);
    } catch (e: any) {
      setErr(e?.message || "Failed to delete category");
    }
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
      {syncMsg && (
        <Notice tone={syncMsg.startsWith("Sync failed") ? "red" : syncMsg === "Sync in progress…" ? "amber" : "green"}>
          {syncMsg}
        </Notice>
      )}

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
          <div className="flex flex-wrap items-center gap-3">
            {!settings?.connected ? (
              <a href="/api/auth/google/start">
                <Button>Connect</Button>
              </a>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Button onClick={sync} disabled={syncing || saving}>
                    {syncing ? "Syncing…" : "Sync now"}
                  </Button>
                  <Button variant="danger" onClick={disconnect} disabled={syncing || saving}>Disconnect</Button>
                </div>
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
          <div className="text-sm font-semibold">Event categories</div>
          <div className="text-xs text-neutral-600">
            Manage event categories and their auto-match keywords. Events with titles containing any of the keywords
            will be automatically categorised during sync. Use <code className="rounded bg-neutral-100 px-1">calendar:holidays</code> to match holiday calendars.
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <div className="flex flex-1 flex-col gap-1">
              <Input
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="Category name"
                onKeyDown={(e) => { if (e.key === "Enter") addCategory(); }}
              />
              <Input
                value={newCatPattern}
                onChange={(e) => setNewCatPattern(e.target.value)}
                placeholder="Keywords (e.g. birthday, bday)"
                onKeyDown={(e) => { if (e.key === "Enter") addCategory(); }}
                className="text-xs"
              />
            </div>
            <Button onClick={addCategory} disabled={!newCatName.trim()}>Add</Button>
          </div>

          {categories.length === 0 && <div className="text-sm text-neutral-500">No categories yet.</div>}

          <ul className="space-y-1">
            {categories.map((cat) => (
              <li key={cat.id} className="rounded-lg border border-neutral-200 px-3 py-2">
                {editingCat === cat.id ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <div className="flex flex-1 flex-col gap-1">
                        <Input
                          value={editCatName}
                          onChange={(e) => setEditCatName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Escape") setEditingCat(null); }}
                          className="text-sm"
                          placeholder="Category name"
                          autoFocus
                        />
                        <Input
                          value={editCatPattern}
                          onChange={(e) => setEditCatPattern(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Escape") setEditingCat(null); }}
                          className="text-xs"
                          placeholder="Keywords, comma-separated (leave empty for manual only)"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Button onClick={() => updateCategory(cat.id, editCatName, editCatPattern)} disabled={!editCatName.trim()}>Save</Button>
                        <Button variant="secondary" onClick={() => setEditingCat(null)}>Cancel</Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium">{cat.name}</span>
                      {cat.pattern ? (
                        <div className="mt-0.5 truncate text-xs text-neutral-500" title={cat.pattern}>
                          <span className="text-neutral-400">keywords:</span> {cat.pattern}
                        </div>
                      ) : (
                        <div className="mt-0.5 text-xs text-neutral-400">manual only</div>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => { setEditingCat(cat.id); setEditCatName(cat.name); setEditCatPattern(cat.pattern || ""); }}
                        className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
                        title="Edit"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => deleteCategory(cat.id)}
                        className="rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                        title="Delete"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

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
