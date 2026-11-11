"use client";
import { useCallback, useEffect, useState } from "react";
import type { GoalPlan, PlannedTask } from "@/lib/brain";
import type { Task } from "@/lib/types";
import DateField from "@/components/DateField";
import { api, fmtDate, localToday, relDue } from "@/components/client";
import { PlusIcon, SparkIcon, XIcon } from "@/components/Icons";

type GoalRow = { id: number; title: string; total: number; done: number; next_due: string | null; created_at: string };

const EXAMPLES = ["Build a business", "Get fit for a 10k run", "Learn Spanish", "Move house", "Save an emergency fund", "Launch my website", "Find a new job"];
const SOURCE_LABEL: Record<GoalPlan["source"], string> = {
  learned: "Based on a plan you shaped before",
  playbook: "THEO's playbook — edit anything, THEO remembers your version",
  generic: "A general framework — edit freely, THEO remembers your version",
  ai: "Drafted with free AI — edit freely, THEO remembers your version",
};

export default function PlanPage() {
  const [today, setToday] = useState("");
  const [goal, setGoal] = useState("");
  const [plan, setPlan] = useState<GoalPlan | null>(null);
  const [original, setOriginal] = useState("");
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [open, setOpen] = useState<{ id: number; tasks: Task[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadGoals = useCallback(() => api<GoalRow[]>("/api/goals").then(setGoals).catch((e) => setError(e.message)), []);
  useEffect(() => {
    setToday(localToday()); loadGoals();
    const g = new URLSearchParams(window.location.search).get("goal");
    if (g) setGoal(g.slice(0, 200));
  }, [loadGoals]);

  async function draft(g = goal) {
    if (!g.trim()) return;
    setGoal(g); setBusy(true); setError("");
    try {
      const r = await api<{ plan: GoalPlan }>("/api/goals/plan", { body: { goal: g, today } });
      setPlan(r.plan); setOriginal(JSON.stringify(r.plan.tasks));
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function accept() {
    if (!plan) return;
    setBusy(true); setError("");
    try {
      const tasks = plan.tasks.map((t) => ({ ...t, steps: t.steps.map((s) => s.trim()).filter(Boolean) })).filter((t) => t.title.trim());
      await api("/api/goals", { body: { goal: plan.goal, projectName: plan.projectName, tasks, edited: JSON.stringify(plan.tasks) !== original, today } });
      setPlan(null); setGoal(""); loadGoals();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  const upd = (i: number, p: Partial<PlannedTask>) => setPlan((pl) => pl && { ...pl, tasks: pl.tasks.map((t, j) => (j === i ? { ...t, ...p } : t)) });

  async function toggleGoal(id: number) {
    if (open?.id === id) return setOpen(null);
    setOpen({ id, tasks: await api<Task[]>(`/api/tasks?goal=${id}&archived=0`) });
  }

  return (
    <>
      <div className="page-head"><h1>Goal planner</h1></div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h2>What do you want to achieve?</h2>
        <div className="muted small" style={{ margin: "6px 0 14px" }}>THEO breaks big goals into dated tasks with steps, and learns from how you adjust them.</div>
        <form className="row" onSubmit={(e) => { e.preventDefault(); draft(); }}>
          <input className="input grow" style={{ padding: 14, fontSize: 16 }} placeholder="e.g. Build a business selling handmade candles" value={goal} onChange={(e) => setGoal(e.target.value)} />
          <button className="btn primary" disabled={busy || !goal.trim()} style={{ padding: "14px 20px" }}>
            <span className="row" style={{ gap: 6 }}><SparkIcon size={16} /> {busy && !plan ? "Planning…" : "Plan it"}</span>
          </button>
        </form>
        <div className="examples">{EXAMPLES.map((x) => <button key={x} onClick={() => draft(x)}>{x}</button>)}</div>
      </div>

      {error && <div className="err" style={{ marginBottom: 20 }}>{error}</div>}

      {plan && (
        <div className="card" style={{ marginBottom: 28 }}>
          <div className="row between wrap">
            <div>
              <h2 style={{ fontSize: 22 }}>{plan.goal}</h2>
              <div className="muted small" style={{ marginTop: 4 }}>{SOURCE_LABEL[plan.source]}</div>
            </div>
            <label className="row small" style={{ fontWeight: 700 }}>Project
              <input className="input" style={{ width: 160 }} value={plan.projectName} onChange={(e) => setPlan({ ...plan, projectName: e.target.value })} />
            </label>
          </div>
          <div className="stack" style={{ marginTop: 20 }}>
            {plan.tasks.map((t, i) => (
              <div key={i} className="plan-step">
                <div className="num">{i + 1}</div>
                <div>
                  <input className="input" style={{ fontWeight: 700 }} value={t.title} onChange={(e) => upd(i, { title: e.target.value })} />
                  <textarea className="textarea" style={{ marginTop: 8, minHeight: 70, fontSize: 13 }} value={t.steps.join("\n")}
                    placeholder="Sub-steps, one per line" onChange={(e) => upd(i, { steps: e.target.value.split("\n") })} />
                </div>
                <div className="input-date">
                  <DateField required value={t.dueDate} onChange={(v) => upd(i, { dueDate: v })} />
                  <div className="muted small" style={{ marginTop: 4 }}>{relDue(t.dueDate, today)}</div>
                </div>
                <input className="input input-est" placeholder="Estimate" value={t.estimate} onChange={(e) => upd(i, { estimate: e.target.value })} />
                <button className="icon-btn" onClick={() => setPlan({ ...plan, tasks: plan.tasks.filter((_, j) => j !== i) })} aria-label="Remove step"><XIcon size={16} /></button>
              </div>
            ))}
          </div>
          <div className="row between" style={{ marginTop: 18 }}>
            <button className="btn ghost" onClick={() => setPlan({ ...plan, tasks: [...plan.tasks, { title: "", dueDate: plan.tasks.at(-1)?.dueDate ?? today, offsetDays: 0, estimate: "", steps: [] }] })}>
              <span className="row" style={{ gap: 4 }}><PlusIcon size={16} /> Add a step</span>
            </button>
            <div className="row">
              <button className="btn" onClick={() => setPlan(null)}>Discard</button>
              <button className="btn primary" disabled={busy} onClick={accept}>{busy ? "Saving…" : `Start this plan (${plan.tasks.length} tasks)`}</button>
            </div>
          </div>
        </div>
      )}

      <h2 style={{ marginBottom: 14 }}>Your goals</h2>
      {goals.length === 0 && <div className="soft-card empty">No goals yet — try one of the examples above.</div>}
      <div className="stack">
        {goals.map((g) => (
          <div key={g.id} className="card">
            <div className="row between" style={{ cursor: "pointer" }} onClick={() => toggleGoal(g.id)}>
              <div className="grow">
                <b style={{ fontSize: 16 }}>{g.title}</b>
                <div className="muted small" style={{ marginTop: 4 }}>{g.done}/{g.total} done{g.next_due ? ` · next step ${relDue(g.next_due, today).toLowerCase()}` : g.total ? " · complete 🎉" : ""}</div>
              </div>
              <div style={{ width: 160 }}><div className="progress"><i style={{ width: `${g.total ? (g.done / g.total) * 100 : 0}%` }} /></div></div>
            </div>
            {open?.id === g.id && (
              <div style={{ marginTop: 14 }}>
                {open.tasks.map((t) => (
                  <div key={t.id} className="list-row">
                    <input type="checkbox" className="check" checked={t.status === "done"} onChange={async () => {
                      await api(`/api/tasks/${t.id}`, { method: "PATCH", body: { status: t.status === "done" ? "todo" : "done" } });
                      setOpen({ id: g.id, tasks: await api<Task[]>(`/api/tasks?goal=${g.id}`) }); loadGoals();
                    }} />
                    <span className="grow" style={{ textDecoration: t.status === "done" ? "line-through" : "none" }}>{t.title}</span>
                    <span className="muted small">{fmtDate(t.due_date)}</span>
                  </div>
                ))}
                <button className="btn danger small" style={{ marginTop: 10 }} onClick={async () => {
                  if (!confirm("Delete this goal and all its tasks?")) return;
                  await api(`/api/goals/${g.id}`, { method: "DELETE" }); setOpen(null); loadGoals();
                }}>Delete goal</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
