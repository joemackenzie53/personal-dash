"use client";
import * as React from "react";
import { api } from "@/lib/client";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
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
        {loading && <div className="text-sm text-neutral-500">Loading…</div>}
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
            <CardContent>
              {p.description ? <div className="text-sm text-neutral-700">{p.description}</div> : <div className="text-sm text-neutral-500">No description.</div>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
