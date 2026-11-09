import { deleteGoal } from "@/lib/repo";
import { handle, ok } from "@/lib/http";

export const DELETE = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  await deleteGoal(Number((await params).id));
  return ok({ ok: true });
});
