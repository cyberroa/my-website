/** Cold (0) → hot (100) score color for live opportunity rankings. */

const STOPS: { t: number; hex: string }[] = [
  { t: 0, hex: "#6b7280" },
  { t: 25, hex: "#2BB4FF" },
  { t: 50, hex: "#C9A86C" },
  { t: 75, hex: "#FFFF84" },
  { t: 100, hex: "#E07A5F" },
];

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function scoreHeatColor(score: number): string {
  const x = Number.isFinite(score) ? Math.min(100, Math.max(0, score)) : 0;
  if (x <= 0) return STOPS[0].hex;
  let i = 0;
  while (i < STOPS.length - 2 && x > STOPS[i + 1].t) i += 1;
  const a = STOPS[i];
  const b = STOPS[i + 1];
  const t = (x - a.t) / (b.t - a.t);
  const [ar, ag, ab] = hexToRgb(a.hex);
  const [br, bg, bb] = hexToRgb(b.hex);
  const r = Math.round(lerp(ar, br, t));
  const g = Math.round(lerp(ag, bg, t));
  const bl = Math.round(lerp(ab, bb, t));
  return `rgb(${r}, ${g}, ${bl})`;
}
