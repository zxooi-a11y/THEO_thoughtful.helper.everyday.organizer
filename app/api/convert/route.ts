import { eventToTask, taskToEvent } from "@/lib/convert";
import { bad, handle, ok, todayFrom } from "@/lib/http";

/** Switch an entry between task and event: { from: "task" | "event", id, today }. */
export const POST = handle(async (req: Request) => {
  const { from, id, today } = await req.json();
  const n = Number(id);
  if (!Number.isInteger(n) || n < 1) return bad("Missing entry");
  if (from === "task") {
    const eventId = await taskToEvent(n, todayFrom(today));
    return eventId ? ok({ to: "event", id: eventId }) : bad("Task not found", 404);
  }
  if (from === "event") {
    const taskId = await eventToTask(n);
    return taskId ? ok({ to: "task", id: taskId }) : bad("Event not found", 404);
  }
  return bad("Say whether it is a task or an event");
});
