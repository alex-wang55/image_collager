import { describe, expect, it } from "vitest";
import { inkColor, inkOf, penOf, strokePath } from "./pens";

describe("strokePath", () => {
  it("scales 0..1 points into the box", () => {
    expect(strokePath({ c: "#000", w: 0.01, p: [0, 0, 1, 1] }, 200, 100)).toBe("M0.0 0.0L200.0 100.0");
  });

  it("draws a lone tap as a dot", () => {
    expect(strokePath({ c: "#000", w: 0.01, p: [0.5, 0.5] }, 100, 100)).toBe("M50.0 50.0l0.01 0");
  });

  it("smooths longer strokes through the midpoints", () => {
    const d = strokePath({ c: "#000", w: 0.01, p: [0, 0, 0.5, 0.5, 1, 0] }, 100, 100);
    expect(d).toBe("M0.0 0.0Q50.0 50.0 75.0 25.0L100.0 0.0");
  });
});

describe("pens and inks", () => {
  it("falls back to the default pen in black", () => {
    expect(penOf({ caption_pen: null })).toBe("pen");
    expect(penOf({ caption_pen: "crayon" })).toBe("pen");
    expect(inkOf({ caption_ink: undefined })).toBe("ink");
    expect(inkOf({ caption_ink: "red" })).toBe("red");
  });

  it("writes pencil in graphite whatever the ink", () => {
    expect(inkColor("pencil", "red")).toBe(inkColor("pencil", "blue"));
    expect(inkColor("marker", "red")).not.toBe(inkColor("marker", "blue"));
  });
});
