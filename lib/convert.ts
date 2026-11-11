// Turn a task into an event (or back) without losing its project tag, files or details.
import { q } from "./db";
import { detectKind, timeRange } from "./events";
import { createEvent, getEvent } from "./eventsRepo";
import { createTask, getTask } from "./repo";
import { deleteOrphans } from "./filesRepo";

/** Task → event: due date becomes the event date; steps and notes go into the description. */
export async function taskToEvent(taskId: number, today: string): Promise<number | null> {
  const t = await getTask(taskId);
  if (!t) return null;
  const description = [
    t.notes.trim(),
    t.steps.length ? t.steps.map((s) => `${s.done ? "[x]" : "[ ]"} ${s.text}`).join("\n") : "",
    t.final_note.trim(),
  ].filter(Boolean).join("\n\n");
  const id = await createEvent({
    title: t.title, kind: detectKind(t.title), start_date: t.due_date ?? today,
    notes: description, url: t.final_url, project_id: t.project_id,
  });
  await q(`INSERT INTO event_files (event_id, file_id) SELECT $1, file_id FROM task_files WHERE task_id = $2 ON CONFLICT DO NOTHING`, [id, taskId]);
  await q(`DELETE FROM tasks WHERE id = $1`, [taskId]);
  await deleteOrphans(24);
  return id;
}

/** Event → task: the event date becomes the due date; place, time and link go into the notes. */
export async function eventToTask(eventId: number): Promise<number | null> {
  const e = await getEvent(eventId);
  if (!e) return null;
  const when = timeRange(e);
  const notes = [
    e.notes.trim(),
    e.location ? `Location: ${e.location}` : "",
    when ? `Time: ${when}` : "",
    e.url ? `Link: ${e.url}` : "",
  ].filter(Boolean).join("\n");
  const id = await createTask({
    title: e.title, notes, projectId: e.project_id, dueDate: e.start_date,
    dueReason: "Converted from an event", priority: 2, tags: [],
  });
  await q(`INSERT INTO task_files (task_id, file_id) SELECT $1, file_id FROM event_files WHERE event_id = $2 ON CONFLICT DO NOTHING`, [id, eventId]);
  await q(`DELETE FROM events WHERE id = $1`, [eventId]);
  await deleteOrphans(24);
  return id;
}
