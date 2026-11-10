"use client";
import Sparkline from "./Sparkline";

export type Stats = {
  kpi: { done_week: number; due_week: number; done_month: number; done_prev_month: number; overdue: number; goal_total: number; goal_done: number; open_total: number };
  perDay: { day: string; created: number; done: number }[];
  perProject: { name: string; color: string; open: number; done: number }[];
};

export default function KpiCards({ stats }: { stats: Stats | null }) {
  // Coerce to numbers so a missing value never shows as "NaN".
  const ZERO: Stats["kpi"] = { done_week: 0, due_week: 0, done_month: 0, done_prev_month: 0, overdue: 0, goal_total: 0, goal_done: 0, open_total: 0 };
  const k: Stats["kpi"] | undefined = stats
    ? (Object.fromEntries(Object.keys(ZERO).map((key) => [key, Number((stats.kpi as Record<string, unknown> | undefined)?.[key]) || 0])) as Stats["kpi"])
    : undefined;
  const days = stats?.perDay ?? [];
  // Activity = share of this week's due work you actually finished (overdue drags it down).
  const activity = k ? (k.done_week + k.overdue === 0 ? 100 : Math.round((k.done_week / (k.done_week + k.overdue)) * 100)) : 0;
  let cum = 0;
  const cumulative = days.slice(-14).map((d) => (cum += d.done));
  const monthDelta = k && k.done_prev_month ? Math.round(((k.done_month - k.done_prev_month) / k.done_prev_month) * 100) : null;
  const goalPct = k && k.goal_total ? Math.round((k.goal_done / k.goal_total) * 100) : 0;

  return (
    <div className="kpis">
      <div className="card kpi">
        <div>
          <div className="label"><span className="full">Your activity level</span><span className="short">Activity</span></div>
          <div className="value">{activity}%</div>
          <div className="delta"><i style={{ background: "#F2A541" }} /> <span className="muted">{k?.overdue ? `${k.overdue} overdue` : "On track"}</span></div>
        </div>
        <span className="spark"><Sparkline values={cumulative} color="#F2A541" /></span>
      </div>
      <div className="card kpi">
        <div>
          <div className="label"><span className="full">Number of completed tasks</span><span className="short">Completed</span></div>
          <div className="value">{k?.done_month ?? 0}<small><span className="full">/month</span><span className="short">/mo</span></small></div>
          <div className="delta"><i style={{ background: "#7F84E8" }} /> <span className="muted">{monthDelta === null ? "First month" : `${monthDelta >= 0 ? "+" : ""}${monthDelta}%`}<span className="full">{monthDelta === null ? "" : " vs last"}</span></span></div>
        </div>
        <span className="spark"><Sparkline values={days.map((d) => d.done)} color="#7F84E8" /></span>
      </div>
      <div className="card kpi">
        <div>
          <div className="label"><span className="full">Goal progress</span><span className="short">Goals</span></div>
          <div className="value">{goalPct}%</div>
          <div className="delta"><i style={{ background: "#5CC97B" }} /> <span className="muted">{k?.goal_done ?? 0}/{k?.goal_total ?? 0}<span className="full"> goal steps</span></span></div>
        </div>
        <span className="spark"><Sparkline kind="bar" values={[goalPct / 100]} color="#5CC97B" /></span>
      </div>
    </div>
  );
}
