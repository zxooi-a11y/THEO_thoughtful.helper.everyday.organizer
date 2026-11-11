// Database access for life events (weddings, trips, interviews…).
import { q } from "./db";
import type { LifeEvent } from "./events";
import { deleteOrphans, linkEventFiles } from "./filesRepo";
import { learnKeywords } from "./repo";

const EVENT_SELECT = `
  SELECT id, title, kind, to_char(start_date, 'YYYY-MM-DD') AS start_date, to_char(end_date, 'YYYY-MM-DD') AS end_date,
         start_time, end_time, location, url, notes, favorite, project_id, created_at,
         COALESCE((SELECT json_agg(json_build_object('id', f.id, 'name', f.name, 'size', f.size, 'mime', f.mime, 'readable', f.chars > 0) ORDER BY f.id)
                   FROM event_files ef JOIN files f ON f.id = ef.file_id WHERE ef.event_id = events.id), '[]') AS files
  FROM events`;

/** Events overlapping [from, to] (either bound optional). */
export function listEvents(opts: { from?: string; to?: string; projectId?: number } = {}) {
  const where: string[] = [];
  const p: unknown[] = [];
  if (opts.to) { p.push(opts.to); where.push(`start_date <= $${p.length}`); }
  if (opts.from) { p.push(opts.from); where.push(`COALESCE(end_date, start_date) >= $${p.length}`); }
  if (opts.projectId) { p.push(opts.projectId); where.push(`project_id = $${p.length}`); }
  return q<LifeEvent>(`${EVENT_SELECT} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY start_date, start_time, id LIMIT 500`, p);
}

export type EventInput = Partial<Omit<LifeEvent, "id" | "created_at" | "files">>;

export async function createEvent(e: EventInput & { title: string; start_date: string; fileIds?: number[] }) {
  const [row] = await q<{ id: number }>(
    `INSERT INTO events (title, kind, start_date, end_date, start_time, end_time, location, url, notes, favorite, project_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
    [e.title, e.kind ?? "other", e.start_date, e.end_date ?? null, e.start_time ?? "", e.end_time ?? "", e.location ?? "", e.url ?? "", e.notes ?? "", e.favorite ?? false, e.project_id ?? null]);
  if (e.fileIds?.length) await linkEventFiles(row.id, e.fileIds);
  if (e.project_id) await learnKeywords(e.title, e.project_id, 1); // filing it teaches THEO
  return row.id;
}

export async function getEvent(id: number) {
  return q<LifeEvent>(`${EVENT_SELECT} WHERE id = $1`, [id]).then((r) => r[0] ?? null);
}

export async function updateEvent(id: number, e: EventInput) {
  const before = "project_id" in e ? await getEvent(id) : null;
  const cols: string[] = [];
  const p: unknown[] = [];
  for (const k of ["title", "kind", "start_date", "end_date", "start_time", "end_time", "location", "url", "notes", "favorite", "project_id"] as const) {
    if (k in e) { p.push(e[k]); cols.push(`${k} = $${p.length}`); }
  }
  if (cols.length) { p.push(id); await q(`UPDATE events SET ${cols.join(", ")} WHERE id = $${p.length}`, p); }
  if (before && e.project_id && e.project_id !== before.project_id) await learnKeywords(e.title ?? before.title, e.project_id, 2, before.project_id);
  return q<LifeEvent>(`${EVENT_SELECT} WHERE id = $1`, [id]).then((r) => r[0] ?? null);
}

export async function deleteEvent(id: number) {
  await q(`DELETE FROM events WHERE id = $1`, [id]);
  await deleteOrphans(24); // files that belonged only to this event
}
