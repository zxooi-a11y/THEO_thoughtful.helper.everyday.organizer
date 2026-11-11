"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { addDays, startOfWeek, toDate, toISO } from "@/lib/brain/dates";
import { localToday } from "./client";
import { CalendarIcon, ChevronL, ChevronR } from "./Icons";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MON3 = MONTHS.map((m) => m.slice(0, 3));
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Props = {
  /** "YYYY-MM-DD" or "" */
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
  /** A required date can't be cleared. */
  required?: boolean;
  className?: string;
  style?: CSSProperties;
  placeholder?: string;
  title?: string;
  "aria-label"?: string;
};

const parts = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return { y, m, d }; };
const iso = (y: number, m: number, d: number) => toISO(new Date(Date.UTC(y, m - 1, d)));
const monthStart = (s: string) => s.slice(0, 8) + "01";
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
/** Move by whole months, keeping the day of month where possible. */
function shiftMonths(s: string, n: number): string {
  const { y, m, d } = parts(s);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, Math.min(d, daysIn(t.getUTCFullYear(), t.getUTCMonth() + 1)));
}
const weekdayName = (s: string) => WEEKDAYS[(toDate(s).getUTCDay() + 6) % 7];
const pretty = (s: string) => { const { y, m, d } = parts(s); return `${weekdayName(s)}, ${d} ${MON3[m - 1]} ${y}`; };

/**
 * Date picker in the app's own style (the browser's built-in calendar can't be restyled).
 * Mouse, touch and keyboard: arrows move by day/week, PageUp/PageDown by month, Enter picks, Esc closes.
 */
