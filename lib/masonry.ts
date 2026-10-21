/** Small, stable pseudo-random number in [0, 1) from an id, so each print keeps its tilt between visits. */
export function seeded(id: string, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** How a print sits on the board: a slight tilt, a nudge sideways, sometimes a strip of tape. */
export function printStyle(id: string) {
  const r = seeded(id);
  const tilt = (r - 0.5) * 4.4; // -2.2deg .. 2.2deg
  const nudge = (seeded(id, 1) - 0.5) * 6; // -3px .. 3px
  const t = seeded(id, 2);
  const tape = t < 0.38 ? { at: (seeded(id, 3) - 0.5) * 40, tilt: (seeded(id, 4) - 0.5) * 16 } : null;
  return { tilt, nudge, tape };
}

export type Sized = { id: string; width: number; height: number; extra?: number };

/**
 * Greedy masonry: each item drops into whichever column is shortest so far.
 * Pass the same `placed` map on every render and items keep the column they
 * were first given, so a new photo landing on top (or a page loading at the
 * bottom) never makes the rest of the board jump around. `extra` is fixed
 * height (frame + caption) in units of column width.
 */
export function layoutColumns<T extends Sized>(items: T[], columns: number, placed = new Map<string, number>()): T[][] {
  const cols: T[][] = Array.from({ length: columns }, () => []);
  const heights = new Array(columns).fill(0);
  const h = (it: T) => it.height / it.width + (it.extra ?? 0);
  for (const it of items) {
    const c = placed.get(it.id);
    if (c !== undefined && c < columns) heights[c] += h(it);
  }
  for (const it of items) {
    let c = placed.get(it.id);
    if (c === undefined || c >= columns) {
      c = 0;
      for (let k = 1; k < columns; k++) if (heights[k] < heights[c] - 1e-6) c = k;
      placed.set(it.id, c);
      heights[c] += h(it);
    }
    cols[c].push(it);
  }
  return cols;
}
