// The four general classifications a project can sit under (on top of its own tag and colour).

export const CATEGORIES = [
  { key: "work",  label: "Work",  emoji: "💼", hint: "Jobs, clients, business projects",       color: "#4A9FE8" },
  { key: "life",  label: "Life",  emoji: "🌿", hint: "Family, friends, a movie, looking after yourself", color: "#5CC97B" },
  { key: "admin", label: "Admin", emoji: "📋", hint: "Car errands, bills, paperwork, chores",   color: "#64748B" },
  { key: "play",  label: "Play",  emoji: "🎲", hint: "Hobbies, planning a D&D night with friends", color: "#9F7AEA" },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]["key"];

export const CATEGORY_KEYS: string[] = CATEGORIES.map((c) => c.key);
export const isCategory = (v: unknown): v is CategoryKey => typeof v === "string" && CATEGORY_KEYS.includes(v);

/** Accepts a category key (any case) → the key; "" / null / junk → null. */
export function normalizeCategory(v: unknown): CategoryKey | null {
  if (typeof v !== "string") return null;
  const t = v.trim().toLowerCase();
  return isCategory(t) ? t : null;
}

export const categoryOf = (key: string | null | undefined) => CATEGORIES.find((c) => c.key === key) ?? null;
