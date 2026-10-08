import { describe, expect, test } from "vitest";

import { frameFor, type Mask, type OutlineSettings, polygonArea, rasterise, scoreView, shift } from "./outline-score";

const settings: OutlineSettings = { outlineMin: 85, dimTolerancePct: 5, outlineFramePx: 512, outlineMarginPct: 5, outlineShiftPct: 3, thinFillPct: 10, thinGrowPct: 2 };
const rect = (w: number, h: number): [number, number][] => [[-w / 2, 0], [w / 2, 0], [w / 2, h], [-w / 2, h]];

function modelOf(polygon: [number, number][], w: number, h: number, dx = 0, dy = 0): { mask: Mask; frame: ReturnType<typeof frameFor> } {
  const frame = frameFor([[w, h]], settings);
  return { mask: shift(rasterise(polygon, frame), dx, dy), frame };
}

describe("the outline score", () => {
  test("[R-ASSET-023] given a reference, when the frame is made, then its longer side is 512 px with a 5% margin on every side", () => {
    const frame = frameFor([[200, 50]], settings);
    expect(frame.width).toBe(512);
    expect(frame.pxPerMetre * 200).toBeCloseTo(512 * 0.9, 6);
    expect(frame.height).toBe(Math.round(50 * frame.pxPerMetre + 512 * 0.1));
  });

  test("[R-ASSET-023] given a model the same as its reference, when it is scored, then it scores 100 and passes", () => {
    const polygon = rect(100, 40);
    const { mask, frame } = modelOf(polygon, 100, 40);
    const score = scoreView(mask, polygon, frame, settings, { width: 100, height: 40 });
    expect(score.score).toBe(100);
    expect(score.passes).toBe(true);
  });

  test("[R-ASSET-023] given a model moved 15 px, inside the 3% search, when it is scored, then the best shift finds it; it is centred by its box first, so a far move does not count against it", () => {
    const polygon: [number, number][] = [[-50, 0], [50, 0], [50, 20], [0, 40], [-50, 20]];
    const { mask, frame } = modelOf(polygon, 100, 40, 15, -10);
    expect(scoreView(mask, polygon, frame, settings, { width: 100, height: 40 }).score).toBe(100);
  });

  test("[R-ASSET-023] given a model with a different shape, when it is scored, then the score is 100 times overlap over union, rounded down, with no scaling", () => {
    const reference = rect(100, 40);
    const half = rect(100, 20);
    const { mask, frame } = modelOf(half, 100, 40);
    const score = scoreView(mask, reference, frame, settings, { width: 100, height: 20 });
    expect(score.score).toBe(Math.floor(score.overlap * 100));
    expect(score.score).toBeGreaterThanOrEqual(49);
    expect(score.score).toBeLessThanOrEqual(51);
    expect(score.passes).toBe(false);
  });

  test("[R-ASSET-023] given a reference filling under 10% of its box, when it is scored, then both masks grow by 2% of the frame; at 10% or more they do not", () => {
    const thin: [number, number][] = [[-100, 0], [100, 0], [100, 2], [0.5, 2], [0.5, 40], [-0.5, 40], [-0.5, 2], [-100, 2]];
    expect((polygonArea(thin) / (200 * 40)) * 100).toBeLessThan(10);
    const { mask, frame } = modelOf(thin, 200, 40);
    const score = scoreView(mask, thin, frame, settings, { width: 200, height: 40 });
    expect(score.thin).toBe(true);
    expect(score.grownPx).toBe(Math.round(512 * 0.02));
    const solid = rect(200, 40);
    const s2 = modelOf(solid, 200, 40);
    expect(scoreView(s2.mask, solid, s2.frame, settings, { width: 200, height: 40 }).thin).toBe(false);
  });

  test("[R-ASSET-023] given a model 5% wider than its reference and one 6% wider, when the size is checked, then 5% passes and 6% fails", () => {
    const polygon = rect(100, 40);
    const { mask, frame } = modelOf(polygon, 100, 40);
    expect(scoreView(mask, polygon, frame, settings, { width: 105, height: 40 }).passes).toBe(true);
    expect(scoreView(mask, polygon, frame, settings, { width: 106, height: 40 }).passes).toBe(false);
    expect(scoreView(mask, polygon, frame, settings, { width: 100, height: 37.9 }).passes).toBe(false);
  });
});
