import { ensureProject, listProjects } from "@/lib/repo";
import { bad, handle, ok } from "@/lib/http";
import { COLOR_KEYS, normalizeColor } from "@/lib/colors";

export const dynamic = "force-dynamic";

export const GET = handle(async () => ok(await listProjects()));

export const POST = handle(async (req: Request) => {
  const { name, color } = await req.json();
  if (typeof name !== "string" || !name.trim()) return bad("Project name is required");
  const clean = name.trim().slice(0, 60);
  const c = normalizeColor(color) ?? COLOR_KEYS[Math.floor(Math.random() * (COLOR_KEYS.length - 1))];
  const id = await ensureProject(clean, c);
  const p = (await listProjects()).find((x) => x.id === id);
  return ok(p ?? { id, name: clean, color: c }, 201);
});
