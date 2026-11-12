import { stats } from "@/lib/repo";
import { handle, ok, todayFrom, tzFrom } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  return ok(await stats(todayFrom(sp.get("today")), tzFrom(sp.get("tz"))));
});
