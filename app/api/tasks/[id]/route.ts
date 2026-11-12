import { deleteTask, updateTask, type TaskPatch } from "@/lib/repo";
import { bad, handle, isISODate, ok } from "@/lib/http";
import { normalizeWebUrl } from "@/lib/links";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const id = Number((await params).id);
  const b = await req.json();
  const patch: TaskPatch = {};
  if (typeof b.title === "string" && b.title.trim()) patch.title = b.title.trim().slice(0, 200);
  if (typeof b.notes === "string") patch.notes = b.notes.slice(0, 5000);
  if ("final_url" in b) {
    const link = normalizeWebUrl(String(b.final_url ?? ""));
    if (link === null) return bad("That doesn't look like a web link. Use something like https://example.com/my-work");
    patch.final_url = link;
  }
  if (typeof b.final_note === "string") patch.final_note = b.final_note.trim().slice(0, 300);
  if ("start_date" in b) patch.start_date = isISODate(b.start_date) ? b.start_date : null;
  if (isISODate(b.today)) patch.today = b.today;
  if ("project_id" in b) patch.project_id = b.project_id ? Number(b.project_id) : null;
  if (Array.isArray(b.tags)) patch.tags = b.tags.map(String).slice(0, 10);
  if ("due_date" in b) patch.due_date = isISODate(b.due_date) ? b.due_date : null;
  if (typeof b.estimate === "string") patch.estimate = b.estimate.slice(0, 40);
  if ([1, 2, 3].includes(b.priority)) patch.priority = b.priority;
  if (["todo", "doing", "later", "done"].includes(b.status)) patch.status = b.status;
  if (typeof b.archived === "boolean") patch.archived = b.archived;
  if (Array.isArray(b.steps)) patch.steps = b.steps.slice(0, 30).map((s: { text?: string; done?: boolean }) => ({ text: String(s.text ?? ""), done: !!s.done }));
  const task = await updateTask(id, patch);
  return task ? ok(task) : bad("Task not found", 404);
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  await deleteTask(Number((await params).id));
  return ok({ ok: true });
});
