"use client";
import { useEffect, useState } from "react";
import { colorOf } from "@/lib/colors";
import KpiCards, { type Stats } from "@/components/KpiCards";
import { api, fmtDate, localToday } from "@/components/client";

export default function AnalyticsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { api<Stats>(`/api/stats?today=${localToday()}`).then(setStats).catch((e) => setError(e.message)); }, []);

  const days = stats?.perDay ?? [];
  const max = Math.max(1, ...days.map((d) => Math.max(d.created, d.done)));
  const pmax = Math.max(1, ...(stats?.perProject ?? []).map((p) => p.open + p.done));

  return (
    <>
      <div className="page-head"><h1>Analytics</h1></div>
      {error && <div className="err">{error}</div>}
      <KpiCards stats={stats} />

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
