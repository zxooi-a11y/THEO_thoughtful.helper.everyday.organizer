// What the calendar's Day view shows. Pure, so it is easy to test.
import type { Task } from "./types";

/**
 * Open (not finished) tasks that belong on `day`:
 *  • a task with a start date is hidden until that date;
 *  • looking back (before today) you see what was due that day;
 *  • today and later: everything still open up to its due date, so a task due on Friday is already
 *    there today. Overdue tasks, and tasks with no date at all, stay on today instead of getting
 *    stuck on a day that has passed.
 */
export function openTasksOnDay(open: Task[], day: string, today: string): Task[] {
  return open.filter((t) => {
    if (t.status === "done" || t.archived) return false;
    if (t.start_date && t.start_date > day) return false;          // hasn't started yet
    if (day < today) return t.due_date === day;                    // looking back: what was due that day
    if (!t.due_date) return day === today;                         // undated tasks live on today
    return day <= t.due_date || day === today;                     // until due; overdue ones stay on today
  });
}

/** Finished tasks that were completed on `day` (finishing moves a task's date to the day it was done). */
export function doneTasksOnDay(tasks: Task[], day: string): Task[] {
  return tasks.filter((t) => t.status === "done" && t.due_date === day);
}

/** Overdue first (oldest first), then due soonest, undated last; high priority first within a day. */
export function sortForDay(list: Task[]): Task[] {
  return [...list].sort((a, b) => {
    const da = a.due_date ?? "9999-12-31", db = b.due_date ?? "9999-12-31";
    return da.localeCompare(db) || a.priority - b.priority || a.id - b.id;
  });
}
