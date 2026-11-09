// All database access + the "learning" side effects live here.
import { q } from "./db";
import type { BrainContext, LearnedPlan } from "./brain";
import { keywords } from "./brain/text";
import type { Project, Step, Task } from "./types";

const TASK_SELECT = `
  SELECT t.id, t.title, t.notes, t.project_id, t.goal_id, t.tags,
         to_char(t.due_date, 'YYYY-MM-DD') AS due_date, t.due_reason, t.estimate, t.priority,
         t.status, t.archived, t.created_at, t.started_at, t.completed_at,
         COALESCE((SELECT json_agg(json_build_object('id', s.id, 'text', s.text, 'done', s.done) ORDER BY s.position)
                   FROM task_steps s WHERE s.task_id = t.id), '[]') AS steps
  FROM tasks t`;

// ── Projects ─────────────────────────────────────────────────────
export function listProjects() {
  return q<Project>(`
    SELECT p.id, p.name, p.color,
      (SELECT count(*)::int FROM tasks t WHERE t.project_id = p.id AND t.status <> 'done' AND NOT t.archived) AS open_count,
      (SELECT count(*)::int FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') AS done_count
    FROM projects p ORDER BY p.name`);
}

export async function ensureProject(name: string, color = "blue"): Promise<number> {
  const rows = await q<{ id: number }>(
    `INSERT INTO projects (name, color) VALUES ($1, $2)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`, [name.trim(), color]);
  return rows[0].id;
}

// ── Brain context (what THEO has learned) ────────────────────────
export async function loadBrainContext(): Promise<BrainContext> {
  const [projects, kw, plans, leads] = await Promise.all([
    q<{ id: number; name: string }>(`SELECT id, name FROM projects`),
    q<{ keyword: string; project_id: number; weight: number }>(`SELECT keyword, project_id, weight FROM learned_keywords WHERE weight > 0`),
    q<LearnedPlan>(`SELECT kind, key_words, title, steps, uses FROM learned_plans ORDER BY uses DESC, updated_at DESC LIMIT 500`),
    // Median days from "created" to "done" per project, from your last 50 finished tasks there.
    q<{ project_id: number; days: number }>(`
      SELECT project_id, percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM completed_at - created_at) / 86400) AS days
      FROM (SELECT project_id, completed_at, created_at,
                   row_number() OVER (PARTITION BY project_id ORDER BY completed_at DESC) rn
            FROM tasks WHERE status = 'done' AND completed_at IS NOT NULL AND project_id IS NOT NULL AND goal_id IS NULL) x
      WHERE rn <= 50 GROUP BY project_id HAVING count(*) >= 3`),
  ]);
  const learnedKeywords: BrainContext["learnedKeywords"] = {};
  for (const r of kw) (learnedKeywords[r.keyword] ??= {})[r.project_id] = r.weight;
  const leadTimes: Record<number, number> = {};
  for (const r of leads) leadTimes[r.project_id] = Number(r.days);
  return { projects, learnedKeywords, learnedPlans: plans, leadTimes };
}

/** Teach THEO that these words belong to this project (and, optionally, not to another). */
export async function learnKeywords(title: string, projectId: number, delta = 1, fromProjectId?: number | null) {
  const words = keywords(title).slice(0, 12);
  if (!words.length) return;
  await q(
    `INSERT INTO learned_keywords (keyword, project_id, weight)
     SELECT w, $2, $3 FROM unnest($1::text[]) AS w
     ON CONFLICT (keyword, project_id) DO UPDATE SET weight = LEAST(learned_keywords.weight + $3, 20)`,
    [words, projectId, delta]);
  if (fromProjectId && fromProjectId !== projectId) {
    await q(`UPDATE learned_keywords SET weight = GREATEST(weight - $3, -5) WHERE project_id = $2 AND keyword = ANY($1::text[])`,
      [words, fromProjectId, delta]);
  }
}

