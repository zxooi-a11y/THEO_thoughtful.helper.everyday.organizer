import { ensureProject, listProjects } from "@/lib/repo";
import { bad, handle, ok } from "@/lib/http";
import { COLOR_KEYS } from "@/lib/colors";

export const dynamic = "force-dynamic";

export const GET = handle(async () => ok(await listProjects()));

export const POST = handle(async (req: Request) => {
  const { name, color } = await req.json();
  if (typeof name !== "string" || !name.trim()) return bad("Project name is required");
  const id = await ensureProject(name.slice(0, 60), COLOR_KEYS.includes(color) ? color : "blue");
  return ok({ id }, 201);
});
