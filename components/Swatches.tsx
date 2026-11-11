"use client";
import { colorOf, PALETTE } from "@/lib/colors";

/** Row of colour dots; the chosen one is ringed. */
export default function Swatches({ value, onPick }: { value: string; onPick: (c: string) => void }) {
  return (
    <div className="swatches" role="radiogroup" aria-label="Colour">
      {PALETTE.map((k) => (
        <button type="button" key={k} role="radio" aria-checked={value === k} className={`swatch ${value === k ? "on" : ""}`}
          style={{ background: colorOf(k).dot }} onClick={() => onPick(k)} aria-label={k} title={k} />
      ))}
    </div>
  );
}
