"use client";
import * as React from "react";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { RichTextEditor } from "@/components/RichTextEditor";

type ActionRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_at: string | null;
  start_at?: string | null;
  snooze_until?: string | null;
  description: string | null;
  parent_type: string | null;
  parent_id: string | null;
  parent_name: string | null;
};

type ProjectRow = { id: string; name: string; status: string };

type EventOption = { event_key: string; title: string };

type Props = {
  action: ActionRow | null;
  projects: ProjectRow[];
  events: EventOption[];
  onClose: () => void;
  onSaved: () => void;
};

function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function tomorrowStr(): string {
  const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10);
}
function nextSatStr(): string {
  const d = new Date(); const day = d.getDay();
  d.setDate(d.getDate() + (day === 6 ? 7 : 6 - day)); return d.toISOString().slice(0, 10);
}
function nextMonStr(): string {
  const d = new Date(); const day = d.getDay();
  d.setDate(d.getDate() + (day === 1 ? 7 : (8 - day) % 7)); return d.toISOString().slice(0, 10);
}

export function ActionDetailModal({ action, projects, events, onClose, onSaved }: Props) {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [status, setStatus] = React.useState("open");
  const [priority, setPriority] = React.useState("med");
  const [dueAt, setDueAt] = React.useState("");
  const [startAt, setStartAt] = React.useState("");
  const [snoozeUntil, setSnoozeUntil] = React.useState("");
  const [parent, setParent] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  React.useEffect(() => {
    if (action) {
      setTitle(action.title);
      setDescription(action.description || "");
      setStatus(action.status);
      setPriority(action.priority || "med");
      setDueAt(toDateInput(action.due_at));
      setStartAt(toDateInput(action.start_at));
      setSnoozeUntil(toDateInput(action.snooze_until));
      if (action.parent_type && action.parent_id) {
        setParent(`${action.parent_type}:${action.parent_id}`);
      } else {
        setParent("");
      }
      setErr(null);
      setConfirmDelete(false);
    }
  }, [action]);

  if (!action) return null;

  async function handleSave() {
    if (!action) return;
    setSaving(true);
    setErr(null);
    try {
      let parentType: string | null = null;
      let parentId: string | null = null;
      if (parent) {
        const [type, ...rest] = parent.split(":");
        parentType = type;
        parentId = rest.join(":");
      }
      await api(`/api/actions/${action.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          status,
          priority,
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
          startAt: startAt ? new Date(startAt).toISOString() : null,
          snoozeUntil: snoozeUntil ? new Date(snoozeUntil).toISOString() : null,
          parentType,
          parentId,
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

  async function handleDelete() {
    if (!action) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    setErr(null);
    try {
      await api(`/api/actions/${action.id}`, { method: "DELETE" });
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e?.message || "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 transition-opacity"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-neutral-200 bg-white shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-4 pb-2">
          <div className="text-base font-semibold">Edit action</div>
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

        <div className="space-y-3 p-4 pt-2">
          <div className="space-y-1">
            <div className="text-xs font-medium text-neutral-600">Title</div>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Action title"
            />
          </div>

          <div className="space-y-1">
            <div className="text-xs font-medium text-neutral-600">Description</div>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder="Add more details..."
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <div className="text-xs font-medium text-neutral-600">Status</div>
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="open">Open</option>
                <option value="done">Done</option>
              </Select>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-neutral-600">Priority</div>
              <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="very_high">Very high</option>
                <option value="high">High</option>
                <option value="med">Medium</option>
                <option value="low">Low</option>
                <option value="very_low">Very low</option>
              </Select>
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Schedule</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <div className="text-xs font-medium text-neutral-500">Start date</div>
                <div className="flex items-center gap-1">
                  <Input type="date" value={startAt} onChange={(e) => setStartAt(e.target.value)} className="text-xs" />
                  {startAt && <button type="button" onClick={() => setStartAt("")} className="shrink-0 px-1 text-base leading-none text-neutral-400 hover:text-neutral-700">×</button>}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs font-medium text-neutral-500">Due date</div>
                <div className="flex items-center gap-1">
                  <Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="text-xs" />
                  {dueAt && <button type="button" onClick={() => setDueAt("")} className="shrink-0 px-1 text-base leading-none text-neutral-400 hover:text-neutral-700">×</button>}
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium text-neutral-500">Snooze until</div>
              <div className="flex items-center gap-1">
                <Input type="date" value={snoozeUntil} onChange={(e) => setSnoozeUntil(e.target.value)} className="flex-1 text-xs" />
                {snoozeUntil && <button type="button" onClick={() => setSnoozeUntil("")} className="shrink-0 px-1 text-base leading-none text-neutral-400 hover:text-neutral-700">×</button>}
              </div>
              <div className="flex flex-wrap gap-1 pt-0.5">
                {(["Tomorrow", "Saturday", "Next week"] as const).map((label) => {
                  const val = label === "Tomorrow" ? tomorrowStr() : label === "Saturday" ? nextSatStr() : nextMonStr();
                  return (
                    <button key={label} type="button" onClick={() => setSnoozeUntil(val)}
                      className="rounded bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-700 hover:bg-neutral-300">{label}</button>
                  );
                })}
                {snoozeUntil && (
                  <button type="button" onClick={() => setSnoozeUntil("")}
                    className="rounded bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500 hover:bg-neutral-200">Clear</button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs font-medium text-neutral-600">Linked to</div>
            <Select value={parent} onChange={(e) => setParent(e.target.value)}>
              <option value="">None</option>
              {projects.length > 0 && (
                <optgroup label="Projects">
                  {projects.map((p) => (
                    <option key={p.id} value={`project:${p.id}`}>{p.name}</option>
                  ))}
                </optgroup>
              )}
              {(events.length > 0 || (action?.parent_type === "event" && action?.parent_id)) && (
                <optgroup label="Upcoming events">
                  {action?.parent_type === "event" && action?.parent_id && !events.some(e => e.event_key === action.parent_id) && (
                    <option value={`event:${action.parent_id}`}>{action.parent_name || "(linked event)"}</option>
                  )}
                  {events.slice(0, 15).map((e) => (
                    <option key={e.event_key} value={`event:${e.event_key}`}>{e.title || "(no title)"}</option>
                  ))}
                </optgroup>
              )}
            </Select>
          </div>

          {err && <div className="text-sm text-red-600">{err}</div>}

          <div className="flex items-center justify-between gap-2 pt-2">
            <button
              onClick={handleDelete}
              className={`text-sm font-medium ${confirmDelete ? "text-red-600" : "text-neutral-500 hover:text-red-600"}`}
            >
              {confirmDelete ? (deleting ? "Deleting\u2026" : "Click again to confirm") : "Delete"}
            </button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !title.trim()}>
                {saving ? "Saving\u2026" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
