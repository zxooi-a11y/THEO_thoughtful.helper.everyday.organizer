"use client";
import { CATEGORIES, categoryOf } from "@/lib/categories";
import { colorOf } from "@/lib/colors";

/** Small "💼 Work" label for a project's classification (nothing when it has none). */
export function CategoryTag({ category, className = "" }: { category: string | null | undefined; className?: string }) {
  const c = categoryOf(category);
  if (!c) return null;
  const col = colorOf(c.color);
  return <span className={`cat-tag ${className}`} style={{ background: col.bg, color: col.fg }} title={c.hint}><span aria-hidden>{c.emoji}</span> {c.label}</span>;
}

/**
 * Pick one of the four general classifications (work / life / admin / play).
 * Tap the chosen one again to remove it — a project doesn't have to be classified.
 */
export default function CategoryPicker({ value, onPick, compact = false }: { value: string | null | undefined; onPick: (key: string | null) => void; compact?: boolean }) {
  return (
    <div className={`cat-pick${compact ? " compact" : ""}`} role="radiogroup" aria-label="Classification">
      {CATEGORIES.map((c) => {
        const on = value === c.key;
        const col = colorOf(c.color);
        return (
          <button
            type="button" key={c.key} role="radio" aria-checked={on} title={c.hint}
            className={`cat-btn${on ? " on" : ""}`}
            style={on ? { background: col.bg, color: col.fg, borderColor: col.dot } : undefined}
            onClick={() => onPick(on ? null : c.key)}
          >
            <span aria-hidden>{c.emoji}</span> {c.label}
          </button>
        );
      })}
    </div>
  );
}
