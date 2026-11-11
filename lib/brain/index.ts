// THEO's brain: turns a messy line of text into a fully-formed task draft.
// 100% local & free — no API calls. Learns via the `ctx` data loaded from Neon.

import { classify, type LearnedKeywords, type ProjectRef } from "./classify.ts";
import { addDays, parseDue } from "./dates.ts";
import { suggestSteps, type LearnedPlan } from "./steps.ts";
import { tidyTitle } from "./text.ts";
export { splitBulk } from "./text.ts";
export { analyzeEvent, analyzeEvents } from "./events.ts";
export type { EventDraft } from "./events.ts";
import type { FileContext } from "./files.ts";

export { planGoal } from "./goals.ts";
export type { GoalPlan, PlannedTask } from "./goals.ts";
export type { LearnedPlan, PlanStep } from "./steps.ts";
export type { LearnedKeywords, ProjectRef } from "./classify.ts";
export { buildFileContext, buildEventHints } from "./files.ts";
export type { FileContext, FileDoc, EventHints } from "./files.ts";

export type BrainContext = {
  projects: ProjectRef[];
  learnedKeywords: LearnedKeywords;
  learnedPlans: LearnedPlan[];
  /** projectId → your typical days from creating to finishing a task there */
  leadTimes: Record<number, number>;
};

export type TaskDraft = {
  title: string;
  projectId: number | null;
  projectName: string | null;
  confidence: number;
  tags: string[];
  priority: 1 | 2 | 3;
  dueDate: string;
  dueReason: string;
  estimate: string;
  steps: string[];
  stepsSource: "learned" | "template" | "generic" | "file";
};

// How many days out a task usually lands when you don't say, per project.
const DEFAULT_LEAD: Record<string, number> = {
  Errands: 2, Home: 3, Work: 3, Finance: 5, Health: 7, Social: 7, Business: 7, Learning: 14,
};

export type AnalyzeExtras = {
  /** What THEO learned from attached files (keywords, deadline, urgency, checklist). */
  files?: FileContext | null;
  /** Use a checklist found in a file as this task's steps (single-task mode only). */
  useChecklist?: boolean;
};

export function analyzeTask(line: string, today: string, ctx: BrainContext, brief = "", extra: AnalyzeExtras = {}): TaskDraft {
  const files = extra.files ?? null;
  const due = parseDue(line, today);
  const briefDue = brief.trim() ? parseDue(brief, today) : null;
  // Brief and file keywords both act as soft context; the task's own words always count most.
  const cls = classify(due.cleaned, ctx.projects, ctx.learnedKeywords, briefDue?.cleaned ?? "", files?.keywords.join(" ") ?? "");
  const title = tidyTitle(cls.cleaned) || tidyTitle(line);
  let plan: { steps: string[]; estimate: string; source: TaskDraft["stepsSource"] } = suggestSteps(title, ctx.learnedPlans);
  if (extra.useChecklist && files?.checklist.length) {
    plan = { steps: files.checklist, estimate: plan.estimate, source: "file" };
  }

  // A file that says "urgent" / "overdue" raises normal priority, like an urgent brief does.
  const priority: 1 | 2 | 3 = cls.priority === 2 && files?.urgent ? 1 : cls.priority;
  const fromFile = priority === 1 && cls.priority === 2;

  let dueDate = due.date;
  let dueReason = due.reason;
  if (!dueDate && briefDue?.date) {
    dueDate = briefDue.date;
    dueReason = `From your brief: ${briefDue.reason.replace(/^You said /, "")}`;
  }
  if (!dueDate && files?.deadline) {
    dueDate = files.deadline.date;
    dueReason = `Deadline found in ${files.deadline.file} (“${files.deadline.cue}”)`;
  }
  if (!dueDate) {
    if (priority === 1) {
      dueDate = today;
      dueReason = fromFile ? "A file you attached looks urgent, so today"
        : brief && !/\b(asap|urgent|important|critical|immediately|now)\b|!/i.test(line) ? "Your brief says it's urgent, so today" : "Marked urgent, so today";
    } else {
      const learnedLead = cls.projectId != null ? ctx.leadTimes[cls.projectId] : undefined;
      let lead = learnedLead != null ? Math.max(1, Math.round(learnedLead)) : DEFAULT_LEAD[cls.projectName ?? ""] ?? 3;
      if (priority === 3) lead = Math.max(lead * 3, 14);
      dueDate = addDays(today, lead);
      dueReason = learnedLead != null
        ? `You usually finish ${cls.projectName} tasks in ~${lead} day${lead === 1 ? "" : "s"}`
        : priority === 3
          ? "Low priority, so pushed out"
          : `Typical for ${cls.projectName ?? "a task like this"}: ~${lead} day${lead === 1 ? "" : "s"}`;
    }
  }

  return {
    title,
    projectId: cls.projectId,
    projectName: cls.projectName,
    confidence: cls.confidence,
    tags: cls.tags,
    priority,
    dueDate,
    dueReason,
    estimate: plan.estimate,
    steps: plan.steps,
    stepsSource: plan.source,
  };
}
