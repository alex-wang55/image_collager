import { describe, expect, it } from "vitest";
import { layoutColumns, printStyle, seeded } from "./masonry";

const item = (id: string, width = 3, height = 4) => ({ id, width, height });
const ids = (cols: { id: string }[][]) => cols.map((c) => c.map((x) => x.id));

describe("layoutColumns", () => {
  it("drops each item into the shortest column", () => {
    const cols = layoutColumns([item("a", 1, 2), item("b"), item("c"), item("d")], 2);
    // a is tall, so b and c both go to the right before the left catches up
    expect(ids(cols)).toEqual([["a", "d"], ["b", "c"]]);
  });

  it("keeps placed items in their column when a new one lands on top", () => {
    const placed = new Map<string, number>();
    const first = layoutColumns([item("a"), item("b"), item("c"), item("d")], 2, placed);
    const after = layoutColumns([item("new", 1, 1), item("a"), item("b"), item("c"), item("d")], 2, placed);
    for (const id of ["a", "b", "c", "d"]) {
      const before = first.findIndex((c) => c.some((x) => x.id === id));
      const now = after.findIndex((c) => c.some((x) => x.id === id));
      expect(now).toBe(before);
    }
    expect(after.flat()).toHaveLength(5);
  });

  it("starts over when the column count changes", () => {
    const placed = new Map<string, number>();
    layoutColumns([item("a"), item("b"), item("c")], 3, placed);
    const two = layoutColumns([item("a"), item("b"), item("c")], 2, placed);
    expect(two.flat()).toHaveLength(3);
    expect(two.every((c) => c.length > 0)).toBe(true);
  });
});

describe("printStyle", () => {
  it("is stable per id and stays a gentle tilt", () => {
    expect(printStyle("abc")).toEqual(printStyle("abc"));
    for (let i = 0; i < 200; i++) {
      const s = printStyle(`photo-${i}`);
      expect(Math.abs(s.tilt)).toBeLessThanOrEqual(2.2);
      expect(Math.abs(s.nudge)).toBeLessThanOrEqual(3);
    }
  });

  it("spreads ids across the range", () => {
    const vals = Array.from({ length: 500 }, (_, i) => seeded(`id-${i}`));
    expect(Math.min(...vals)).toBeLessThan(0.05);
    expect(Math.max(...vals)).toBeGreaterThan(0.95);
  });
});
