/** What a caption is written with. Each font draws at a different natural size, so `scale` evens them out. */
export const PENS = {
  pen: { label: "Pen", cls: "font-hand", scale: 1 },
  marker: { label: "Marker", cls: "font-marker", scale: 0.78 },
  pencil: { label: "Pencil", cls: "font-pencil", scale: 1.12 },
  type: { label: "Typewriter", cls: "font-type", scale: 0.68 },
  comic: { label: "Comic Sans", cls: "font-comic", scale: 0.74 },
} as const;
export type Pen = keyof typeof PENS;

export const INKS = {
  ink: { label: "Black", color: "#2a251e" },
  blue: { label: "Blue", color: "#2747a6" },
  red: { label: "Red", color: "#c4362b" },
  green: { label: "Green", color: "#2e7a4c" },
} as const;
export type Ink = keyof typeof INKS;

/** Pencil is graphite whatever ink you picked. */
export function inkColor(pen: Pen | null | undefined, ink: Ink | null | undefined): string {
  if (pen === "pencil") return "#5f5a52";
  return INKS[ink ?? "ink"]?.color ?? INKS.ink.color;
}

export function penOf(p: { caption_pen?: string | null }): Pen {
  return p.caption_pen && p.caption_pen in PENS ? (p.caption_pen as Pen) : "pen";
}
export function inkOf(p: { caption_ink?: string | null }): Ink {
  return p.caption_ink && p.caption_ink in INKS ? (p.caption_ink as Ink) : "ink";
}

const LAST = "shoebox-pen";
/** The pen you used last time is the default next time. */
export function lastPen(): { pen: Pen; ink: Ink } {
  try {
    const v = JSON.parse(localStorage.getItem(LAST) ?? "null");
    if (v && v.pen in PENS && v.ink in INKS) return v;
  } catch {}
  return { pen: "pen", ink: "ink" };
}
export function rememberPen(pen: Pen, ink: Ink) {
  try {
    localStorage.setItem(LAST, JSON.stringify({ pen, ink }));
  } catch {}
}

/* ---------- doodles ---------- */

/** A freehand drawing over a photo. Coordinates are 0..1 of the photo's width and height. */
export type Stroke = { c: string; w: number; p: number[] };
export type Doodle = { v: 1; strokes: Stroke[] };

export const DOODLE_COLORS = ["#ffffff", "#1f1b16", "#ff4d3d", "#ffd23f", "#3d8bff", "#3ddc84"];

/** Smooth SVG path through the points (quadratic curves via midpoints), in a box of width w and height h. */
export function strokePath(s: Stroke, w: number, h: number): string {
  const pts = s.p;
  if (pts.length < 2) return "";
  const X = (i: number) => (pts[i] * w).toFixed(1);
  const Y = (i: number) => (pts[i + 1] * h).toFixed(1);
  if (pts.length === 2) return `M${X(0)} ${Y(0)}l0.01 0`; // a dot
  let d = `M${X(0)} ${Y(0)}`;
  for (let i = 2; i < pts.length - 2; i += 2) {
    const mx = (((pts[i] + pts[i + 2]) / 2) * w).toFixed(1);
    const my = (((pts[i + 1] + pts[i + 3]) / 2) * h).toFixed(1);
    d += `Q${X(i)} ${Y(i)} ${mx} ${my}`;
  }
  const n = pts.length - 2;
  return d + `L${X(n)} ${Y(n)}`;
}
