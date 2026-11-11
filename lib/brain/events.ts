// Turns a line like "Sarah & Tom's wedding 12 Dec 4pm at Kuala Lumpur" into an event draft.
// Pure and rule-based (no network), so it also runs in the browser.

import { addDays, parseDue, safeDate, upcoming } from "./dates.ts";
import { findTimes } from "./files.ts";
import { detectKind } from "../events.ts";
import { splitBulk, tidyTitle } from "./text.ts";

export type EventDraft = {
  title: string;
  kind: string;
  start_date: string;
  end_date: string;      // "" = single day
  start_time: string;    // "" = all day
  end_time: string;
  location: string;
  url: string;
  notes: string;
  /** False when the line had no date, so the form fell back to a default the person should check. */
  dateFound: boolean;
  dateReason: string;
};

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const mon = (s: string) => MONTHS.indexOf(s.slice(0, 3).toLowerCase()) + 1;

const M = (n: number) => String.raw`(?<m${n}>jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?`;
const D = (n: number) => String.raw`(?<d${n}>\d{1,2})(?:st|nd|rd|th)?`;
const Y = (n: number) => String.raw`(?:,?\s+(?<y${n}>\d{4}))?`;
const SEP = String.raw`\s*(?:-|–|—|to|until|till)\s*`;
const FROM = String.raw`(?:\bfrom\s+)?`;
const OF = String.raw`(?:of\s+)?`;

type Parts = { d1: number; m1: number; y1?: number; d2: number; m2: number; y2?: number };
const g = (m: RegExpExecArray, k: string) => m.groups?.[k];

// Ranges, most specific first.
const RANGES: [RegExp, (m: RegExpExecArray) => Parts][] = [
  // 2026-12-03 to 2026-12-05
  [/(?:\bfrom\s+)?\b(?<y1>\d{4})-(?<m1>\d{1,2})-(?<d1>\d{1,2})(?:\s*(?:to|until|till|–|—)\s*|\s+-\s+)(?<y2>\d{4})-(?<m2>\d{1,2})-(?<d2>\d{1,2})\b/i,
    (m) => ({ d1: +g(m, "d1")!, m1: +g(m, "m1")!, y1: +g(m, "y1")!, d2: +g(m, "d2")!, m2: +g(m, "m2")!, y2: +g(m, "y2")! })],
  // 20 Dec – 27 Dec
  [new RegExp(`${FROM}\\b${D(1)}\\s+${OF}${M(1)}${Y(1)}${SEP}${D(2)}\\s+${OF}${M(2)}${Y(2)}`, "i"),
    (m) => ({ d1: +g(m, "d1")!, m1: mon(g(m, "m1")!), y1: g(m, "y1") ? +g(m, "y1")! : undefined, d2: +g(m, "d2")!, m2: mon(g(m, "m2")!), y2: g(m, "y2") ? +g(m, "y2")! : undefined })],
  // Dec 28 – Jan 3
  [new RegExp(`${FROM}\\b${M(1)}\\s+${D(1)}${Y(1)}${SEP}${M(2)}\\s+${D(2)}${Y(2)}`, "i"),
    (m) => ({ d1: +g(m, "d1")!, m1: mon(g(m, "m1")!), y1: g(m, "y1") ? +g(m, "y1")! : undefined, d2: +g(m, "d2")!, m2: mon(g(m, "m2")!), y2: g(m, "y2") ? +g(m, "y2")! : undefined })],
  // 20-27 Dec
  [new RegExp(`${FROM}\\b${D(1)}${SEP}${D(2)}\\s+${OF}${M(1)}${Y(1)}`, "i"),
    (m) => ({ d1: +g(m, "d1")!, m1: mon(g(m, "m1")!), y1: g(m, "y1") ? +g(m, "y1")! : undefined, d2: +g(m, "d2")!, m2: mon(g(m, "m1")!), y2: g(m, "y1") ? +g(m, "y1")! : undefined })],
  // Dec 20-27
  [new RegExp(`${FROM}\\b${M(1)}\\s+${D(1)}${SEP}${D(2)}${Y(1)}`, "i"),
    (m) => ({ d1: +g(m, "d1")!, m1: mon(g(m, "m1")!), y1: g(m, "y1") ? +g(m, "y1")! : undefined, d2: +g(m, "d2")!, m2: mon(g(m, "m1")!), y2: g(m, "y1") ? +g(m, "y1")! : undefined })],
];

