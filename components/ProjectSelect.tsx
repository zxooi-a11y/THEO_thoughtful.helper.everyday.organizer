"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { Project } from "@/lib/types";
import { colorOf, PALETTE } from "@/lib/colors";
import Swatches from "./Swatches";
import CategoryPicker from "./CategoryPicker";
import { categoryOf } from "@/lib/categories";
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
  // "New project" mini form
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PALETTE[0]);
  const [newCat, setNewCat] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);
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
    setQuery(""); setActive(idx); setCreating(false); place(); setOpen(true);
  };
  const close = useCallback((refocus = true) => { setOpen(false); if (refocus) trigger.current?.focus(); }, []);

  useLayoutEffect(() => { if (open) place(); }, [open, place]);
  useEffect(() => {
    if (!open) return;
    (creating ? nameInput.current : search.current)?.focus();
    const onMove = () => place();
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open, place, creating]);

  // Keep the highlighted row in range and in view
  useEffect(() => { if (active >= options.length) setActive(Math.max(0, options.length - 1)); }, [options.length, active]);
  useEffect(() => { panel.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: "nearest" }); }, [active, open]);

  function choose(o: Opt) {
    onChange(o.kind === "empty" ? null : o.kind === "extra" ? o.value : o.p.id);
    close();
  }

  // Step 1: open the form (name pre-filled from what was typed, next unused colour suggested)
  function startCreate() {
    const used = new Set(projects.map((p) => p.color));
    setNewName(query.trim());
    setNewCat(null);
    setNewColor(PALETTE.find((c) => !used.has(c)) ?? PALETTE[projects.length % PALETTE.length]);
    setCreating(true);
  }

  // Step 2: save it
  async function create() {
    const name = newName.trim();
    if (!name || saving) return;
    // Typed the name of one that exists? Just pick it.
    const same = projects.find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (same) { onChange(same.id); setCreating(false); close(); return; }
    setSaving(true);
    try {
      const p = await api<Project>("/api/projects", { body: { name, color: newColor, category: newCat } });
      onCreated?.(p);
      onChange(p.id);
      setCreating(false);
      close();
    } catch (e) { alert((e as Error).message); }
    finally { setSaving(false); }
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(options.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (options[active]) choose(options[active]);
      else if (allowCreate) startCreate();
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
          {creating ? (
            <div className="combo-form">
              <div className="combo-form-title">New project</div>
              <input
                ref={nameInput} className="combo-name" value={newName} placeholder="Project name" aria-label="Project name" autoComplete="off"
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); create(); } else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setCreating(false); } }}
              />
              <div className="combo-form-label">Colour</div>
              <Swatches value={newColor} onPick={setNewColor} />
              <div className="combo-form-label">Classification <span className="muted">· optional</span></div>
              <CategoryPicker compact value={newCat} onPick={setNewCat} />
              <div className="combo-form-actions">
                <button type="button" className="btn small" onClick={() => setCreating(false)}>Back</button>
                <button type="button" className="btn primary small" disabled={!newName.trim() || saving} onClick={create}>{saving ? "Creating…" : "Create project"}</button>
              </div>
            </div>
          ) : (<>
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
                  <span className="combo-label">{o.kind === "project" ? o.p.name : o.label}{o.kind === "project" && categoryOf(o.p.category) && <span className="combo-cat" title={categoryOf(o.p.category)!.label}>{categoryOf(o.p.category)!.emoji}</span>}</span>
                  {isSel && <span className="combo-check" aria-hidden>✓</span>}
                </div>
              );
            })}
          </div>
          {allowCreate && (
            <button type="button" className="combo-create" onMouseDown={(e) => e.preventDefault()} onClick={startCreate}>
              <PlusIcon size={15} />
              <span>{query.trim() && !projects.some((p) => p.name.toLowerCase() === q) ? <>New project “<b>{query.trim()}</b>”</> : "New project…"}</span>
            </button>
          )}
          </>)}
        </div>
        </>,
        document.body,
      )}
    </>
  );
}
