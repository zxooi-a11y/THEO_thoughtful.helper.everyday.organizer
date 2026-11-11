"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { Project } from "@/lib/types";
import { colorOf } from "@/lib/colors";
import { api } from "./client";
import { PlusIcon, SearchIcon } from "./Icons";

type Extra = { label: string; value: number };

type Props = {
  projects: Project[];
  value: number | null;
  onChange: (id: number | null) => void;
  onCreated?: (p: Project) => void;
  /** Label for "no project" (value null). */
  emptyLabel?: string;
  className?: string;
  style?: CSSProperties;
  title?: string;
  /** Show "+ New project…" (default). Turn off for filters. */
  allowCreate?: boolean;
  /** Extra fixed choices, e.g. { label: "No project", value: -1 } in a filter. */
  extra?: Extra[];
};

type Opt =
  | { kind: "empty"; label: string }
  | { kind: "extra"; label: string; value: number }
  | { kind: "project"; p: Project };

/**
 * Searchable project picker: type to narrow the list, arrow keys + Enter to choose,
 * "+ New project…" is always at the bottom. Rounded and soft like the rest of the app.
 */
export default function ProjectSelect({
  projects, value, onChange, onCreated, emptyLabel = "Inbox", className = "select", style, title, allowCreate = true, extra = [],
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number; maxH: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);

  const q = query.trim().toLowerCase();
  const options = useMemo<Opt[]>(() => {
    const out: Opt[] = [];
    if (!q || emptyLabel.toLowerCase().includes(q)) out.push({ kind: "empty", label: emptyLabel });
    for (const x of extra) if (!q || x.label.toLowerCase().includes(q)) out.push({ kind: "extra", ...x });
    for (const p of projects) if (!q || p.name.toLowerCase().includes(q)) out.push({ kind: "project", p });
    return out;
  }, [projects, q, emptyLabel, extra]);

  const selected = projects.find((p) => p.id === value);
  const selectedExtra = extra.find((x) => x.value === value);
  const label = selected?.name ?? selectedExtra?.label ?? emptyLabel;

  const place = useCallback(() => {
    const el = trigger.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const margin = 8, vw = window.innerWidth, vh = window.innerHeight;
    const width = Math.min(Math.max(r.width, 240), vw - margin * 2);
    const left = Math.max(margin, Math.min(r.left, vw - width - margin));
    const below = vh - r.bottom - margin, above = r.top - margin;
    // Open downwards unless there's clearly more room above
    if (below < 260 && above > below) setPos({ left, width, bottom: vh - r.top + 6, maxH: Math.min(360, above - 6) });
    else setPos({ left, width, top: r.bottom + 6, maxH: Math.min(360, below - 6) });
  }, []);

  const openIt = () => {
    // Start on the current choice so it is highlighted and scrolled into view
    const idx = value == null ? 0
      : extra.some((x) => x.value === value) ? 1 + extra.findIndex((x) => x.value === value)
      : 1 + extra.length + Math.max(0, projects.findIndex((p) => p.id === value));
    setQuery(""); setActive(idx); place(); setOpen(true);
  };
  const close = useCallback((refocus = true) => { setOpen(false); if (refocus) trigger.current?.focus(); }, []);

  useLayoutEffect(() => { if (open) place(); }, [open, place]);
  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const onMove = () => place();
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open, place]);

  // Keep the highlighted row in range and in view
  useEffect(() => { if (active >= options.length) setActive(Math.max(0, options.length - 1)); }, [options.length, active]);
  useEffect(() => { panel.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: "nearest" }); }, [active, open]);

  function choose(o: Opt) {
    onChange(o.kind === "empty" ? null : o.kind === "extra" ? o.value : o.p.id);
    close();
  }

  async function create() {
    const name = (query.trim() || window.prompt("Name your new project (e.g. Wedding, Side hustle, Kids):") || "").trim();
    if (!name) return;
    // Typed the name of one that exists? Just pick it.
    const same = projects.find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (same) { onChange(same.id); close(); return; }
    try {
      const p = await api<Project>("/api/projects", { body: { name } });
      onCreated?.(p);
      onChange(p.id);
      close();
    } catch (e) { alert((e as Error).message); }
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(options.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (options[active]) choose(options[active]);
      else if (allowCreate) create();
    } else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === "Tab") close(false);
  }

  return (
    <>
      <button
        ref={trigger} type="button" title={title} style={style}
        className={`combo-trigger ${className}`} aria-haspopup="listbox" aria-expanded={open}
        onClick={() => (open ? close() : openIt())}
        onKeyDown={(e) => { if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) { e.preventDefault(); openIt(); } }}
      >
        {selected && <i className="combo-dot" style={{ background: colorOf(selected.color).dot }} />}
        <span className={`combo-label${selected || selectedExtra ? "" : " muted-label"}`}>{label}</span>
        <svg className="combo-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 9l6 6 6-6" /></svg>
      </button>

      {open && pos && typeof document !== "undefined" && createPortal(
        <>
        {/* A click anywhere else only closes the list (it must not reach a popup behind it and close that too). */}
        <div className="combo-shield" onMouseDown={(e) => e.preventDefault()} onClick={() => close(false)} />
        <div
          ref={panel} className="combo-panel" role="dialog" aria-label="Choose a project"
          style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxH }}
        >
          <div className="combo-search">
            <SearchIcon size={15} />
            <input
              ref={search} value={query} placeholder="Search projects…" aria-label="Search projects" autoComplete="off" autoCapitalize="none" spellCheck={false}
              onChange={(e) => { setQuery(e.target.value); setActive(0); }} onKeyDown={onKey}
            />
          </div>
          <div className="combo-list" role="listbox">
            {options.length === 0 && <div className="combo-none">No project matches “{query.trim()}”</div>}
            {options.map((o, i) => {
              const isSel = o.kind === "empty" ? value == null : o.kind === "extra" ? value === o.value : value === o.p.id;
              return (
                <div
                  key={o.kind === "project" ? o.p.id : o.kind === "extra" ? `x${o.value}` : "empty"}
                  role="option" aria-selected={isSel} data-active={i === active}
                  className={`combo-item${i === active ? " active" : ""}${isSel ? " sel" : ""}`}
                  onMouseEnter={() => setActive(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(o)}
                >
                  {o.kind === "project" ? <i className="combo-dot" style={{ background: colorOf(o.p.color).dot }} /> : <i className="combo-dot ghost" />}
                  <span className="combo-label">{o.kind === "project" ? o.p.name : o.label}</span>
                  {isSel && <span className="combo-check" aria-hidden>✓</span>}
                </div>
              );
            })}
          </div>
          {allowCreate && (
            <button type="button" className="combo-create" onMouseDown={(e) => e.preventDefault()} onClick={create}>
              <PlusIcon size={15} />
              <span>{query.trim() && !projects.some((p) => p.name.toLowerCase() === q) ? <>New project “<b>{query.trim()}</b>”</> : "New project…"}</span>
            </button>
          )}
        </div>
        </>,
        document.body,
      )}
    </>
  );
}
