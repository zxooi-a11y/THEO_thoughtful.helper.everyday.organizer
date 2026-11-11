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

const ITEM = 40;               // height of one row in a wheel
const ROWS = 5;                // rows visible; the middle one is the selection
const PAD = ITEM * Math.floor(ROWS / 2);
const COPIES = 5;              // looping wheels repeat their list so they can spin round
const pad2 = (n: number) => String(n).padStart(2, "0");

const HOUR_ITEMS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTE_ITEMS = Array.from({ length: 60 }, (_, i) => pad2(i));
const AP_ITEMS = ["AM", "PM"];

type WheelProps = { items: string[]; index: number; loop?: boolean; label: string; onSelect: (i: number) => void };

/**
 * One scroll wheel, iPhone-alarm style: rows snap to the centre; the row in the middle is the selection.
 * Works by touch-scrolling, mouse wheel, dragging with a mouse, clicking a row, or Up/Down keys.
 */
function Wheel({ items, index, loop, label, onSelect }: WheelProps) {
  const el = useRef<HTMLDivElement>(null);
  const len = items.length;
  const copies = loop ? COPIES : 1;
  const middle = loop ? Math.floor(COPIES / 2) : 0;
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const raf = useRef<number | null>(null);
  const drag = useRef<{ y: number; top: number; moved: boolean } | null>(null);
  const lit = useRef<Element | null>(null);
  // While the wheel is moving (finger, momentum or a glide we started) it must not be re-positioned or committed mid-way
  const moving = useRef(false);
  const lockUntil = useRef(0);          // a glide we started is in progress until this time
  const heading = useRef<number | null>(null); // the row that glide is heading to

  const domOf = useCallback((i: number) => (loop ? middle * len + i : i), [loop, middle, len]);
  const nearest = () => Math.round((el.current?.scrollTop ?? 0) / ITEM);

  // Highlight the row in the centre as it passes
  const paint = useCallback(() => {
    const node = el.current;
    if (!node) return;
    const dom = Math.max(0, Math.min(len * copies - 1, nearest()));
    const next = node.children[dom];
    if (lit.current !== next) { lit.current?.classList.remove("on"); next?.classList.add("on"); lit.current = next ?? null; }
  }, [len, copies]); // eslint-disable-line react-hooks/exhaustive-deps

  // Start (and follow the value) in the right place
  useLayoutEffect(() => {
    const node = el.current;
    if (!node) return;
    if (moving.current || heading.current != null) { paint(); return; }
    const cur = nearest();
    const here = loop ? ((cur % len) + len) % len : cur;
    const stranded = loop && (cur < len || cur >= (COPIES - 1) * len);
    if (here !== index || stranded) { node.style.scrollBehavior = "auto"; node.scrollTop = domOf(index) * ITEM; }
    paint();
  }, [index, domOf, loop, len, paint]); // eslint-disable-line react-hooks/exhaustive-deps

  function settle() {
    const node = el.current;
    if (!node) return;
    // A glide we started (click / arrow key) is still under way: wait for it to land
    if (performance.now() < lockUntil.current) { settleTimer.current = setTimeout(settle, 80); return; }
    moving.current = false; heading.current = null;
    let dom = Math.max(0, Math.min(len * copies - 1, nearest()));
    const logical = ((dom % len) + len) % len;
    // Keep a looping wheel in its middle copy so there's always room to spin
    if (loop && (dom < len || dom >= (COPIES - 1) * len)) { node.style.scrollBehavior = "auto"; node.scrollTop = (middle * len + logical) * ITEM; dom = middle * len + logical; }
    paint();
    if (logical !== index) onSelect(logical);
  }

  function onScroll() {
    if (raf.current == null) raf.current = requestAnimationFrame(() => { raf.current = null; paint(); });
    moving.current = true;
    if (drag.current) return; // settle when the finger/mouse lets go
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(settle, 110);
  }

  const goTo = (dom: number, smooth = true) => {
    const node = el.current;
    if (!node) return;
    const max = len * copies - 1;
    const target = Math.max(0, Math.min(max, dom));
    heading.current = target;
    const logical = ((target % len) + len) % len;
    if (smooth && logical !== index) onSelect(logical);
    lockUntil.current = performance.now() + (smooth ? 450 : 0);
    node.style.scrollBehavior = smooth ? "smooth" : "auto";
    node.scrollTop = target * ITEM;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(settle, smooth ? 200 : 110);
  };

  // Mouse dragging (touch already scrolls natively). The wheel only grabs the mouse once it really starts
  // to drag, so a plain click on a row still reaches that row.
  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType !== "mouse" || e.button !== 0 || !el.current) return;
    drag.current = { y: e.clientY, top: el.current.scrollTop, moved: false };
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || !el.current) return;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.abs(dy) > 4) {
      d.moved = true;
      el.current.style.scrollSnapType = "none";
      el.current.style.scrollBehavior = "auto";
      el.current.setPointerCapture(e.pointerId);
    }
    if (d.moved) el.current.scrollTop = d.top - dy;
  }
  function onPointerUp(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || !el.current) return;
    if (d.moved) {
      el.current.releasePointerCapture?.(e.pointerId);
      el.current.style.scrollSnapType = "";
      goTo(nearest()); // glide to the closest row
      if (settleTimer.current) clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(settle, 220);
      // the click that follows a drag must not pick a row
      setTimeout(() => { drag.current = null; }, 0);
    } else {
      drag.current = null;
    }
  }

  function onKey(e: React.KeyboardEvent) {
    const step = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : e.key === "PageUp" ? -5 : e.key === "PageDown" ? 5 : 0;
    if (!step) return;
    e.preventDefault();
    goTo((heading.current ?? nearest()) + step); // step from where the last key press is heading, so quick presses add up
  }

  return (
    <div
      ref={el} className="wheel" role="listbox" aria-label={label} tabIndex={0}
      onScroll={onScroll} onKeyDown={onKey}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
    >
      {Array.from({ length: len * copies }, (_, dom) => {
        const i = dom % len;
        return (
          <div
            key={dom} role="option" aria-selected={i === index} className="wheel-item"
            onClick={() => { if (!drag.current?.moved) goTo(dom); }}
          >
            {items[i]}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Time picker in the app's own style: scroll the hour, minute and AM/PM wheels like an iPhone alarm,
 * or type a time ("430pm", "16:30", "noon"). Changes apply as the wheels settle; Done closes it.
 */
export default function TimeField({ value, onChange, required, className = "input", style, placeholder = "Pick a time", title, "aria-label": ariaLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ h12: number; m: number; ap: Meridiem }>({ h12: 9, m: 0, ap: "AM" });
  const [text, setText] = useState("");
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLInputElement>(null);

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
    const s = splitTime(value);
    setDraft(s ? { h12: s.h12, m: s.m, ap: s.ap } : { h12: 9, m: 0, ap: "AM" });
    setText(value ? fmtTime(value) : "");
    place(); setOpen(true);
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

  // If the value changes from outside the wheels (typing, Clear), the wheels follow
  useEffect(() => {
    const s = splitTime(value);
    if (s) setDraft({ h12: s.h12, m: s.m, ap: s.ap });
  }, [value]);

  function spin(patch: Partial<typeof draft>) {
    const next = { ...draft, ...patch };
    setDraft(next);
    const v = joinTime(next.h12, next.m, next.ap);
    onChange(v);
    setText(fmtTime(v));
  }

  function typed(raw: string) {
    setText(raw);
    const v = parseTimeInput(raw, draft.ap);
    if (v) onChange(v);
  }
  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); const v = parseTimeInput(text, draft.ap); if (v) { onChange(v); close(); } else if (!text.trim() && !required) { onChange(""); close(); } }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === "Tab") close(false);
  }
  function done() {
    // Pressing Done on an empty time accepts what the wheels show (like Save on a phone alarm)
    if (!value) onChange(joinTime(draft.h12, draft.m, draft.ap));
    close();
  }

  const invalid = text.trim() !== "" && parseTimeInput(text, draft.ap) === null;

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
          <div className="dp-panel tp-panel" role="dialog" aria-label="Choose a time" style={{ left: pos.left, top: pos.top, bottom: pos.bottom }}>
            <div className="tp-entry">
              <ClockIcon size={16} />
              <input
                ref={field} value={text} onChange={(e) => typed(e.target.value)} onKeyDown={onInputKey}
                placeholder={value ? "" : "Scroll below, or type e.g. 4:30pm"}
                aria-label="Time" aria-invalid={invalid} autoComplete="off" autoCapitalize="none" spellCheck={false} inputMode="text"
              />
            </div>
            {invalid && <div className="tp-hint">Try something like 4:30pm or 16:30</div>}

            <div className="wheels" style={{ height: ITEM * ROWS }}>
              <div className="wheels-band" style={{ top: PAD, height: ITEM }} aria-hidden />
              <Wheel label="Hour" items={HOUR_ITEMS} index={draft.h12 - 1} loop onSelect={(i) => spin({ h12: i + 1 })} />
              <div className="wheels-colon" style={{ top: PAD, height: ITEM }} aria-hidden>:</div>
              <Wheel label="Minute" items={MINUTE_ITEMS} index={draft.m} loop onSelect={(i) => spin({ m: i })} />
              <Wheel label="AM or PM" items={AP_ITEMS} index={draft.ap === "AM" ? 0 : 1} onSelect={(i) => spin({ ap: i === 0 ? "AM" : "PM" })} />
            </div>

            <div className="dp-foot">
              {!required && value ? <button type="button" onClick={() => { onChange(""); setText(""); close(); }}>Clear</button> : <span />}
              <button type="button" onClick={done}>Done</button>
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
