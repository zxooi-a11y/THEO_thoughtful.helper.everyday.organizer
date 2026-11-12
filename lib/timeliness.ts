// How often finished tasks were done early, on the day, or late. Pure, so it is easy to test.
import { addDays, daysBetween, startOfWeek } from "./brain/dates.ts";

/** One finished task: when it was due, and the (local) day it was finished. */
export type DoneRow = { project_id: number | null; due: string; done_on: string };
export type OpenRow = { project_id: number | null; open: number; overdue: number };
export type ProjectInfo = { id: number; name: string; color: string; category: string | null };

export type Counts = { early: number; onTime: number; late: number };
export type Verdict = "early" | "onTime" | "late";

/** Days between due and done: negative = early, 0 = on the day, positive = late. */
export const slip = (r: Pick<DoneRow, "due" | "done_on">) => daysBetween(r.due, r.done_on);
export const verdict = (r: Pick<DoneRow, "due" | "done_on">): Verdict => { const d = slip(r); return d < 0 ? "early" : d === 0 ? "onTime" : "late"; };

const empty = (): Counts => ({ early: 0, onTime: 0, late: 0 });
const bump = (c: Counts, v: Verdict) => { c[v]++; };
const total = (c: Counts) => c.early + c.onTime + c.late;
/** Share finished on time or early (0–100), or null when there is nothing to judge yet. */
export const onTimeRate = (c: Counts) => (total(c) ? Math.round(((c.early + c.onTime) / total(c)) * 100) : null);

export type Timeliness = {
  summary: Counts & { total: number; rate: number | null; avgEarlyDays: number | null; avgLateDays: number | null; worstLateDays: number };
  byWeek: (Counts & { week: string })[];
  byProject: (Counts & ProjectInfo & { open: number; overdue: number })[];
  byCategory: (Counts & { category: string | null; open: number; overdue: number; projects: number })[];
};

const round1 = (n: number) => Math.round(n * 10) / 10;

export function summarize(rows: DoneRow[], open: OpenRow[], projects: ProjectInfo[], today: string, weeks = 8): Timeliness {
  const all = empty();
  const early: number[] = [], late: number[] = [];
  const perProject = new Map<number | null, Counts>();
  const perWeek = new Map<string, Counts>();

  for (const r of rows) {
    const v = verdict(r), d = slip(r);
    bump(all, v);
    if (v === "early") early.push(-d); else if (v === "late") late.push(d);
    const pc = perProject.get(r.project_id) ?? empty(); bump(pc, v); perProject.set(r.project_id, pc);
    const wk = startOfWeek(r.done_on);
    const wc = perWeek.get(wk) ?? empty(); bump(wc, v); perWeek.set(wk, wc);
  }

  const openBy = new Map<number | null, OpenRow>(open.map((o) => [o.project_id, o]));
  const info = new Map(projects.map((p) => [p.id, p]));

  // Last N weeks including quiet ones, oldest first
  const thisWeek = startOfWeek(today);
  const byWeek = Array.from({ length: weeks }, (_, i) => {
    const week = addDays(thisWeek, -7 * (weeks - 1 - i));
    return { week, ...(perWeek.get(week) ?? empty()) };
  });

  const ids = new Set<number | null>([...perProject.keys(), ...openBy.keys()]);
  const byProject = [...ids].map((id) => {
    const p = id == null ? { id: 0, name: "No project", color: "gray", category: null } : info.get(id) ?? { id, name: "Deleted project", color: "gray", category: null };
    const c = perProject.get(id) ?? empty(), o = openBy.get(id);
    return { ...p, ...c, open: o?.open ?? 0, overdue: o?.overdue ?? 0 };
  }).sort((a, b) => total(b) + b.open - (total(a) + a.open) || a.name.localeCompare(b.name));

  // Classification roll-up (work / life / admin / play / not classified)
  const cats = new Map<string | null, Counts & { category: string | null; open: number; overdue: number; projects: number }>();
  for (const p of byProject) {
    const key = p.category ?? null;
    const c = cats.get(key) ?? { category: key, ...empty(), open: 0, overdue: 0, projects: 0 };
    c.early += p.early; c.onTime += p.onTime; c.late += p.late; c.open += p.open; c.overdue += p.overdue; c.projects += 1;
    cats.set(key, c);
  }
  const order = ["work", "life", "admin", "play", null];
  const byCategory = [...cats.values()].sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));

  const avg = (xs: number[]) => (xs.length ? round1(xs.reduce((s, x) => s + x, 0) / xs.length) : null);
  return {
    summary: { ...all, total: total(all), rate: onTimeRate(all), avgEarlyDays: avg(early), avgLateDays: avg(late), worstLateDays: late.length ? Math.max(...late) : 0 },
    byWeek, byProject, byCategory,
  };
}
