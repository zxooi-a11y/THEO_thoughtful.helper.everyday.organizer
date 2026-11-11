import type { EventInput } from "@/lib/eventsRepo";
import { EVENT_KINDS } from "@/lib/events";
import { isISODate } from "@/lib/http";

/** Validate/trim an incoming event body; only keys that were sent are returned. */
export function cleanEvent(b: Record<string, unknown>): EventInput {
  const e: EventInput = {};
  const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
  if ("title" in b) e.title = str(b.title, 160);
  if ("kind" in b && EVENT_KINDS.some((k) => k.key === b.kind)) e.kind = String(b.kind);
  if ("start_date" in b && isISODate(b.start_date)) e.start_date = b.start_date;
  if ("end_date" in b) e.end_date = isISODate(b.end_date) ? b.end_date : null;
  if (e.start_date && e.end_date && e.end_date <= e.start_date) e.end_date = null;
  const validTime = (v: unknown) => (/^([01]?\d|2[0-3]):[0-5]\d$/.test(String(v)) ? String(v).padStart(5, "0") : "");
  if ("start_time" in b) e.start_time = validTime(b.start_time);
  if ("end_time" in b) e.end_time = validTime(b.end_time);
  if ("location" in b) e.location = str(b.location, 200);
  if ("url" in b) {
    const u = str(b.url, 500);
    e.url = !u || /^https?:\/\//i.test(u) ? u : `https://${u}`;
  }
  if ("notes" in b) e.notes = str(b.notes, 5000);
  if ("favorite" in b) e.favorite = !!b.favorite;
  if ("project_id" in b) e.project_id = Number(b.project_id) > 0 ? Number(b.project_id) : null;
  return e;
}
