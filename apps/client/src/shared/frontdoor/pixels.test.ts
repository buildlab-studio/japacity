// The door draws its figure at the screen's own pixels (prologue.md R-PROLOGUE-009).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

import { doorPixels } from "./pixels";

describe("the door's pixels", () => {
  test("[R-PROLOGUE-009] given a phone's pixel ratio, then the door's canvases draw at it up to two to one, with antialiasing, and at one with no screen to read", () => {
    expect(doorPixels(3)).toBe(2);
    expect(doorPixels(2)).toBe(2);
    expect(doorPixels(1.5)).toBe(1.5);
    expect(doorPixels(1)).toBe(1);
    expect(doorPixels(undefined)).toBe(1);
    expect(doorPixels(Number.NaN)).toBe(1);
    // The account's scene keeps its canvas; the door's turntable is gone (the door's second design): its figure in
    // the player's colours is a still drawn once, antialiased, at the published figure's own pixels.
    for (const file of ["FrontScene.tsx"]) {
      const source = readFileSync(join(import.meta.dirname, file), "utf8");
      expect({ file, pixels: source.includes("dpr={doorPixels()}"), smooth: /antialias: true/.test(source), rough: /antialias: false/.test(source) }).toEqual({ file, pixels: true, smooth: true, rough: false });
    }
    const still = readFileSync(join(import.meta.dirname, "..", "datapage", "photoRender.ts"), "utf8");
    expect({ smooth: /antialias: true/.test(still), rough: /antialias: false/.test(still), figure: /FIGURE_PX = \{ width: 400, height: 800 \}/.test(still) }).toEqual({ smooth: true, rough: false, figure: true });
  });
});
