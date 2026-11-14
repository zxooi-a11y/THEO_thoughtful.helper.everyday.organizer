"use client";
import { useEffect, useState } from "react";
import { colorOf } from "@/lib/colors";
import type { FileMeta, Project, Step, Task } from "@/lib/types";
import { addDays } from "@/lib/brain/dates";
import { api, fmtDate, relDue, timeAgo } from "./client";
import ProjectSelect from "./ProjectSelect";
import DateField from "./DateField";
import FinalWorkLink from "./FinalWork";
import { normalizeWebUrl } from "@/lib/links";
import { FileDrop, FileList, uploadFile, type Insights } from "./files";
import { CalendarIcon, ClockIcon, FolderIcon, PlusIcon, XIcon } from "./Icons";

type Props = { task: Task; projects: Project[]; today: string; onChange: (t: Task | null) => void; onEdit?: () => void };

/** Right-hand card: the selected task with its steps and actions (like "Product analytics" in the reference). */
export default function TaskDetail({ task, projects, today, onChange, onEdit }: Props) {
  const [steps, setSteps] = useState<Step[]>(task.steps);
  const [notes, setNotes] = useState(task.notes);
  const [title, setTitle] = useState(task.title);
  const [estimate, setEstimate] = useState(task.estimate);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [finalOpen, setFinalOpen] = useState(false);
  const [fUrl, setFUrl] = useState(task.final_url ?? "");
  const [fNote, setFNote] = useState(task.final_note ?? "");
  const [insights, setInsights] = useState<Insights | null>(null);

  useEffect(() => { setSteps(task.steps); setNotes(task.notes); setTitle(task.title); setEstimate(task.estimate); setError(""); setFinalOpen(false); setFUrl(task.final_url ?? ""); setFNote(task.final_note ?? ""); }, [task]);
  // Suggestions from an attached file belong to the task they were made for.
  useEffect(() => { setInsights(null); }, [task.id]);

  const project = projects.find((p) => p.id === task.project_id);
  const c = colorOf(project?.color);

  async function patch(body: Record<string, unknown>) {
    setBusy(true); setError("");
    try { onChange(await api<Task>(`/api/tasks/${task.id}`, { method: "PATCH", body })); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function attach(picked: File[]) {
    setUploading(true); setError("");
    const errors: string[] = [];
    let latest: Task | null = null;
    let found = null as Insights | null;
    for (const f of picked) {
      try {
        const r = await uploadFile(f, { taskId: task.id, today });
        if (r.task) latest = r.task;
        if (r.insights && (r.insights.deadline || r.insights.checklist.length)) found = { ...r.insights, deadline: r.insights.deadline ?? found?.deadline ?? null };
      } catch (e) { errors.push((e as Error).message); }
    }
    if (latest) onChange(latest);
    if (found) setInsights(found);
    if (errors.length) setError(errors.join(" "));
    setUploading(false);
  }
  async function removeFile(f: FileMeta) {
    if (!confirm(`Remove “${f.name}” from this task?`)) return;
    try { const r = await api<{ task: Task }>(`/api/files/${f.id}?taskId=${task.id}`, { method: "DELETE" }); onChange(r.task); }
    catch (e) { setError((e as Error).message); }
  }
  async function saveFinal(url: string, note: string) {
    if (normalizeWebUrl(url) === null) { setError("That doesn't look like a web link. Use something like https://example.com/my-work"); return; }
    setBusy(true); setError("");
    try { onChange(await api<Task>(`/api/tasks/${task.id}`, { method: "PATCH", body: { final_url: url, final_note: note } })); setFinalOpen(false); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  const saveSteps = (next: Step[]) => { setSteps(next); patch({ steps: next }); };
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <div className="soft-card detail" id="task-panel">
      <div className="row between">
        <span className="chip" style={{ background: c.bg, color: c.fg }}>{project?.name ?? "Inbox"}</span>
        <span className="row" style={{ gap: 8 }}>
          <span className="muted small">{timeAgo(task.created_at)}</span>
          {onEdit && <button type="button" className="btn small" onClick={onEdit}>✎ Edit</button>}
        </span>
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

      {/* Final work: the link / submission that showcases the finished task */}
      <div className="final-block">
        <div className="row between">
          <b className="small">Final work</b>
          {task.final_url && !finalOpen && <button type="button" className="btn ghost small" style={{ padding: "2px 8px" }} onClick={() => setFinalOpen(true)}>Edit</button>}
        </div>
        {finalOpen ? (
          <div className="final-form">
            <input className="input" autoFocus inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="Paste the link: design, doc, website, repo…"
              value={fUrl} onChange={(e) => setFUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveFinal(fUrl, fNote)} />
            <input className="input" placeholder="What is it? e.g. Final logo pack v3 (optional)" value={fNote} onChange={(e) => setFNote(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveFinal(fUrl, fNote)} />
            <div className="row between wrap">
              {task.final_url ? <button type="button" className="btn danger small" disabled={busy} onClick={() => saveFinal("", "")}>Remove</button> : <span />}
              <div className="row">
                <button type="button" className="btn small" disabled={busy} onClick={() => { setFinalOpen(false); setFUrl(task.final_url ?? ""); setFNote(task.final_note ?? ""); }}>Cancel</button>
                <button type="button" className="btn primary small" disabled={busy || !fUrl.trim()} onClick={() => saveFinal(fUrl, fNote)}>Save</button>
              </div>
            </div>
          </div>
        ) : task.final_url ? (
          <div style={{ marginTop: 8 }}><FinalWorkLink url={task.final_url} note={task.final_note} /></div>
        ) : (
          <div style={{ marginTop: 6 }}>
            {task.status === "done" && <div className="hint-banner" style={{ marginBottom: 8 }}>🎉 Done! Add a link to the finished work to showcase it.</div>}
            <button type="button" className="btn small" onClick={() => setFinalOpen(true)}>🔗 Add final link</button>
          </div>
        )}
      </div>

      {/* Files: attached to this task; THEO reads what it can */}
      <div style={{ marginTop: 14 }}>
        <div className="row between" style={{ marginBottom: 6 }}>
          <b className="small">Files</b>
          <span className="muted small">{task.files.length ? `${task.files.length} attached` : "none yet"}</span>
        </div>
        <FileList files={task.files} onRemove={removeFile} />
        <div style={{ marginTop: task.files.length ? 10 : 0 }}>
          <FileDrop compact onPick={attach} busy={uploading} disabled={task.files.length >= 10} label="Attach files" />
        </div>
        {insights && (
          <div className="hint-banner" style={{ marginTop: 10 }}>
            <b>THEO found something in your file:</b>
            {insights.deadline && (
              <div className="row between wrap" style={{ marginTop: 8 }}>
                <span>Deadline <b>{insights.deadline.date}</b> (“{insights.deadline.cue}”, in {insights.deadline.file})</span>
                <button className="btn small primary" onClick={async () => { await patch({ due_date: insights.deadline!.date }); setInsights((i) => i && { ...i, deadline: null }); }}>Use as due date</button>
              </div>
            )}
            {insights.checklist.length > 0 && (
              <div className="row between wrap" style={{ marginTop: 8 }}>
                <span>A {insights.checklist.length}-item checklist in {insights.checklistFile}</span>
                <button className="btn small primary" onClick={async () => { await patch({ steps: [...steps, ...insights.checklist.map((text) => ({ text, done: false }))] }); setInsights((i) => i && { ...i, checklist: [] }); }}>Add as steps</button>
              </div>
            )}
            <div className="row" style={{ justifyContent: "flex-end" }}><button className="btn ghost small" onClick={() => setInsights(null)}>Dismiss</button></div>
          </div>
        )}
      </div>

      <div className="meta">
        <div className="row"><CalendarIcon size={18} />
          {task.status === "done" && <span className="small" style={{ fontWeight: 700 }}>Finished on</span>}
          <DateField className="bare" placeholder="No due date" value={task.due_date ?? ""} onChange={(v) => patch({ due_date: v || null })} />
          <span className="muted small">{task.status === "done" ? "change it if you ticked it off late" : relDue(task.due_date, today)}</span>
        </div>
        {task.status === "done" && task.original_due && task.original_due !== task.due_date && <div className="muted small" style={{ marginTop: -6, paddingLeft: 28 }}>Originally due {fmtDate(task.original_due, true)}</div>}
        {task.due_reason && <div className="muted small" style={{ marginTop: -6, paddingLeft: 28 }}>THEO: {task.due_reason}</div>}
        <div className="row"><ClockIcon size={18} />
          <input className="bare" value={estimate} placeholder="Estimate (e.g. 2 hours)" onChange={(e) => setEstimate(e.target.value)}
            onBlur={() => estimate !== task.estimate && patch({ estimate })} />
        </div>
        <div className="row"><FolderIcon size={18} />
          <ProjectSelect className="bare" projects={projects} value={task.project_id} title="Moving a task teaches THEO"
            onChange={(id) => patch({ project_id: id })} />
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
