"use client";
import { useState } from "react";
import Link from "next/link";
import type { Project } from "@/lib/types";
import type { TaskDraft } from "@/lib/brain";
import { api } from "./client";
import { SparkIcon, XIcon } from "./Icons";

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
  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState<TaskDraft[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function analyze() {
    setBusy(true); setError("");
    try {
      const r = await api<{ drafts: TaskDraft[] }>("/api/analyze", { body: { text, today } });
      // Clicked a specific day? Use it unless the line itself named a date.
      setDrafts(defaultDate ? r.drafts.map((d) => (d.dueReason.startsWith("You said") || d.dueReason === "Exact date given" ? d : { ...d, dueDate: defaultDate, dueReason: "Day you picked on the calendar" })) : r.drafts);
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

  const upd = (i: number, patch: Partial<TaskDraft>) => setDrafts((d) => d!.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label="Add tasks">
        <div className="row between" style={{ marginBottom: 6 }}>
          <h2 style={{ fontSize: 22 }}>{drafts ? `Review ${drafts.length} task${drafts.length === 1 ? "" : "s"}` : "Add tasks"}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><XIcon /></button>
        </div>

        {!drafts ? (
          <>
            <p className="muted" style={{ marginTop: 0 }}>
              One task per line — paste a whole brain-dump. Mention dates naturally (“by Friday”, “next week”, “20/12”) and THEO works out the rest.
              Got something big like “build a business”? Use the <Link href="/plan" style={{ color: "var(--accent-dark)", fontWeight: 700 }}>Goal planner</Link>.
            </p>
            <textarea className="textarea" style={{ minHeight: 240 }} autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={EXAMPLE} />
            {error && <div className="err" style={{ marginTop: 12 }}>{error}</div>}
            <div className="row between" style={{ marginTop: 16 }}>
              <button className="btn ghost" onClick={() => setText(EXAMPLE)}>Try an example</button>
              <button className="btn primary" disabled={busy || !text.trim()} onClick={analyze}>
                <span className="row" style={{ gap: 6 }}><SparkIcon size={16} />{busy ? "Thinking…" : "Organize for me"}</span>
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
