"use client";
import { useState } from "react";
import { analyzeEvents, type EventDraft } from "@/lib/brain/events";
import { endTimeProblem, EVENT_KINDS, kindOf } from "@/lib/events";
import { api } from "./client";
import { SparkIcon, XIcon } from "./Icons";

const PLACEHOLDER = "Type or paste your events here, one per line…";
const EXAMPLE = `Sarah & Tom's wedding 12 Dec 2026 4pm at Kuala Lumpur
Bali holiday 20-27 Dec
Google interview tomorrow 10am
Mum's 60th birthday party next Saturday 6-9pm
New Year party 31 Dec 10pm - 2am
AWS Summit 24/11 https://aws.amazon.com/summit`;

type Row = EventDraft;

type Props = {
  today: string;
  /** Text to start with (carried over from the single-event form). */
  seed?: string;
  defaultDate?: string | null;
  onClose: () => void;
  onSaved: (count: number) => void;
  /** Switch to the single-event form, carrying the first line over. */
  onSingle: (firstLine: string) => void;
};

/** Paste many events → THEO reads dates, times, places and links → you review → save them all at once. */
export default function EventBatchAdd({ today, seed = "", defaultDate, onClose, onSaved, onSingle }: Props) {
  const [text, setText] = useState(seed);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const upd = (i: number, p: Partial<Row>) => setRows((rs) => rs!.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const problem = (r: Row) => (!r.title.trim() ? "Give the event a name." : endTimeProblem(r.start_time, r.end_time, r.end_date));
  const blocked = rows?.some((r) => problem(r)) ?? false;

  function organize() {
    setError("");
    const drafts = analyzeEvents(text, today, defaultDate);
    if (!drafts.length) { setError("Add at least one event, one per line."); return; }
    setRows(drafts);
  }

  async function save() {
    if (!rows?.length || blocked) return;
    setBusy(true); setError("");
    try {
      await api("/api/events", {
        body: { events: rows.map((r) => ({ title: r.title, kind: r.kind, start_date: r.start_date, end_date: r.end_date || null, start_time: r.start_time, end_time: r.end_time, location: r.location, url: r.url, notes: r.notes })) },
      });
      onSaved(rows.length);
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }

  const firstLine = () => text.split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? "";

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="modal" role="dialog" aria-label="Add events" style={{ width: "min(900px, 100%)" }}>
        <div className="row between" style={{ marginBottom: 6 }}>
          <h2 style={{ fontSize: 22 }}>{rows ? `Review ${rows.length} event${rows.length === 1 ? "" : "s"}` : "Add events"}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><XIcon /></button>
        </div>

        {!rows ? (
          <>
            <div className="seg" style={{ display: "inline-flex", margin: "8px 0 14px" }} role="tablist">
              <button role="tab" aria-selected={false} onClick={() => onSingle(firstLine())}>Single event</button>
              <button role="tab" aria-selected className="on">Batch dump</button>
            </div>
            <p className="muted" style={{ marginTop: 0 }}>
              One event per line. Write them naturally: the date (“12 Dec”, “next Saturday”, “20-27 Dec”), time (“4pm”, “6-9pm”), place (“at Kuala Lumpur”) and a link if you have one. THEO sorts out the type, dates and times.
            </p>
            <textarea className="textarea" style={{ minHeight: 200 }} autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={PLACEHOLDER} />
            {error && <div className="err" style={{ marginTop: 12 }}>{error}</div>}
            <div className="row between" style={{ marginTop: 16 }}>
              <button className="btn ghost" onClick={() => setText(EXAMPLE)}>Try an example</button>
              <button className="btn primary" disabled={!text.trim()} onClick={organize}>
                <span className="row" style={{ gap: 6 }}><SparkIcon size={16} />Organize for me</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="muted" style={{ marginTop: 0 }}>Check each event and fix anything that looks off, then save them all.</p>
            <div className="stack">
              {rows.map((r, i) => {
                const k = kindOf(r.kind);
                const issue = problem(r);
                return (
                  <div key={i} className="ev-draft" style={{ borderLeftColor: k.accent }}>
                    <div className="row" style={{ alignItems: "flex-start" }}>
                      <input className="input grow" style={{ fontWeight: 700 }} value={r.title} aria-label="Event name" onChange={(e) => upd(i, { title: e.target.value })} />
                      <button className="icon-btn" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="Remove event"><XIcon size={16} /></button>
                    </div>
                    <div className="ev-fields">
                      <label className="stack" style={{ gap: 4 }}>
                        <span className="small muted">Type</span>
                        <select className="select" value={r.kind} onChange={(e) => upd(i, { kind: e.target.value })}>
                          {EVENT_KINDS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
                        </select>
                      </label>
                      <label className="stack" style={{ gap: 4 }}>
                        <span className="small muted">Date</span>
                        <input type="date" className="input" value={r.start_date} onChange={(e) => upd(i, { start_date: e.target.value, dateFound: true, dateReason: "You picked it" })} />
                      </label>
                      <label className="stack" style={{ gap: 4 }}>
                        <span className="small muted">End date</span>
                        <input type="date" className="input" min={r.start_date} value={r.end_date} onChange={(e) => upd(i, { end_date: e.target.value })} />
                      </label>
                      <label className="stack" style={{ gap: 4 }}>
                        <span className="small muted">Start time</span>
                        <input type="time" className="input" value={r.start_time} onChange={(e) => upd(i, { start_time: e.target.value })} />
                      </label>
                      <label className="stack" style={{ gap: 4 }}>
                        <span className="small muted">End time</span>
                        <input type="time" className="input" value={r.end_time} onChange={(e) => upd(i, { end_time: e.target.value })} />
                      </label>
                    </div>
                    <div className={`why${r.dateFound ? "" : " warn"}`}>{r.dateReason}</div>
                    <div className="ev-fields two">
                      <input className="input" placeholder="Location" value={r.location} onChange={(e) => upd(i, { location: e.target.value })} aria-label="Location" />
                      <input className="input" placeholder="Link (optional)" inputMode="url" autoCapitalize="none" value={r.url} onChange={(e) => upd(i, { url: e.target.value })} aria-label="Link" />
                    </div>
                    {issue && <div className="err" style={{ marginTop: 8 }} role="alert">{issue}</div>}
                  </div>
                );
              })}
            </div>
            {error && <div className="err" style={{ marginTop: 12 }}>{error}</div>}
            <div className="row between" style={{ marginTop: 18 }}>
              <button className="btn ghost" disabled={busy} onClick={() => setRows(null)}>← Back</button>
              <button className="btn primary" disabled={busy || !rows.length || blocked} onClick={save}>
                {busy ? "Saving…" : `Save ${rows.length} event${rows.length === 1 ? "" : "s"}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
