import { createEvent, listEvents } from "@/lib/eventsRepo";
import { detectKind } from "@/lib/events";
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

export const POST = handle(async (req: Request) => {
  const e = cleanEvent(await req.clone().json());
  if (!e.title) return bad("Give the event a name");
  if (!e.start_date) return bad("Pick a date");
  // No type picked → work it out from the title ("Sarah's wedding" → Wedding).
  if (!e.kind) e.kind = detectKind(e.title, `${e.location ?? ""} ${e.notes ?? ""}`);
  const body = await req.clone().json().catch(() => ({}));
  const fileIds = (Array.isArray(body?.fileIds) ? body.fileIds : []).map(Number).filter((n: number) => Number.isInteger(n) && n > 0).slice(0, 10);
  const id = await createEvent({ ...e, title: e.title, start_date: e.start_date, fileIds });
  return ok({ id }, 201);
});