function parseRange(line: string, today: string): { start: string; end: string; span: [number, number]; matched: string } | null {
  for (const [re, pick] of RANGES) {
    const m = re.exec(line);
    if (!m) continue;
    const p = pick(m);
    const start = p.y1 ? safeDate(p.y1, p.m1, p.d1) : upcoming(today, p.m1, p.d1);
    if (!start) continue;
    const end = p.y2 ? safeDate(p.y2, p.m2, p.d2) : upcoming(start, p.m2, p.d2);
    if (!end || end < start) continue;
    return { start, end: end === start ? "" : end, span: [m.index, m[0].length], matched: m[0].trim() };
  }
  return null;
}

/** "12 Dec 2026" / "Dec 12, 2026": a single date with its year spelled out. */
function withYear(text: string): { date: string; matched: string; index: number; length: number } | null {
  const forms = [
    new RegExp(`(?:\\bon\\s+)?\\b${D(1)}\\s+${OF}${M(1)},?\\s+(?<y1>(?:19|20)\\d{2})\\b`, "i"),
    new RegExp(`(?:\\bon\\s+)?\\b${M(1)}\\s+${D(1)},?\\s+(?<y1>(?:19|20)\\d{2})\\b`, "i"),
  ];
  for (const re of forms) {
    const m = re.exec(text);
    const date = m && safeDate(+g(m, "y1")!, mon(g(m, "m1")!), +g(m, "d1")!);
    if (m && date) return { date, matched: m[0].replace(/^on\s+/i, "").trim(), index: m.index, length: m[0].length };
  }
  return null;
}

const EXPLICIT_DATE = new RegExp(
  String.raw`\b\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\b` +
  String.raw`|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b|\b\d{1,2}[/.]\d{1,2}(?:[/.]\d{2,4})?\b|\b\d{4}-\d{1,2}-\d{1,2}\b`, "i");
const WEEKDAYS = /\b(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(?:day|nesday|rsday|urday|sday)?\b,?/gi;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const LOCATION = /\s+(?:at|in|@)\s+((?:[A-Z0-9][\w'’.&-]*)(?:\s+(?:[A-Z0-9][\w'’.&-]*|of|the|de|la|&))*)[\s.,;]*$/;
const DANGLING = /(?:\s+|^)(?:on|at|from|by|for|until|till|to|@|-|–|—)\s*$/i;

