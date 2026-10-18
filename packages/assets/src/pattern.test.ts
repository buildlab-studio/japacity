import { describe, expect, test } from "vitest";

import { nearestPaletteName } from "./palette";
import { drawPattern, type PatternSpec } from "./pattern";

const SPECS: PatternSpec[] = [
  { kind: "ankara", seed: 4, cols: ["indigo", "gold", "orange", "cream"] },
  { kind: "ankara", seed: 1, cols: ["teal", "cream", "orange", "wine"] },
  { kind: "ankara", seed: 5, cols: ["danfoYellow", "cream", "orange", "white"] },
  { kind: "ankara", seed: 8, cols: ["orange", "indigo", "cream", "gold"] },
  { kind: "ankara", seed: 2, cols: ["green", "cream", "red", "danfoYellow"] },
  { kind: "ankara", seed: 7, cols: ["purple", "gold", "white", "teal"] },
  { kind: "adire", seed: 2 },
  { kind: "adire", seed: 5 },
  { kind: "asoOke", seed: 3, cols: ["wine", "gold", "cream"] },
  { kind: "asoOke", seed: 21, cols: ["basin", "white", "indigo"] },
];

function pixel(image: ReturnType<typeof drawPattern>, x: number, y: number): string {
  const i = (y * image.width + x) * 4;
  return Array.from(image.pixels.subarray(i, i + 4)).join(",");
}

/** How many pixels differ between two columns (or rows) of the image. */
function difference(image: ReturnType<typeof drawPattern>, a: number, b: number, columns: boolean): number {
  let count = 0;
  for (let k = 0; k < image.width; k++) {
    if ((columns ? pixel(image, a, k) : pixel(image, k, a)) !== (columns ? pixel(image, b, k) : pixel(image, k, b))) count++;
  }
  return count;
}

describe("fabric patterns", () => {
  test.each(SPECS)("[assets:fabric-pattern-from-seed] given a $kind pattern of seed $seed, when it is drawn, then every pixel is an opaque palette colour", (spec) => {
    const image = drawPattern(spec);
    expect(image.width).toBeLessThanOrEqual(256);
    for (let i = 0; i < image.pixels.length; i += 4) {
      const rgb = [image.pixels[i] ?? 0, image.pixels[i + 1] ?? 0, image.pixels[i + 2] ?? 0] as const;
      expect(nearestPaletteName(rgb, 0)).not.toBeNull();
      expect(image.pixels[i + 3]).toBe(255);
    }
  });

  test.each(SPECS)("[assets:fabric-pattern-from-seed] given a $kind pattern of seed $seed, when it is drawn twice, then the pixels are the same", (spec) => {
    expect(drawPattern(spec).pixels).toEqual(drawPattern(spec).pixels);
  });

  // A pattern that tiles changes no more across its wrap than across any line inside it. A shape cut at
  // the edge and not drawn again on the far side would make the wrap the most broken line in the image.
  test.each(SPECS)("[assets:fabric-pattern-from-seed] given a $kind pattern of seed $seed, when it is tiled, then the seam is no worse than any line inside it", (spec) => {
    const image = drawPattern(spec);
    const last = image.width - 1;
    for (const columns of [true, false]) {
      let worst = 0;
      for (let k = 0; k < last; k++) worst = Math.max(worst, difference(image, k, k + 1, columns));
      expect(difference(image, last, 0, columns)).toBeLessThanOrEqual(worst);
    }
  });
});
