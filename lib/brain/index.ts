// THEO's brain: turns a messy line of text into a fully-formed task draft.
// 100% local & free — no API calls. Learns via the `ctx` data loaded from Neon.

import { classify, type LearnedKeywords, type ProjectRef } from "./classify.ts";
import { addDays, parseDue } from "./dates.ts";
import { suggestSteps, type LearnedPlan } from "./steps.ts";
import { tidyTitle } from "./text.ts";

export { planGoal } from "./goals.ts";
export type { GoalPlan, PlannedTask } from "./goals.ts";
export type { LearnedPlan, PlanStep } from "./steps.ts";
export type { LearnedKeywords, ProjectRef } from "./classify.ts";

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
  stepsSource: "learned" | "template" | "generic";
};

// How many days out a task usually lands when you don't say, per project.
const DEFAULT_LEAD: Record<string, number> = {
  Errands: 2, Home: 3, Work: 3, Finance: 5, Health: 7, Social: 7, Business: 7, Learning: 14,
};

/** Split a pasted blob into individual task lines (newlines, bullets, numbered lists, semicolons). */
export function splitBulk(text: string): string[] {
  return text
    .split(/\r?\n|;(?=\s)/)
    .map((l) => l.replace(/^\s*(?:[-*•▪◦·]|\d+[.)]|\[\s?[xX ]?\s?\])\s*/, "").trim())
    .filter((l) => l.length > 1);
}

export function analyzeTask(line: string, today: string, ctx: BrainContext, brief = ""): TaskDraft {
  const due = parseDue(line, today);
  const briefDue = brief.trim() ? parseDue(brief, today) : null;
  const cls = classify(due.cleaned, ctx.projects, ctx.learnedKeywords, briefDue?.cleaned ?? "");
  const title = tidyTitle(cls.cleaned) || tidyTitle(line);
  const plan = suggestSteps(title, ctx.learnedPlans);

  let dueDate = due.date;
  let dueReason = due.reason;
  if (!dueDate && briefDue?.date) {
    dueDate = briefDue.date;
    dueReason = `From your brief: ${briefDue.reason.replace(/^You said /, "")}`;
  }
  if (!dueDate) {
    if (cls.priority === 1) {
      dueDate = today;
      dueReason = brief && !/\b(asap|urgent|important|critical|immediately|now)\b|!/i.test(line) ? "Your brief says it's urgent, so today" : "Marked urgent, so today";
    } else {
      const learnedLead = cls.projectId != null ? ctx.leadTimes[cls.projectId] : undefined;
      let lead = learnedLead != null ? Math.max(1, Math.round(learnedLead)) : DEFAULT_LEAD[cls.projectName ?? ""] ?? 3;
      if (cls.priority === 3) lead = Math.max(lead * 3, 14);
      dueDate = addDays(today, lead);
      dueReason = learnedLead != null
        ? `You usually finish ${cls.projectName} tasks in ~${lead} day${lead === 1 ? "" : "s"}`
        : cls.priority === 3
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
    priority: cls.priority,
    dueDate,
    dueReason,
    estimate: plan.estimate,
    steps: plan.steps,
    stepsSource: plan.source,
  };
}
