// Database access for attached files. Binary data goes in/out as base64 text, so it works
// identically over Neon's HTTP driver and can't be mangled by driver type conversions.
import { q } from "./db";
import { buildFileContext, type FileContext } from "./brain/files";
import type { FileMeta } from "./types";

export const MAX_FILE_BYTES = 4 * 1024 * 1024;          // Vercel's request limit is 4.5 MB
export const MAX_TOTAL_BYTES = 350 * 1024 * 1024;       // keep well inside Neon's free 0.5 GB
export const MAX_FILES_PER_TASK = 10;

export async function storageUsed(): Promise<number> {
  const [r] = await q<{ used: string }>(`SELECT COALESCE(sum(size), 0)::bigint AS used FROM files`);
  return Number(r.used);
}

export async function saveFile(f: { name: string; mime: string; buf: Buffer; text: string }): Promise<FileMeta> {
  const [row] = await q<{ id: number }>(
    `INSERT INTO files (name, mime, size, data, extracted_text, chars)
     VALUES ($1, $2, $3, decode($4, 'base64'), $5, $6) RETURNING id`,
    [f.name, f.mime, f.buf.length, f.buf.toString("base64"), f.text, f.text.length]);
  return { id: row.id, name: f.name, mime: f.mime, size: f.buf.length, readable: f.text.length > 0 };
}

export async function getFileData(id: number) {
  const [r] = await q<{ name: string; mime: string; b64: string }>(
    `SELECT name, mime, encode(data, 'base64') AS b64 FROM files WHERE id = $1`, [id]);
  return r ? { name: r.name, mime: r.mime, buf: Buffer.from(r.b64, "base64") } : null;
}

export function getFileMetas(ids: number[]) {
  if (!ids.length) return Promise.resolve([] as FileMeta[]);
  return q<FileMeta>(
    `SELECT id, name, mime, size, chars > 0 AS readable FROM files WHERE id = ANY($1::int[]) ORDER BY id`, [ids]);
}

/** What THEO learns from these files (keywords, deadline, urgency, checklist). */
export async function fileContextFor(ids: number[], today: string): Promise<FileContext | null> {
  if (!ids.length) return null;
  const docs = await q<{ name: string; text: string }>(
    `SELECT name, extracted_text AS text FROM files WHERE id = ANY($1::int[]) ORDER BY id`, [ids.slice(0, 20)]);
  return buildFileContext(docs, today);
}

export async function linkFiles(taskId: number, fileIds: number[]) {
  if (!fileIds.length) return;
  await q(`INSERT INTO task_files (task_id, file_id) SELECT $1, f.id FROM files f WHERE f.id = ANY($2::int[]) ON CONFLICT DO NOTHING`, [taskId, fileIds]);
}

export async function countTaskFiles(taskId: number): Promise<number> {
  const [r] = await q<{ n: number }>(`SELECT count(*)::int AS n FROM task_files WHERE task_id = $1`, [taskId]);
  return r.n;
}

export function unlinkFile(taskId: number, fileId: number) {
  return q(`DELETE FROM task_files WHERE task_id = $1 AND file_id = $2`, [taskId, fileId]);
}

/** Remove files nothing points to. `graceHours` protects files that were just uploaded and are still being staged. */
export function deleteOrphans(graceHours = 0) {
  return q(`DELETE FROM files WHERE NOT EXISTS (SELECT 1 FROM task_files tf WHERE tf.file_id = files.id)
            AND created_at < now() - ($1::int * interval '1 hour')`, [graceHours]);
}

/** Delete a staged file only if it isn't attached to anything. */
export function deleteIfOrphan(id: number) {
  return q(`DELETE FROM files WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM task_files WHERE file_id = $1)`, [id]);
}
