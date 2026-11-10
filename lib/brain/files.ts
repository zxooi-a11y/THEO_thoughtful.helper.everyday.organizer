// Turns the text of attached files into hints for the Auto choices:
// what the files are about (keywords), a deadline they mention, whether they look urgent,
// and a checklist they contain. Pure functions; text extraction itself lives in lib/extract.ts.

import { keywordCounts } from "./text.ts";
import { safeDate, toISO, toDate, upcoming } from "./dates.ts";
import { detectKind } from "../events.ts";

export type FileDoc = { name: string; text: string };

export type FileContext = {
  names: string[];
  /** Most characteristic words across the files (and their names), most important first. */
  keywords: string[];
  /** Earliest upcoming date that sits next to a deadline-style cue ("due", "by", "before"…). */
  deadline: { date: string; file: string; cue: string } | null;
  urgent: boolean;
  /** A bulleted / numbered / checkbox list found in a file, usable as steps. */
  checklist: string[];
  checklistFile: string;
};

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MON = "(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?";
const monthNo = (m: string) => MONTHS.indexOf(m.slice(0, 3).toLowerCase()) + 1;

const CUE = /\b(due(?: date| on| by)?|deadline|by|before|until|no later than|expires?|expiry|expiring|closing date|last day|submit(?:ted)?(?: by)?|payable by|pay by|must be (?:done|completed|paid|submitted))\b[^.\n]{0,25}$/i;
const URGENT = /\b(urgent|asap|overdue|final notice|immediate(?:ly)?|past due|time[- ]sensitive)\b/i;
const BULLET = /^\s*(?:[-*•▪◦·]|\d{1,2}[.)]|\[\s?[xX ]?\s?\])\s+(\S.{3,119})\s*$/;

type Hit = { date: string; index: number };

