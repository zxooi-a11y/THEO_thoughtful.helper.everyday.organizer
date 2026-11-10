import { deleteIfOrphan, deleteOrphans, getFileData, unlinkFile } from "@/lib/filesRepo";
import { bad, handle, ok } from "@/lib/http";
import { getTask } from "@/lib/repo";

type Ctx = { params: Promise<{ id: string }> };

// Only types that are safe to display in the browser open inline; everything else downloads.
const INLINE = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf"]);

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return bad("File not found", 404);
  const f = await getFileData(id);
  if (!f) return bad("File not found", 404);
  const inline = INLINE.has(f.mime);
  const ascii = f.name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return new Response(new Uint8Array(f.buf), {
    headers: {
      "content-type": inline ? f.mime : "application/octet-stream",
      "content-length": String(f.buf.length),
      "content-disposition": `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(f.name)}`,
      "x-content-type-options": "nosniff",
      "content-security-policy": "sandbox",
      "cache-control": "private, max-age=3600",
    },
  });
});

/** `?taskId=` detaches the file from that task (and deletes it if nothing else uses it); without it, removes a staged upload. */
export const DELETE = handle(async (req: Request, { params }: Ctx) => {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return bad("File not found", 404);
  const taskId = Number(new URL(req.url).searchParams.get("taskId")) || null;
  if (taskId) await unlinkFile(taskId, id);
  await deleteIfOrphan(id);
  if (taskId) return ok({ task: await getTask(taskId) });
  await deleteOrphans(24);
  return ok({ ok: true });
});