export function analyzeEvent(line: string, today: string, defaultDate?: string | null): EventDraft {
  let text = line.trim();

  // Link
  let url = "";
  const u = /https?:\/\/[^\s)<>"']+/i.exec(text);
  if (u) { url = u[0].replace(/[.,;:!?]+$/, ""); text = text.replace(u[0], " "); }

  // "Thursday, 26 November": the weekday is just a label; the explicit date wins.
  if (EXPLICIT_DATE.test(text)) text = text.replace(WEEKDAYS, " ");

  // Dates: a range ("20-27 Dec") or a single date ("12 Dec", "next Friday", "20/12")
  let start = "", end = "", dateFound = false, dateReason = "";
  const range = parseRange(text, today);
  if (range) {
    start = range.start; end = range.end; dateFound = true;
    dateReason = `Dates found: “${range.matched}”`;
    text = text.slice(0, range.span[0]) + " " + text.slice(range.span[0] + range.span[1]);
  } else if (withYear(text)) {
    const w = withYear(text)!;
    start = w.date; dateFound = true; dateReason = `You said “${w.matched}”`;
    text = text.slice(0, w.index) + " " + text.slice(w.index + w.length);
  } else {
    const due = parseDue(text, today);
    if (due.date) { start = due.date; dateFound = true; dateReason = due.reason; text = due.cleaned; }
  }

  // Times: "4pm", "4–6 PM", "16:00 - 18:30"
  let start_time = "", end_time = "";
  const t = findTimes(text, 0, 0, text.length);
  if (t) {
    start_time = t.start; end_time = t.end ?? "";
    text = text.replace(new RegExp(`(?:\\b(?:from|at)\\s+|@\\s*)?${escapeRe(t.matched)}`, "i"), " ");
  }
  // "10pm – 2am" runs past midnight: end on the next day
  if (start && start_time && end_time && !end && end_time <= start_time) {
    end = addDays(start, 1);
    dateReason += dateReason ? " · runs past midnight" : "";
  }

  // Tidy what the date/time removal left behind: empty brackets like "( , )", doubled spaces.
  text = text.replace(/\(\s*[,;:\-–—\s]*\)/g, " ").replace(/\s+/g, " ").replace(/\s+([,;:])/g, "$1").trim();

  let title = text, location = "", description = "";

  const colon = text.indexOf(":");
  if (colon > 0 && text.slice(colon + 1).trim()) {
    // "Bukit Jalil: Hot Flow Yoga runs with a capacity of 18…" → place + title + description
    const left = text.slice(0, colon).trim(), right = text.slice(colon + 1).trim();
    const placeLeft = placeLike(left) && detectKind(left) === "other";
    if (placeLeft && wordCount(right) >= 8) {
      location = left;
      [title, description] = leadPhrase(right);
    } else if (placeLeft && wordCount(right) <= 7) {
      location = left; title = right;                       // "Kuala Lumpur: Sarah's wedding"
    } else {
      title = left; description = right;                    // "Dinner with Jo: bring wine"
    }
  } else if (text.length > 90) {
    [title, description] = leadPhrase(text);                // a long sentence: short title + the rest as description
  }

  // Place: "… at Kuala Lumpur" (capitalised, at the end of the title)
  if (!location) {
    const loc = LOCATION.exec(title);
    if (loc) {
      location = loc[1].replace(/[.,;]+$/, "").trim();
      const without = title.slice(0, loc.index).trim();
      // Keep "Interview at Google" whole when removing the place would leave a one-word title.
      if (without.split(/\s+/).filter(Boolean).length >= 2) title = without;
    }
  }

  for (let i = 0; i < 3; i++) title = title.replace(DANGLING, "").trim();
  title = tidyTitle(title) || tidyTitle(line);
  description = description.replace(/^[\s,;:\-–—.]+|[\s,;:\-–—]+$/g, "").trim();
  if (description) description = description[0].toUpperCase() + description.slice(1);

  if (!start) { start = defaultDate || today; dateReason = defaultDate ? "No date in the line, so the day you picked" : "No date found. Please check the date"; }

  return { title, kind: detectKind(title, location), start_date: start, end_date: end, start_time, end_time, location, url, notes: description, dateFound, dateReason };
}

const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;

/** "Bandar Utama, One Square" / "Damansara Heights, The Five @ KPD": two or more capitalised words, no sentence in sight. */
function placeLike(s: string): boolean {
  const tokens = s.split(/[\s,]+/).filter(Boolean);
  if (tokens.length < 2 || tokens.length > 8) return false;
  return tokens.every((t) => /^[A-Z0-9@&(]/.test(t) || /^(?:of|the|de|la|and|at|&|@)$/i.test(t));
}

// Where a short title ends and the descriptive sentence begins.
const TITLE_END = /\s+(?:runs?|is|are|will|has|have|takes?|starts?|begins?|features?|includes?|offers?|aimed|designed|suitable|for|with|that|which)\b|\s[–—-]\s|[,;.]/i;

/** Splits "Megastrength Foundations runs with a capacity of 8, aimed at…" into ["Megastrength Foundations", "runs with…"]. */
function leadPhrase(text: string): [string, string] {
  const m = TITLE_END.exec(text.slice(3));          // never cut inside the first few characters
  let cut = m ? m.index + 3 : -1;
  if (cut < 0 || cut > 80) {
    const words = text.split(/\s+/);
    if (words.length <= 8) return [text, ""];
    cut = words.slice(0, 8).join(" ").length;       // no natural break: first 8 words
  }
  return [text.slice(0, cut).trim(), text.slice(cut).trim()];
}

/** One draft per line of pasted text (bullets and numbering are ignored). */
export function analyzeEvents(text: string, today: string, defaultDate?: string | null): EventDraft[] {
  return splitBulk(text).slice(0, 100).map((l) => analyzeEvent(l, today, defaultDate));
}
