import { analyzeEvents } from "@/lib/brain";
import { classify } from "@/lib/brain/classify";
import { loadBrainContext } from "@/lib/repo";
import { bad, handle, ok, todayFrom } from "@/lib/http";

/** Read pasted event lines and guess each one's project tag from your projects and what THEO has learned. */
export const POST = handle(async (req: Request) => {
  const { text, today, defaultDate } = await req.json();
  if (typeof text !== "string" || !text.trim()) return bad("Add at least one event, one per line.");
  const t = todayFrom(today);
  const ctx = await loadBrainContext();
  const drafts = analyzeEvents(text, t, typeof defaultDate === "string" ? defaultDate : null).map((d) => {
    const c = classify(`${d.title} ${d.location}`, ctx.projects, ctx.learnedKeywords);
    return { ...d, project_id: c.projectId != null && c.confidence >= 0.35 ? c.projectId : null };
  });
  return ok({ drafts });
});
