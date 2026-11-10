"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { detectKind, EVENT_KINDS, kindOf, type LifeEvent } from "@/lib/events";
import type { EventHints } from "@/lib/brain";
import type { FileMeta } from "@/lib/types";
import EventCard from "@/components/EventCard";
import { api, fmtDate, localToday } from "@/components/client";
import { FileDrop, FileList, uploadFile } from "@/components/files";
import { PlusIcon, XIcon } from "@/components/Icons";

type Draft = { id?: number; title: string; kind: string; autoKind: boolean; start_date: string; end_date: string; start_time: string; location: string; url: string; notes: string; favorite: boolean; files: FileMeta[] };

const blank = (today: string): Draft => ({ title: "", kind: "other", autoKind: true, start_date: today, end_date: "", start_time: "", location: "", url: "", notes: "", favorite: false, files: [] });

export default function EventsPage() {
  const [today, setToday] = useState("");
  const [events, setEvents] = useState<LifeEvent[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [showPast, setShowPast] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileError, setFileError] = useState("");
  const [hints, setHints] = useState<EventHints | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => api<LifeEvent[]>("/api/events").then(setEvents).catch((e) => setError(e.message)), []);
  useEffect(() => {
    const t = localToday();
    setToday(t); load();
    // Opened from the calendar with ?new=YYYY-MM-DD or ?open=ID
    const u = new URLSearchParams(window.location.search);
    if (u.get("new")) setDraft({ ...blank(t), start_date: u.get("new")! });
  }, [load]);
  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get("open"));
    const ev = id && events.find((e) => e.id === id);
    if (ev) { openEdit(ev); window.history.replaceState(null, "", "/events"); }
  }, [events]);

  useEffect(() => { if (!draft) { setHints(null); setFileError(""); } }, [draft]);
  const closeDraft = () => { setDraft(null); load(); };

  // Keep the most useful suggestion from each file: first type & link, earliest date (with its time).
  const mergeHints = (a: EventHints | null, b: EventHints | null | undefined): EventHints | null => {
    if (!b) return a;
    if (!a) return b;
    const useB = !!b.date && (!a.date || b.date.value < a.date.value);
    return { kind: a.kind ?? b.kind, url: a.url ?? b.url, date: useB ? b.date : a.date, time: useB ? b.time : a.time };
  };

  async function addFiles(picked: File[]) {
    if (!draft) return;
    setUploading(true); setFileError("");
    const errors: string[] = [];
    let found = hints;
    for (const f of picked) {
      try {
        const r = await uploadFile(f, draft.id ? { eventId: draft.id, today } : { forEvent: true, today });
        found = mergeHints(found, r.hints);
        setDraft((d) => d && { ...d, files: r.event ? r.event.files : [...d.files, r.file] });
      } catch (e) { errors.push((e as Error).message); }
    }
    setHints(found);
    if (errors.length) setFileError(errors.join(" "));
    setUploading(false);
  }

  async function removeFile(f: FileMeta) {
    if (!draft) return;
    try {
      if (draft.id) {
        const r = await api<{ event: LifeEvent }>(`/api/files/${f.id}?eventId=${draft.id}`, { method: "DELETE" });
        setDraft((d) => d && { ...d, files: r.event?.files ?? d.files.filter((x) => x.id !== f.id) });
      } else {
        await api(`/api/files/${f.id}`, { method: "DELETE" });
        setDraft((d) => d && { ...d, files: d.files.filter((x) => x.id !== f.id) });
      }
    } catch (e) { setFileError((e as Error).message); }
  }

  // One tap fills in what THEO read: type, date, time and link (link only if still empty).
  function applyHints() {
    if (!hints) return;
    upd({
      ...(hints.kind ? { kind: hints.kind, autoKind: false } : {}),
      ...(hints.date ? { start_date: hints.date.value } : {}),
      ...(hints.time ? { start_time: hints.time } : {}),
      ...(hints.url && !draft?.url ? { url: hints.url } : {}),
    });
    setHints(null);
  }

  function openEdit(e: LifeEvent) {
    setError("");
    setDraft({ id: e.id, title: e.title, kind: e.kind, autoKind: false, start_date: e.start_date, end_date: e.end_date ?? "", start_time: e.start_time, location: e.location, url: e.url, notes: e.notes, favorite: e.favorite, files: e.files ?? [] });
  }

  async function save() {
    if (!draft) return;
    setBusy(true); setError("");
    const body = { ...draft, end_date: draft.end_date || null };
    try {
      if (draft.id) await api(`/api/events/${draft.id}`, { method: "PATCH", body });
      else await api("/api/events", { body: { ...body, fileIds: draft.files.map((f) => f.id) } });
      setDraft(null); load();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!draft?.id || !confirm(`Delete “${draft.title}”?`)) return;
    await api(`/api/events/${draft.id}`, { method: "DELETE" }).catch((e) => setError(e.message));
    setDraft(null); load();
  }

  async function toggleFav(e: LifeEvent) {
    setEvents((es) => es.map((x) => (x.id === e.id ? { ...x, favorite: !x.favorite } : x)));
    await api(`/api/events/${e.id}`, { method: "PATCH", body: { favorite: !e.favorite } }).catch((er) => setError(er.message));
  }

  const shown = useMemo(() => [...events].sort((a, b) => (a.start_date + a.start_time).localeCompare(b.start_date + b.start_time)).filter((e) => filter === "all" || (filter === "fav" ? e.favorite : e.kind === filter)), [events, filter]);
  const upcoming = shown.filter((e) => (e.end_date ?? e.start_date) >= today);
  const past = shown.filter((e) => (e.end_date ?? e.start_date) < today).reverse();
  const kindsUsed = EVENT_KINDS.filter((k) => events.some((e) => e.kind === k.key));
  const upd = (p: Partial<Draft>) => setDraft((d) => d && { ...d, ...p });

  return (
    <>
      <div className="page-head">
        <h1>Events</h1>
        <button className="btn primary" onClick={() => { setError(""); setDraft(blank(today)); }}>
          <span className="row" style={{ gap: 6 }}><PlusIcon size={16} /> Add event</span>
        </button>
      </div>
      <p className="muted" style={{ marginTop: -14, marginBottom: 22 }}>The big moments: weddings, trips, interviews, birthdays and parties. They show up on your Task calendar too.</p>

      {events.length > 0 && (
        <div className="row wrap" style={{ gap: 8, marginBottom: 22 }}>
          <button className={`pill ${filter === "all" ? "on-dark" : ""}`} onClick={() => setFilter("all")}>All</button>
          <button className={`pill ${filter === "fav" ? "on-dark" : ""}`} onClick={() => setFilter("fav")}>♥ Favourites</button>
          {kindsUsed.map((k) => (
            <button key={k.key} className="pill" onClick={() => setFilter(k.key)}
              style={filter === k.key ? { background: k.pill, color: k.accent, borderColor: k.pill } : undefined}>{k.label}</button>
          ))}
        </div>
      )}

      {error && !draft && <div className="err" style={{ marginBottom: 20 }}>{error}</div>}

      <h2 style={{ marginBottom: 14 }}>Coming up</h2>
      {upcoming.length === 0 ? (
        <div className="soft-card empty">
          {events.length === 0 ? "No events yet. Add a wedding, trip, interview or birthday you're looking forward to." : "Nothing coming up for this filter."}
        </div>
      ) : (
        <div className="event-grid">
          {upcoming.map((e) => <EventCard key={e.id} event={e} today={today} onFavorite={() => toggleFav(e)} onOpen={() => openEdit(e)} />)}
        </div>
      )}

      {past.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <button className="btn ghost" onClick={() => setShowPast(!showPast)}>{showPast ? "Hide" : "Show"} past events ({past.length})</button>
          {showPast && (
            <div className="event-grid" style={{ marginTop: 14 }}>
              {past.map((e) => <EventCard key={e.id} event={e} today={today} onFavorite={() => toggleFav(e)} onOpen={() => openEdit(e)} />)}
            </div>
          )}
        </div>
      )}

      {draft && (
        <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && closeDraft()}>
          <form className="modal stack" style={{ width: "min(640px, 100%)" }} onSubmit={(e) => { e.preventDefault(); save(); }}>
            <div className="row between">
              <h2 style={{ fontSize: 22 }}>{draft.id ? "Edit event" : "Add event"}</h2>
              <button type="button" className="icon-btn" onClick={closeDraft} aria-label="Close"><XIcon /></button>
            </div>

            <label className="stack" style={{ gap: 6 }}>
              <span className="small" style={{ fontWeight: 700 }}>What's happening?</span>
              <input className="input" style={{ padding: 14, fontSize: 16 }} autoFocus required placeholder="e.g. Sarah & Tom's wedding, Bali holiday, Google interview"
                value={draft.title} onChange={(e) => upd({ title: e.target.value, ...(draft.autoKind ? { kind: detectKind(e.target.value) } : {}) })} />
            </label>

            <div className="stack" style={{ gap: 6 }}>
              <span className="small" style={{ fontWeight: 700 }}>Type {draft.autoKind && draft.title && <span className="muted">· picked automatically</span>}</span>
              <div className="row wrap" style={{ gap: 6 }}>
                {EVENT_KINDS.map((k) => (
                  <button type="button" key={k.key} className="pill" onClick={() => upd({ kind: k.key, autoKind: false })}
                    style={draft.kind === k.key ? { background: k.pill, color: k.accent, borderColor: k.accent } : undefined}>{k.label}</button>
                ))}
              </div>
            </div>

            <div className="form-row">
              <label className="stack" style={{ gap: 6 }}>
                <span className="small" style={{ fontWeight: 700 }}>Date</span>
                <input type="date" className="input" required value={draft.start_date} onChange={(e) => upd({ start_date: e.target.value })} />
              </label>
              <label className="stack" style={{ gap: 6 }}>
                <span className="small" style={{ fontWeight: 700 }}>Until <span className="muted">(multi-day)</span></span>
                <input type="date" className="input" min={draft.start_date} value={draft.end_date} onChange={(e) => upd({ end_date: e.target.value })} />
              </label>
              <label className="stack" style={{ gap: 6 }}>
                <span className="small" style={{ fontWeight: 700 }}>Time</span>
                <input type="time" className="input" value={draft.start_time} onChange={(e) => upd({ start_time: e.target.value })} />
              </label>
            </div>

            <div className="form-row stack-mobile">
              <label className="stack" style={{ gap: 6 }}>
                <span className="small" style={{ fontWeight: 700 }}>Location</span>
                <input className="input" placeholder="e.g. Kuala Lumpur, Malaysia" value={draft.location} onChange={(e) => upd({ location: e.target.value })} />
              </label>
              <label className="stack" style={{ gap: 6 }}>
                <span className="small" style={{ fontWeight: 700 }}>Link</span>
                <input className="input" placeholder="Invite, booking or ticket URL" value={draft.url} onChange={(e) => upd({ url: e.target.value })} />
              </label>
            </div>

            <textarea className="textarea" style={{ minHeight: 70 }} placeholder="Notes: dress code, who's going, gift ideas…" value={draft.notes} onChange={(e) => upd({ notes: e.target.value })} />

            {/* Files: THEO reads them and can fill in the event for you */}
            <div className="attach" style={{ marginTop: 0 }}>
              <div className="attach-head">
                <b>Files</b><span className="muted small">tickets, invites, bookings · THEO reads text, PDF and Word files</span>
              </div>
              <FileDrop onPick={addFiles} busy={uploading} disabled={draft.files.length >= 10} />
              <FileList files={draft.files} onRemove={removeFile} />
              {fileError && <div className="err" style={{ marginTop: 8 }}>{fileError}</div>}
              {hints && (
                <div className="hint-banner" style={{ marginTop: 10 }}>
                  <b>THEO found in your file:</b>
                  <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                    {hints.kind && <li>Type: <b>{kindOf(hints.kind).label}</b></li>}
                    {hints.date && <li>Date: <b>{fmtDate(hints.date.value, true)}</b>{hints.time ? <> at <b>{hints.time}</b></> : null} <span className="muted">({hints.date.file})</span></li>}
                    {hints.url && <li style={{ wordBreak: "break-all" }}>Link: {hints.url}{draft.url ? <span className="muted"> (you already have one, so it won&apos;t be replaced)</span> : null}</li>}
                  </ul>
                  <div className="row" style={{ justifyContent: "flex-end" }}>
                    <button type="button" className="btn ghost small" onClick={() => setHints(null)}>Dismiss</button>
                    <button type="button" className="btn primary small" onClick={applyHints}>Fill these in</button>
                  </div>
                </div>
              )}
            </div>

            {error && <div className="err">{error}</div>}

            <div className="row between wrap">
              <div className="row">
                {draft.id && <button type="button" className="btn danger" onClick={remove}>Delete</button>}
                {draft.title && (
                  <a className="btn ghost" href={`/plan?goal=${encodeURIComponent(`Prepare for ${draft.title}`)}`} title="Turn this event into a step-by-step prep plan">Plan prep tasks →</a>
                )}
              </div>
              <div className="row">
                <button type="button" className="btn" onClick={closeDraft}>Cancel</button>
                <button className="btn primary" disabled={busy || !draft.title.trim() || !draft.start_date}>{busy ? "Saving…" : draft.id ? "Save" : "Add event"}</button>
              </div>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
