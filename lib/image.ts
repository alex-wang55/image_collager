import { readTakenAt } from "./exif";

/** Long side of the stored photo. Big enough for any phone screen, small enough that ~3,000 fit in 1GB. */
const FULL_SIDE = 1920;
const FULL_QUALITY = 0.8;
/** Long side of the grid copy. A 2-column grid on a 3x phone needs ~540px wide. */
const THUMB_SIDE = 720;
const THUMB_QUALITY = 0.72;

export type Processed = {
  full: Blob;
  thumb: Blob;
  ext: "jpg" | "webp";
  width: number;
  height: number;
  color: string;
  takenAt: string | null;
};

let webpOk: boolean | null = null;
/** Chrome and Android encode WebP (smaller files). Safari quietly hands back a PNG, so check once. */
function canEncodeWebp(): boolean {
  if (webpOk === null) {
    try {
      const c = document.createElement("canvas");
      c.width = c.height = 1;
      webpOk = c.toDataURL("image/webp").startsWith("data:image/webp");
    } catch {
      webpOk = false;
    }
  }
  return webpOk;
}

/** Caller revokes `img.src` once it's done drawing. */
function loadImage(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file isn't a photo we can open"));
    };
    img.src = url;
  });
}

function draw(src: CanvasImageSource, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, w, h);
  return c;
}

function encode(c: HTMLCanvasElement, type: string, q: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't save that photo"))), type, q),
  );
}

function fit(w: number, h: number, side: number) {
  const s = Math.min(1, side / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}

/** Average colour, shown behind the photo while it loads. */
function averageColor(c: HTMLCanvasElement): string {
  const tiny = draw(c, 1, 1);
  const [r, g, b] = tiny.getContext("2d")!.getImageData(0, 0, 1, 1).data;
  return "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");
}

/**
 * Shrink a phone photo into a full copy and a grid copy, and pull out its
 * size, colour and taken-at date. Browsers apply EXIF rotation when drawing,
 * so sideways iPhone shots come out upright.
 */
export async function processPhoto(file: File): Promise<Processed> {
  const head = await file.slice(0, 256 * 1024).arrayBuffer();
  let takenAt = readTakenAt(head);
  // Android keeps the real file date; iOS stamps "now" on picked photos, so ignore anything recent.
  if (!takenAt && file.lastModified && file.lastModified < Date.now() - 10 * 60_000) {
    takenAt = new Date(file.lastModified).toISOString();
  }

  const img = await loadImage(file);
  try {
    const sw = img.naturalWidth;
    const sh = img.naturalHeight;
    if (!sw || !sh) throw new Error("That file isn't a photo we can open");
    const webp = canEncodeWebp();
    const type = webp ? "image/webp" : "image/jpeg";

    const f = fit(sw, sh, FULL_SIDE);
    const fullCanvas = draw(img, f.w, f.h);
    const t = fit(f.w, f.h, THUMB_SIDE);
    const thumbCanvas = draw(fullCanvas, t.w, t.h);

    const [full, thumb] = await Promise.all([
      encode(fullCanvas, type, FULL_QUALITY),
      encode(thumbCanvas, type, THUMB_QUALITY),
    ]);
    const color = averageColor(thumbCanvas);
    // free the big bitmaps right away; iOS is stingy with canvas memory
    fullCanvas.width = fullCanvas.height = 0;
    thumbCanvas.width = thumbCanvas.height = 0;
    return { full, thumb, ext: webp ? "webp" : "jpg", width: f.w, height: f.h, color, takenAt };
  } finally {
    URL.revokeObjectURL(img.src);
  }
}