/** Dates written out in full (never "tomorrow" etc., which are noise inside documents). */
function explicitDates(text: string, today: string): Hit[] {
  const out: Hit[] = [];
  const year = toDate(today).getUTCFullYear();
  const push = (iso: string | null, index: number) => { if (iso) out.push({ date: iso, index }); };
  let m: RegExpExecArray | null;

  const iso = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g;
  while ((m = iso.exec(text))) push(safeDate(+m[1], +m[2], +m[3]), m.index);

  const dmy = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MON},?(?:\\s+(\\d{4}))?\\b`, "gi");
  while ((m = dmy.exec(text))) push(m[3] ? safeDate(+m[3], monthNo(m[2]), +m[1]) : upcoming(today, monthNo(m[2]), +m[1]), m.index);

  const mdy = new RegExp(`\\b${MON}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`, "gi");
  while ((m = mdy.exec(text))) push(m[3] ? safeDate(+m[3], monthNo(m[1]), +m[2]) : upcoming(today, monthNo(m[1]), +m[2]), m.index);

  const num = /\b(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})\b/g; // day-first unless impossible
  while ((m = num.exec(text))) {
    let d = +m[1], mo = +m[2];
    if (mo > 12 && d <= 12) [d, mo] = [mo, d];
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    push(safeDate(y, mo, d), m.index);
  }
  return out.filter((h) => Math.abs(+h.date.slice(0, 4) - year) <= 3);
}

function findDeadline(doc: FileDoc, today: string): FileContext["deadline"] {
  const text = doc.text.slice(0, 60_000);
  let best: FileContext["deadline"] = null;
  for (const h of explicitDates(text, today)) {
    if (h.date < today) continue;
    const before = text.slice(Math.max(0, h.index - 50), h.index);
    const cue = CUE.exec(before);
    if (!cue) continue;
    if (!best || h.date < best.date) best = { date: h.date, file: doc.name, cue: cue[1].toLowerCase() };
  }
  return best;
}

function findChecklist(text: string): string[] {
  const items: string[] = [];
  for (const line of text.slice(0, 60_000).split(/\r?\n/)) {
    const m = BULLET.exec(line);
    if (m) items.push(m[1].replace(/\s+/g, " ").trim());
  }
  return items.length >= 3 ? items.slice(0, 12) : [];
}

export function buildFileContext(docs: FileDoc[], today: string): FileContext | null {
  if (!docs.length) return null;
  const counts = new Map<string, number>();
  for (const d of docs) {
    // File names are a strong, clean signal ("candle-business-plan.pdf").
    for (const [w, c] of keywordCounts(d.name.replace(/\.[a-z0-9]+$/i, "").replace(/[_\-.]+/g, " "))) counts.set(w, (counts.get(w) ?? 0) + 4 * c);
    for (const [w, c] of keywordCounts(d.text.slice(0, 60_000))) counts.set(w, (counts.get(w) ?? 0) + c);
  }
  const keywords = [...counts].filter(([w]) => w.length > 2).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([w]) => w);

  let deadline: FileContext["deadline"] = null;
  let checklist: string[] = [], checklistFile = "";
  let urgent = false;
  for (const d of docs) {
    const dl = findDeadline(d, today);
    if (dl && (!deadline || dl.date < deadline.date)) deadline = dl;
    if (!checklist.length) { const c = findChecklist(d.text); if (c.length) { checklist = c; checklistFile = d.name; } }
    if (URGENT.test(d.text.slice(0, 3000))) urgent = true;
  }
  return { names: docs.map((d) => d.name), keywords, deadline, urgent, checklist, checklistFile };
}

// ── Events: read an invite / ticket / booking and suggest the event's details ──

export type EventHints = {
  /** Event type key (see lib/events.ts), e.g. "wedding". */
  kind: string | null;
  date: { value: string; file: string } | null;
  /** 24h "HH:MM" */
  time: string | null;
  url: string | null;
};

// Words that mark a date as a deadline for something else (RSVP, payment…) rather than the event itself.
const NOT_EVENT_DATE = /\b(rsvp|reply|respond|confirm|deadline|due|payable|pay by|book by|register by|by|before|until|expires?)\b[^.\n]{0,25}$/i;

function findTime(text: string, around: number): string | null {
  const win = text.slice(Math.max(0, around - 40), around + 120);
  const m = /\b(?:at\s+)?(1[0-2]|0?[1-9])(?::([0-5]\d))?\s?(am|pm)\b/i.exec(win) ?? /\b([01]?\d|2[0-3]):([0-5]\d)()\b/.exec(win);
  if (!m) return null;
  let h = +m[1];
  const min = m[2] ? +m[2] : 0;
  const ap = (m[3] ?? "").toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function buildEventHints(docs: FileDoc[], today: string): EventHints | null {
  if (!docs.length) return null;
  let kind: string | null = null;
  let date: EventHints["date"] = null, time: string | null = null, url: string | null = null;
  let dateIsEventish = false;

  for (const d of docs) {
    const k = detectKind(d.name.replace(/\.[a-z0-9]+$/i, "").replace(/[_\-.]+/g, " "), d.text.slice(0, 1500));
    if (!kind && k !== "other") kind = k;

    const text = d.text.slice(0, 60_000);
    for (const h of explicitDates(text, today)) {
      if (h.date < today) continue;
      const eventish = !NOT_EVENT_DATE.test(text.slice(Math.max(0, h.index - 50), h.index));
      // Prefer dates that aren't deadlines (RSVP etc.); among equals, the earliest.
      const better = !date || (eventish && !dateIsEventish) || (eventish === dateIsEventish && h.date < date.value);
      if (better) { date = { value: h.date, file: d.name }; dateIsEventish = eventish; time = findTime(text, h.index); }
    }
    if (!url) {
      const u = /https?:\/\/[^\s)<>"'\]]+/i.exec(text);
      if (u) url = u[0].replace(/[.,;:!?]+$/, "");
    }
  }
  return kind || date || url ? { kind, date, time, url } : null;
}

export const _test = { explicitDates, toISO };
