// Pastel chip palette matching the reference design: soft background + strong text.
export const COLORS: Record<string, { bg: string; fg: string; dot: string }> = {
  blue:   { bg: "#E3F1FD", fg: "#2B6CB0", dot: "#4A9FE8" },
  purple: { bg: "#EFE6FB", fg: "#6B46C1", dot: "#9F7AEA" },
  indigo: { bg: "#E4E4FB", fg: "#4C51BF", dot: "#7F84E8" },
  orange: { bg: "#FDEFDF", fg: "#B7631A", dot: "#F0A04B" },
  green:  { bg: "#DFF5E3", fg: "#2F855A", dot: "#5CC97B" },
  pink:   { bg: "#FBE4EE", fg: "#B83280", dot: "#ED64A6" },
  yellow: { bg: "#FCF4D6", fg: "#975A16", dot: "#E9B949" },
  teal:   { bg: "#DDF4F2", fg: "#2C7A7B", dot: "#4FD1C5" },
  red:    { bg: "#FDE4E4", fg: "#C53030", dot: "#F05252" },
  lime:   { bg: "#EAF5D3", fg: "#4D7C0F", dot: "#84CC16" },
  cyan:   { bg: "#DCF3F8", fg: "#0E7490", dot: "#22B8D6" },
  slate:  { bg: "#E7EBF0", fg: "#475569", dot: "#64748B" },
  gray:   { bg: "#EEEEEE", fg: "#555555", dot: "#A0A0A0" },
};
export const COLOR_KEYS = Object.keys(COLORS);

const HEX = /^#[0-9a-f]{6}$/i;
export const isHexColor = (v: unknown): v is string => typeof v === "string" && HEX.test(v);

/** A palette name or a custom "#rrggbb" colour → what to store; null when it's neither. */
export function normalizeColor(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (COLORS[t] && t !== "gray") return t;
  return HEX.test(t) ? t.toLowerCase() : null;
}

const rgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const toHex = (c: number[]) => "#" + c.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, "0")).join("");
/** t = 0 → a, t = 1 → b */
const mix = (a: [number, number, number], b: [number, number, number], t: number) => a.map((x, i) => x + (b[i] - x) * t) as [number, number, number];
const luminance = ([r, g, b]: [number, number, number]) => {
  const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

/**
 * Colours for a stored project colour: a palette name or a custom hex.
 * For a custom colour, `dot` is the colour itself, `bg` a soft tint of it, and `fg` a darkened version
 * (darker still for light colours) so text on the tint stays readable.
 */
export const colorOf = (key: string | undefined | null) => {
  if (key && HEX.test(key)) {
    const c = rgb(key);
    const dark = luminance(c) > 0.5 ? 0.62 : 0.42;
    return { dot: key.toLowerCase(), bg: toHex(mix(c, [255, 255, 255], 0.84)), fg: toHex(mix(c, [0, 0, 0], dark)) };
  }
  return COLORS[key ?? ""] ?? COLORS.gray;
};

/** The colours a person can choose for a project tag (gray is only the "no project" fallback). */
export const PALETTE = COLOR_KEYS.filter((k) => k !== "gray");

/** Colours for anything that sits under a project tag (event card side panel, calendar chips…). */
export function projectTheme(key: string | undefined | null) {
  const c = colorOf(key);
  return { accent: c.fg, panel: `${c.dot}1F`, pill: `${c.dot}38`, dot: c.dot };
}
