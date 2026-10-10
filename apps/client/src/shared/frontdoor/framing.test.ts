// The figure on its turntable is framed whole (prologue.md R-PROLOGUE-009): from hair to shoes,
// nine tenths of the space's height, the disc at its foot.
import { describe, expect, test } from "vitest";

import { FILL, FOV, framing, PLINTH_HIGH, STANDING } from "./framing";

describe("the turntable's framing", () => {
  test("[R-PROLOGUE-009] given a figure of any height a look has, then the camera sees it whole with its disc in nine tenths of the height, the foot at the bottom, and a taller figure is seen from further back", () => {
    let before = 0;
    for (const high of [1.5, STANDING, 2.2]) {
      const { distance, middle, seen } = framing(high);
      // The height seen at the figure, from the camera's distance and its field of view.
      const view = 2 * distance * Math.tan(((FOV / 2) * Math.PI) / 180);
      expect(view).toBeCloseTo(seen, 6);
      expect((high + PLINTH_HIGH) / view).toBeCloseTo(FILL, 6);
      // The foot of the view sits at the disc, the top over the hair with room to spare.
      const foot = middle - view / 2;
      expect(foot).toBeLessThanOrEqual(0);
      expect(foot).toBeGreaterThan(-0.15);
      expect(middle + view / 2).toBeGreaterThan(high);
      expect(distance).toBeGreaterThan(before);
      before = distance;
    }
  });
});
