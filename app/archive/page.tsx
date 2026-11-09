"use client";
import { useCallback, useEffect, useState } from "react";
import { colorOf } from "@/lib/colors";
import type { Project, Task } from "@/lib/types";
import { api, fmtDate } from "@/components/client";
import { SearchIcon } from "@/components/Icons";

export default function ArchivePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const [t, p] = await Promise.all([api<Task[]>(`/api/tasks?archived=1${q ? `&q=${encodeURIComponent(q)}` : ""}`), api<Project[]>("/api/projects")]);
    setTasks(t.sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""))); setProjects(p);
  }, [q]);
  useEffect(() => { const id = setTimeout(load, 200); return () => clearTimeout(id); }, [load]);

  const act = async (t: Task, body: Record<string, unknown> | null) => {
    if (body) await api(`/api/tasks/${t.id}`, { method: "PATCH", body });
    else if (confirm("Delete permanently?")) await api(`/api/tasks/${t.id}`, { method: "DELETE" });
    load();
  };

  return (
    <>
      <div className="page-head"><h1>Archive</h1></div>
      <div className="search"><SearchIcon /><input placeholder="Search finished tasks" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="card">
        {tasks.length === 0 && <div className="empty">Finished tasks will show up here.</div>}
        {tasks.map((t) => {
          const p = projects.find((x) => x.id === t.project_id); const c = colorOf(p?.color);
          return (
            <div key={t.id} className="list-row wrap">
              <span className="chip" style={{ background: c.bg, color: c.fg, fontSize: 11 }}>{p?.name ?? "Inbox"}</span>
              <div className="grow">
                <div style={{ fontWeight: 600 }}>{t.title}</div>
                <div className="muted small">{t.completed_at ? `Done ${fmtDate(t.completed_at.slice(0, 10), true)}` : "Archived"} · was due {fmtDate(t.due_date)}</div>
              </div>
              <button className="btn ghost small" onClick={() => act(t, { status: "todo", archived: false })}>Reopen</button>
              <button className="btn danger small" onClick={() => act(t, null)}>Delete</button>
            </div>
          );
        })}
      </div>
    </>
  );
}
