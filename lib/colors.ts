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
  gray:   { bg: "#EEEEEE", fg: "#555555", dot: "#A0A0A0" },
};
export const COLOR_KEYS = Object.keys(COLORS);
export const colorOf = (key: string | undefined | null) => COLORS[key ?? ""] ?? COLORS.gray;