/** Remember a step list you shaped yourself so similar tasks/goals reuse it. */
export async function learnPlan(kind: "task" | "goal", title: string, steps: unknown[]) {
  const kw = keywords(title);
  if (!kw.length || !steps.length) return;
  const existing = await q<{ id: number }>(
    `SELECT id FROM learned_plans WHERE kind = $1 AND key_words @> $2::text[] AND key_words <@ $2::text[] LIMIT 1`, [kind, kw]);
  if (existing.length) {
    await q(`UPDATE learned_plans SET steps = $2, title = $3, uses = uses + 1, updated_at = now() WHERE id = $1`,
      [existing[0].id, JSON.stringify(steps), title]);
  } else {
    await q(`INSERT INTO learned_plans (kind, key_words, title, steps) VALUES ($1, $2, $3, $4)`, [kind, kw, title, JSON.stringify(steps)]);
  }
}

// ── Tasks ────────────────────────────────────────────────────────
export function getTask(id: number) {
  return q<Task>(`${TASK_SELECT} WHERE t.id = $1`, [id]).then((r) => r[0] ?? null);
}

export function listTasks(opts: { from?: string; to?: string; search?: string; projectId?: number; archived?: boolean; status?: string; goalId?: number }) {
  const where: string[] = [];
  const p: unknown[] = [];
  const add = (cond: string, v: unknown) => { p.push(v); where.push(cond.replace("?", `$${p.length}`)); };
  if (opts.from) add("t.due_date >= ?", opts.from);
  if (opts.to) add("t.due_date <= ?", opts.to);
  if (opts.search) add("(t.title ILIKE ? OR t.notes ILIKE $" + (p.length + 1) + " OR array_to_string(t.tags, ' ') ILIKE $" + (p.length + 1) + ")", `%${opts.search}%`);
  if (opts.projectId) add("t.project_id = ?", opts.projectId);
  if (opts.status) add("t.status = ?", opts.status);
  if (opts.goalId) add("t.goal_id = ?", opts.goalId);
  where.push(opts.archived ? "(t.archived OR t.status = 'done')" : "NOT t.archived");
  return q<Task>(`${TASK_SELECT} WHERE ${where.join(" AND ")} ORDER BY t.due_date NULLS LAST, t.priority, t.id LIMIT 1000`, p);
}

export type NewTask = {
  title: string; notes?: string; projectId: number | null; goalId?: number | null; tags?: string[];
  dueDate: string | null; dueReason?: string; estimate?: string; priority?: number; steps?: string[];
};

