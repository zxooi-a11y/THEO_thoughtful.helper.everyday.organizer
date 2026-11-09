import { stats } from "@/lib/repo";
import { handle, ok, todayFrom } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => ok(await stats(todayFrom(new URL(req.url).searchParams.get("today")))));
