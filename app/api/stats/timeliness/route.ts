import { timeliness } from "@/lib/repo";
import { handle, ok, todayFrom, tzFrom } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  return ok(await timeliness(todayFrom(sp.get("today")), tzFrom(sp.get("tz"))));
});