export async function createTask(t: NewTask, opts: { learn?: boolean } = {}): Promise<number> {
  const [row] = await q<{ id: number }>(
    `INSERT INTO tasks (title, notes, project_id, goal_id, tags, due_date, due_reason, estimate, priority)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [t.title, t.notes ?? "", t.projectId, t.goalId ?? null, t.tags ?? [], t.dueDate, t.dueReason ?? "", t.estimate ?? "", t.priority ?? 2]);
  const steps = (t.steps ?? []).map((s) => s.trim()).filter(Boolean);
  if (steps.length) {
    await q(`INSERT INTO task_steps (task_id, position, text) SELECT $1, i, s FROM unnest($2::text[]) WITH ORDINALITY AS u(s, i)`, [row.id, steps]);
  }
  if (opts.learn && t.projectId) await learnKeywords(t.title, t.projectId, 1);
  return row.id;
}

export type TaskPatch = Partial<{
  title: string; notes: string; project_id: number | null; tags: string[]; due_date: string | null;
  estimate: string; priority: number; status: Task["status"]; archived: boolean; steps: Step[];
}>;

export async function updateTask(id: number, patch: TaskPatch) {
  const before = await getTask(id);
  if (!before) return null;
  const cols: string[] = [];
  const p: unknown[] = [];
  const set = (col: string, v: unknown) => { p.push(v); cols.push(`${col} = $${p.length}`); };
  for (const k of ["title", "notes", "project_id", "tags", "due_date", "estimate", "priority", "archived"] as const) {
    if (k in patch) set(k, patch[k]);
  }
  if (patch.status && patch.status !== before.status) {
    set("status", patch.status);
    if (patch.status === "doing" && !before.started_at) cols.push("started_at = now()");
    cols.push(patch.status === "done" ? "completed_at = now()" : "completed_at = NULL");
  }
  if (cols.length) { p.push(id); await q(`UPDATE tasks SET ${cols.join(", ")} WHERE id = $${p.length}`, p); }

  if (patch.steps) {
    await q(`DELETE FROM task_steps WHERE task_id = $1`, [id]);
    const s = patch.steps.filter((x) => x.text.trim());
    if (s.length) {
      await q(`INSERT INTO task_steps (task_id, position, text, done)
               SELECT $1, i, t, d FROM unnest($2::text[], $3::bool[]) WITH ORDINALITY AS u(t, d, i)`,
        [id, s.map((x) => x.text.trim()), s.map((x) => !!x.done)]);
    }
    // If you rewrote the step list (not just ticked boxes), remember your version.
    const oldText = before.steps.map((x) => x.text).join("\n");
    const newText = s.map((x) => x.text.trim()).join("\n");
    if (oldText !== newText && !before.goal_id) await learnPlan("task", patch.title ?? before.title, s.map((x) => ({ text: x.text.trim(), estimate: patch.estimate ?? before.estimate })));
  }

  // Re-filed under a different project → strongest learning signal.
  if ("project_id" in patch && patch.project_id && patch.project_id !== before.project_id) {
    await learnKeywords(patch.title ?? before.title, patch.project_id, 2, before.project_id);
  }
  return getTask(id);
}

export function deleteTask(id: number) {
  return q(`DELETE FROM tasks WHERE id = $1`, [id]);
}

// ── Goals ────────────────────────────────────────────────────────
export function listGoals() {
  return q(`
    SELECT g.id, g.title, g.project_id, g.created_at,
      count(t.id)::int AS total, count(t.id) FILTER (WHERE t.status = 'done')::int AS done,
      to_char(min(t.due_date) FILTER (WHERE t.status <> 'done'), 'YYYY-MM-DD') AS next_due
    FROM goals g LEFT JOIN tasks t ON t.goal_id = g.id
    GROUP BY g.id ORDER BY g.created_at DESC`);
}

export async function createGoal(title: string, projectId: number | null) {
  const [g] = await q<{ id: number }>(`INSERT INTO goals (title, project_id) VALUES ($1, $2) RETURNING id`, [title, projectId]);
  return g.id;
}

export function deleteGoal(id: number) {
  return q(`DELETE FROM goals WHERE id = $1`, [id]);
}

// ── Analytics ────────────────────────────────────────────────────
export async function stats(today: string) {
  const [[kpi], perDay, perProject] = await Promise.all([
    q<{ done_week: number; due_week: number; done_month: number; done_prev_month: number; overdue: number; goal_total: number; goal_done: number; open_total: number }>(`
      SELECT
        count(*) FILTER (WHERE status = 'done' AND completed_at >= $1::date - 6)::int AS done_week,
        count(*) FILTER (WHERE due_date BETWEEN $1::date - 6 AND $1::date)::int AS due_week,
        count(*) FILTER (WHERE status = 'done' AND completed_at >= date_trunc('month', $1::date))::int AS done_month,
        count(*) FILTER (WHERE status = 'done' AND completed_at >= date_trunc('month', $1::date) - interval '1 month'
                                             AND completed_at <  date_trunc('month', $1::date))::int AS done_prev_month,
        count(*) FILTER (WHERE status <> 'done' AND NOT archived AND due_date < $1::date)::int AS overdue,
        count(*) FILTER (WHERE goal_id IS NOT NULL)::int AS goal_total,
        count(*) FILTER (WHERE goal_id IS NOT NULL AND status = 'done')::int AS goal_done,
        count(*) FILTER (WHERE status <> 'done' AND NOT archived)::int AS open_total
      FROM tasks`, [today]),
    q<{ day: string; created: number; done: number }>(`
      SELECT to_char(d, 'YYYY-MM-DD') AS day,
        (SELECT count(*)::int FROM tasks WHERE created_at::date = d) AS created,
        (SELECT count(*)::int FROM tasks WHERE completed_at::date = d) AS done
      FROM generate_series($1::date - 29, $1::date, interval '1 day') AS d ORDER BY d`, [today]),
    q<{ name: string; color: string; open: number; done: number }>(`
      SELECT p.name, p.color,
        count(t.id) FILTER (WHERE t.status <> 'done' AND NOT t.archived)::int AS open,
        count(t.id) FILTER (WHERE t.status = 'done')::int AS done
      FROM projects p LEFT JOIN tasks t ON t.project_id = p.id
      GROUP BY p.id ORDER BY count(t.id) DESC, p.name`),
  ]);
  return { kpi, perDay, perProject };
}
