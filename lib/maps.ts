// Turns an event's location text into a Google Maps link.

/**
 * A pasted web link (e.g. a Google Maps share link) opens as it is; anything else is searched on Google Maps.
 * Returns null when there is nothing to open.
 */
export function mapsUrl(location: string | null | undefined): string | null {
  const text = (location ?? "").trim();
  if (!text) return null;
  if (/^https?:\/\//i.test(text)) {
    try { const u = new URL(text); if (u.protocol === "http:" || u.protocol === "https:") return u.href; } catch { /* fall through to a search */ }
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`;
}
