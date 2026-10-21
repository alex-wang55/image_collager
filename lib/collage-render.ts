/**
 * Draws a set of photos into one shareable image. Three looks:
 *  - scrapbook: prints scattered on paper with tape and handwritten captions
 *  - grid: clean rows with thin gutters
 *  - strip: a photo-booth strip, up to four frames
 */

export type Style = "scrapbook" | "grid" | "strip";
export type Format = "post" | "story";
export type Pic = { img: CanvasImageSource; width: number; height: number; caption: string | null };

const PAPER = "#f3eee4";
const PRINT = "#fffdf9";
const INK = "#2a251e";
const MUTED = "#8a8174";
const TAPE = "rgba(236, 222, 186, 0.86)";

export type RenderOpts = {
  pics: Pic[];
  style: Style;
  format: Format;
  title: string;
  subtitle: string;
  seed: number;
  hand: string; // CSS font-family for the handwriting font
  sans: string;
};

export function canvasSize(style: Style, format: Format, count: number) {
  if (style === "strip") {
    const n = Math.min(4, count);
    return { w: 640, h: 40 + n * 392 + (n - 1) * 24 + 210 };
  }
  return format === "story" ? { w: 1080, h: 1920 } : { w: 1080, h: 1350 };
}

export async function renderCollage(o: RenderOpts): Promise<Blob> {
  const { w, h } = canvasSize(o.style, o.format, o.pics.length);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  if (o.style === "grid") drawGrid(ctx, w, h, o);
  else if (o.style === "strip") drawStrip(ctx, w, h, o);
  else drawScrapbook(ctx, w, h, o);
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.92));
  c.width = c.height = 0;
  if (!blob) throw new Error("Couldn't make the image");
  return blob;
}

/* ---------- shared bits ---------- */

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fill a box with the photo, cropping the overflow from the centre (like object-fit: cover). */
function cover(ctx: CanvasRenderingContext2D, p: Pic, x: number, y: number, bw: number, bh: number) {
  const s = Math.max(bw / p.width, bh / p.height);
  const sw = bw / s;
  const sh = bh / s;
  ctx.drawImage(p.img, (p.width - sw) / 2, (p.height - sh) / 2, sw, sh, x, y, bw, bh);
}

function paper(ctx: CanvasRenderingContext2D, w: number, h: number, dots = true) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, w, h);
  if (!dots) return;
  ctx.fillStyle = "rgba(120, 100, 70, 0.07)";
  for (let y = 4; y < h; y += 12) for (let x = (y / 12) % 2 ? 4 : 10; x < w; x += 12) ctx.fillRect(x, y, 2, 2);
}

function fitText(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > max) t = t.slice(0, -1);
  return t.trimEnd() + "…";
}

