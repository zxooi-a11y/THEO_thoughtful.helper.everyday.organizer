import { deleteEvent, updateEvent } from "@/lib/eventsRepo";
import { bad, handle, ok } from "@/lib/http";
import { endTimeProblem } from "@/lib/events";
import { cleanEvent } from "../clean";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const e = cleanEvent(await req.json());
  if ("title" in e && !e.title) return bad("Give the event a name");
  // Only checkable when the form sends both times (a favourite toggle sends neither).
  if ("start_time" in e && "end_time" in e) {
    const issue = endTimeProblem(e.start_time ?? "", e.end_time ?? "", e.end_date);
    if (issue) return bad(issue);
  }
  const ev = await updateEvent(Number((await params).id), e);
  return ev ? ok(ev) : bad("Event not found", 404);
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  await deleteEvent(Number((await params).id));
  return ok({ ok: true });
});
