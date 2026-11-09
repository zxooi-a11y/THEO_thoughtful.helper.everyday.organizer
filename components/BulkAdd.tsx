"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Project } from "@/lib/types";
import type { TaskDraft } from "@/lib/brain";
import { api } from "./client";
import { SparkIcon, XIcon } from "./Icons";

const PLACEHOLDER = "Type or paste your tasks here, one per line…";
type Mode = "batch" | "single";

const EXAMPLE = `Pay electricity bill by Friday
Call mum tomorrow
Book dentist appointment
Buy groceries for the week
Fix the leaking kitchen tap ASAP
Read "Atomic Habits"
Renew passport before 20 Dec
Plan Sarah's birthday party next week
Clean the garage this weekend #home`;

type Props = { projects: Project[]; today: string; defaultDate?: string | null; onClose: () => void; onSaved: () => void };

/** Paste many tasks at once → THEO proposes project, tags, due date and steps → you review → save. */
export default function BulkAdd({ projects, today, defaultDate, onClose, onSaved }: Props) {
  const [mode, setMode] = useState<Mode>("batch");
  const [text, setText] = useState("");
  // Single-entry fields ("" = let THEO decide).
  const [single, setSingle] = useState({ title: "", projectId: "", dueDate: defaultDate ?? "", notes: "" });
  const [drafts, setDrafts] = useState<(TaskDraft & { notes?: string })[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Remember which mode you prefer.
  useEffect(() => { try { const m = localStorage.getItem("theo:addMode"); if (m === "single" || m === "batch") setMode(m); } catch {} }, []);
  const switchMode = (m: Mode) => { setMode(m); setError(""); try { localStorage.setItem("theo:addMode", m); } catch {} };

  async function analyze() {
    const input = mode === "single" ? single.title.trim() : text;
    if (!input.trim()) return;
    setBusy(true); setError("");
    try {
      const r = await api<{ drafts: TaskDraft[] }>("/api/analyze", { body: { text: input, today } });
      let out = r.drafts;
      if (mode === "single") {
        // Anything you filled in yourself beats THEO's guess.
        out = out.slice(0, 1).map((d) => ({
          ...d,
          ...(single.projectId ? { projectId: Number(single.projectId), projectName: projects.find((p) => p.id === Number(single.projectId))?.name ?? null, confidence: 1 } : {}),
          ...(single.dueDate ? { dueDate: single.dueDate, dueReason: "You picked it" } : {}),
          notes: single.notes,
        }));
      } else if (defaultDate) {
        // Clicked a specific day? Use it unless the line itself named a date.
        out = out.map((d) => (d.dueReason.startsWith("You said") || d.dueReason === "Exact date given" ? d : { ...d, dueDate: defaultDate, dueReason: "Day you picked on the calendar" }));
      }
      setDrafts(out);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function save() {
    if (!drafts?.length) return;
    setBusy(true); setError("");
    try {
      await api("/api/tasks", { body: { tasks: drafts } });
      onSaved();
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }

  const canAnalyze = mode === "single" ? !!single.title.trim() : !!text.trim();
  const upd = (i: number, patch: Partial<TaskDraft & { notes: string }>) => setDrafts((d) => d!.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label="Add tasks">
        <div className="row between" style={{ marginBottom: 6 }}>
          <h2 style={{ fontSize: 22 }}>{drafts ? `Review ${drafts.length} task${drafts.length === 1 ? "" : "s"}` : "Add tasks"}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><XIcon /></button>
        </div>

        {!drafts ? (
          <>
            <div className="seg" style={{ display: "inline-flex", margin: "8px 0 14px" }} role="tablist">
              <button role="tab" aria-selected={mode === "batch"} className={mode === "batch" ? "on" : ""} onClick={() => switchMode("batch")}>Batch dump</button>
              <button role="tab" aria-selected={mode === "single"} className={mode === "single" ? "on" : ""} onClick={() => switchMode("single")}>Single task</button>
            </div>

            {mode === "batch" ? (
              <>
                <p className="muted" style={{ marginTop: 0 }}>
                  One task per line. Paste a whole brain-dump and mention dates naturally (“by Friday”, “next week”, “20/12”); THEO works out the rest.
                  Got something big like “build a business”? Use the <Link href="/plan" style={{ color: "var(--accent-dark)", fontWeight: 700 }}>Goal planner</Link>.
                </p>
                <textarea className="textarea" style={{ minHeight: 240 }} autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={PLACEHOLDER} />
              </>
            ) : (
              <form className="stack" onSubmit={(e) => { e.preventDefault(); if (canAnalyze && !busy) analyze(); }}>
                <p className="muted" style={{ margin: 0 }}>Describe the task. Leave the other fields on <b>Auto</b> and THEO fills them in, or set them yourself.</p>
                <input className="input" style={{ padding: 14, fontSize: 16 }} autoFocus placeholder="e.g. Call the plumber about the leak by Thursday"
                  value={single.title} onChange={(e) => setSingle({ ...single, title: e.target.value })} />
                <div className="row wrap" style={{ alignItems: "flex-start" }}>
                  <label className="grow stack" style={{ gap: 6, minWidth: 180 }}>
                    <span className="small" style={{ fontWeight: 700 }}>Project</span>
                    <select className="select" value={single.projectId} onChange={(e) => setSingle({ ...single, projectId: e.target.value })}>
                      <option value="">Auto (let THEO decide)</option>
                      {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </label>
                  <label className="grow stack" style={{ gap: 6, minWidth: 180 }}>
                    <span className="small" style={{ fontWeight: 700 }}>Due date</span>
                    <div className="row" style={{ gap: 6 }}>
                      <input type="date" className="input" value={single.dueDate} onChange={(e) => setSingle({ ...single, dueDate: e.target.value })} />
                      {single.dueDate && <button type="button" className="btn ghost small" onClick={() => setSingle({ ...single, dueDate: "" })}>Auto</button>}
                    </div>
                  </label>
                </div>
                <textarea className="textarea" style={{ minHeight: 70 }} placeholder="Notes (optional)" value={single.notes} onChange={(e) => setSingle({ ...single, notes: e.target.value })} />
                <button type="submit" hidden />
              </form>
            )}

            {error && <div className="err" style={{ marginTop: 12 }}>{error}</div>}
            <div className="row between" style={{ marginTop: 16 }}>
              {mode === "batch" ? <button className="btn ghost" onClick={() => setText(EXAMPLE)}>Try an example</button> : <span />}
              <button className="btn primary" disabled={busy || !canAnalyze} onClick={analyze}>
                <span className="row" style={{ gap: 6 }}><SparkIcon size={16} />{busy ? "Thinking…" : mode === "single" ? "Add task" : "Organize for me"}</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="muted" style={{ marginTop: 0 }}>Adjust anything that looks off — THEO learns from the projects you choose.</p>
            <div className="stack">
              {drafts.map((d, i) => (
                <div key={i} className="draft">
                  <div>
                    <input className="input" value={d.title} onChange={(e) => upd(i, { title: e.target.value })} />
                    <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
                      {d.priority === 1 && <span className="tag" style={{ background: "#fdecef", color: "#d6455d" }}>urgent</span>}
                      {d.tags.filter((t) => t !== "urgent").map((t) => <span key={t} className="tag">#{t}</span>)}
                      {d.estimate && <span className="muted small">≈ {d.estimate}</span>}
                    </div>
                    <details>
                      <summary>{d.steps.length} suggested steps{d.stepsSource === "learned" ? " (from your past edits)" : ""}</summary>
                      <textarea className="textarea" style={{ marginTop: 6, minHeight: 90 }} value={d.steps.join("\n")}
                        onChange={(e) => upd(i, { steps: e.target.value.split("\n") })} />
                    </details>
                  </div>
                  <div>
                    <select className="select" value={d.projectId ?? ""} onChange={(e) => upd(i, { projectId: e.target.value ? Number(e.target.value) : null })}>
                      <option value="">Inbox</option>
                      {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <div className="why">{d.projectId == null ? "Not sure — pick one and THEO will learn" : d.confidence < 0.35 ? "Best guess" : "Confident"}</div>
                  </div>
                  <div>
                    <input type="date" className="input" value={d.dueDate} onChange={(e) => upd(i, { dueDate: e.target.value, dueReason: "You picked it" })} />
                    <div className="why">{d.dueReason}</div>
                  </div>
                  <button className="icon-btn" onClick={() => setDrafts(drafts.filter((_, j) => j !== i))} aria-label="Remove"><XIcon size={16} /></button>
                </div>
              ))}
            </div>
            {error && <div className="err" style={{ marginTop: 12 }}>{error}</div>}
            <div className="row between" style={{ marginTop: 18 }}>
              <button className="btn ghost" onClick={() => setDrafts(null)}>← Back</button>
              <button className="btn primary" disabled={busy || !drafts.length} onClick={save}>{busy ? "Saving…" : `Save ${drafts.length} task${drafts.length === 1 ? "" : "s"}`}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
