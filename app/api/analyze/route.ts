import { analyzeEvent, analyzeTask, guessEntryType, splitBulk } from "@/lib/brain";
import { loadBrainContext } from "@/lib/repo";
import { fileContextFor } from "@/lib/filesRepo";
import { bad, handle, ok, todayFrom } from "@/lib/http";

// Turn a pasted list into task drafts (nothing is saved yet — you review first).
export const POST = handle(async (req: Request) => {
  const { text, today, brief, fileIds, useChecklist } = await req.json();
  if (typeof text !== "string" || !text.trim()) return bad("Paste or type at least one task");
  const lines = splitBulk(text).slice(0, 200);
  const ctx = await loadBrainContext();
  const t = todayFrom(today);
  const ids = (Array.isArray(fileIds) ? fileIds : []).map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 10);
  const files = await fileContextFor(ids, t);
  const b = typeof brief === "string" ? brief.slice(0, 2000) : "";
  return ok({
    drafts: lines.map((l) => analyzeTask(l, t, ctx, b, { files, useChecklist: !!useChecklist && lines.length === 1 })),
    // Every line can be a task or an event: THEO guesses which, and prepares the event version too.
    entries: lines.map((l) => ({ type: guessEntryType(l), event: analyzeEvent(l, t) })),
    // Tell the UI what THEO picked up from the files, so it can say so.
    fileHints: files ? { deadline: files.deadline, urgent: files.urgent, checklist: files.checklist.length } : null,
  });
});
