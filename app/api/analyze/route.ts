import { analyzeTask, splitBulk } from "@/lib/brain";
import { loadBrainContext } from "@/lib/repo";
import { bad, handle, ok, todayFrom } from "@/lib/http";

// Turn a pasted list into task drafts (nothing is saved yet — you review first).
export const POST = handle(async (req: Request) => {
  const { text, today, brief } = await req.json();
  if (typeof text !== "string" || !text.trim()) return bad("Paste or type at least one task");
  const lines = splitBulk(text).slice(0, 200);
  const ctx = await loadBrainContext();
  const t = todayFrom(today);
  return ok({ drafts: lines.map((l) => analyzeTask(l, t, ctx, typeof brief === "string" ? brief.slice(0, 2000) : "")) });
});
