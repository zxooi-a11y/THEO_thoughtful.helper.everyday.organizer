import { createTask, listTasks } from "@/lib/repo";
import { bad, handle, isISODate, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  const u = new URL(req.url).searchParams;
  const tasks = await listTasks({
    from: isISODate(u.get("from")) ? u.get("from")! : undefined,
    to: isISODate(u.get("to")) ? u.get("to")! : undefined,
    search: u.get("q")?.slice(0, 100) || undefined,
    projectId: Number(u.get("project")) || undefined,
    goalId: Number(u.get("goal")) || undefined,
    status: ["todo", "doing", "later", "done"].includes(u.get("status") ?? "") ? u.get("status")! : undefined,
    archived: u.get("archived") === "1",
  });
  return ok(tasks);
});

type Incoming = { title?: string; projectId?: number | null; tags?: string[]; dueDate?: string | null; dueReason?: string; estimate?: string; priority?: number; steps?: string[]; notes?: string };

// Save one or many tasks (bulk add). Every saved task also teaches THEO its project.
export const POST = handle(async (req: Request) => {
  const body = await req.json();
  const list: Incoming[] = Array.isArray(body?.tasks) ? body.tasks : [body];
  const ids: number[] = [];
  for (const t of list.slice(0, 200)) {
    if (!t.title?.trim()) continue;
    ids.push(await createTask({
      title: t.title.trim().slice(0, 200),
      notes: (t.notes ?? "").slice(0, 5000),
      projectId: t.projectId ?? null,
      tags: (t.tags ?? []).map(String).slice(0, 10),
      dueDate: isISODate(t.dueDate) ? t.dueDate : null,
      dueReason: t.dueReason ?? "",
      estimate: t.estimate ?? "",
      priority: [1, 2, 3].includes(Number(t.priority)) ? Number(t.priority) : 2,
      steps: (t.steps ?? []).map(String).slice(0, 30),
    }, { learn: true }));
  }
  if (!ids.length) return bad("No valid tasks to save");
  return ok({ ids }, 201);
});
