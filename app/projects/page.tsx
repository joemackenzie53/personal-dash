"use client";
import * as React from "react";
import { api } from "@/lib/client";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { fmtDate } from "@/lib/format";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Notice } from "@/components/Notice";
import { Badge } from "@/components/ui/Badge";

type Project = {
  id: string;
  name: string;
  status: string;
  priority: string;
  target_date: string | null;
  description: string | null;
  drive_folder_url: string | null;
  openActions?: number;
};

type ActionRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_at: string | null;
};

function ProjectActions({ projectId }: { projectId: string }) {
  const [actions, setActions] = React.useState<ActionRow[]>([]);
  const [newTitle, setNewTitle] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);

  async function loadActions() {
    try {
      const res = await api<{ actions: ActionRow[] }>(
        `/api/actions?status=all&parentType=project&parentId=${encodeURIComponent(projectId)}`
      );
      setActions(res.actions);
    } catch {
      setActions([]);
    }
  }

  React.useEffect(() => {
    loadActions();
  }, [projectId]);

  async function addAction() {
    if (!newTitle.trim()) return;
    setAdding(true);
    try {
      await api("/api/actions", {
        method: "POST",
        body: JSON.stringify({
          title: newTitle.trim(),
          parentType: "project",
          parentId: projectId,
        }),
      });
      setNewTitle("");
      await loadActions();
    } catch {
    } finally {
      setAdding(false);
    }
  }

  async function toggleAction(action: ActionRow) {
    const newStatus = action.status === "open" ? "done" : "open";
    try {
      await api(`/api/actions/${action.id}`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus }),
      });
      await loadActions();
    } catch {
    }
  }

  const openActions = actions.filter((a) => a.status === "open");
  const doneActions = actions.filter((a) => a.status === "done");

  return (
    <div className="border-t border-neutral-100 pt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between text-left"
      >
        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
          Actions
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-500">{openActions.length} open</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`text-neutral-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="mt-2">
          <div className="flex gap-2">
            <Input
              placeholder="Add an action..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addAction(); }}
              className="text-sm"
            />
            <Button onClick={addAction} disabled={!newTitle.trim() || adding}>
              {adding ? "Adding..." : "Add"}
            </Button>
          </div>

          {actions.length > 0 && (
            <ul className="mt-2 space-y-1">
              {openActions.map((a) => (
                <li key={a.id} className="flex items-center gap-2 rounded px-1 py-1 hover:bg-neutral-50">
                  <button
                    onClick={() => toggleAction(a)}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-neutral-300 text-transparent hover:border-neutral-500"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </button>
                  <span className="flex-1 text-sm">{a.title}</span>
                  {a.due_at && <span className="shrink-0 text-xs text-neutral-500">{fmtDate(a.due_at)}</span>}
                </li>
              ))}
              {doneActions.map((a) => (
                <li key={a.id} className="flex items-center gap-2 rounded px-1 py-1 hover:bg-neutral-50">
                  <button
                    onClick={() => toggleAction(a)}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-green-400 bg-green-100 text-green-600"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </button>
                  <span className="flex-1 text-sm text-neutral-400 line-through">{a.title}</span>
                </li>
              ))}
            </ul>
          )}

          {actions.length === 0 && (
            <div className="mt-2 text-xs text-neutral-500">No actions yet.</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ProjectsPage() {
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  const [name, setName] = React.useState("");
  const [priority, setPriority] = React.useState("med");
  const [driveUrl, setDriveUrl] = React.useState("");
  const [desc, setDesc] = React.useState("");

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await api<{ projects: Project[] }>("/api/projects?status=active");
      setProjects(res.projects);
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
  }, []);

  async function create() {
    setErr(null);
    try {
      await api("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          name,
          priority,
          driveFolderUrl: driveUrl || null,
          description: desc || null
        })
      });
      setName("");
      setPriority("med");
      setDriveUrl("");
      setDesc("");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Create failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Lightweight project index. Keep the real docs in Drive; link them here.
          </p>
        </div>
        <Button variant="secondary" onClick={load} disabled={loading}>Refresh</Button>
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

      <Card>
        <CardHeader>
          <div className="text-sm font-semibold">Create project</div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <div className="text-xs font-medium text-neutral-600">Name</div>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. House move" />
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium text-neutral-600">Priority</div>
              <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="high">high</option>
                <option value="med">med</option>
                <option value="low">low</option>
              </Select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <div className="text-xs font-medium text-neutral-600">Drive folder URL (optional)</div>
              <Input value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)} placeholder="https://drive.google.com/..." />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <div className="text-xs font-medium text-neutral-600">Description (optional)</div>
              <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} />
            </div>
          </div>
          <Button onClick={create} disabled={!name.trim()}>Create</Button>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {loading && <div className="text-sm text-neutral-500">Loading...</div>}
        {!loading && projects.length === 0 && <div className="text-sm text-neutral-500">No active projects yet.</div>}
        {projects.map((p) => (
          <Card key={p.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{p.name}</div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <Badge>{p.priority}</Badge>
                    {typeof p.openActions === "number" ? <Badge tone="blue">{p.openActions} open actions</Badge> : null}
                  </div>
                </div>
                {p.drive_folder_url ? (
                  <a href={p.drive_folder_url} target="_blank" className="text-sm font-medium underline">
                    Drive
                  </a>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {p.description ? <div className="text-sm text-neutral-700">{p.description}</div> : <div className="text-sm text-neutral-500">No description.</div>}
              <ProjectActions projectId={p.id} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
