import { createGoal, createTask, ensureProject, learnPlan, listGoals } from "@/lib/repo";
import { daysBetween } from "@/lib/brain/dates";
import { bad, handle, isISODate, ok, todayFrom } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = handle(async () => ok(await listGoals()));

type InTask = { title: string; dueDate: string; estimate?: string; steps?: string[] };

// Accept a plan: creates the goal, a project if needed, and one task per step.
export const POST = handle(async (req: Request) => {
  const { goal, projectName, tasks, edited, today } = await req.json();
  if (typeof goal !== "string" || !goal.trim()) return bad("Goal title missing");
  const list: InTask[] = (Array.isArray(tasks) ? tasks : []).filter((x: InTask) => x?.title?.trim()).slice(0, 40);
  if (!list.length) return bad("The plan has no steps");
  const t = todayFrom(today);
  const projectId = await ensureProject(String(projectName || "Goals").slice(0, 60), "indigo");
  const goalId = await createGoal(goal.trim().slice(0, 200), projectId);
  for (const x of list) {
    await createTask({
      title: x.title.trim().slice(0, 200), projectId, goalId,
      dueDate: isISODate(x.dueDate) ? x.dueDate : null, dueReason: `Step of “${goal.trim()}”`,
      estimate: x.estimate ?? "", steps: (x.steps ?? []).map(String).filter(Boolean),
      tags: ["goal"],
    });
  }
  // You changed THEO's suggestion → remember your version for next time.
  if (edited) {
    await learnPlan("goal", goal, list.map((x) => ({
      text: x.title.trim(), offsetDays: isISODate(x.dueDate) ? Math.max(0, daysBetween(t, x.dueDate)) : 0,
      estimate: x.estimate ?? "", steps: x.steps ?? [],
    })));
  }
  return ok({ id: goalId }, 201);
});
