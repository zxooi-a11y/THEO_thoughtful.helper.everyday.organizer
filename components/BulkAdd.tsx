"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Project } from "@/lib/types";
import type { TaskDraft } from "@/lib/brain";
import { api } from "./client";
import ProjectSelect from "./ProjectSelect";
import { SparkIcon, XIcon } from "./Icons";

const PLACEHOLDER = "Type or paste your tasks here, one per line…";
const BRIEF_PLACEHOLDER = "e.g. All of this is for my candle business, launching at the Christmas market on 12 Dec. Money stuff is urgent.";
type Mode = "batch" | "single";
type Aspect = "project" | "due" | "steps" | "title";
const ASPECTS: { key: Aspect; label: string }[] = [
  { key: "project", label: "Project" }, { key: "due", label: "Due date" }, { key: "steps", label: "Steps" }, { key: "title", label: "Wording" },
];

/** A draft plus what THEO originally suggested and your 👍/👎 on it. */
type Row = TaskDraft & {
  notes?: string;
  vote: "up" | "down" | null;
  aspects: Aspect[];
  suggested: { projectId: number | null; dueDate: string; steps: string[] };
};

const EXAMPLE = `Pay electricity bill by Friday
Call mum tomorrow
Book dentist appointment
Buy groceries for the week
Fix the leaking kitchen tap ASAP
Read "Atomic Habits"
Renew passport before 20 Dec
Plan Sarah's birthday party next week
Clean the garage this weekend #home`;

const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} },
};

type Props = { projects: Project[]; today: string; defaultDate?: string | null; onClose: () => void; onSaved: () => void };

