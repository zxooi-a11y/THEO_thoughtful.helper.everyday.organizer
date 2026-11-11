// Is a line a task (something to DO) or an event (something that HAPPENS)?
// "Finance Lang Backdrop design" → task.  "Finance Lang Invest Fair 12 Dec" → event.

import { detectKind } from "../events.ts";

export type EntryType = "task" | "event";

// Lines that start with an action are tasks, even when they mention an event ("Plan Sarah's birthday party").
const ACTION_START = /^\s*(?:to\s+)?(?:call|phone|ring|email|e-?mail|text|message|reply|buy|order|purchase|pick|get|grab|pay|settle|transfer|book|schedule|reserve|renew|apply|register|submit|send|write|draft|prepare|plan|organi[sz]e|arrange|design|create|make|build|finish|finalis?e|fix|repair|replace|install|clean|tidy|wash|read|study|learn|practi[cs]e|review|update|check|confirm|research|find|decide|set up|sort|follow up|remind|cancel|pack|print|edit|test|draw|sketch|brief|invoice|file|sign|collect|return|drop|take|bring|prepay)\b/i;

// Kinds that are things you attend. "appointment" is left out: "book dentist appointment" is a task.
const EVENT_KINDS = new Set(["wedding", "birthday", "party", "holiday", "trip", "interview", "conference", "anniversary", "concert", "class"]);

const TIME_OF_DAY = /\b(?:\d{1,2}(?::\d{2})?\s?(?:am|pm)|\d{1,2}:\d{2})\b/i;

export function guessEntryType(line: string): EntryType {
  if (ACTION_START.test(line)) return "task";
  if (EVENT_KINDS.has(detectKind(line))) return "event";
  // A specific time of day almost always means something you attend
  if (TIME_OF_DAY.test(line)) return "event";
  return "task";
}
