"use client";
import { useEffect, useState } from "react";
import { colorOf } from "@/lib/colors";
import type { Project, Step, Task } from "@/lib/types";
import { addDays } from "@/lib/brain/dates";
import { api, relDue, timeAgo } from "./client";
import { CalendarIcon, ClockIcon, FolderIcon, PlusIcon, XIcon } from "./Icons";

type Props = { task: Task; projects: Project[]; today: string; onChange: (t: Task | null) => void };

/** Right-hand card: the selected task with its steps and actions (like "Product analytics" in the reference). */
export default function TaskDetail({ task, projects, today, onChange }: Props) {
  const [steps, setSteps] = useState<Step[]>(task.steps);
  const [notes, setNotes] = useState(task.notes);
  const [title, setTitle] = useState(task.title);
  const [estimate, setEstimate] = useState(task.estimate);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { setSteps(task.steps); setNotes(task.notes); setTitle(task.title); setEstimate(task.estimate); setError(""); }, [task]);

  const project = projects.find((p) => p.id === task.project_id);
  const c = colorOf(project?.color);

  async function patch(body: Record<string, unknown>) {
    setBusy(true); setError("");
    try { onChange(await api<Task>(`/api/tasks/${task.id}`, { method: "PATCH", body })); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  const saveSteps = (next: Step[]) => { setSteps(next); patch({ steps: next }); };
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <div className="soft-card detail">
      <div className="row between">
        <span className="chip" style={{ background: c.bg, color: c.fg }}>{project?.name ?? "Inbox"}</span>
        <span className="muted small">{timeAgo(task.created_at)}</span>
      </div>

      <h3><input className="bare" value={title} onChange={(e) => setTitle(e.target.value)}
        onBlur={() => title.trim() && title !== task.title && patch({ title })} aria-label="Task title" /></h3>
      {task.tags.length > 0 && <div className="row wrap" style={{ gap: 6 }}>{task.tags.map((t) => <span key={t} className="tag">#{t}</span>)}</div>}

      <div className="row between" style={{ marginTop: 16 }}>
        <b className="small">Steps</b>
        <span className="muted small">{doneCount}/{steps.length}</span>
      </div>
      {steps.length > 0 && <div className="progress" style={{ marginTop: 8 }}><i style={{ width: `${(doneCount / steps.length) * 100}%` }} /></div>}
      <ul className="steps">
        {steps.map((s, i) => (
          <li key={s.id ?? i} className={s.done ? "done" : ""}>
            <input type="checkbox" className="check" checked={s.done}
              onChange={() => saveSteps(steps.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))} aria-label="Toggle step" />
            <input className="bare" value={s.text}
              onChange={(e) => setSteps(steps.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
              onBlur={() => JSON.stringify(steps) !== JSON.stringify(task.steps) && saveSteps(steps)} />
            <button className="icon-btn" style={{ padding: 0 }} onClick={() => saveSteps(steps.filter((_, j) => j !== i))} aria-label="Remove step"><XIcon size={14} /></button>
          </li>
        ))}
      </ul>
      <button className="btn ghost small" style={{ padding: "6px 10px" }} onClick={() => setSteps([...steps, { text: "", done: false }])}>
        <span className="row" style={{ gap: 4 }}><PlusIcon size={14} /> Add step</span>
      </button>

      <textarea className="textarea" style={{ marginTop: 12, minHeight: 60, background: "transparent" }} placeholder="Notes…" value={notes}
        onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== task.notes && patch({ notes })} />

      <div className="meta">
        <div className="row"><CalendarIcon size={18} />
          <input type="date" className="bare" style={{ width: "auto" }} value={task.due_date ?? ""} onChange={(e) => patch({ due_date: e.target.value || null })} />
          <span className="muted small">{relDue(task.due_date, today)}</span>
        </div>
        {task.due_reason && <div className="muted small" style={{ marginTop: -6, paddingLeft: 28 }}>THEO: {task.due_reason}</div>}
        <div className="row"><ClockIcon size={18} />
          <input className="bare" value={estimate} placeholder="Estimate (e.g. 2 hours)" onChange={(e) => setEstimate(e.target.value)}
            onBlur={() => estimate !== task.estimate && patch({ estimate })} />
        </div>
        <div className="row"><FolderIcon size={18} />
          <select className="bare" value={task.project_id ?? ""} onChange={(e) => patch({ project_id: e.target.value ? Number(e.target.value) : null })} title="Moving a task teaches THEO">
            <option value="">Inbox</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      {error && <div className="err" style={{ marginBottom: 12 }}>{error}</div>}

      {task.status === "done" ? (
        <button className="btn primary block" disabled={busy} onClick={() => patch({ status: "todo" })}>Reopen task</button>
      ) : task.status === "doing" ? (
        <button className="btn primary block" disabled={busy} onClick={() => patch({ status: "done" })}>Mark as done</button>
      ) : (
        <button className="btn primary block" disabled={busy} onClick={() => patch({ status: "doing" })}>Accept the task</button>
      )}
      <div className="row" style={{ justifyContent: "center", marginTop: 8 }}>
        {task.status !== "done" && (
          <button className="btn ghost" disabled={busy} onClick={() => patch({ status: "later", due_date: addDays(task.due_date && task.due_date > today ? task.due_date : today, 3) })}>Later</button>
        )}
        <button className="btn danger small" disabled={busy} onClick={async () => {
          if (!confirm("Delete this task?")) return;
          await api(`/api/tasks/${task.id}`, { method: "DELETE" }); onChange(null);
        }}>Delete</button>
      </div>
    </div>
  );
}
