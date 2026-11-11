// Times are stored as 24-hour "HH:MM" strings ("" = not set) and shown the friendly way ("4:30 PM").
// Pure helpers shared by the browser and the server.

export type Meridiem = "AM" | "PM";

/** "16:30" → { h12: 4, m: 30, ap: "PM" }; "" or junk → null */
export function splitTime(v: string): { h24: number; h12: number; m: number; ap: Meridiem } | null {
  const x = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(v);
  if (!x) return null;
  const h24 = +x[1];
  return { h24, h12: h24 % 12 || 12, m: +x[2], ap: h24 >= 12 ? "PM" : "AM" };
}

/** (4, 30, "PM") → "16:30" */
export function joinTime(h12: number, m: number, ap: Meridiem): string {
  const h24 = (h12 % 12) + (ap === "PM" ? 12 : 0);
  return `${String(h24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "16:30" → "4:30 PM"; "00:05" → "12:05 AM"; "" → "" */
export function fmtTime(v: string): string {
  const t = splitTime(v);
  return t ? `${t.h12}:${String(t.m).padStart(2, "0")} ${t.ap}` : "";
}

/**
 * Understands what people type: "4pm", "4:30 pm", "4.30p.m.", "16:30", "1630", "430", "noon".
 * With no am/pm, hours 1–12 use `fallback` (the picker's current AM/PM); 13–23 are 24-hour.
 * Returns "HH:MM" or null.
 */
export function parseTimeInput(input: string, fallback?: Meridiem): string | null {
  const s = input.toLowerCase().replace(/[.\s]/g, "");
  if (!s) return null;
  if (s === "noon") return "12:00";
  if (s === "midnight") return "00:00";
  const x = /^(\d{1,2})(?::?(\d{2}))?(a|p|am|pm)?$/.exec(s);
  if (!x) return null;
  let h = +x[1];
  const m = x[2] ? +x[2] : 0;
  if (m > 59) return null;
  const ap = x[3] ? (x[3][0] === "p" ? "PM" : "AM") : null;
  if (ap) {
    if (h < 1 || h > 12) return null;
    return joinTime(h, m, ap);
  }
  if (h > 23) return null;
  if (h >= 1 && h <= 12 && fallback && !(x[1].length === 2 && x[1][0] === "0")) return joinTime(h, m, fallback);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
