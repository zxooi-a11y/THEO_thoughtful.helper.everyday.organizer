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
export const colorOf = (key: string | undefined | null) => COLORS[key ?? ""] ?? COLORS.gray;

/** The colours a person can choose for a project tag (gray is only the "no project" fallback). */
export const PALETTE = COLOR_KEYS.filter((k) => k !== "gray");

/** Colours for anything that sits under a project tag (event card side panel, calendar chips…). */
export function projectTheme(key: string | undefined | null) {
  const c = colorOf(key);
  return { accent: c.fg, panel: `${c.dot}1F`, pill: `${c.dot}38`, dot: c.dot };
}
