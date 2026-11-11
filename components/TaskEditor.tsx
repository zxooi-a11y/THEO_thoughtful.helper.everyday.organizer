"use client";
import { useState } from "react";
import type { FileMeta, Project, Step, Task } from "@/lib/types";
import { api } from "./client";
import ProjectSelect from "./ProjectSelect";
import { FileDrop, FileList, uploadFile } from "./files";
import { normalizeWebUrl } from "@/lib/links";
import { PlusIcon, XIcon } from "./Icons";

type Props = {
  task: Task;
  projects: Project[];
  today: string;
  onClose: () => void;
  /** Called with the saved task, or null when it was deleted. */
  onSaved: (t: Task | null) => void;
  /** Called after the task was turned into an event (it no longer exists as a task). */
  onConverted?: () => void;
};

const PRIORITIES: { v: 1 | 2 | 3; label: string }[] = [{ v: 1, label: "High" }, { v: 2, label: "Normal" }, { v: 3, label: "Low" }];
const STATUSES: { v: Task["status"]; label: string }[] = [
  { v: "todo", label: "To do" }, { v: "doing", label: "In progress" }, { v: "later", label: "Later" }, { v: "done", label: "Done" },
];

/** "call, #pay  Urgent" → ["call","pay","urgent"] */
const parseTags = (s: string) => [...new Set(s.split(/[,\s]+/).map((t) => t.replace(/^#/, "").trim().toLowerCase()).filter(Boolean))].slice(0, 10);

/** Edit everything about a task in one place. Saving sends one update; THEO learns from project and step changes. */
export default function TaskEditor({ task, projects: initialProjects, today, onClose, onSaved, onConverted }: Props) {
  const [projects, setProjects] = useState(initialProjects);
  const [title, setTitle] = useState(task.title);
  const [projectId, setProjectId] = useState<number | null>(task.project_id);
  const [due, setDue] = useState(task.due_date ?? "");
  const [priority, setPriority] = useState<1 | 2 | 3>(task.priority);
  const [status, setStatus] = useState<Task["status"]>(task.status);
  const [estimate, setEstimate] = useState(task.estimate);
  const [tags, setTags] = useState(task.tags.map((t) => `#${t}`).join(" "));
  const [notes, setNotes] = useState(task.notes);
  const [finalUrl, setFinalUrl] = useState(task.final_url ?? "");
  const [finalNote, setFinalNote] = useState(task.final_note ?? "");
  const [steps, setSteps] = useState<Step[]>(task.steps.map((s) => ({ ...s })));
  const [files, setFiles] = useState<FileMeta[]>(task.files ?? []);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const addProject = (p: Project) => setProjects((ps) => (ps.some((x) => x.id === p.id) ? ps : [...ps, p].sort((a, b) => a.name.localeCompare(b.name))));
  const updStep = (i: number, patch: Partial<Step>) => setSteps((ss) => ss.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const moveStep = (i: number, d: -1 | 1) => setSteps((ss) => { const j = i + d; if (j < 0 || j >= ss.length) return ss; const c = [...ss]; [c[i], c[j]] = [c[j], c[i]]; return c; });

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    if (!title.trim()) { setError("The task needs a name."); return; }
    if (normalizeWebUrl(finalUrl) === null) { setError("The final work link doesn't look like a web link. Use something like https://example.com/my-work"); return; }
    setBusy(true); setError("");
    try {
      const updated = await api<Task>(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: {
          title: title.trim(), project_id: projectId, due_date: due || null, priority, status,
          estimate: estimate.trim(), tags: parseTags(tags), notes, final_url: finalUrl, final_note: finalNote,
          steps: steps.filter((s) => s.text.trim()).map((s) => ({ text: s.text.trim(), done: s.done })),
        },
      });
      onSaved(updated);
    } catch (er) { setError((er as Error).message); setBusy(false); }
  }

  async function remove() {
    if (!confirm(`Delete “${task.title}”? This can't be undone.`)) return;
    setBusy(true);
    try { await api(`/api/tasks/${task.id}`, { method: "DELETE" }); onSaved(null); }
    catch (er) { setError((er as Error).message); setBusy(false); }
  }

  async function convertToEvent() {
    if (!confirm(`Turn “${task.title}” into an event? Its due date becomes the event date; steps and notes move into the description. It keeps its project tag and files.`)) return;
    setBusy(true); setError("");
    try { await api("/api/convert", { body: { from: "task", id: task.id, today } }); onConverted?.(); onSaved(null); }
    catch (er) { setError((er as Error).message); setBusy(false); }
  }

  async function addFiles(picked: File[]) {
    setUploading(true); setError("");
    const errors: string[] = [];
    for (const f of picked) {
      try { const r = await uploadFile(f, { taskId: task.id, today }); if (r.task) setFiles(r.task.files); }
      catch (er) { errors.push((er as Error).message); }
    }
    if (errors.length) setError(errors.join(" "));
    setUploading(false);
  }
  async function removeFile(f: FileMeta) {
    try { const r = await api<{ task: Task }>(`/api/files/${f.id}?taskId=${task.id}`, { method: "DELETE" }); setFiles(r.task.files); }
    catch (er) { setError((er as Error).message); }
  }

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <form className="modal stack" style={{ width: "min(680px, 100%)" }} onSubmit={save} aria-label="Edit task">
        <div className="row between">
          <h2 style={{ fontSize: 22 }}>Edit task</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><XIcon /></button>
        </div>

        <label className="stack" style={{ gap: 6 }}>
          <span className="small" style={{ fontWeight: 700 }}>Task</span>
          <input className="input" style={{ padding: 14, fontSize: 16 }} autoFocus required value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>

        <div className="form-row">
          <label className="stack" style={{ gap: 6 }}>
            <span className="small" style={{ fontWeight: 700 }}>Project</span>
            <ProjectSelect projects={projects} value={projectId} onChange={setProjectId} onCreated={addProject} />
          </label>
          <label className="stack" style={{ gap: 6 }}>
            <span className="small" style={{ fontWeight: 700 }}>Status</span>
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value as Task["status"])}>
              {STATUSES.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
            </select>
          </label>
        </div>

        <div className="form-row">
          <label className="stack" style={{ gap: 6 }}>
            <span className="row between" style={{ minHeight: 22 }}>
              <span className="small" style={{ fontWeight: 700 }}>Due date</span>
              {due && <button type="button" className="btn ghost small" style={{ padding: "0 6px" }} onClick={() => setDue("")}>Clear</button>}
            </span>
            <input type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} />
            {task.due_reason && due === (task.due_date ?? "") && <span className="muted small">THEO: {task.due_reason}</span>}
          </label>
          <label className="stack" style={{ gap: 6 }}>
            <span className="row" style={{ minHeight: 22 }}><span className="small" style={{ fontWeight: 700 }}>Time estimate</span></span>
            <input className="input" placeholder="e.g. 2 hours" value={estimate} onChange={(e) => setEstimate(e.target.value)} />
          </label>
        </div>

        <div className="stack" style={{ gap: 6 }}>
          <span className="small" style={{ fontWeight: 700 }}>Priority</span>
          <div className="seg" style={{ alignSelf: "flex-start" }} role="radiogroup" aria-label="Priority">
            {PRIORITIES.map((p) => (
              <button type="button" key={p.v} role="radio" aria-checked={priority === p.v} className={priority === p.v ? "on" : ""} onClick={() => setPriority(p.v)}>{p.label}</button>
            ))}
          </div>
        </div>

        <label className="stack" style={{ gap: 6 }}>
          <span className="small" style={{ fontWeight: 700 }}>Tags <span className="muted">(separate with spaces or commas)</span></span>
          <input className="input" placeholder="#call #urgent" value={tags} onChange={(e) => setTags(e.target.value)} />
        </label>

        <div className="stack" style={{ gap: 6 }}>
          <div className="row between">
            <span className="small" style={{ fontWeight: 700 }}>Steps</span>
            <span className="muted small">{steps.filter((s) => s.done).length}/{steps.length} done</span>
          </div>
          <ul className="steps" style={{ margin: 0 }}>
            {steps.map((s, i) => (
              <li key={s.id ?? `n${i}`} className={s.done ? "done" : ""} style={{ alignItems: "center" }}>
                <input type="checkbox" className="check" checked={s.done} onChange={() => updStep(i, { done: !s.done })} aria-label="Done" />
                <input className="input" style={{ padding: "7px 10px" }} value={s.text} placeholder="Describe the step" onChange={(e) => updStep(i, { text: e.target.value })} />
                <button type="button" className="icon-btn" style={{ padding: 4 }} disabled={i === 0} onClick={() => moveStep(i, -1)} aria-label="Move step up">↑</button>
                <button type="button" className="icon-btn" style={{ padding: 4 }} disabled={i === steps.length - 1} onClick={() => moveStep(i, 1)} aria-label="Move step down">↓</button>
                <button type="button" className="icon-btn" style={{ padding: 4 }} onClick={() => setSteps(steps.filter((_, j) => j !== i))} aria-label="Remove step"><XIcon size={14} /></button>
              </li>
            ))}
          </ul>
          <button type="button" className="btn ghost small" style={{ alignSelf: "flex-start" }} onClick={() => setSteps([...steps, { text: "", done: false }])}>
            <span className="row" style={{ gap: 4 }}><PlusIcon size={14} /> Add step</span>
          </button>
        </div>

        <div className="stack" style={{ gap: 6 }}>
          <span className="small" style={{ fontWeight: 700 }}>Final work <span className="muted">· link to the finished result</span></span>
          <input className="input" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="https://… (design, document, website, repo)"
            value={finalUrl} onChange={(e) => setFinalUrl(e.target.value)} />
          <input className="input" placeholder="What is it? e.g. Final logo pack v3 (optional)" value={finalNote} onChange={(e) => setFinalNote(e.target.value)} />
        </div>

        <textarea className="textarea" style={{ minHeight: 80 }} placeholder="Notes…" value={notes} onChange={(e) => setNotes(e.target.value)} />

        <div className="attach" style={{ marginTop: 0 }}>
          <div className="attach-head"><b>Files</b><span className="muted small">added or removed here are saved straight away</span></div>
          <FileDrop onPick={addFiles} busy={uploading} disabled={files.length >= 10} />
          <FileList files={files} onRemove={removeFile} />
        </div>

        {error && <div className="err">{error}</div>}

        <div className="row between wrap">
          <div className="row" style={{ gap: 4 }}>
            <button type="button" className="btn danger" disabled={busy} onClick={remove}>Delete</button>
            <button type="button" className="btn ghost" disabled={busy} onClick={convertToEvent} title="Turn this task into an event">Convert to event</button>
          </div>
          <div className="row">
            <button type="button" className="btn" disabled={busy} onClick={onClose}>Cancel</button>
            <button className="btn primary" disabled={busy || uploading || !title.trim()}>{busy ? "Saving…" : "Save changes"}</button>
          </div>
        </div>
      </form>
    </div>
  );
}
