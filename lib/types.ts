// Shapes shared between API routes and the UI.

export type Project = { id: number; name: string; color: string; open_count?: number; done_count?: number; event_count?: number };

export type FileMeta = { id: number; name: string; mime: string; size: number; readable: boolean };

export type Step = { id?: number; text: string; done: boolean };

export type Task = {
  id: number;
  title: string;
  notes: string;
  project_id: number | null;
  goal_id: number | null;
  tags: string[];
  due_date: string | null; // YYYY-MM-DD
  due_reason: string;
  estimate: string;
  priority: 1 | 2 | 3;
  status: "todo" | "doing" | "later" | "done";
  archived: boolean;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  steps: Step[];
  files: FileMeta[];
  /** Optional: the Day view hides the task until this date. */
  start_date: string | null;
  /** Set when finishing moved the task to the day it was done: the date it was originally due. */
  original_due: string | null;
  /** Link to the finished work, and what it is. Empty until added. */
  final_url: string;
  final_note: string;
};

export type Goal = { id: number; title: string; project_id: number | null; created_at: string; total: number; done: number };
