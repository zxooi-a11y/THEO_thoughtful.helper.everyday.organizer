// Where a task's dates land when it is finished on a given day. Pure, so it is easy to test.
export type Dates = { due_date: string | null; original_due: string | null };

/** The finished day becomes the task's date; the date it was really due is kept (and cleared if they match). */
export function finishDates(t: Dates, day: string): Dates {
  const due = t.original_due ?? t.due_date;
  return { due_date: day, original_due: due && due !== day ? due : null };
}
