"use client";
import { hostOf, isSafeLink } from "@/lib/links";

/** The finished work: a clickable card showing what it is and where it lives. */
export default function FinalWorkLink({ url, note, compact }: { url: string; note?: string; compact?: boolean }) {
  if (!url) return null;
  const safe = isSafeLink(url);
  const body = (
    <>
      <span className="fw-icon" aria-hidden>🔗</span>
      <span className="fw-text">
        <span className="fw-title">{note || hostOf(url)}</span>
        <span className="fw-host">{note ? hostOf(url) : "Final work"}{safe ? " ↗" : ""}</span>
      </span>
    </>
  );
  // Never render anything but http(s) links as clickable.
  return safe
    ? <a className={`final-link${compact ? " compact" : ""}`} href={url} target="_blank" rel="noopener noreferrer" title={url} onClick={(e) => e.stopPropagation()}>{body}</a>
    : <span className={`final-link${compact ? " compact" : ""}`} title={url}>{body}</span>;
}
