"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, startOfWeek, toDate } from "@/lib/brain/dates";
import { colorOf } from "@/lib/colors";
import { kindOf, type LifeEvent } from "@/lib/events";
import type { Project, Task } from "@/lib/types";
import BulkAdd from "@/components/BulkAdd";
import KpiCards, { type Stats } from "@/components/KpiCards";
import TaskDetail from "@/components/TaskDetail";
import { api, fmtDate, localToday, MONTH_LONG, relDue, WEEKDAY } from "@/components/client";
import { BellIcon, CalendarIcon, ChevronL, ChevronR, PlusIcon, SearchIcon } from "@/components/Icons";

type View = "day" | "week" | "month";

function monthStart(iso: string) { return iso.slice(0, 8) + "01"; }
function shiftMonth(iso: string, n: number) {
  const d = toDate(monthStart(iso));
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1)).toISOString().slice(0, 10);
}

export default function CalendarPage() {
  const [today, setToday] = useState("");
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<LifeEvent[]>([]);
  const [doing, setDoing] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [adding, setAdding] = useState<{ date: string | null } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [statsOpen, setStatsOpen] = useState(true);

  useEffect(() => { const t = localToday(); setToday(t); setCursor(t); }, []);

  // Analytics section: remembers open/closed on this device; on a phone it starts collapsed so the calendar gets the space.
  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem("theo:statsOpen"); } catch {}
    setStatsOpen(saved ? saved === "1" : window.matchMedia("(min-width: 861px)").matches);
  }, []);
  const toggleStats = () => setStatsOpen((o) => { try { localStorage.setItem("theo:statsOpen", o ? "0" : "1"); } catch {} return !o; });

  // Visible date range for the current view.
  const days = useMemo(() => {
    if (!cursor) return [] as string[];
    if (view === "day") return [cursor];
    if (view === "week") { const s = startOfWeek(cursor); return Array.from({ length: 7 }, (_, i) => addDays(s, i)); }
    const first = monthStart(cursor);
    const start = startOfWeek(first);
    const lastOfMonth = addDays(shiftMonth(cursor, 1), -1);
    const end = addDays(startOfWeek(lastOfMonth), 6);
    const out: string[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
    return out;
  }, [cursor, view]);

  const load = useCallback(async () => {
    if (!days.length) return;
    try {
      const qs = new URLSearchParams({ from: days[0], to: days[days.length - 1] });
      if (search) qs.set("q", search);
      if (projectFilter) qs.set("project", projectFilter);
      const range = new URLSearchParams({ from: days[0], to: days[days.length - 1] });
      const [t, d, p, s, ev] = await Promise.all([
        api<Task[]>(`/api/tasks?${qs}`),
        api<Task[]>(`/api/tasks?status=doing`),
        api<Project[]>("/api/projects"),
        api<Stats>(`/api/stats?today=${today}`),
        api<LifeEvent[]>(`/api/events?${range}`).catch(() => [] as LifeEvent[]),
      ]);
      setEvents(ev);
      setTasks(t); setDoing(d); setProjects(p); setStats(s); setError("");
    } catch (e) { setError((e as Error).message); }
  }, [days, search, projectFilter, today]);

  useEffect(() => { const id = setTimeout(load, search ? 250 : 0); return () => clearTimeout(id); }, [load, search]);

  const byDay = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of tasks) if (t.due_date) (m.get(t.due_date) ?? m.set(t.due_date, []).get(t.due_date)!).push(t);
    return m;
  }, [tasks]);
  const eventsByDay = useMemo(() => {
    const m = new Map<string, LifeEvent[]>();
    for (const e of events) {
      for (let d = e.start_date; d <= (e.end_date ?? e.start_date); d = addDays(d, 1)) (m.get(d) ?? m.set(d, []).get(d)!).push(e);
    }
    return m;
  }, [events]);
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const selected = useMemo(() => {
    const all = [...tasks, ...doing];
    return all.find((t) => t.id === selectedId)
      ?? doing[0]
      ?? tasks.filter((t) => t.status !== "done" && t.due_date && t.due_date >= today).sort((a, b) => a.due_date!.localeCompare(b.due_date!))[0]
      ?? null;
  }, [tasks, doing, selectedId, today]);

  function onTaskChange(t: Task | null) {
    if (!t) { setSelectedId(null); load(); return; }
    setTasks((ts) => ts.map((x) => (x.id === t.id ? t : x)));
    setSelectedId(t.id);
    load();
  }

  async function moveTask(id: number, date: string) {
    setTasks((ts) => ts.map((x) => (x.id === id ? { ...x, due_date: date } : x)));
    await api(`/api/tasks/${id}`, { method: "PATCH", body: { due_date: date } }).catch((e) => setError(e.message));
    load();
  }

  function step(n: number) {
    if (view === "month") setCursor(shiftMonth(cursor, n));
    else setCursor(addDays(cursor, n * (view === "week" ? 7 : 1)));
  }

  if (!cursor) return null;
  const [cy, cm] = cursor.split("-").map(Number);
  const heading = view === "month" ? `${MONTH_LONG[cm - 1]} ${cy}` : view === "week" ? `Week of ${fmtDate(days[0])}` : fmtDate(cursor, true);
  const maxChips = view === "month" ? 2 : 99;

  const eventChip = (e: LifeEvent) => {
    const k = kindOf(e.kind);
    return (
      <a key={`e${e.id}`} href={`/events?open=${e.id}`} className="chip ev-chip" style={{ background: k.pill, color: k.accent }} title={`${k.label}: ${e.title}`}
        onClick={(x) => x.stopPropagation()}>★ {e.title}</a>
    );
  };

  const chip = (t: Task) => {
    const c = colorOf(projectById.get(t.project_id ?? -1)?.color);
    return (
      <button key={t.id} draggable className={`chip ${t.status === "done" ? "done" : ""} ${selected?.id === t.id ? "sel" : ""}`}
        style={{ background: c.bg, color: c.fg }} title={t.title}
        onDragStart={(e) => e.dataTransfer.setData("text/plain", String(t.id))}
        onClick={(e) => { e.stopPropagation(); setSelectedId(t.id); }}>
        {t.priority === 1 && "! "}{t.title}
      </button>
    );
  };

  return (
    <>
      <div className="page-head">
        <h1>Task calendar</h1>
        <button className="icon-btn" title={`${stats?.kpi.overdue ?? 0} overdue`} onClick={() => setCursor(today)}><BellIcon size={24} /></button>
      </div>

      <div className="search">
        <SearchIcon />
        <input placeholder="Task search" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} aria-label="Filter by project">
          <option value="">By topic name</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {error && <div className="err" style={{ marginBottom: 20 }}>{error}</div>}

      <div className="cal-layout">
        <section>
          <button type="button" className="stats-toggle" onClick={toggleStats} aria-expanded={statsOpen} aria-controls="stats-body">
            <span>
              <h2>Life performance analytics</h2>
              <span className="muted small stats-sub">How you&apos;re keeping up with everything on your plate</span>
            </span>
            <span className="stats-chev" aria-hidden>{statsOpen ? "Hide" : "Show"} <i className={statsOpen ? "open" : ""} /></span>
          </button>
          {statsOpen && <div id="stats-body"><KpiCards stats={stats} /></div>}

          <div className="cal-head">
            <h2 style={{ fontSize: 18 }}>{heading}</h2>
            <div className="row wrap">
              <div className="seg">
                {(["day", "week", "month"] as View[]).map((v) => (
                  <button key={v} className={view === v ? "on" : ""} onClick={() => setView(v)}>{v[0].toUpperCase() + v.slice(1)}</button>
                ))}
              </div>
              <div className="range">
                <button onClick={() => step(-1)} aria-label="Previous"><ChevronL /></button>
                <CalendarIcon size={14} />
                <button onClick={() => setCursor(today)}>{fmtDate(days[0], true)} – {fmtDate(days[days.length - 1], true)}</button>
                <button onClick={() => step(1)} aria-label="Next"><ChevronR /></button>
              </div>
            </div>
          </div>

          {view === "day" ? (
            <div className="day-list">
              {(eventsByDay.get(cursor) ?? []).map((e) => {
                const k = kindOf(e.kind);
                return (
                  <a key={e.id} href={`/events?open=${e.id}`} className="day-item" style={{ background: k.panel }}>
                    <span className="chip" style={{ background: k.pill, color: k.accent }}>★ {k.label}</span>
                    <div className="grow">
                      <div style={{ fontWeight: 700 }}>{e.title}</div>
                      <div className="muted small">{[e.start_time, e.location].filter(Boolean).join(" · ") || "All day"}</div>
                    </div>
                  </a>
                );
              })}
              {(byDay.get(cursor) ?? []).length === 0 && (eventsByDay.get(cursor) ?? []).length === 0 && <div className="empty">Nothing due {relDue(cursor, today).toLowerCase()}. Enjoy it — or add something.</div>}
              {(byDay.get(cursor) ?? []).map((t) => {
                const p = projectById.get(t.project_id ?? -1); const c = colorOf(p?.color);
                const done = t.steps.filter((s) => s.done).length;
                return (
                  <div key={t.id} className="day-item" onClick={() => setSelectedId(t.id)}>
                    <span className="chip" style={{ background: c.bg, color: c.fg }}>{p?.name ?? "Inbox"}</span>
                    <div className="grow">
                      <div style={{ fontWeight: 700, textDecoration: t.status === "done" ? "line-through" : "none" }}>{t.title}</div>
                      <div className="muted small">{t.estimate} · {done}/{t.steps.length} steps · {t.status}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={`grid ${view}`}>
              {days.map((d) => {
                const list = byDay.get(d) ?? [];
                const out = view === "month" && d.slice(0, 7) !== cursor.slice(0, 7);
                const show = expanded === d ? list : list.slice(0, maxChips);
                return (
                  <div key={d} className={`cell ${out ? "out" : ""} ${d === today ? "today" : ""} ${dragOver === d ? "drop" : ""}`}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(d); }}
                    onDragLeave={() => setDragOver(null)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(null); const id = Number(e.dataTransfer.getData("text/plain")); if (id) moveTask(id, d); }}>
                    <div className="dhead"><span>{WEEKDAY[(toDate(d).getUTCDay() + 6) % 7]}</span><b>{d.slice(8)}</b></div>
                    {(eventsByDay.get(d) ?? []).map(eventChip)}
                    {show.map(chip)}
                    {list.length > show.length && <button className="more" onClick={() => setExpanded(d)}>+{list.length - show.length}</button>}
                    <button className="add-here" title="Add tasks for this day" onClick={() => setAdding({ date: d })}>+</button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <aside className="side-col">
          <div className="soft-card">
            <h2>At work</h2>
            {doing.length === 0 && <div className="muted small" style={{ marginTop: 12 }}>Nothing in progress. Pick a task and hit “Accept the task”.</div>}
            {doing.map((t) => {
              const c = colorOf(projectById.get(t.project_id ?? -1)?.color);
              return (
                <div key={t.id} className="atwork-item" onClick={() => setSelectedId(t.id)}>
                  <span className="chip" style={{ background: c.bg, color: c.fg, maxWidth: 210 }}>{t.title}</span>
                  <span className="muted small">{t.estimate || relDue(t.due_date, today)}</span>
                </div>
              );
            })}
          </div>
          {selected ? (
            <TaskDetail task={selected} projects={projects} today={today} onChange={onTaskChange} />
          ) : (
            <div className="soft-card empty">
              <p>No tasks yet.</p>
              <button className="btn primary" onClick={() => setAdding({ date: null })}>Add your first tasks</button>
            </div>
          )}
        </aside>
      </div>

      <button className="fab" onClick={() => setAdding({ date: null })}><PlusIcon size={18} /> Add tasks</button>

      {adding && (
        <BulkAdd projects={projects} today={today} defaultDate={adding.date}
          onClose={() => setAdding(null)} onSaved={() => { setAdding(null); load(); }} />
      )}
    </>
  );
}
