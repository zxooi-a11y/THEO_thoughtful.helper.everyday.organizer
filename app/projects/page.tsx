"use client";
import { useCallback, useEffect, useState } from "react";
import { COLOR_KEYS, colorOf } from "@/lib/colors";
import type { Project, Task } from "@/lib/types";
import { api, localToday, relDue } from "@/components/client";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState("blue");
  const [error, setError] = useState("");
  const [today, setToday] = useState("");

  const load = useCallback(async () => {
    try {
      const [p, t] = await Promise.all([api<Project[]>("/api/projects"), api<Task[]>("/api/tasks")]);
      setProjects(p); setTasks(t.filter((x) => x.status !== "done"));
    } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { setToday(localToday()); load(); }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await api("/api/projects", { body: { name, color } }).catch((er) => setError(er.message));
    setName(""); load();
  }

  async function move(t: Task, projectId: number | null) {
    await api(`/api/tasks/${t.id}`, { method: "PATCH", body: { project_id: projectId } });
    load();
  }

  const groups: (Project | null)[] = [...projects.filter((p) => tasks.some((t) => t.project_id === p.id) || (p.open_count ?? 0) + (p.done_count ?? 0) > 0), ...projects.filter((p) => !tasks.some((t) => t.project_id === p.id) && !((p.open_count ?? 0) + (p.done_count ?? 0))), null];

  return (
    <>
      <div className="page-head"><h1>Projects</h1></div>
      <form className="card row wrap" style={{ marginBottom: 28 }} onSubmit={add}>
        <input className="input grow" placeholder="New project or area of life (e.g. Wedding, Side hustle, Kids)" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="row" style={{ gap: 6 }}>
          {COLOR_KEYS.filter((k) => k !== "gray").map((k) => (
            <button type="button" key={k} onClick={() => setColor(k)} aria-label={k}
              style={{ width: 24, height: 24, borderRadius: 8, border: color === k ? "2px solid var(--text)" : "0", background: colorOf(k).dot }} />
          ))}
        </div>
        <button className="btn primary">Add project</button>
      </form>
      <p className="muted" style={{ marginTop: -12, marginBottom: 20 }}>Moving a task to another project teaches THEO where similar tasks belong next time.</p>
      {error && <div className="err" style={{ marginBottom: 20 }}>{error}</div>}

      <div className="cards">
        {groups.map((p) => {
          const list = tasks.filter((t) => t.project_id === (p?.id ?? null));
          if (!p && !list.length) return null;
          const c = colorOf(p?.color);
          return (
            <div key={p?.id ?? "inbox"} className="card">
              <div className="row between">
                <span className="chip" style={{ background: c.bg, color: c.fg }}>{p?.name ?? "Inbox"}</span>
                <span className="muted small">{list.length} open · {p?.done_count ?? 0} done</span>
              </div>
              <div style={{ marginTop: 10 }}>
                {list.length === 0 && <div className="muted small" style={{ padding: "10px 0" }}>Nothing open.</div>}
                {list.slice(0, 12).map((t) => (
                  <div key={t.id} className="list-row">
                    <div className="grow">
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{t.title}</div>
                      <div className="muted small">{relDue(t.due_date, today)}</div>
                    </div>
                    <select className="select" style={{ width: 110, padding: "4px 6px", fontSize: 12 }} value={t.project_id ?? ""} onChange={(e) => move(t, e.target.value ? Number(e.target.value) : null)}>
                      <option value="">Inbox</option>
                      {projects.map((pp) => <option key={pp.id} value={pp.id}>{pp.name}</option>)}
                    </select>
                  </div>
                ))}
                {list.length > 12 && <div className="muted small" style={{ paddingTop: 8 }}>+{list.length - 12} more</div>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
