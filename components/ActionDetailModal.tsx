"use client";
import * as React from "react";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";

type ActionRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_at: string | null;
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

function toDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function ActionDetailModal({ action, projects, events, onClose, onSaved }: Props) {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [status, setStatus] = React.useState("open");
  const [priority, setPriority] = React.useState("med");
  const [dueAt, setDueAt] = React.useState("");
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
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add more details..."
              rows={3}
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
                <option value="high">High</option>
                <option value="med">Medium</option>
                <option value="low">Low</option>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs font-medium text-neutral-600">Due date</div>
            <Input
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
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
