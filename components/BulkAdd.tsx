"use client";
import { useEffect, useState } from "react";
import type { FileMeta, Project } from "@/lib/types";
import type { TaskDraft } from "@/lib/brain";
import type { EventDraft } from "@/lib/brain/events";
import type { EntryType } from "@/lib/brain/entryType";
import { endTimeProblem, eventTheme } from "@/lib/events";
import { api, } from "./client";
import { FileDrop, FileList, uploadFile } from "./files";
import ProjectSelect from "./ProjectSelect";
import DateField from "./DateField";
import TimeField from "./TimeField";
import { SparkIcon, XIcon } from "./Icons";

const PLACEHOLDER = "Type or paste your tasks and events here, one per line…";
const BRIEF_PLACEHOLDER = "e.g. All of this is for my candle business, launching at the Christmas market on 12 Dec. Money stuff is urgent.";
type Mode = "batch" | "single";
type Aspect = "project" | "due" | "steps" | "title";
const ASPECTS: { key: Aspect; label: string }[] = [
  { key: "project", label: "Project" }, { key: "due", label: "Due date" }, { key: "steps", label: "Steps" }, { key: "title", label: "Wording" },
];

/** A draft plus what THEO originally suggested and your 👍/👎 on it. */
type Row = TaskDraft & {
  /** Is this entry a task (to do) or an event (to attend)? THEO guesses; you can flip it. */
  type: EntryType;
  guess: EntryType;
  /** The event version of the line (date, times, place…); used when type is "event". */
  ev: EventDraft;
  notes?: string;
  fileIds: number[];
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
Clean the garage this weekend #home
Finance Lang Backdrop design
Finance Lang Invest Fair 12 Dec 9am - 5pm at KLCC`;

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
  const [files, setFiles] = useState<FileMeta[]>([]);
  const [uploading, setUploading] = useState(false);
  const [fileError, setFileError] = useState("");
  const [hints, setHints] = useState<{ deadline: { date: string; file: string; cue: string } | null; urgent: boolean; checklist: number } | null>(null);
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

  const canAnalyze = (mode === "single" ? !!single.title.trim() : !!text.trim()) && !uploading;

  // Upload picked files one by one (each request stays under the host's size limit).
  async function addFiles(picked: File[]) {
    setUploading(true); setFileError("");
    const errors: string[] = [];
    for (const f of picked) {
      if (files.length + 1 > 10) { errors.push("You can attach up to 10 files."); break; }
      try { const r = await uploadFile(f); setFiles((cur) => [...cur, r.file]); }
      catch (e) { errors.push((e as Error).message); }
    }
    if (errors.length) setFileError(errors.join(" "));
    setUploading(false);
  }
  const removeFile = (f: FileMeta) => {
    setFiles((cur) => cur.filter((x) => x.id !== f.id));
    api(`/api/files/${f.id}`, { method: "DELETE" }).catch(() => {}); // staged upload: safe to discard
  };

  async function analyze() {
    const input = mode === "single" ? single.title.trim() : text;
    if (!input.trim()) return;
    setBusy(true); setError("");
    store.set("theo:brief", brief);
    try {
      const r = await api<{ drafts: TaskDraft[]; entries: { type: EntryType; event: EventDraft }[]; fileHints: typeof hints }>("/api/analyze", {
        body: { text: input, today, brief, fileIds: files.map((f) => f.id), useChecklist: mode === "single" },
      });
      setHints(r.fileHints);
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
      setRows(drafts.map((d, i) => {
        const guess = r.entries[i]?.type ?? "task";
        const ev: EventDraft = { ...(r.entries[i]?.event ?? blankEvent(d.title, d.dueDate)) };
        // A date you picked (single entry) or the calendar day you clicked applies when the line has none.
        const forced = mode === "single" ? single.dueDate : !ev.dateFound ? defaultDate ?? "" : "";
        if (forced) { ev.start_date = forced; ev.dateFound = true; ev.dateReason = mode === "single" ? "You picked it" : "Day you picked on the calendar"; }
        if (mode === "single" && single.notes) ev.notes = single.notes;
        return { ...d, type: guess, guess, ev, fileIds: files.map((f) => f.id), vote: null, aspects: [], suggested: { projectId: d.projectId, dueDate: d.dueDate, steps: d.steps } };
      }));
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function save() {
    if (!rows?.length || blocked) return;
    setBusy(true); setError("");
    const taskRows = rows.filter((r) => r.type === "task");
    const eventRows = rows.filter((r) => r.type === "event");
    try {
      if (taskRows.length) {
        await api("/api/tasks", {
          body: {
            today, brief,
            tasks: taskRows.map(({ vote, aspects, suggested, type, guess, ev, ...t }) => ({ ...t, feedback: { vote, aspects, suggested } })),
          },
        });
        // Saved: if the events step fails below, a retry must not add these tasks twice.
        if (eventRows.length) setRows(eventRows);
      }
      if (eventRows.length) {
        await api("/api/events", {
          body: {
            events: eventRows.map((r) => ({
              title: r.title, kind: r.ev.kind, project_id: r.projectId, start_date: r.ev.start_date, end_date: r.ev.end_date || null,
              start_time: r.ev.start_time, end_time: r.ev.end_time, location: r.ev.location, url: r.ev.url, notes: r.ev.notes, fileIds: r.fileIds,
            })),
          },
        });
      }
      onSaved();
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }

  const blankEvent = (title: string, date: string): EventDraft => ({ title, kind: "other", start_date: date, end_date: "", start_time: "", end_time: "", location: "", url: "", notes: "", dateFound: false, dateReason: "No date found. Please check the date" });
  const updEv = (i: number, patch: Partial<EventDraft>) => setRows((d) => d!.map((x, j) => (j === i ? { ...x, ev: { ...x.ev, ...patch } } : x)));
  // Flipping between task and event keeps the date you can see.
  const setType = (i: number, type: EntryType) => setRows((d) => d!.map((x, j) => {
    if (j !== i || x.type === type) return x;
    if (type === "event") return { ...x, type, ev: x.ev.dateFound ? x.ev : { ...x.ev, start_date: x.dueDate } };
    return { ...x, type, dueDate: x.ev.dateFound ? x.ev.start_date : x.dueDate, dueReason: x.ev.dateFound ? "From the event date" : x.dueReason };
  }));
  const eventIssue = (r: Row) => (r.type === "event" ? (!r.title.trim() ? "Give the event a name." : endTimeProblem(r.ev.start_time, r.ev.end_time, r.ev.end_date)) : "");
  const blocked = rows?.some((r) => eventIssue(r)) ?? false;
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
      <div className="modal" role="dialog" aria-label="Add tasks and events">
        <div className="row between" style={{ marginBottom: 6 }}>
          <h2 style={{ fontSize: 22 }}>{rows ? `Review ${rows.length} entr${rows.length === 1 ? "y" : "ies"}` : "Add tasks & events"}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><XIcon /></button>
        </div>

        {!rows ? (
          <>
            <div className="seg" style={{ display: "inline-flex", margin: "8px 0 14px" }} role="tablist">
              <button role="tab" aria-selected={mode === "batch"} className={mode === "batch" ? "on" : ""} onClick={() => switchMode("batch")}>Batch dump</button>
              <button role="tab" aria-selected={mode === "single"} className={mode === "single" ? "on" : ""} onClick={() => switchMode("single")}>Single entry</button>
            </div>

            {mode === "batch" ? (
              <>
                <p className="muted" style={{ marginTop: 0 }}>
                  One entry per line. Paste a whole brain-dump and mention dates naturally (“by Friday”, “next week”, “20/12”). THEO decides whether each is a <b>task</b> (something to do) or an <b>event</b> (something you attend), and you can flip it in the review.
                </p>
                <textarea className="textarea" style={{ minHeight: 200 }} autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={PLACEHOLDER} />
              </>
            ) : (
              <form className="stack" onSubmit={(e) => { e.preventDefault(); if (canAnalyze && !busy) analyze(); }}>
                <p className="muted" style={{ margin: 0 }}>Describe the task or event. Leave the other fields on <b>Auto</b> and THEO fills them in, or set them yourself.</p>
                <input className="input" style={{ padding: 14, fontSize: 16 }} autoFocus placeholder="e.g. Call the plumber about the leak by Thursday"
                  value={single.title} onChange={(e) => setSingle({ ...single, title: e.target.value })} />
                <div className="form-row stack-mobile">
                  <label className="stack" style={{ gap: 6 }}>
                    <span className="small" style={{ fontWeight: 700 }}>Project</span>
                    <ProjectSelect projects={projects} value={single.projectId} emptyLabel="Auto (let THEO decide)" onCreated={addProject}
                      onChange={(id) => setSingle((s) => ({ ...s, projectId: id }))} />
                  </label>
                  <label className="stack" style={{ gap: 6 }}>
                    <span className="row between" style={{ minHeight: 22 }}>
                      <span className="small" style={{ fontWeight: 700 }}>Due date</span>
                      {single.dueDate && <button type="button" className="btn ghost small" style={{ padding: "0 6px" }} onClick={() => setSingle({ ...single, dueDate: "" })}>Auto</button>}
                    </span>
                    <DateField placeholder="Auto" value={single.dueDate} onChange={(v) => setSingle({ ...single, dueDate: v })} />
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

            {/* Files: THEO reads them to make better Auto choices */}
            <div className="attach">
              <div className="attach-head">
                <b>Files</b><span className="muted small">optional · THEO reads text, PDF and Word files to help Auto (a deadline, what it&apos;s about, a checklist)</span>
              </div>
              <FileDrop onPick={addFiles} busy={uploading} disabled={files.length >= 10} />
              <FileList files={files} onRemove={removeFile} />
              {fileError && <div className="err" style={{ marginTop: 8 }}>{fileError}</div>}
            </div>

            {error && <div className="err" style={{ marginTop: 12 }}>{error}</div>}
            <div className="row between" style={{ marginTop: 16 }}>
              {mode === "batch" ? <button className="btn ghost" onClick={() => setText(EXAMPLE)}>Try an example</button> : <span />}
              <button className="btn primary" disabled={busy || !canAnalyze} onClick={analyze}>
                <span className="row" style={{ gap: 6 }}><SparkIcon size={16} />{busy ? "Thinking…" : mode === "single" ? "Add entry" : "Organize for me"}</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="row between wrap" style={{ marginBottom: 12 }}>
              <p className="muted" style={{ margin: 0 }}>
                Check whether each entry is a <b>Task</b> or an <b>Event</b>, set its project tag and fix anything. On tasks, rate THEO&apos;s suggestion with 👍 / 👎 and it learns from both.
                {brief && <><br /><span className="small">Using your brief: “{brief.length > 90 ? brief.slice(0, 90) + "…" : brief}”</span></>}
              </p>
              {rows.length > 1 && <button className="btn ghost small" onClick={allUp}>👍 All good</button>}
            </div>
            {hints && (hints.deadline || hints.urgent || hints.checklist > 0) && (
              <div className="hint-banner" style={{ marginBottom: 12 }}>
                <b>From your files:</b>{" "}
                {[hints.deadline && `deadline ${hints.deadline.date} in ${hints.deadline.file}`, hints.urgent && "looks urgent", hints.checklist > 0 && `${hints.checklist}-item checklist${rows.length === 1 ? " used as steps" : " found (use Single task to turn it into steps)"}`].filter(Boolean).join(" · ")}
              </div>
            )}
            <div className="stack">
              {rows.map((d, i) => (
                <div key={i} className="entry">
                  <div className="row between" style={{ marginBottom: 6 }}>
                    <div className="seg" role="radiogroup" aria-label="Entry type">
                      <button type="button" role="radio" aria-checked={d.type === "task"} className={d.type === "task" ? "on" : ""} onClick={() => setType(i, "task")}>Task</button>
                      <button type="button" role="radio" aria-checked={d.type === "event"} className={d.type === "event" ? "on" : ""} onClick={() => setType(i, "event")}>Event</button>
                    </div>
                    <span className="muted small">{d.type === d.guess ? `THEO's guess: ${d.guess}` : "You changed this"}</span>
                  </div>
                  {d.type === "event" ? (
                    <div className="ev-draft" style={{ borderLeftColor: eventTheme(d.ev.kind, projects.find((x) => x.id === d.projectId)).accent }}>
                      <div className="row" style={{ alignItems: "flex-start" }}>
                        <input className="input grow" style={{ fontWeight: 700 }} value={d.title} aria-label="Event name" onChange={(e) => upd(i, { title: e.target.value })} />
                        <button className="icon-btn" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="Remove"><XIcon size={16} /></button>
                      </div>
                      <div className="ev-fields one">
                        <label className="stack" style={{ gap: 4 }}>
                          <span className="small muted">Project tag</span>
                          <ProjectSelect projects={projects} value={d.projectId} onCreated={addProject}
                            onChange={(id) => upd(i, { projectId: id, projectName: projects.find((p) => p.id === id)?.name ?? null })} />
                        </label>
                      </div>
                      <div className="ev-fields four" style={{ marginTop: 8 }}>
                        <label className="stack" style={{ gap: 4 }}>
                          <span className="small muted">Date</span>
                          <DateField required value={d.ev.start_date} onChange={(v) => updEv(i, { start_date: v, dateFound: true, dateReason: "You picked it" })} />
                        </label>
                        <label className="stack" style={{ gap: 4 }}>
                          <span className="small muted">End date</span>
                          <DateField min={d.ev.start_date} value={d.ev.end_date} placeholder="Single day" onChange={(v) => updEv(i, { end_date: v })} />
                        </label>
                        <label className="stack" style={{ gap: 4 }}>
                          <span className="small muted">Start time</span>
                          <TimeField placeholder="All day" value={d.ev.start_time} onChange={(v) => updEv(i, { start_time: v })} />
                        </label>
                        <label className="stack" style={{ gap: 4 }}>
                          <span className="small muted">End time</span>
                          <TimeField placeholder="Not set" value={d.ev.end_time} onChange={(v) => updEv(i, { end_time: v })} />
                        </label>
                      </div>
                      <div className={`why${d.ev.dateFound ? "" : " warn"}`}>{d.ev.dateReason}</div>
                      <div className="ev-fields two">
                        <input className="input" placeholder="Location" value={d.ev.location} onChange={(e) => updEv(i, { location: e.target.value })} aria-label="Location" />
                        <input className="input" placeholder="Link (optional)" inputMode="url" autoCapitalize="none" value={d.ev.url} onChange={(e) => updEv(i, { url: e.target.value })} aria-label="Link" />
                      </div>
                      <textarea className="textarea" style={{ minHeight: 56, marginTop: 8 }} placeholder="Description (optional)" value={d.ev.notes}
                        onChange={(e) => updEv(i, { notes: e.target.value })} aria-label="Description" />
                      {eventIssue(d) && <div className="err" style={{ marginTop: 8 }} role="alert">{eventIssue(d)}</div>}
                    </div>
                  ) : (
                <div className={`draft ${d.vote ? "voted-" + d.vote : ""}`}>
                  <div>
                    <input className="input" value={d.title} onChange={(e) => upd(i, { title: e.target.value })} />
                    <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
                      {d.priority === 1 && <span className="tag" style={{ background: "#fdecef", color: "#d6455d" }}>urgent</span>}
                      {d.tags.filter((t) => t !== "urgent").map((t) => <span key={t} className="tag">#{t}</span>)}
                      {d.estimate && <span className="muted small">≈ {d.estimate}</span>}
                    </div>
                    <details open={d.vote === "down" && d.aspects.includes("steps")}>
                      <summary>{d.steps.length} suggested steps{d.stepsSource === "learned" ? " (from your past edits)" : d.stepsSource === "file" ? " (from your file)" : ""}</summary>
                      <textarea className="textarea" style={{ marginTop: 6, minHeight: 90 }} value={d.steps.join("\n")}
                        onChange={(e) => upd(i, { steps: e.target.value.split("\n") })} />
                    </details>
                    {d.fileIds.length > 0 && (
                      <div className="row-files">
                        {d.fileIds.map((id) => {
                          const f = files.find((x) => x.id === id);
                          return f ? (
                            <span key={id} className="tag" title={f.name}>📎 {f.name.length > 22 ? f.name.slice(0, 20) + "…" : f.name}
                              <button type="button" aria-label={`Don't attach ${f.name} to this task`} onClick={() => upd(i, { fileIds: d.fileIds.filter((x) => x !== id) })}>×</button>
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
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
                    <DateField required value={d.dueDate} onChange={(v) => upd(i, { dueDate: v, dueReason: "You picked it" })} />
                    <div className="why">{d.dueReason}</div>
                  </div>
                  <button className="icon-btn" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="Remove"><XIcon size={16} /></button>
                </div>
                  )}
                </div>
              ))}
            </div>
            {error && <div className="err" style={{ marginTop: 12 }}>{error}</div>}
            <div className="row between" style={{ marginTop: 18 }}>
              <button className="btn ghost" onClick={() => setRows(null)}>← Back</button>
              <button className="btn primary" disabled={busy || !rows.length || blocked} onClick={save}>{busy ? "Saving…" : `Save ${rows.length} entr${rows.length === 1 ? "y" : "ies"}`}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