export default function DateField({ value, onChange, min, max, required, className = "input", style, placeholder = "Pick a date", title, "aria-label": ariaLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"days" | "months">("days");
  const [cursor, setCursor] = useState(""); // first day of the month being shown
  const [focus, setFocus] = useState("");   // the day the keyboard is on
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const today = localToday();

  const blocked = useCallback((d: string) => (!!min && d < min) || (!!max && d > max), [min, max]);

  const place = useCallback(() => {
    const el = trigger.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const margin = 8, W = 308, H = 372, vw = window.innerWidth, vh = window.innerHeight;
    const left = Math.max(margin, Math.min(r.left, vw - W - margin));
    const below = vh - r.bottom - margin, above = r.top - margin;
    if (below < H && above > below) setPos({ left, bottom: vh - r.top + 6 });
    else setPos({ left, top: r.bottom + 6 });
  }, []);

  const openIt = () => {
    const base = value || (min && today < min ? min : today);
    setCursor(monthStart(base)); setFocus(base); setView("days"); place(); setOpen(true);
  };
  const close = useCallback((refocus = true) => { setOpen(false); if (refocus) trigger.current?.focus(); }, []);

  useLayoutEffect(() => { if (open) place(); }, [open, place]);
  useEffect(() => {
    if (!open) return;
    const onMove = () => place();
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => { window.removeEventListener("resize", onMove); window.removeEventListener("scroll", onMove, true); };
  }, [open, place]);

  // Keep real focus on the keyboard's day so arrows and screen readers follow along
  useEffect(() => {
    if (open && view === "days") panel.current?.querySelector<HTMLButtonElement>(`[data-date="${focus}"]`)?.focus();
  }, [open, view, focus, cursor]);

  const pick = (d: string) => { if (blocked(d)) return; onChange(d); close(); };

  function goTo(next: string) {
    setFocus(next);
    if (monthStart(next) !== cursor) setCursor(monthStart(next));
  }
  function onGridKey(e: React.KeyboardEvent) {
    const step: Record<string, () => string> = {
      ArrowLeft: () => addDays(focus, -1), ArrowRight: () => addDays(focus, 1),
      ArrowUp: () => addDays(focus, -7), ArrowDown: () => addDays(focus, 7),
      Home: () => startOfWeek(focus), End: () => addDays(startOfWeek(focus), 6),
      PageUp: () => shiftMonths(focus, -1), PageDown: () => shiftMonths(focus, 1),
    };
    if (step[e.key]) { e.preventDefault(); goTo(step[e.key]()); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(focus); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === "Tab") close(false);
  }

  // Six weeks starting on Monday, like the rest of the app
  const first = cursor || monthStart(today);
  const gridStart = startOfWeek(first);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const { y: cy, m: cm } = parts(first);

  return (
    <>
      <button
        ref={trigger} type="button" title={title} style={style} aria-label={ariaLabel} aria-haspopup="dialog" aria-expanded={open}
        className={`datefield-trigger ${className}`} onClick={() => (open ? close() : openIt())}
        onKeyDown={(e) => { if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) { e.preventDefault(); openIt(); } }}
      >
        <CalendarIcon size={16} />
        <span className={`df-text${value ? "" : " df-placeholder"}`}>{value ? pretty(value) : placeholder}</span>
      </button>

      {open && pos && typeof document !== "undefined" && createPortal(
        <>
          {/* A click anywhere else only closes the calendar, not a popup behind it */}
          <div className="combo-shield" onMouseDown={(e) => e.preventDefault()} onClick={() => close(false)} />
          <div ref={panel} className="dp-panel" role="dialog" aria-label="Choose a date" style={{ left: pos.left, top: pos.top, bottom: pos.bottom }}>
            <div className="dp-head">
              <button type="button" className="dp-title" onClick={() => setView(view === "days" ? "months" : "days")} aria-label={view === "days" ? "Choose month and year" : "Back to days"}>
                {view === "days" ? `${MONTHS[cm - 1]} ${cy}` : cy}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden
                  style={{ transform: view === "months" ? "rotate(180deg)" : undefined }}><path d="M6 9l6 6 6-6" /></svg>
              </button>
              <div className="row" style={{ gap: 6 }}>
                <button type="button" className="dp-nav" aria-label={view === "days" ? "Previous month" : "Previous year"}
                  onClick={() => { const n = shiftMonths(first, view === "days" ? -1 : -12); setCursor(monthStart(n)); if (view === "days") setFocus(n); }}><ChevronL size={15} /></button>
                <button type="button" className="dp-nav" aria-label={view === "days" ? "Next month" : "Next year"}
                  onClick={() => { const n = shiftMonths(first, view === "days" ? 1 : 12); setCursor(monthStart(n)); if (view === "days") setFocus(n); }}><ChevronR size={15} /></button>
              </div>
            </div>

            {view === "months" ? (
              <div className="dp-months">
                {MON3.map((name, i) => (
                  <button type="button" key={name} className={`dp-month${i + 1 === cm ? " sel" : ""}`}
                    onClick={() => { const n = iso(cy, i + 1, Math.min(parts(focus || first).d, daysIn(cy, i + 1))); setCursor(monthStart(n)); setFocus(n); setView("days"); }}>
                    {name}
                  </button>
                ))}
              </div>
            ) : (
              <>
                <div className="dp-week" aria-hidden>{WEEKDAYS.map((w) => <span key={w} className="dp-wd">{w.slice(0, 2)}</span>)}</div>
                <div className="dp-days" role="grid" onKeyDown={onGridKey}>
                  {days.map((d) => {
                    const out = d.slice(0, 7) !== first.slice(0, 7);
                    return (
                      <button
                        type="button" key={d} data-date={d} tabIndex={d === focus ? 0 : -1} disabled={blocked(d)}
                        aria-label={pretty(d)} aria-pressed={d === value}
                        className={`dp-day${out ? " out" : ""}${d === today ? " today" : ""}${d === value ? " sel" : ""}`}
                        onClick={() => pick(d)}
                      >
                        {parts(d).d}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <div className="dp-foot">
              {!required && value ? <button type="button" onClick={() => { onChange(""); close(); }}>Clear</button> : <span />}
              <button type="button" disabled={blocked(today)} onClick={() => pick(today)}>Today</button>
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
