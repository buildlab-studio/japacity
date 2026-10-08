import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { signedVolume } from "../../people/blend";
import { buildPuff, PUFF_TRIANGLES, puffArrays, rawPuff } from "./puff";
import { PUFF_DATA, puffSource } from "./write";

/** The working value of assets.md's Numbers table: the thinned shape keeps at most this share of the raw triangles. */
const THIN_MAX_PCT = 50;

describe("the smoke puff", () => {
  const raw = rawPuff();
  const puff = buildPuff();

  test("[R-ASSET-026] given the puff's blended surface, when it is thinned at build time, then it keeps at most thinMaxPct of the raw triangles and at most the faceted ball's 80", () => {
    expect(puff.triangles.length).toBeLessThanOrEqual(PUFF_TRIANGLES);
    expect(puff.triangles.length * 100).toBeLessThanOrEqual(raw.triangles.length * THIN_MAX_PCT);
  });

  test("[R-ASSET-026] given the thinned puff, when its edges are counted, then every edge joins exactly two faces and the faces point outward, so it is one closed soft shape", () => {
    const edges = new Map<string, number>();
    for (const [a, b, c] of puff.triangles) {
      for (const [from, to] of [[a, b], [b, c], [c, a]] as const) {
        const key = `${String(Math.min(from, to))}-${String(Math.max(from, to))}`;
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    }
    expect([...edges.values()].every((count) => count === 2)).toBe(true);
    expect(signedVolume(puff)).toBeGreaterThan(0);
  });

  test("[R-ASSET-005] given the puff, when its size is read, then it is about the 0.3 m ball it replaces and rests on its centre", () => {
    const { positions } = puffArrays(puff);
    const xs = positions.filter((_, at) => at % 3 === 0);
    const width = Math.max(...xs) - Math.min(...xs);
    expect(width).toBeGreaterThan(0.5);
    expect(width).toBeLessThan(0.8);
  });

  test("[R-ASSET-026] given the client's puff file, when it is compared with the build, then it holds exactly the finished triangles and nothing is blended on the phone", () => {
    expect(readFileSync(PUFF_DATA, "utf8")).toBe(puffSource());
  });
});
