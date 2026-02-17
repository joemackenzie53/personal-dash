"use client";
import * as React from "react";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { fmtDate, fmtTime, isAllDay } from "@/lib/format";

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
  is_template: number;
  generated_from_action_id: string | null;
};

type CategoryRow = { id: string; name: string };

type Props = {
  event: EventRow | null;
  projects: ProjectRow[];
  onClose: () => void;
  onSaved: () => void;
};

export function EventDetailModal({ event, projects, onClose, onSaved }: Props) {
  const [category, setCategory] = React.useState("unknown");
  const [projectId, setProjectId] = React.useState("");
  const [notesUrl, setNotesUrl] = React.useState("");
  const [isMajor, setIsMajor] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const [categories, setCategories] = React.useState<CategoryRow[]>([]);
  const [actions, setActions] = React.useState<ActionRow[]>([]);
  const [seriesTemplates, setSeriesTemplates] = React.useState<ActionRow[]>([]);
  const [newTemplateTitle, setNewTemplateTitle] = React.useState("");
  const [newInstanceTitle, setNewInstanceTitle] = React.useState("");
  const [addingAction, setAddingAction] = React.useState(false);
  const [actionsTab, setActionsTab] = React.useState<"instance" | "recurring">("instance");

  React.useEffect(() => {
    api<{ categories: CategoryRow[] }>("/api/categories")
      .then((res) => setCategories(res.categories))
      .catch(() => setCategories([]));
  }, []);

  async function loadActions(eventKey: string) {
    try {
      await api("/api/actions/propagate", {
        method: "POST",
        body: JSON.stringify({ eventKey }),
      });
    } catch {}

    try {
      const [actionsRes, templatesRes] = await Promise.all([
        api<{ actions: ActionRow[] }>(
          `/api/actions?status=all&parentType=event&parentId=${encodeURIComponent(eventKey)}`
        ),
        api<{ templates: ActionRow[] }>(
          `/api/actions/templates?eventKey=${encodeURIComponent(eventKey)}`
        ),
      ]);
      setActions(actionsRes.actions);
      setSeriesTemplates(templatesRes.templates);
    } catch {
      setActions([]);
      setSeriesTemplates([]);
    }
  }

  React.useEffect(() => {
    if (event) {
      setCategory(event.category || "unknown");
      setProjectId(event.project_id || "");
      setNotesUrl(event.notes_url || "");
      setIsMajor(!!event.is_major);
      setErr(null);
      setNewTemplateTitle("");
      setNewInstanceTitle("");
      setActionsTab("instance");
      loadActions(event.event_key);
    } else {
      setActions([]);
      setSeriesTemplates([]);
    }
  }, [event]);

  if (!event) return null;

  const allDay = isAllDay(event.start, event.all_day);

  async function handleSave() {
    if (!event) return;
    setSaving(true);
    setErr(null);
    try {
      await api("/api/event-meta", {
        method: "PUT",
        body: JSON.stringify({
          eventKey: event.event_key,
          category,
          isMajor,
          projectId: projectId || null,
          notesUrl: notesUrl || null,
        }),
      });
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function addAction(title: string, isTemplate: boolean) {
    if (!event || !title.trim()) return;
    setAddingAction(true);
    try {
      await api("/api/actions", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          parentType: "event",
          parentId: event.event_key,
          isTemplate,
        }),
      });
      if (isTemplate) setNewTemplateTitle("");
      else setNewInstanceTitle("");
      await loadActions(event.event_key);
    } catch (e: any) {
      setErr(e?.message || "Failed to add action");
    } finally {
      setAddingAction(false);
    }
  }

  async function toggleAction(action: ActionRow) {
    const newStatus = action.status === "open" ? "done" : "open";
    try {
      await api(`/api/actions/${action.id}`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus }),
      });
      if (event) await loadActions(event.event_key);
    } catch (e: any) {
      setErr(e?.message || "Failed to update action");
    }
  }

  async function deleteAction(actionId: string) {
    try {
      await api(`/api/actions/${actionId}`, { method: "DELETE" });
      if (event) await loadActions(event.event_key);
    } catch (e: any) {
      setErr(e?.message || "Failed to delete action");
    }
  }

  const instanceActions = actions.filter((a) => !a.is_template);
  const instanceOpen = instanceActions.filter((a) => a.status === "open");
  const instanceDone = instanceActions.filter((a) => a.status === "done");

  const xIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );

  const checkIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );

  function renderTemplateRow(a: ActionRow) {
    return (
      <li key={a.id} className="group flex items-center gap-2 rounded px-1 py-1 hover:bg-neutral-50">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-neutral-400">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="17 1 21 5 17 9" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <polyline points="7 23 3 19 7 15" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
        </span>
        <span className="flex-1 text-sm">{a.title}</span>
        <button
          onClick={() => deleteAction(a.id)}
          className="shrink-0 rounded p-0.5 text-neutral-300 opacity-0 group-hover:opacity-100 hover:text-red-500"
          title="Delete"
        >
          {xIcon}
        </button>
      </li>
    );
  }

  function renderInstanceRow(a: ActionRow) {
    const isDone = a.status === "done";
    const isGenerated = !!a.generated_from_action_id;
    return (
      <li key={a.id} className="group flex items-center gap-2 rounded px-1 py-1 hover:bg-neutral-50">
        <button
          onClick={() => toggleAction(a)}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
            isDone
              ? "border-green-400 bg-green-100 text-green-600"
              : "border-neutral-300 text-transparent hover:border-neutral-500"
          }`}
        >
          {checkIcon}
        </button>
        <span className={`flex-1 text-sm ${isDone ? "text-neutral-400 line-through" : ""}`}>
          {a.title}
        </span>
        {a.due_at && !isDone && <span className="shrink-0 text-xs text-neutral-500">{fmtDate(a.due_at)}</span>}
        {isGenerated && !isDone && (
          <span className="shrink-0 text-xs text-neutral-400" title="Auto-created from a recurring action">
            recurring
          </span>
        )}
        {!isDone && (
          <button
            onClick={() => deleteAction(a.id)}
            className="shrink-0 rounded p-0.5 text-neutral-300 opacity-0 group-hover:opacity-100 hover:text-red-500"
            title={isGenerated ? "Remove from this instance" : "Delete"}
          >
            {xIcon}
          </button>
        )}
      </li>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 transition-opacity"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-neutral-200 bg-white shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-4 pb-2">
          <div>
            <div className="text-base font-semibold">{event.title || "(no title)"}</div>
            <div className="mt-1 text-sm text-neutral-600">
              {fmtDate(event.start)}
              {!allDay ? <> &bull; {fmtTime(event.start)} &ndash; {fmtTime(event.end)}</> : <span className="text-neutral-500"> (all day)</span>}
            </div>
            {event.recurring_event_id && (
              <div className="mt-1 flex items-center gap-1 text-xs text-neutral-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="17 1 21 5 17 9" />
                  <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                  <polyline points="7 23 3 19 7 15" />
                  <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                </svg>
                Recurring event
              </div>
            )}
            {event.location && (
              <div className="mt-1 text-sm text-neutral-500">{event.location}</div>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {event.description && (
          <div className="px-4 pb-2">
            <div className="rounded-lg bg-neutral-50 p-3 text-sm text-neutral-700 whitespace-pre-wrap">
              {event.description}
            </div>
          </div>
        )}

        <div className="space-y-3 p-4 pt-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <div className="text-xs font-medium text-neutral-600">Category</div>
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
                {categories.length === 0 && <option value="unknown">unknown</option>}
              </Select>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-neutral-600">Project (optional)</div>
              <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">None</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs font-medium text-neutral-600">Notes link (optional)</div>
            <Input
              placeholder="Google Doc/Sheet link"
              value={notesUrl}
              onChange={(e) => setNotesUrl(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isMajor}
              onChange={(e) => setIsMajor(e.target.checked)}
            />
            Mark as major
          </label>

          {err && <div className="text-sm text-red-600">{err}</div>}

          {event.recurring_event_id && (
            <div className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
              This is a recurring event. Saving will apply your changes to all instances in the series (unless you&apos;ve already customised one individually).
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving\u2026" : "Save"}
            </Button>
          </div>
        </div>

        <div className="border-t border-neutral-200 p-4">
          <div className="flex items-center gap-1 border-b border-neutral-200 mb-3">
            <button
              onClick={() => setActionsTab("instance")}
              className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors ${
                actionsTab === "instance"
                  ? "border-neutral-900 text-neutral-900"
                  : "border-transparent text-neutral-400 hover:text-neutral-600"
              }`}
            >
              This instance
              {instanceOpen.length > 0 && (
                <span className="ml-1.5 text-neutral-400">{instanceOpen.length}</span>
              )}
            </button>
            <button
              onClick={() => setActionsTab("recurring")}
              className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors ${
                actionsTab === "recurring"
                  ? "border-neutral-900 text-neutral-900"
                  : "border-transparent text-neutral-400 hover:text-neutral-600"
              }`}
            >
              Recurring
              {seriesTemplates.length > 0 && (
                <span className="ml-1.5 text-neutral-400">{seriesTemplates.length}</span>
              )}
            </button>
          </div>

          {actionsTab === "instance" && (
            <div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add an action\u2026"
                  value={newInstanceTitle}
                  onChange={(e) => setNewInstanceTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addAction(newInstanceTitle, false); }}
                  className="text-sm"
                />
                <Button onClick={() => addAction(newInstanceTitle, false)} disabled={!newInstanceTitle.trim() || addingAction}>
                  Add
                </Button>
              </div>

              {instanceActions.length > 0 && (
                <ul className="mt-2 space-y-0.5">
                  {instanceOpen.map((a) => renderInstanceRow(a))}
                  {instanceDone.map((a) => renderInstanceRow(a))}
                </ul>
              )}
            </div>
          )}

          {actionsTab === "recurring" && (
            <div>
              <div className="mb-2 text-xs text-neutral-500">
                Actions here are automatically added to every instance of this event.
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add a recurring action\u2026"
                  value={newTemplateTitle}
                  onChange={(e) => setNewTemplateTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addAction(newTemplateTitle, true); }}
                  className="text-sm"
                />
                <Button onClick={() => addAction(newTemplateTitle, true)} disabled={!newTemplateTitle.trim() || addingAction}>
                  Add
                </Button>
              </div>

              {seriesTemplates.length > 0 && (
                <ul className="mt-2 space-y-0.5">
                  {seriesTemplates.map((a) => renderTemplateRow(a))}
                </ul>
              )}
              {seriesTemplates.length === 0 && (
                <div className="mt-2 text-xs text-neutral-400 italic">
                  No recurring actions yet.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
