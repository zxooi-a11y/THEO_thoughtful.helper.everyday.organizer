// Natural-language due-date detection. All dates are ISO "YYYY-MM-DD" strings in the
// user's local calendar (the browser sends its own `today`), and maths is done in UTC
// so time zones never shift a day.

export type DueParse = { date: string | null; cleaned: string; reason: string };

const DAY_MS = 86_400_000;
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  couple: 2, few: 3,
};

export function toDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
export function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function addDays(iso: string, n: number): string {
  return toISO(new Date(toDate(iso).getTime() + n * DAY_MS));
}
export function daysBetween(a: string, b: string): number {
  return Math.round((toDate(b).getTime() - toDate(a).getTime()) / DAY_MS);
}
/** 0 = Monday … 6 = Sunday */
export function weekdayMon(iso: string): number {
  return (toDate(iso).getUTCDay() + 6) % 7;
}
export function startOfWeek(iso: string): string {
  return addDays(iso, -weekdayMon(iso));
}
function endOfMonth(iso: string): string {
  const d = toDate(iso);
  return toISO(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
}
function firstOfNextMonth(iso: string): string {
  const d = toDate(iso);
  return toISO(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)));
}
function safeDate(y: number, m: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return toISO(dt);
}
/** Same day/month this year, or next year if already passed. */
function upcoming(today: string, m: number, d: number): string | null {
  const y = toDate(today).getUTCFullYear();
  const thisYear = safeDate(y, m, d);
  if (thisYear && thisYear >= today) return thisYear;
  return safeDate(y + 1, m, d);
}
function nextWeekday(today: string, dow: number /*0=Mon*/, forceNextWeek: boolean): string {
  if (forceNextWeek) return addDays(startOfWeek(today), 7 + dow);
  let diff = (dow - weekdayMon(today) + 7) % 7;
  if (diff === 0) diff = 7;
  return addDays(today, diff);
}

type Rule = { re: RegExp; resolve: (m: RegExpExecArray, today: string) => { date: string | null; reason: string } };

const LEAD = String.raw`(?:\b(?:by|on|due|before|for|until|til|till)\s+)?`;

const RULES: Rule[] = [
  { re: new RegExp(LEAD + String.raw`\b(day after tomorrow)\b`, "i"), resolve: (_m, t) => ({ date: addDays(t, 2), reason: "You said “day after tomorrow”" }) },
  { re: new RegExp(LEAD + String.raw`\b(today|tonight|this (?:morning|afternoon|evening)|eod)\b`, "i"), resolve: (m, t) => ({ date: t, reason: `You said “${m[1]}”` }) },
  { re: new RegExp(LEAD + String.raw`\b(tomorrow|tmrw|tmr)\b`, "i"), resolve: (_m, t) => ({ date: addDays(t, 1), reason: "You said “tomorrow”" }) },
  {
    re: new RegExp(LEAD + String.raw`\bin\s+(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|a couple of|a few)\s+(day|week|month)s?\b`, "i"),
    resolve: (m, t) => {
      const raw = m[1].toLowerCase().replace(/^a (couple|few) of$/, "$1");
      const n = /^\d+$/.test(raw) ? Number(raw) : NUMBER_WORDS[raw] ?? 1;
      const unit = m[2].toLowerCase();
      const days = unit === "day" ? n : unit === "week" ? n * 7 : n * 30;
      return { date: addDays(t, days), reason: `You said “in ${m[1]} ${m[2]}${n > 1 ? "s" : ""}”` };
    },
  },
  { re: new RegExp(LEAD + String.raw`\b(end of (?:the )?week|eow)\b`, "i"), resolve: (_m, t) => ({ date: nextWeekdayOrToday(t, 4), reason: "End of the week (Friday)" }) },
  { re: new RegExp(LEAD + String.raw`\b(end of (?:the )?month|eom)\b`, "i"), resolve: (_m, t) => ({ date: endOfMonth(t), reason: "End of the month" }) },
  { re: new RegExp(LEAD + String.raw`\b(next month)\b`, "i"), resolve: (_m, t) => ({ date: firstOfNextMonth(t), reason: "Start of next month" }) },
  { re: new RegExp(LEAD + String.raw`\b(next week)\b`, "i"), resolve: (_m, t) => ({ date: addDays(startOfWeek(t), 7), reason: "Monday next week" }) },
  { re: new RegExp(LEAD + String.raw`\b(this week)\b`, "i"), resolve: (_m, t) => ({ date: nextWeekdayOrToday(t, 4), reason: "Later this week (Friday)" }) },
  { re: new RegExp(LEAD + String.raw`\b((?:this |the |next )?weekend)\b`, "i"), resolve: (m, t) => ({ date: m[1].toLowerCase().startsWith("next") ? addDays(startOfWeek(t), 12) : nextWeekdayOrToday(t, 5), reason: `You said “${m[1]}”` }) },
  {
    re: new RegExp(LEAD + String.raw`\b(this |next )?(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(?:day|nesday|rsday|urday|sday)?\b`, "i"),
    resolve: (m, t) => {
      const dow = (WEEKDAYS.indexOf(m[2].slice(0, 3).toLowerCase()) + 6) % 7;
      const isNext = (m[1] ?? "").trim().toLowerCase() === "next";
      const d = nextWeekday(t, dow, isNext);
      return { date: d, reason: `You said “${m[0].trim()}”` };
    },
  },
  {
    // 20 Nov, 3rd of December
    re: new RegExp(LEAD + String.raw`\b(\d{1,2})(?:st|nd|rd|th)?(?:\s+of)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b`, "i"),
    resolve: (m, t) => ({ date: upcoming(t, MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1, Number(m[1])), reason: `You said “${m[0].trim()}”` }),
  },
  {
    // Nov 20, December 3rd
    re: new RegExp(LEAD + String.raw`\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?\b`, "i"),
    resolve: (m, t) => ({ date: upcoming(t, MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1, Number(m[2])), reason: `You said “${m[0].trim()}”` }),
  },
  {
    // 2026-11-20
    re: new RegExp(LEAD + String.raw`\b(\d{4})-(\d{1,2})-(\d{1,2})\b`, "i"),
    resolve: (m) => ({ date: safeDate(Number(m[1]), Number(m[2]), Number(m[3])), reason: "Exact date given" }),
  },
  {
    // 20/11, 20/11/2026 — day-first unless that's impossible (11/20 → Nov 20)
    re: new RegExp(LEAD + String.raw`\b(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?\b`, "i"),
    resolve: (m, t) => {
      let d = Number(m[1]), mo = Number(m[2]);
      if (mo > 12 && d <= 12) [d, mo] = [mo, d];
      if (m[3]) {
        const y = Number(m[3].length === 2 ? "20" + m[3] : m[3]);
        return { date: safeDate(y, mo, d), reason: "Exact date given" };
      }
      return { date: upcoming(t, mo, d), reason: "Exact date given" };
    },
  },
];

function nextWeekdayOrToday(today: string, dow: number): string {
  const diff = (dow - weekdayMon(today) + 7) % 7;
  return addDays(today, diff);
}

/** Find a due date inside free text. Returns the text with the date phrase removed. */
export function parseDue(text: string, today: string): DueParse {
  for (const rule of RULES) {
    const m = rule.re.exec(text);
    if (!m) continue;
    const { date, reason } = rule.resolve(m, today);
    if (!date) continue;
    const cleaned = (text.slice(0, m.index) + " " + text.slice(m.index + m[0].length)).replace(/\s+/g, " ").trim();
    return { date, cleaned, reason };
  }
  return { date: null, cleaned: text, reason: "" };
}
