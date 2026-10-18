import { describe, expect, test } from "vitest";

import { packSigns, SIGN_ATLAS } from "./sign";

describe("sign faces", () => {
  test("[assets:sign-text-drawn-in-code] given the sign atlas, when its size is read, then it is at most 512 by 128 and a power of two on each side", () => {
    const [w, h] = SIGN_ATLAS;
    expect(w).toBeLessThanOrEqual(512);
    expect(h).toBeLessThanOrEqual(128);
    expect(Math.log2(w) % 1).toBe(0);
    expect(Math.log2(h) % 1).toBe(0);
  });

  test("[assets:sign-text-drawn-in-code] given several boards, when they are packed, then every face fits the atlas, none overlap, and every face keeps its shape at one scale", () => {
    const faces = [
      { width: 3.8, height: 0.62 },
      { width: 1.2, height: 0.42 },
      { width: 2.96, height: 0.675 },
      { width: 1.2, height: 0.8 },
    ];
    const rects = packSigns(faces);
    const scale = (rects[0]?.[2] ?? 0) / 3.8;
    rects.forEach(([x, y, w, h], i) => {
      expect(x + w).toBeLessThanOrEqual(SIGN_ATLAS[0]);
      expect(y + h).toBeLessThanOrEqual(SIGN_ATLAS[1]);
      expect(Math.abs(w - (faces[i]?.width ?? 0) * scale)).toBeLessThanOrEqual(1);
      expect(Math.abs(h - (faces[i]?.height ?? 0) * scale)).toBeLessThanOrEqual(1);
      rects.forEach(([x2, y2, w2, h2], j) => {
        if (j <= i) return;
        const apart = x + w <= x2 || x2 + w2 <= x || y + h <= y2 || y2 + h2 <= y;
        expect(apart).toBe(true);
      });
    });
  });

  test("[assets:sign-text-drawn-in-code] given one shop's board, when it is packed, then it takes the atlas's full width, as large as it can be", () => {
    const [[, , w, h] = [0, 0, 0, 0]] = packSigns([{ width: 4, height: 1 }]);
    expect(w).toBeGreaterThanOrEqual(511);
    expect(h).toBeLessThanOrEqual(128);
  });
});
