"use client";
import { useEffect, useState } from "react";
import { colorOf } from "@/lib/colors";
import KpiCards, { type Stats } from "@/components/KpiCards";
import { api, fmtDate, localToday, localTz } from "@/components/client";
import { categoryOf } from "@/lib/categories";
import type { Timeliness } from "@/lib/timeliness";
import { CategoryTag } from "@/components/CategoryPicker";

export default function AnalyticsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [ot, setOt] = useState<Timeliness | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const qs = `today=${localToday()}&tz=${encodeURIComponent(localTz())}`;
    api<Stats>(`/api/stats?${qs}`).then(setStats).catch((e) => setError(e.message));
    api<Timeliness>(`/api/stats/timeliness?${qs}`).then(setOt).catch((e) => setError(e.message));
  }, []);

  const days = stats?.perDay ?? [];
  const max = Math.max(1, ...days.map((d) => Math.max(d.created, d.done)));
  const pmax = Math.max(1, ...(stats?.perProject ?? []).map((p) => p.open + p.done));

  return (
    <>
      <div className="page-head"><h1>Analytics</h1></div>
      {error && <div className="err">{error}</div>}
      <KpiCards stats={stats} />

      <OnTime ot={ot} />

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="row between wrap">
          <h2>Last 30 days</h2>
          <div className="row small muted">
            <span className="row" style={{ gap: 6 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: "#E4E4FB", display: "inline-block" }} /> Added</span>
            <span className="row" style={{ gap: 6 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: "#F2A541", display: "inline-block" }} /> Completed</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 180, marginTop: 20 }}>
          {days.map((d) => (
            <div key={d.day} title={`${fmtDate(d.day)}: ${d.created} added, ${d.done} done`} style={{ flex: 1, display: "flex", gap: 1, alignItems: "flex-end", height: "100%" }}>
              <div style={{ flex: 1, height: `${(d.created / max) * 100}%`, background: "#E4E4FB", borderRadius: "3px 3px 0 0", minHeight: d.created ? 3 : 0 }} />
              <div style={{ flex: 1, height: `${(d.done / max) * 100}%`, background: "#F2A541", borderRadius: "3px 3px 0 0", minHeight: d.done ? 3 : 0 }} />
            </div>
          ))}
        </div>
        <div className="row between muted small" style={{ marginTop: 8 }}><span>{fmtDate(days[0]?.day)}</span><span>Today</span></div>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 16 }}>Where your energy goes</h2>
        <div className="bars">
          {(stats?.perProject ?? []).map((p) => {
            const c = colorOf(p.color);
            return (
              <div key={p.name} className="row">
                <span style={{ width: 110, fontWeight: 700, fontSize: 13 }}>{p.name}</span>
                <div className="grow" style={{ display: "flex", height: 14, background: "var(--soft)", borderRadius: 6, overflow: "hidden" }}>
                  <div style={{ width: `${(p.done / pmax) * 100}%`, background: c.dot }} title={`${p.done} done`} />
                  <div style={{ width: `${(p.open / pmax) * 100}%`, background: c.bg }} title={`${p.open} open`} />
                </div>
                <span className="muted small" style={{ width: 90, textAlign: "right" }}>{p.done} done · {p.open} open</span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ── How often work is finished early, on the day, or late ─────────────
const EARLY = "#5CC97B", ONTIME = "#7F84E8", LATE = "#E8685C";
type Counts = { early: number; onTime: number; late: number };
const total = (c: Counts) => c.early + c.onTime + c.late;
const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);
const days = (n: number | null) => (n == null ? "–" : `${n} day${n === 1 ? "" : "s"}`);

function Split({ c, height }: { c: Counts; height?: number }) {
  const t = total(c);
  return (
    <div className="ot-split" style={height ? { height } : undefined} title={`${c.early} early · ${c.onTime} on time · ${c.late} late`}>
      {t > 0 && <><i style={{ width: `${(c.early / t) * 100}%`, background: EARLY }} /><i style={{ width: `${(c.onTime / t) * 100}%`, background: ONTIME }} /><i style={{ width: `${(c.late / t) * 100}%`, background: LATE }} /></>}
    </div>
  );
}

function OnTime({ ot }: { ot: Timeliness | null }) {
  if (!ot) return null;
  const s = ot.summary;
  const maxWeek = Math.max(1, ...ot.byWeek.map(total));
  const legend = (
    <div className="ot-legend">
      <span><i style={{ background: EARLY }} /> Early</span>
      <span><i style={{ background: ONTIME }} /> On the day</span>
      <span><i style={{ background: LATE }} /> Late</span>
    </div>
  );
  const rate = (c: Counts) => (total(c) ? `${pct(c.early + c.onTime, total(c))}% on time` : "Nothing finished yet");

  return (
    <div className="card" style={{ marginBottom: 24 }} data-testid="ontime">
      <div className="row between wrap">
        <div>
          <h2>Do you finish on time?</h2>
          <div className="muted small" style={{ marginTop: 4 }}>Every finished task, judged against the date it was originally due.</div>
        </div>
        {legend}
      </div>

      {s.total === 0 ? (
        <div className="muted" style={{ padding: "24px 0 8px" }}>Finish a few tasks that have a due date and this will show how often you&apos;re early, on the day, or late.</div>
      ) : (<>
        <div style={{ marginTop: 16 }}><Split c={s} height={22} /></div>
        <div className="ot-stats">
          <div className="ot-stat"><b style={{ color: EARLY }}>{pct(s.early, s.total)}%</b><span>Early · {s.early} task{s.early === 1 ? "" : "s"}{s.avgEarlyDays != null ? `, ${days(s.avgEarlyDays)} ahead on average` : ""}</span></div>
          <div className="ot-stat"><b style={{ color: ONTIME }}>{pct(s.onTime, s.total)}%</b><span>On the day · {s.onTime} task{s.onTime === 1 ? "" : "s"}</span></div>
          <div className="ot-stat"><b style={{ color: LATE }}>{pct(s.late, s.total)}%</b><span>Late · {s.late} task{s.late === 1 ? "" : "s"}{s.avgLateDays != null ? `, ${days(s.avgLateDays)} behind on average` : ""}{s.worstLateDays > 1 ? ` (worst ${days(s.worstLateDays)})` : ""}</span></div>
          <div className="ot-stat"><b>{s.rate ?? 0}%</b><span>Done by the due date, across {s.total} finished task{s.total === 1 ? "" : "s"}</span></div>
        </div>

        <h3 style={{ margin: "20px 0 10px", fontSize: 14 }}>Last 8 weeks</h3>
        <div className="ot-weeks">
          {ot.byWeek.map((w) => {
            const t = total(w);
            return (
              <div key={w.week} className="ot-week" title={`Week of ${fmtDate(w.week)}: ${w.early} early, ${w.onTime} on time, ${w.late} late`}>
                <div className="stack-bar" style={{ height: `${(t / maxWeek) * 100}%`, minHeight: t ? 4 : 0 }}>
                  <i style={{ height: `${pct(w.early, t)}%`, background: EARLY }} />
                  <i style={{ height: `${pct(w.onTime, t)}%`, background: ONTIME }} />
                  <i style={{ height: `${pct(w.late, t)}%`, background: LATE }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="row between muted small" style={{ marginTop: 6 }}><span>{fmtDate(ot.byWeek[0]?.week)}</span><span>This week</span></div>
      </>)}

      {ot.byCategory.some((c) => c.category) && (<>
        <h3 style={{ margin: "24px 0 12px", fontSize: 14 }}>By classification</h3>
        <div className="ot-rows">
          {ot.byCategory.map((c) => {
            const cat = categoryOf(c.category);
            return (
              <div key={c.category ?? "none"} className="ot-row" data-testid={`ot-cat-${c.category ?? "none"}`}>
                <span className="name">{cat ? <span aria-hidden>{cat.emoji}</span> : null}<span>{cat ? cat.label : "Not classified"}</span></span>
                <div><Split c={c} /><div className="muted small" style={{ marginTop: 4 }}>{c.projects} project{c.projects === 1 ? "" : "s"} · {c.open} open{c.overdue ? ` · ${c.overdue} overdue now` : ""}</div></div>
                <span className="rate">{rate(c)}</span>
              </div>
            );
          })}
        </div>
      </>)}

      {ot.byProject.length > 0 && (<>
        <h3 style={{ margin: "24px 0 12px", fontSize: 14 }}>By project</h3>
        <div className="ot-rows">
          {ot.byProject.map((p) => {
            const col = colorOf(p.color);
            return (
              <div key={p.id} className="ot-row">
                <span className="name"><i style={{ width: 10, height: 10, borderRadius: 5, background: col.dot, flex: "none" }} /><span>{p.name}</span><CategoryTag category={p.category} /></span>
                <div><Split c={p} /><div className="muted small" style={{ marginTop: 4 }}>{p.open} open{p.overdue ? ` · ${p.overdue} overdue now` : ""}</div></div>
                <span className="rate">{rate(p)}</span>
              </div>
            );
          })}
        </div>
      </>)}
    </div>
  );
}
