// The things' labels never cover each other (docs/rules/world.md R-WORLD-005, R-WORLD-002): Makoko
// has five labels within 110 pixels.
import { describe, expect, test } from "vitest";

import { LABEL_GAP, type LabelBox, spreadLabels } from "./labels";

function overlaps(boxes: readonly LabelBox[], feet: readonly number[]): [number, number][] {
  const found: [number, number][] = [];
  boxes.forEach((a, i) =>
    boxes.forEach((b, j) => {
      if (j <= i) return;
      const ya = feet[i] ?? 0;
      const yb = feet[j] ?? 0;
      if (Math.abs(a.x - b.x) < (a.width + b.width) / 2 && ya - a.height < yb && yb - b.height < ya) found.push([i, j]);
    }),
  );
  return found;
}

describe("the labels over a place", () => {
  test("[R-WORLD-005] given five labels bunched within 110 pixels as Makoko's were, when they are laid out, then none covers another, each keeps its x, and the lowest keeps its place", () => {
    const boxes: LabelBox[] = [
      { x: 230, y: 380, width: 80, height: 24 },
      { x: 300, y: 386, width: 82, height: 24 },
      { x: 240, y: 398, width: 86, height: 24 },
      { x: 268, y: 410, width: 62, height: 24 },
      { x: 330, y: 372, width: 62, height: 24 },
    ];
    expect(overlaps(boxes, boxes.map((box) => box.y)).length).toBeGreaterThan(0);
    const feet = spreadLabels(boxes);
    expect(overlaps(boxes, feet)).toEqual([]);
    expect(feet[3]).toBe(410);
    for (const [index, foot] of feet.entries()) expect(foot).toBeLessThanOrEqual(boxes[index]!.y);
  });

  test("[R-WORLD-005] given labels apart, when they are laid out, then none moves", () => {
    const boxes: LabelBox[] = [
      { x: 60, y: 300, width: 80, height: 24 },
      { x: 300, y: 300, width: 80, height: 24 },
      { x: 60, y: 300 + 24 + LABEL_GAP + 1, width: 80, height: 24 },
    ];
    expect(spreadLabels(boxes)).toEqual(boxes.map((box) => box.y));
  });
});