/** Add one task or a whole brain-dump → THEO proposes project, tags, due date and steps → you review, 👍/👎 → save. */
export default function BulkAdd({ projects: initialProjects, today, defaultDate, onClose, onSaved }: Props) {
  const [projects, setProjects] = useState(initialProjects);
  const [mode, setMode] = useState<Mode>("batch");
  const [text, setText] = useState("");
  const [brief, setBrief] = useState("");
  const [briefOpen, setBriefOpen] = useState(false);
  // Single-entry fields ("" = let THEO decide).
  const [single, setSingle] = useState({ title: "", projectId: null as number | null, dueDate: defaultDate ?? "", notes: "" });
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Remember your preferred mode and last brief (on this device only).
  useEffect(() => {
    const m = store.get("theo:addMode");
    if (m === "single" || m === "batch") setMode(m);
    const b = store.get("theo:brief");
    if (b) { setBrief(b); setBriefOpen(true); }
  }, []);
  const switchMode = (m: Mode) => { setMode(m); setError(""); store.set("theo:addMode", m); };
  const addProject = (p: Project) => setProjects((ps) => (ps.some((x) => x.id === p.id) ? ps : [...ps, p].sort((a, b) => a.name.localeCompare(b.name))));

  const canAnalyze = mode === "single" ? !!single.title.trim() : !!text.trim();

  async function analyze() {
    const input = mode === "single" ? single.title.trim() : text;
    if (!input.trim()) return;
    setBusy(true); setError("");
    store.set("theo:brief", brief);
    try {
      const r = await api<{ drafts: TaskDraft[] }>("/api/analyze", { body: { text: input, today, brief } });
      let drafts: (TaskDraft & { notes?: string })[] = r.drafts;
      if (mode === "single") {
        drafts = drafts.slice(0, 1).map((d) => ({
          ...d,
          ...(single.projectId ? { projectId: single.projectId, projectName: projects.find((p) => p.id === single.projectId)?.name ?? null, confidence: 1 } : {}),
          ...(single.dueDate ? { dueDate: single.dueDate, dueReason: "You picked it" } : {}),
          notes: single.notes,
        }));
      } else if (defaultDate) {
        // Clicked a specific day? Use it unless the line itself named a date.
        drafts = drafts.map((d) => (d.dueReason.startsWith("You said") || d.dueReason === "Exact date given" ? d : { ...d, dueDate: defaultDate, dueReason: "Day you picked on the calendar" }));
      }
      setRows(drafts.map((d) => ({ ...d, vote: null, aspects: [], suggested: { projectId: d.projectId, dueDate: d.dueDate, steps: d.steps } })));
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function save() {
    if (!rows?.length) return;
    setBusy(true); setError("");
    try {
      await api("/api/tasks", {
        body: {
          today, brief,
          tasks: rows.map(({ vote, aspects, suggested, ...t }) => ({ ...t, feedback: { vote, aspects, suggested } })),
        },
      });
      onSaved();
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }

  const upd = (i: number, patch: Partial<Row>) => setRows((d) => d!.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const vote = (i: number, v: "up" | "down") => {
    const r = rows![i];
    upd(i, r.vote === v ? { vote: null, aspects: [] } : { vote: v, aspects: v === "up" ? [] : r.aspects });
  };
  const toggleAspect = (i: number, a: Aspect) => {
    const r = rows![i];
    upd(i, { aspects: r.aspects.includes(a) ? r.aspects.filter((x) => x !== a) : [...r.aspects, a] });
  };
  const allUp = () => setRows((rs) => rs!.map((r) => ({ ...r, vote: "up", aspects: [] })));

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label="Add tasks">
        <div className="row between" style={{ marginBottom: 6 }}>
          <h2 style={{ fontSize: 22 }}>{rows ? `Review ${rows.length} task${rows.length === 1 ? "" : "s"}` : "Add tasks"}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><XIcon /></button>
        </div>

        {!rows ? (
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
                <textarea className="textarea" style={{ minHeight: 200 }} autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={PLACEHOLDER} />
              </>
            ) : (
              <form className="stack" onSubmit={(e) => { e.preventDefault(); if (canAnalyze && !busy) analyze(); }}>
                <p className="muted" style={{ margin: 0 }}>Describe the task. Leave the other fields on <b>Auto</b> and THEO fills them in, or set them yourself.</p>
                <input className="input" style={{ padding: 14, fontSize: 16 }} autoFocus placeholder="e.g. Call the plumber about the leak by Thursday"
                  value={single.title} onChange={(e) => setSingle({ ...single, title: e.target.value })} />
                <div className="form-row stack-mobile">
                  <label className="stack" style={{ gap: 6 }}>
                    <span className="small" style={{ fontWeight: 700 }}>Project</span>
                    <ProjectSelect projects={projects} value={single.projectId} emptyLabel="Auto (let THEO decide)" onCreated={addProject}
                      onChange={(id) => setSingle((s) => ({ ...s, projectId: id }))} />
                  </label>
                  <label className="stack" style={{ gap: 6 }}>
                    <span className="small" style={{ fontWeight: 700 }}>Due date</span>
                    <div className="row" style={{ gap: 6 }}>
                      <input type="date" className="input" value={single.dueDate} onChange={(e) => setSingle({ ...single, dueDate: e.target.value })} />
                      {single.dueDate && <button type="button" className="btn ghost small" onClick={() => setSingle({ ...single, dueDate: "" })}>Auto</button>}
                    </div>
                  </label>
                </div>
                <textarea className="textarea" style={{ minHeight: 60 }} placeholder="Notes (optional)" value={single.notes} onChange={(e) => setSingle({ ...single, notes: e.target.value })} />
                <button type="submit" hidden />
              </form>
            )}

            {/* Brief: context for the Auto choices */}
            <div className="brief">
              <button type="button" className="brief-toggle" onClick={() => setBriefOpen(!briefOpen)} aria-expanded={briefOpen}>
                <span className="row" style={{ gap: 8 }}><SparkIcon size={16} /><b>Brief</b><span className="muted small">optional context that helps Auto choose better</span></span>
                <span className="muted">{briefOpen ? "−" : "+"}</span>
              </button>
              {briefOpen && (
                <>
                  <textarea className="textarea" style={{ minHeight: 70, marginTop: 10 }} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder={BRIEF_PLACEHOLDER} />
                  <div className="row between small muted" style={{ marginTop: 6 }}>
                    <span>Name a project, a deadline (“by 12 Dec”) or a priority (“urgent”) and THEO applies it to every task unless the task says otherwise.</span>
                    {brief && <button type="button" className="btn ghost small" style={{ padding: "4px 8px" }} onClick={() => { setBrief(""); store.set("theo:brief", ""); }}>Clear</button>}
                  </div>
                </>
              )}
            </div>

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
            <div className="row between wrap" style={{ marginBottom: 12 }}>
              <p className="muted" style={{ margin: 0 }}>
                Rate each suggestion with 👍 / 👎 (👎 asks what was off) and fix anything. THEO learns from both.
                {brief && <><br /><span className="small">Using your brief: “{brief.length > 90 ? brief.slice(0, 90) + "…" : brief}”</span></>}
              </p>
              {rows.length > 1 && <button className="btn ghost small" onClick={allUp}>👍 All good</button>}
            </div>
            <div className="stack">
              {rows.map((d, i) => (
                <div key={i} className={`draft ${d.vote ? "voted-" + d.vote : ""}`}>
                  <div>
                    <input className="input" value={d.title} onChange={(e) => upd(i, { title: e.target.value })} />
                    <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
                      {d.priority === 1 && <span className="tag" style={{ background: "#fdecef", color: "#d6455d" }}>urgent</span>}
                      {d.tags.filter((t) => t !== "urgent").map((t) => <span key={t} className="tag">#{t}</span>)}
                      {d.estimate && <span className="muted small">≈ {d.estimate}</span>}
                    </div>
                    <details open={d.vote === "down" && d.aspects.includes("steps")}>
                      <summary>{d.steps.length} suggested steps{d.stepsSource === "learned" ? " (from your past edits)" : ""}</summary>
                      <textarea className="textarea" style={{ marginTop: 6, minHeight: 90 }} value={d.steps.join("\n")}
                        onChange={(e) => upd(i, { steps: e.target.value.split("\n") })} />
                    </details>
                    <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>
                      <button className={`vote ${d.vote === "up" ? "on" : ""}`} onClick={() => vote(i, "up")} aria-pressed={d.vote === "up"} title="Good suggestion">👍</button>
                      <button className={`vote ${d.vote === "down" ? "on down" : ""}`} onClick={() => vote(i, "down")} aria-pressed={d.vote === "down"} title="Not quite right">👎</button>
                      {d.vote === "down" && (
                        <>
                          <span className="muted small">What was off?</span>
                          {ASPECTS.map((a) => (
                            <button key={a.key} className={`pill ${d.aspects.includes(a.key) ? "on" : ""}`} onClick={() => toggleAspect(i, a.key)} aria-pressed={d.aspects.includes(a.key)}>{a.label}</button>
                          ))}
                        </>
                      )}
                      {d.vote === "up" && <span className="muted small">THEO will reuse this</span>}
                    </div>
                  </div>
                  <div>
                    <ProjectSelect projects={projects} value={d.projectId} onCreated={addProject}
                      onChange={(id) => upd(i, { projectId: id, projectName: projects.find((p) => p.id === id)?.name ?? null })} />
                    <div className="why">
                      {d.projectId !== d.suggested.projectId ? "Changed, so THEO learns this"
                        : d.projectId == null ? "Not sure. Pick one and THEO will learn"
                        : d.confidence < 0.35 ? "Best guess" : "Confident"}
                    </div>
                  </div>
                  <div>
                    <input type="date" className="input" value={d.dueDate} onChange={(e) => upd(i, { dueDate: e.target.value, dueReason: "You picked it" })} />
                    <div className="why">{d.dueReason}</div>
                  </div>
                  <button className="icon-btn" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="Remove"><XIcon size={16} /></button>
                </div>
              ))}
            </div>
            {error && <div className="err" style={{ marginTop: 12 }}>{error}</div>}
            <div className="row between" style={{ marginTop: 18 }}>
              <button className="btn ghost" onClick={() => setRows(null)}>← Back</button>
              <button className="btn primary" disabled={busy || !rows.length} onClick={save}>{busy ? "Saving…" : `Save ${rows.length} task${rows.length === 1 ? "" : "s"}`}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
