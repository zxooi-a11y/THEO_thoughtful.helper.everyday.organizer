"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { fmtTime, joinTime, parseTimeInput, splitTime, type Meridiem } from "@/lib/time";
import { ClockIcon } from "./Icons";

type Props = {
  /** 24-hour "HH:MM" or "" */
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  className?: string;
  style?: CSSProperties;
  placeholder?: string;
  title?: string;
  "aria-label"?: string;
};

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Time picker in the app's own style (the browser's built-in one can't be restyled): tap an hour, a minute
 * and AM/PM, or type a time ("430pm", "16:30", "noon"). Changes apply immediately; Done just closes it.
 */
export default function TimeField({ value, onChange, required, className = "input", style, placeholder = "Pick a time", title, "aria-label": ariaLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [ap, setAp] = useState<Meridiem>("AM");
  const [text, setText] = useState("");
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const cur = splitTime(value);

  const place = useCallback(() => {
    const el = trigger.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const margin = 8, W = 296, H = 400, vw = window.innerWidth, vh = window.innerHeight;
    const left = Math.max(margin, Math.min(r.left, vw - W - margin));
    const below = vh - r.bottom - margin, above = r.top - margin;
    if (below < H && above > below) setPos({ left, bottom: vh - r.top + 6 });
    else setPos({ left, top: r.bottom + 6 });
  }, []);

  const openIt = () => {
    setAp(cur?.ap ?? "AM");
    setText(value ? fmtTime(value) : "");
    place(); setOpen(true);
  };
  const close = useCallback((refocus = true) => { setOpen(false); if (refocus) trigger.current?.focus(); }, []);

  useLayoutEffect(() => { if (open) place(); }, [open, place]);
  useEffect(() => {
    if (!open) return;
    // Typing is handy on a computer; on a phone don't pop the keyboard over the tap targets
    if (window.matchMedia("(pointer: fine)").matches) field.current?.focus();
    const onMove = () => place();
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => { window.removeEventListener("resize", onMove); window.removeEventListener("scroll", onMove, true); };
  }, [open, place]);

  const commit = (v: string) => { onChange(v); setText(v ? fmtTime(v) : ""); };
  const pickHour = (h: number) => commit(joinTime(h, cur?.m ?? 0, ap));
  const pickMinute = (m: number) => commit(joinTime(cur?.h12 ?? 9, m, ap));
  const pickAp = (next: Meridiem) => { setAp(next); if (cur) commit(joinTime(cur.h12, cur.m, next)); };

  function typed(raw: string) {
    setText(raw);
    const v = parseTimeInput(raw, ap);
    if (v) { onChange(v); const s = splitTime(v); if (s) setAp(s.ap); }
  }
  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); const v = parseTimeInput(text, ap); if (v) { commit(v); close(); } else if (!text.trim() && !required) { commit(""); close(); } }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === "Tab") close(false);
  }

  const invalid = text.trim() !== "" && parseTimeInput(text, ap) === null;

  return (
    <>
      <button
        ref={trigger} type="button" title={title} style={style} aria-label={ariaLabel} aria-haspopup="dialog" aria-expanded={open}
        className={`datefield-trigger ${className}`} onClick={() => (open ? close() : openIt())}
        onKeyDown={(e) => { if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) { e.preventDefault(); openIt(); } }}
      >
        <ClockIcon size={16} />
        <span className={`df-text${value ? "" : " df-placeholder"}`}>{value ? fmtTime(value) : placeholder}</span>
      </button>

      {open && pos && typeof document !== "undefined" && createPortal(
        <>
          {/* A click anywhere else only closes the picker, not a popup behind it */}
          <div className="combo-shield" onMouseDown={(e) => e.preventDefault()} onClick={() => close(false)} />
          <div ref={panel} className="dp-panel tp-panel" role="dialog" aria-label="Choose a time" style={{ left: pos.left, top: pos.top, bottom: pos.bottom }}>
            <div className="tp-entry">
              <ClockIcon size={16} />
              <input
                ref={field} value={text} onChange={(e) => typed(e.target.value)} onKeyDown={onInputKey} placeholder="Type a time, e.g. 4:30pm"
                aria-label="Time" aria-invalid={invalid} autoComplete="off" autoCapitalize="none" spellCheck={false} inputMode="text"
              />
            </div>
            {invalid && <div className="tp-hint">Try something like 4:30pm or 16:30</div>}

            <div className="tp-label">Hour</div>
            <div className="tp-grid">
              {HOURS.map((h) => (
                <button type="button" key={h} className={`tp-btn${cur?.h12 === h ? " sel" : ""}`} aria-pressed={cur?.h12 === h} onClick={() => pickHour(h)}>{h}</button>
              ))}
            </div>

            <div className="tp-label">Minute</div>
            <div className="tp-grid">
              {MINUTES.map((m) => (
                <button type="button" key={m} className={`tp-btn${cur?.m === m ? " sel" : ""}`} aria-pressed={cur?.m === m} onClick={() => pickMinute(m)}>{pad(m)}</button>
              ))}
            </div>

            <div className="tp-ampm" role="radiogroup" aria-label="AM or PM">
              {(["AM", "PM"] as Meridiem[]).map((x) => (
                <button type="button" key={x} role="radio" aria-checked={ap === x} className={ap === x ? "on" : ""} onClick={() => pickAp(x)}>{x}</button>
              ))}
            </div>

            <div className="dp-foot">
              {!required && value ? <button type="button" onClick={() => { commit(""); close(); }}>Clear</button> : <span />}
              <button type="button" onClick={() => close()}>Done</button>
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
