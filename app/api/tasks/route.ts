import { createTask, learnKeywords, listTasks, recordFeedback, type Feedback } from "@/lib/repo";
import { fileContextFor } from "@/lib/filesRepo";
import { bad, handle, isISODate, ok, todayFrom } from "@/lib/http";

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
    open: u.get("open") === "1",
    archived: u.get("archived") === "1",
  });
  return ok(tasks);
});

type Incoming = { title?: string; projectId?: number | null; tags?: string[]; dueDate?: string | null; dueReason?: string; estimate?: string; priority?: number; steps?: string[]; notes?: string; fileIds?: number[];
  feedback?: { vote?: string | null; aspects?: string[]; suggested?: { projectId?: number | null; dueDate?: string | null; steps?: string[] } } };

// Save one or many tasks (bulk add). Every saved task also teaches THEO its project.
export const POST = handle(async (req: Request) => {
  const body = await req.json();
  const list: Incoming[] = Array.isArray(body?.tasks) ? body.tasks : [body];
  const today = todayFrom(body?.today);
  const brief = typeof body?.brief === "string" ? body.brief.trim().slice(0, 2000) : "";
  const ids: number[] = [];
  const allFileIds = new Set<number>();
  const projectsWithFiles = new Set<number>();
  for (const t of list.slice(0, 200)) {
    if (!t.title?.trim()) continue;
    const title = t.title.trim().slice(0, 200);
    const projectId = t.projectId ?? null;
    const dueDate = isISODate(t.dueDate) ? t.dueDate : null;
    const steps = (t.steps ?? []).map(String).slice(0, 30);
    const notes = [(t.notes ?? "").trim(), brief ? `Brief: ${brief}` : ""].filter(Boolean).join("\n\n").slice(0, 5000);
    const fileIds = (t.fileIds ?? []).map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 10);
    fileIds.forEach((f) => allFileIds.add(f));
    const id = await createTask({
      title, notes, projectId, dueDate, steps, fileIds,
      tags: (t.tags ?? []).map(String).slice(0, 10),
      dueReason: t.dueReason ?? "",
      estimate: t.estimate ?? "",
      priority: [1, 2, 3].includes(Number(t.priority)) ? Number(t.priority) : 2,
    }, { learn: true });
    ids.push(id);
    if (fileIds.length && projectId) projectsWithFiles.add(projectId);

    // Your 👍/👎 and corrections on THEO's suggestion → learning.
    if (t.feedback?.suggested) {
      const f = t.feedback, sug = f.suggested!;
      const fb: Feedback = {
        vote: f.vote === "up" || f.vote === "down" ? f.vote : null,
        aspects: (f.aspects ?? []).filter((a) => ["project", "due", "steps", "title"].includes(a)),
        brief,
        suggested: { projectId: sug.projectId ?? null, dueDate: isISODate(sug.dueDate) ? sug.dueDate : null, steps: (sug.steps ?? []).map(String) },
      };
      await recordFeedback(id, title, { projectId, dueDate, steps }, fb, today);
    }
  }
  // Files saved with a task teach THEO what its project is about (gently).
  if (projectsWithFiles.size) {
    const ctx = await fileContextFor([...allFileIds], today);
    const words = ctx?.keywords.slice(0, 8).join(" ");
    if (words) for (const pid of projectsWithFiles) await learnKeywords(words, pid, 0.5);
  }
  if (!ids.length) return bad("No valid tasks to save");
  return ok({ ids }, 201);
});