function tape(ctx: CanvasRenderingContext2D, cx: number, cy: number, len: number, angle: number) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.fillStyle = TAPE;
  const hh = len * 0.28;
  ctx.beginPath();
  // torn ends
  ctx.moveTo(-len / 2, -hh / 2);
  ctx.lineTo(len / 2, -hh / 2 + 2);
  ctx.lineTo(len / 2 - 4, 0);
  ctx.lineTo(len / 2, hh / 2);
  ctx.lineTo(-len / 2 + 2, hh / 2 - 1);
  ctx.lineTo(-len / 2 + 5, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/* ---------- scrapbook ---------- */

function drawScrapbook(ctx: CanvasRenderingContext2D, w: number, h: number, o: RenderOpts) {
  const rand = rng(o.seed);
  paper(ctx, w, h);
  const story = o.format === "story";
  const top = story ? 250 : 170;

  ctx.fillStyle = INK;
  ctx.font = `700 ${story ? 104 : 88}px ${o.hand}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(fitText(ctx, o.title, w - 140), 70, top - (story ? 80 : 58));
  ctx.fillStyle = MUTED;
  ctx.font = `500 ${story ? 34 : 30}px ${o.sans}`;
  ctx.fillText(o.subtitle, 74, top - (story ? 30 : 18));

  const n = o.pics.length;
  const cols = n === 1 ? 1 : n <= 4 ? 2 : 3;
  const rows = Math.ceil(n / cols);
  const ax = 40;
  const aw = w - 80;
  const ay = top + 10;
  const ah = h - ay - 50;
  const cw = aw / cols;
  const ch = ah / rows;
  const frameRatio = 0.05 + 1.25 + 0.22; // frame height / width for a 4:5 photo with a thick bottom edge
  const pw = Math.min(cw * 0.98, (ch * 0.98) / frameRatio) * (n === 1 ? 0.9 : 1.04);

  const order = o.pics.map((p, i) => ({ p, i })).sort(() => rand() - 0.5);
  for (const { p, i } of order) {
    const r = Math.floor(i / cols);
    const inRow = Math.min(cols, n - r * cols);
    const col = i % cols;
    const rowOffset = ((cols - inRow) * cw) / 2;
    const cx = ax + rowOffset + cw * (col + 0.5) + (rand() - 0.5) * cw * 0.12;
    const cy = ay + ch * (r + 0.5) + (rand() - 0.5) * ch * 0.08;
    const angle = ((rand() - 0.5) * 12 * Math.PI) / 180;
    drawPrint(ctx, p, cx, cy, pw, angle, o.hand, rand() < 0.45 ? (rand() - 0.5) * 0.5 : null);
  }
}

function drawPrint(ctx: CanvasRenderingContext2D, p: Pic, cx: number, cy: number, pw: number, angle: number, hand: string, tapeAngle: number | null) {
  const pad = pw * 0.05;
  const iw = pw - pad * 2;
  const ih = iw * 1.25;
  const foot = pw * 0.22;
  const ph = pad + ih + foot;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.shadowColor = "rgba(50, 36, 20, 0.28)";
  ctx.shadowBlur = pw * 0.07;
  ctx.shadowOffsetY = pw * 0.025;
  ctx.fillStyle = PRINT;
  ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
  ctx.shadowColor = "transparent";
  cover(ctx, p, -pw / 2 + pad, -ph / 2 + pad, iw, ih);
  if (p.caption) {
    ctx.fillStyle = INK;
    ctx.font = `500 ${Math.round(pw * 0.085)}px ${hand}`;
    ctx.textBaseline = "middle";
    ctx.fillText(fitText(ctx, p.caption, iw - pad), -pw / 2 + pad * 1.6, -ph / 2 + pad + ih + foot * 0.52);
  }
  if (tapeAngle !== null) tape(ctx, 0, -ph / 2 + 2, pw * 0.36, tapeAngle * 0.4);
  ctx.restore();
}

/* ---------- grid ---------- */

const ROWS: Record<number, number[]> = {
  1: [1],
  2: [1, 1],
  3: [1, 2],
  4: [2, 2],
  5: [2, 3],
  6: [2, 2, 2],
  7: [2, 3, 2],
  8: [3, 2, 3],
  9: [3, 3, 3],
};

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, o: RenderOpts) {
  paper(ctx, w, h, false);
  const story = o.format === "story";
  const m = 36;
  const g = 12;
  const foot = story ? 220 : 130;
  const rows = ROWS[Math.min(9, o.pics.length)] ?? [3, 3, 3];
  const gh = h - m - foot;
  const rh = (gh - g * (rows.length - 1)) / rows.length;
  let i = 0;
  rows.forEach((count, r) => {
    const cw = (w - 2 * m - g * (count - 1)) / count;
    for (let c = 0; c < count; c++) {
      const p = o.pics[i++];
      if (p) cover(ctx, p, m + c * (cw + g), m + r * (rh + g), cw, rh);
    }
  });
  ctx.fillStyle = INK;
  ctx.textBaseline = "alphabetic";
  ctx.font = `700 ${story ? 92 : 72}px ${o.hand}`;
  const baseline = h - foot / 2 + (story ? 30 : 22);
  ctx.fillText(fitText(ctx, o.title, w - 2 * m - 320), m + 4, baseline);
  ctx.fillStyle = MUTED;
  ctx.font = `500 ${story ? 32 : 28}px ${o.sans}`;
  ctx.textAlign = "right";
  ctx.fillText(o.subtitle, w - m, baseline - 6);
  ctx.textAlign = "left";
}

/* ---------- photo-booth strip ---------- */

function drawStrip(ctx: CanvasRenderingContext2D, w: number, h: number, o: RenderOpts) {
  ctx.fillStyle = "#fbf8f2";
  ctx.fillRect(0, 0, w, h);
  const pics = o.pics.slice(0, 4);
  const m = 40;
  const fh = 392;
  pics.forEach((p, i) => cover(ctx, p, m, m + i * (fh + 24), w - 2 * m, fh));
  const top = m + pics.length * (fh + 24) - 24;
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = `700 72px ${o.hand}`;
  ctx.fillText(fitText(ctx, o.title, w - 2 * m), w / 2, top + 110);
  ctx.fillStyle = MUTED;
  ctx.font = `500 26px ${o.sans}`;
  ctx.fillText(o.subtitle, w / 2, top + 158);
  ctx.textAlign = "left";
}
