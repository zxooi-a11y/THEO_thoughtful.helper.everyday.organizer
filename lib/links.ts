// Safe handling of user-supplied links (final work, event links). Pure, shared by server and browser.

/**
 * Returns a clean http(s) URL, "" for empty input, or null when it isn't a usable web link.
 * Bare domains get https:// added ("figma.com/file/x" → "https://figma.com/file/x").
 * Anything else (javascript:, data:, ftp:, file:…) is rejected so it can never become a clickable script link.
 */
export function normalizeWebUrl(input: string): string | "" | null {
  const raw = input.trim();
  if (!raw) return "";
  if (raw.length > 500 || /\s/.test(raw)) return null;
  let candidate = raw;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    // No scheme: accept "domain.tld/…" only
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(?::\d+)?([/?#].*)?$/i.test(raw)) return null;
    candidate = `https://${raw}`;
  }
  try {
    const u = new URL(candidate);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (!u.hostname.includes(".") && u.hostname !== "localhost") return null;
    return u.href;
  } catch {
    return null;
  }
}

/** "https://www.figma.com/file/abc" → "figma.com" (for compact display). */
export function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

/** True only for links that are safe to put in an href. */
export const isSafeLink = (url: string) => normalizeWebUrl(url) !== null && /^https?:\/\//i.test(url);
