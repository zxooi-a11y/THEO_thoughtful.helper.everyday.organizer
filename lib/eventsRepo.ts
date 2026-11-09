// Database access for life events (weddings, trips, interviews…).
import { q } from "./db";
import type { LifeEvent } from "./events";

const EVENT_SELECT = `
  SELECT id, title, kind, to_char(start_date, 'YYYY-MM-DD') AS start_date, to_char(end_date, 'YYYY-MM-DD') AS end_date,
         start_time, location, url, notes, favorite, created_at
  FROM events`;

/** Events overlapping [from, to] (either bound optional). */
export function listEvents(opts: { from?: string; to?: string } = {}) {
  const where: string[] = [];
  const p: unknown[] = [];
  if (opts.to) { p.push(opts.to); where.push(`start_date <= $${p.length}`); }
  if (opts.from) { p.push(opts.from); where.push(`COALESCE(end_date, start_date) >= $${p.length}`); }
  return q<LifeEvent>(`${EVENT_SELECT} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY start_date, start_time, id LIMIT 500`, p);
}

export type EventInput = Partial<Omit<LifeEvent, "id" | "created_at">>;

export async function createEvent(e: EventInput & { title: string; start_date: string }) {
  const [row] = await q<{ id: number }>(
    `INSERT INTO events (title, kind, start_date, end_date, start_time, location, url, notes, favorite)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [e.title, e.kind ?? "other", e.start_date, e.end_date ?? null, e.start_time ?? "", e.location ?? "", e.url ?? "", e.notes ?? "", e.favorite ?? false]);
  return row.id;
}

export async function updateEvent(id: number, e: EventInput) {
  const cols: string[] = [];
  const p: unknown[] = [];
  for (const k of ["title", "kind", "start_date", "end_date", "start_time", "location", "url", "notes", "favorite"] as const) {
    if (k in e) { p.push(e[k]); cols.push(`${k} = $${p.length}`); }
  }
  if (cols.length) { p.push(id); await q(`UPDATE events SET ${cols.join(", ")} WHERE id = $${p.length}`, p); }
  return q<LifeEvent>(`${EVENT_SELECT} WHERE id = $1`, [id]).then((r) => r[0] ?? null);
}

export function deleteEvent(id: number) {
  return q(`DELETE FROM events WHERE id = $1`, [id]);
}
