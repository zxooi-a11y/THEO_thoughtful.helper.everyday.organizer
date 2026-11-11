// Event types: label, colours for the card (soft panel + strong accent) and words that identify them.
// Pure module, shared by the server and the browser.
import type { FileMeta } from "./types.ts";
import { projectTheme } from "./colors.ts";

export type EventKind = {
  key: string;
  label: string;
  accent: string; // big date + pill text
  panel: string;  // left date panel
  pill: string;   // pill background
  re: RegExp;
};

export const EVENT_KINDS: EventKind[] = [
  { key: "wedding",    label: "Wedding",     accent: "#E0245E", panel: "#FDEFF3", pill: "#FCE1EA", re: /\b(wedding|marriage|engagement|bridal|bachelor(ette)?|hens?|stag)\b/i },
  { key: "birthday",   label: "Birthday",    accent: "#E8780C", panel: "#FEF3E6", pill: "#FDE6CC", re: /\b(birthday|bday|b-day)\b/i },
  { key: "party",      label: "Party",       accent: "#8B3FD9", panel: "#F5EEFD", pill: "#EBDDFB", re: /\b(party|celebration|housewarming|reunion|gala|dinner party|bbq|barbecue)\b/i },
  { key: "holiday",    label: "Holiday",     accent: "#0E9384", panel: "#E8F7F5", pill: "#CDEFEA", re: /\b(holiday|vacation|getaway|honeymoon|staycation|retreat|cruise)\b/i },
  { key: "trip",       label: "Trip",        accent: "#1F7AE0", panel: "#EAF3FD", pill: "#D4E6FB", re: /\b(trip|travel|flight|fly to|visit to|road ?trip|journey)\b/i },
  { key: "interview",  label: "Interview",   accent: "#4C51BF", panel: "#EEEFFC", pill: "#DDDFF9", re: /\b(interview|assessment|job fair|onboarding|first day)\b/i },
  { key: "class",      label: "Class",       accent: "#4D7C0F", panel: "#F3F9E8", pill: "#E2F0C6", re: /\b(class(?:es)?|lesson|session|training|workout|course|lecture)\b|pilates|yoga|reformer|bootcamp|hiit|barre|strength/i },
  { key: "conference", label: "Conference",  accent: "#D61F69", panel: "#FDEFF5", pill: "#FBDCE9", re: /\b(conference|summit|expo|fair|forum|exhibition|meetup|convention|workshop|seminar|webinar|market)\b/i },
  { key: "anniversary",label: "Anniversary", accent: "#C53030", panel: "#FDEEEE", pill: "#FBDADA", re: /\b(anniversary)\b/i },
  { key: "concert",    label: "Concert",     accent: "#B7791F", panel: "#FDF6E7", pill: "#FAEBC8", re: /\b(concert|gig|festival|show|theatre|theater|match|game)\b/i },
  { key: "appointment",label: "Appointment", accent: "#2F855A", panel: "#EAF7EF", pill: "#D3EFDD", re: /\b(appointment|doctor|dentist|surgery|check-?up)\b/i },
  { key: "other",      label: "Event",       accent: "#6B6B6B", panel: "#F3F2F0", pill: "#E7E5E1", re: /$^/ },
];

export const kindOf = (key: string | null | undefined): EventKind =>
  EVENT_KINDS.find((k) => k.key === key) ?? EVENT_KINDS[EVENT_KINDS.length - 1];

/** Guess the event type from its title (and location/notes as a fallback). */
export function detectKind(title: string, extra = ""): string {
  for (const k of EVENT_KINDS) if (k.re.test(title)) return k.key;
  for (const k of EVENT_KINDS) if (extra && k.re.test(extra)) return k.key;
  return "other";
}

export type LifeEvent = {
  id: number;
  title: string;
  kind: string;
  start_date: string;       // YYYY-MM-DD
  end_date: string | null;
  start_time: string;
  end_time: string;
  location: string;
  url: string;
  notes: string;
  favorite: boolean;
  /** The project tag this event sits under (tasks use the same tags). */
  project_id: number | null;
  created_at: string;
  files: FileMeta[];
};

/** "16:00 – 18:30", "16:00", "until 18:30" or "" (24h times as stored). */
export function timeRange(e: Pick<LifeEvent, "start_time" | "end_time">): string {
  if (e.start_time && e.end_time) return `${e.start_time} – ${e.end_time}`;
  if (e.start_time) return e.start_time;
  if (e.end_time) return `until ${e.end_time}`;
  return "";
}

/**
 * A same-day event must end after it starts. Overnight events need an end date, which makes any times valid.
 * Returns an error message, or "" when fine.
 */
export function endTimeProblem(start_time: string, end_time: string, end_date: string | null | undefined): string {
  if (!start_time || !end_time || end_date) return "";
  return end_time > start_time ? "" : "The end time must be after the start time. For an event that runs past midnight, set an end date too.";
}

/**
 * The colours an event is drawn in. An event under a project tag takes that project's colour,
 * so the whole project looks alike on the cards and the calendar; otherwise its own type colour.
 */
export function eventTheme(kind: string | null | undefined, project?: { color: string } | null) {
  const k = kindOf(kind);
  if (!project) return { accent: k.accent, panel: k.panel, pill: k.pill, label: k.label };
  const t = projectTheme(project.color);
  return { accent: t.accent, panel: t.panel, pill: t.pill, label: k.label };
}
