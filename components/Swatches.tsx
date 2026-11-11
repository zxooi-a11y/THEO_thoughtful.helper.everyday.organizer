"use client";
import { useEffect, useState } from "react";
import { colorOf, isHexColor, PALETTE } from "@/lib/colors";

/**
 * Row of colour dots, plus a "custom" dot that opens the device's colour picker.
 * The chosen colour is ringed. For a custom colour a hex box appears so an exact value can be typed or pasted.
 */
export default function Swatches({ value, onPick }: { value: string; onPick: (c: string) => void }) {
  const custom = isHexColor(value);
  const [hex, setHex] = useState(custom ? value : "");
  useEffect(() => { if (isHexColor(value)) setHex(value); }, [value]);

  const typed = (raw: string) => {
    let t = raw.trim().toLowerCase();
    if (t && !t.startsWith("#")) t = "#" + t;
    setHex(t.slice(0, 7));
    if (/^#[0-9a-f]{6}$/.test(t)) onPick(t);
  };

  return (
    <div className="swatch-wrap">
      <div className="swatches" role="radiogroup" aria-label="Colour">
        {PALETTE.map((k) => (
          <button type="button" key={k} role="radio" aria-checked={value === k} className={`swatch ${value === k ? "on" : ""}`}
            style={{ background: colorOf(k).dot }} onClick={() => onPick(k)} aria-label={k} title={k} />
        ))}
        {/* Custom colour: a rainbow dot (or the chosen colour) over a native colour input */}
        <label className={`swatch custom ${custom ? "on has" : ""}`} title="Custom colour" style={custom ? { background: value } : undefined}>
          <input type="color" value={custom ? value : "#6366f1"} aria-label="Custom colour"
            onChange={(e) => { setHex(e.target.value); onPick(e.target.value); }} />
          {!custom && <span aria-hidden>+</span>}
        </label>
      </div>
      {custom && (
        <label className="hexbox">
          <span className="small muted">Hex</span>
          <input className="input" value={hex} onChange={(e) => typed(e.target.value)} maxLength={7} spellCheck={false} autoCapitalize="none" aria-label="Hex colour" placeholder="#3b82f6" />
        </label>
      )}
    </div>
  );
}
