// Small decorative charts for the KPI cards (area curve, wavy line, solid bar).
type Props = { values: number[]; color: string; kind?: "area" | "bar"; width?: number; height?: number };

export default function Sparkline({ values, color, kind = "area", width = 100, height = 56 }: Props) {
  const id = "g" + color.replace("#", "");
  if (kind === "bar") {
    const pct = Math.max(0, Math.min(1, values[0] ?? 0));
    return (
      <svg width={width} height={height} aria-hidden>
        <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".9" /><stop offset="1" stopColor={color} stopOpacity=".15" /></linearGradient></defs>
        <rect x="0" y="0" width={width} height={height} rx="4" fill={color} opacity=".08" />
        <rect x="0" y="0" width={Math.max(2, width * pct)} height={height} rx="4" fill={`url(#${id})`} />
      </svg>
    );
  }
  const v = values.length > 1 ? values : [0, 0];
  const max = Math.max(1, ...v);
  const pts = v.map((y, i) => [(i / (v.length - 1)) * width, height - 4 - (y / max) * (height - 10)] as const);
  // Smooth curve through the points (Catmull-Rom → Bezier).
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [p0, p1, p2, p3] = [pts[i - 1] ?? pts[i], pts[i], pts[i + 1], pts[i + 2] ?? pts[i + 1]];
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`;
  }
  return (
    <svg width={width} height={height} aria-hidden>
      <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".45" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={`${d} L${width},${height} L0,${height} Z`} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" />
    </svg>
  );
}
