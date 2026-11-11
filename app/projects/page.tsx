"use client";
import { useCallback, useEffect, useState } from "react";
import { COLOR_KEYS, colorOf } from "@/lib/colors";
import type { Project, Task } from "@/lib/types";
import { api, fmtDate, localToday, relDue } from "@/components/client";
import ProjectSelect from "@/components/ProjectSelect";
import TaskEditor from "@/components/TaskEditor";
import { kindOf, timeRange, type LifeEvent } from "@/lib/events";
import { PlusIcon } from "@/components/Icons";

const PALETTE = COLOR_KEYS.filter((k) => k !== "gray");

function Swatches({ value, onPick }: { value: string; onPick: (c: string) => void }) {
  return (
    <div className="swatches">
      {PALETTE.map((k) => (
        <button type="button" key={k} className={`swatch ${value === k ? "on" : ""}`} style={{ background: colorOf(k).dot }} onClick={() => onPick(k)} aria-label={k} title={k} />
      ))}
    </div>
  );
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState("blue");
  const [editing, setEditing] = useState<{ id: number; name: string; color: string } | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [events, setEvents] = useState<LifeEvent[]>([]);
  const [error, setError] = useState("");
  const [today, setToday] = useState("");

  const load = useCallback(async () => {
    try {
      const today = localToday();
      const [p, t, ev] = await Promise.all([api<Project[]>("/api/projects"), api<Task[]>("/api/tasks"), api<LifeEvent[]>(`/api/events?from=${today}`)]);
      setEvents(ev); setProjects(p); setTasks(t.filter((x) => x.status !== "done")); setError("");
    } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { setToday(localToday()); load(); }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try { await api("/api/projects", { body: { name, color } }); setName(""); load(); }
    catch (er) { setError((er as Error).message); }
  }

  async function saveEdit() {
    if (!editing) return;
    try { await api(`/api/projects/${editing.id}`, { method: "PATCH", body: { name: editing.name, color: editing.color } }); setEditing(null); load(); }
    catch (er) { setError((er as Error).message); }
  }

  async function remove(p: Project) {
    const n = tasks.filter((t) => t.project_id === p.id).length;
    if (!confirm(`Delete “${p.name}”?${n ? ` Its ${n} open task${n === 1 ? "" : "s"} will move to the Inbox.` : ""}`)) return;
    await api(`/api/projects/${p.id}`, { method: "DELETE" }).catch((er) => setError(er.message));
    setEditing(null); load();
  }

  async function move(t: Task, projectId: number | null) {
    await api(`/api/tasks/${t.id}`, { method: "PATCH", body: { project_id: projectId } });
    load();
  }

  const count = (p: Project) => tasks.filter((t) => t.project_id === p.id).length + events.filter((e) => e.project_id === p.id).length;

  async function moveEvent(e: LifeEvent, projectId: number | null) {
    await api(`/api/events/${e.id}`, { method: "PATCH", body: { project_id: projectId } });
    load();
  }
  // Busiest projects first, then the rest alphabetically; Inbox last.
  const groups: (Project | null)[] = [...projects].sort((a, b) => count(b) - count(a) || a.name.localeCompare(b.name));
  groups.push(null);

  return (
    <>
      <div className="page-head"><h1>Projects</h1></div>

      <form className="card stack" style={{ marginBottom: 12 }} onSubmit={add}>
        <div><h2>Add your own project</h2><div className="muted small" style={{ marginTop: 4 }}>A project is a tag that groups related tasks <b>and</b> events, e.g. “Finance Lang”.</div></div>
        <div className="row wrap">
          <input className="input grow" style={{ minWidth: 220 }} placeholder="e.g. Wedding, Side hustle, Kids, Renovation" value={name} onChange={(e) => setName(e.target.value)} />
          <Swatches value={color} onPick={setColor} />
          <button className="btn primary" disabled={!name.trim()}><span className="row" style={{ gap: 6 }}><PlusIcon size={16} /> Add project</span></button>
        </div>
      </form>
      <p className="muted" style={{ marginBottom: 24 }}>
        You can also create a project from any project dropdown with <b>+ New project…</b>. Moving a task to another project teaches THEO where similar tasks belong.
      </p>
      {error && <div className="err" style={{ marginBottom: 20 }}>{error}</div>}

      <div className="cards">
        {groups.map((p) => {
          const list = tasks.filter((t) => t.project_id === (p?.id ?? null));
          const evs = events.filter((e) => (e.project_id ?? null) === (p?.id ?? null));
          // Tasks and events under one tag, in date order (undated tasks last).
          const entries = [
            ...evs.map((e) => ({ type: "event" as const, date: e.start_date, e })),
            ...list.map((t) => ({ type: "task" as const, date: t.due_date ?? "9999", t })),
          ].sort((a, b) => a.date.localeCompare(b.date));
          if (!p && !entries.length) return null;
          const c = colorOf(p?.color);
          const isEditing = p && editing?.id === p.id;
          return (
            <div key={p?.id ?? "inbox"} className="card">
              {isEditing ? (
                <div className="stack" style={{ gap: 10 }}>
                  <input className="input" autoFocus value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && saveEdit()} />
                  <Swatches value={editing.color} onPick={(k) => setEditing({ ...editing, color: k })} />
                  <div className="row between">
                    <button className="btn danger small" onClick={() => remove(p)}>Delete project</button>
                    <div className="row">
                      <button className="btn small" onClick={() => setEditing(null)}>Cancel</button>
                      <button className="btn primary small" onClick={saveEdit}>Save</button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="row between">
                  <span className="chip" style={{ background: c.bg, color: c.fg }}>{p?.name ?? "Inbox"}</span>
                  <span className="row" style={{ gap: 4 }}>
                    <span className="muted small">{list.length} task{list.length === 1 ? "" : "s"} · {evs.length} event{evs.length === 1 ? "" : "s"} · {p?.done_count ?? 0} done</span>
                    {p && <button className="btn ghost small" style={{ padding: "4px 8px" }} onClick={() => setEditing({ id: p.id, name: p.name, color: p.color })}>Edit</button>}
                  </span>
                </div>
              )}
              <div style={{ marginTop: 10 }}>
                {entries.length === 0 && <div className="muted small" style={{ padding: "10px 0" }}>Nothing open.</div>}
                {entries.slice(0, 12).map((en) => en.type === "event" ? (
                  <div key={`e${en.e.id}`} className="list-row">
                    <div className="grow">
                      <a href={`/events?open=${en.e.id}`} style={{ display: "block" }} title="Open event">
                        <div className="row" style={{ gap: 6 }}><span className="tag" style={{ background: kindOf(en.e.kind).pill, color: kindOf(en.e.kind).accent }}>Event</span><span style={{ fontWeight: 600, fontSize: 13 }}>{en.e.title}</span></div>
                        <div className="muted small">{fmtDate(en.e.start_date)}{timeRange(en.e) ? ` · ${timeRange(en.e)}` : ""}</div>
                      </a>
                    </div>
                    <ProjectSelect projects={projects} value={en.e.project_id} style={{ width: 120, padding: "4px 6px", fontSize: 12 }}
                      onCreated={(np) => setProjects((ps) => [...ps, np])} onChange={(id) => moveEvent(en.e, id)} />
                  </div>
                ) : (() => { const t = en.t; return (
                  <div key={t.id} className="list-row">
                    <div className="grow" role="button" tabIndex={0} style={{ cursor: "pointer" }} onClick={() => setEditingTask(t)}
                      onKeyDown={(e) => e.key === "Enter" && setEditingTask(t)} title="Edit task">
                      <div className="row" style={{ gap: 6 }}><span className="tag">Task</span><span style={{ fontWeight: 600, fontSize: 13 }}>{t.title}</span></div>
                      <div className="muted small">{relDue(t.due_date, today)}</div>
                    </div>
                    <ProjectSelect projects={projects} value={t.project_id} style={{ width: 120, padding: "4px 6px", fontSize: 12 }}
                      onCreated={(np) => setProjects((ps) => [...ps, np])} onChange={(id) => move(t, id)} />
                  </div>
                ); })())}
                {entries.length > 12 && <div className="muted small" style={{ paddingTop: 8 }}>+{entries.length - 12} more</div>}
              </div>
            </div>
          );
        })}
      </div>
      {editingTask && (
        <TaskEditor key={editingTask.id} task={editingTask} projects={projects} today={today}
          onClose={() => setEditingTask(null)} onSaved={() => { setEditingTask(null); load(); }} />
      )}
    </>
  );
}
