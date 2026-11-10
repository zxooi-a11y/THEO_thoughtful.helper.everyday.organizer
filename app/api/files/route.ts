import { extractText } from "@/lib/extract";
import { buildFileContext } from "@/lib/brain";
import { countTaskFiles, deleteOrphans, linkFiles, MAX_FILE_BYTES, MAX_FILES_PER_TASK, MAX_TOTAL_BYTES, saveFile, storageUsed } from "@/lib/filesRepo";
import { getTask, learnKeywords } from "@/lib/repo";
import { bad, handle, ok, todayFrom } from "@/lib/http";

export const maxDuration = 30;

const cleanName = (n: string) => n.replace(/[\\/\u0000-\u001f]/g, "_").replace(/^\.+/, "").trim().slice(0, 150) || "file";

/**
 * Upload ONE file per request (keeps each request under Vercel's 4.5 MB limit).
 * With `taskId` it is attached to that task and THEO reports what it found in it;
 * without, it's staged (used by the Add tasks window) until the tasks are saved.
 */
export const POST = handle(async (req: Request) => {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_FILE_BYTES + 64 * 1024) return bad(`That file is too big. The limit is ${MAX_FILE_BYTES / 1024 / 1024} MB per file.`, 413);

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return bad("No file received");
  if (file.size === 0) return bad("That file is empty");
  if (file.size > MAX_FILE_BYTES) return bad(`“${file.name}” is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_FILE_BYTES / 1024 / 1024} MB per file.`, 413);
  if ((await storageUsed()) + file.size > MAX_TOTAL_BYTES) return bad("File storage is nearly full (free database limit). Delete some old files first.", 507);

  const taskId = Number(form.get("taskId")) || null;
  const today = todayFrom(form.get("today"));
  if (taskId) {
    if (!(await getTask(taskId))) return bad("Task not found", 404);
    if ((await countTaskFiles(taskId)) >= MAX_FILES_PER_TASK) return bad(`A task can have up to ${MAX_FILES_PER_TASK} files.`);
  }

  const name = cleanName(file.name);
  const buf = Buffer.from(await file.arrayBuffer());
  const text = await extractText(name, file.type, buf);
  const meta = await saveFile({ name, mime: file.type || "application/octet-stream", buf, text });
  deleteOrphans(24).catch(() => {}); // tidy up abandoned uploads (best effort)

  if (!taskId) return ok({ file: meta }, 201);

  await linkFiles(taskId, [meta.id]);
  let task = await getTask(taskId);
  // Files you attach teach THEO what this project is about.
  const ctx = text ? buildFileContext([{ name, text }], today) : null;
  if (task?.project_id && ctx?.keywords.length) await learnKeywords(ctx.keywords.slice(0, 8).join(" "), task.project_id, 0.5);

  // Suggestions the person can accept with one tap — never applied silently.
  const insights = ctx && task ? {
    deadline: ctx.deadline && ctx.deadline.date !== task.due_date ? ctx.deadline : null,
    checklist: ctx.checklist.length && !task.steps.length ? ctx.checklist : [],
    checklistFile: ctx.checklistFile,
  } : { deadline: null, checklist: [], checklistFile: "" };
  task = await getTask(taskId);
  return ok({ file: meta, task, insights }, 201);
});

