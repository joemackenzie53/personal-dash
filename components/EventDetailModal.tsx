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
  "admin",
];

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

  React.useEffect(() => {
    if (event) {
      setCategory(event.category || "unknown");
      setProjectId(event.project_id || "");
      setNotesUrl(event.notes_url || "");
      setIsMajor(!!event.is_major);
      setErr(null);
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 transition-opacity"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-neutral-200 bg-white shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-4 pb-2">
          <div>
            <div className="text-base font-semibold">{event.title || "(no title)"}</div>
            <div className="mt-1 text-sm text-neutral-600">
              {fmtDate(event.start)}
              {!allDay ? <> • {fmtTime(event.start)} – {fmtTime(event.end)}</> : <span className="text-neutral-500"> (all day)</span>}
            </div>
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
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
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

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
