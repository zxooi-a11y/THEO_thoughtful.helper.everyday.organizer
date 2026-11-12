import { deleteProject, updateProject } from "@/lib/repo";
import { bad, handle, ok } from "@/lib/http";
import { normalizeColor } from "@/lib/colors";
import { normalizeCategory } from "@/lib/categories";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const { name, color, category } = await req.json();
  const patch: { name?: string; color?: string; category?: string | null } = {};
  if (typeof name === "string" && name.trim()) patch.name = name.trim().slice(0, 60);
  const c = color === undefined ? null : normalizeColor(color);
  if (color !== undefined && c === null) return bad("That colour isn't valid. Pick one from the palette or use a hex colour like #3b82f6");
  if (c) patch.color = c;
  if (category !== undefined) {
    // "" or null removes the classification; otherwise it must be one of the four
    const cat = category === null || category === "" ? null : normalizeCategory(category);
    if (category !== null && category !== "" && !cat) return bad("Classification must be work, life, admin or play");
    patch.category = cat;
  }
  try {
    const p = await updateProject(Number((await params).id), patch);
    return p ? ok(p) : bad("Project not found", 404);
  } catch (e) {
    if (String((e as Error).message).includes("duplicate")) return bad("You already have a project with that name");
    throw e;
  }
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  await deleteProject(Number((await params).id));
  return ok({ ok: true });
});
