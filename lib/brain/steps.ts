// Suggests concrete steps + a time estimate for a single task.

import { keywords, similarity } from "./text.ts";

export type LearnedPlan = { kind: "task" | "goal"; key_words: string[]; title: string; steps: PlanStep[]; uses: number };
export type PlanStep = { text: string; offsetDays?: number; estimate?: string; steps?: string[] };

type Template = { re: RegExp; estimate: string; steps: (obj: string) => string[] };

const T: Template[] = [
  { re: /\b(?:call|phone|ring)\b\s*(.*)/i, estimate: "30 min", steps: (o) => [
    `Find ${o || "the"} number and a good time to call`, "Jot down what you need to say or ask", `Call ${o || "them"}`, "Note the outcome and any follow-ups"] },
  { re: /\b(?:email|e-mail|message|text|reply to|write to|whatsapp)\b\s*(.*)/i, estimate: "20 min", steps: (o) => [
    "Decide the one thing this message must achieve", `Draft the message to ${o || "them"}`, "Re-read, attach anything needed", "Send and set a follow-up reminder if needed"] },
  { re: /\b(?:pay|settle|transfer)\b\s*(.*)/i, estimate: "15 min", steps: (o) => [
    `Find the ${o || "bill"} and account details`, "Check the amount and due date", `Pay ${o || "it"}`, "Save the receipt / confirmation"] },
  { re: /\b(?:renew|apply for|register)\b\s*(.*)/i, estimate: "1 hour", steps: (o) => [
    `Check what's required to renew/apply for ${o || "it"} (documents, fees)`, "Gather the documents", "Submit the application / payment", "Save the confirmation and note the next expiry date"] },
  { re: /\b(?:book|schedule|reserve|make an appointment)\b\s*(.*)/i, estimate: "20 min", steps: (o) => [
    "Check your calendar for free slots", `Find who/where to book ${o || "it"} with`, `Book ${o || "it"}`, "Add it to the calendar with a reminder"] },
  { re: /\b(?:buy|order|purchase|pick up|get|grab|shop for)\b\s*(.*)/i, estimate: "1 hour", steps: (o) => [
    `Decide exactly what you need (${o || "item"}: size, model, quantity)`, "Set a budget", "Compare 2–3 options or stores", `Buy ${o || "it"}`, "Put it away / set it up"] },
  { re: /\b(?:clean|tidy|declutter|organi[sz]e|vacuum|wash|do the)\b\s*(.*)/i, estimate: "1 hour", steps: (o) => [
    "Gather supplies and put on some music", `Clear and sort ${o || "the area"} (keep / donate / bin)`, `Clean ${o || "it"} top to bottom`, "Put things back and take the rubbish out"] },
  { re: /\b(?:fix|repair|replace|install|assemble)\b\s*(.*)/i, estimate: "2 hours", steps: (o) => [
    `Work out what's wrong with ${o || "it"} (search the symptom)`, "Get the tools / parts — or decide to call a pro", `Fix ${o || "it"}`, "Test that it works, tidy up"] },
  { re: /\b(?:learn|study|practi[cs]e|revise|take a course on)\b\s*(.*)/i, estimate: "3 sessions", steps: (o) => [
    `Define what "good enough" at ${o || "this"} looks like`, "Pick one good resource (course, book, video)", "Block 2–3 focused sessions in the calendar", "Practise / summarise what you learned"] },
  { re: /\b(?:read)\b\s*(.*)/i, estimate: "1 week", steps: (o) => [
    `Get a copy of ${o || "it"}`, "Set a daily page / chapter target", "Read and note key ideas", "Write a 3-line summary of what to apply"] },
  { re: /\b(?:plan|organi[sz]e)\b.*\b(trip|holiday|vacation|party|event|wedding|birthday|dinner)\b/i, estimate: "1 week", steps: (o) => [
    `Set the date, budget and who's coming for the ${o}`, "Book the essentials (venue, travel, stay)", "Make a checklist of everything else", "Confirm all details 2–3 days before"] },
  { re: /\b(?:write|draft|prepare|create|design|make)\b\s*(.*)/i, estimate: "2 hours", steps: (o) => [
    `Outline the key points of ${o || "it"}`, `Draft ${o || "it"}`, "Review and polish", "Send / publish / hand it in"] },
  { re: /\b(?:cook|bake|meal prep)\b\s*(.*)/i, estimate: "1 hour", steps: (o) => [
    `Pick the recipe for ${o || "the meal"}`, "Check the pantry and buy missing ingredients", "Cook", "Clean up and store leftovers"] },
  { re: /\b(?:go to the gym|workout|exercise|run|swim|yoga|walk)\b\s*(.*)/i, estimate: "1 hour", steps: () => [
    "Put it in the calendar at a realistic time", "Prepare kit the night before", "Do the session", "Log it — what went well?"] },
  { re: /\b(?:meet|catch up with|visit|see)\b\s*(.*)/i, estimate: "2 hours", steps: (o) => [
    `Message ${o || "them"} to agree on a time and place`, "Put it in the calendar", "Prepare anything you want to bring or discuss", "Meet up"] },
];

const GENERIC = (title: string) => [
  "Clarify what “done” looks like", "Gather what you need", `Do it: ${title}`, "Review and tick it off"];

/** Learned plan reuse needs a decent overlap with what you typed. */
export function findLearned(title: string, kind: "task" | "goal", learned: LearnedPlan[], min = 0.5): LearnedPlan | null {
  const kw = keywords(title);
  let best: LearnedPlan | null = null, bestScore = 0;
  for (const p of learned) {
    if (p.kind !== kind) continue;
    const s = similarity(kw, p.key_words) + Math.min(p.uses, 10) * 0.01;
    if (s > bestScore) { best = p; bestScore = s; }
  }
  return bestScore >= min ? best : null;
}

export function suggestSteps(title: string, learned: LearnedPlan[] = []): { steps: string[]; estimate: string; source: "learned" | "template" | "generic" } {
  const mine = findLearned(title, "task", learned);
  if (mine) return { steps: mine.steps.map((s) => s.text), estimate: mine.steps[0]?.estimate ?? "", source: "learned" };

  for (const t of T) {
    const m = t.re.exec(title);
    if (!m) continue;
    const obj = (m[1] ?? "").replace(/[.!?]+$/, "").trim();
    return { steps: t.steps(obj), estimate: t.estimate, source: "template" };
  }
  return { steps: GENERIC(title), estimate: "1 hour", source: "generic" };
}
