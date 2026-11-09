// Shapes shared between API routes and the UI.

export type Project = { id: number; name: string; color: string; open_count?: number; done_count?: number };

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
};

export type Goal = { id: number; title: string; project_id: number | null; created_at: string; total: number; done: number };
