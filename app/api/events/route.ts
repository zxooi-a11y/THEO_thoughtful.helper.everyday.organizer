import { createEvent, listEvents } from "@/lib/eventsRepo";
import { detectKind, endTimeProblem } from "@/lib/events";
import { bad, handle, isISODate, ok } from "@/lib/http";
import { cleanEvent } from "./clean";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  const u = new URL(req.url).searchParams;
  return ok(await listEvents({
    from: isISODate(u.get("from")) ? u.get("from")! : undefined,
    to: isISODate(u.get("to")) ? u.get("to")! : undefined,
  }));
});

/** Validate one incoming event; returns the cleaned event or an error message. */
function prepare(raw: Record<string, unknown>, label: string) {
  const e = cleanEvent(raw);
  if (!e.title) return { error: `${label}Give the event a name` };
  if (!e.start_date) return { error: `${label}Pick a date` };
  const timeIssue = endTimeProblem(e.start_time ?? "", e.end_time ?? "", e.end_date);
  if (timeIssue) return { error: `${label}${timeIssue}` };
  // No type picked → work it out from the title ("Sarah's wedding" → Wedding).
  if (!e.kind) e.kind = detectKind(e.title, `${e.location ?? ""} ${e.notes ?? ""}`);
  return { event: { ...e, title: e.title, start_date: e.start_date } };
}

export const POST = handle(async (req: Request) => {
  const body = await req.json().catch(() => ({}));

  // Batch: { events: [...] }. Every event is checked first, so a mistake in one saves nothing.
  if (Array.isArray(body?.events)) {
    const list = (body.events as Record<string, unknown>[]).slice(0, 100);
    if (!list.length) return bad("There are no events to save");
    const ready = [];
    for (let i = 0; i < list.length; i++) {
      const r = prepare(list[i] ?? {}, list.length > 1 ? `Event ${i + 1}: ` : "");
      if (r.error) return bad(r.error);
      ready.push(r.event!);
    }
    const ids: number[] = [];
    for (const ev of ready) ids.push(await createEvent(ev));
    return ok({ ids }, 201);
  }

  // Single event (optionally with staged files)
  const r = prepare(body ?? {}, "");
  if (r.error) return bad(r.error);
  const fileIds = (Array.isArray(body?.fileIds) ? body.fileIds : []).map(Number).filter((n: number) => Number.isInteger(n) && n > 0).slice(0, 10);
  const id = await createEvent({ ...r.event!, fileIds });
  return ok({ id }, 201);
});
