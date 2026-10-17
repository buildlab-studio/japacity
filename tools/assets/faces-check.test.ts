import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import type { BakedModel } from "./bake";
import { checkFaces, FACE_GAP, type FacedStage, floorFaces, type ModelFace, STRIP_STEP, stripTops } from "./faces-check";
import { readGlb, toDocument, writeGlb } from "./glb";

const ROOT = join(import.meta.dirname, "..", "..");
/** The stripes: the design's slab laid on the ground, its top a few millimetres over it. */
const planted = JSON.parse(readFileSync(join(ROOT, "tools", "__fixtures__", "stripes", "place.json"), "utf8")) as { place: string; stage: FacedStage };
const SLAB = "places/stripes/prop_slab.glb";

/** A slab of 4 by 3 metres standing on y = 0, `top` metres thick: its top looks up, its underside down. */
async function slab(top: number): Promise<ModelFace[]> {
  const up = [-2, top, -1.5, -2, top, 1.5, 2, top, 1.5, 2, top, -1.5];
  const down = [-2, 0, -1.5, 2, 0, -1.5, 2, 0, 1.5, -2, 0, 1.5];
  const model: BakedModel = {
    name: "prop_slab",
    parts: [{ node: "body", primitives: [{ material: "body", positions: [...up, ...down], colours: Array.from({ length: 24 }, () => 0.5), indices: [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7] }] }],
    extras: {},
  };
  return floorFaces(await readGlb(await writeGlb(toDocument(model))));
}

describe("faces at one height", () => {
  test("[R-WORLD-012] given the planted file with a slab 4 mm over the ground, when the place check reads it, then it fails naming the slab and the ground", async () => {
    const faces = await slab(0.004);
    const problems = checkFaces(planted.place, planted.stage, (file) => (file === SLAB ? faces : []));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^R-WORLD-012: place\.stripes: the ground at 0\.000 m and places\/stripes\/prop_slab\.glb copy 0 at 0\.004 m overlap 4\.0 mm apart$/);
  });

  test("[R-WORLD-012] given the same slab 2 cm thick, or moved off the strip it would share a height with, when checked, then it passes", async () => {
    expect(checkFaces(planted.place, planted.stage, () => [])).toEqual([]);
    const thick = await slab(0.02);
    expect(checkFaces(planted.place, planted.stage, (file) => (file === SLAB ? thick : []))).toEqual([]);
    // The same slab under the strip, whose top stands 12 mm up, fights it.
    const under: FacedStage = { ...planted.stage, models: [{ file: SLAB, at: [[0, 3.5, 0]] }] };
    expect(checkFaces(planted.place, under, (file) => (file === SLAB ? thick : []))[0]).toMatch(/strip 0 at 0\.012 m and places\/stripes\/prop_slab\.glb copy 0 at 0\.020 m overlap 8\.0 mm apart/);
  });

  test("[R-WORLD-012] given a model's underside on the ground and faces over a tenth of a metre, when its floors are read, then only the faces that look up and lie low count", async () => {
    const faces = await slab(0.3);
    expect(faces).toEqual([]);
    const low = await slab(0.05);
    expect(low).toHaveLength(2);
    for (const face of low) expect(face.y).toBeCloseTo(0.05, 3);
  });

  test("[R-WORLD-012] given strips that overlap and strips that do not, when they are laid, then each overlapping strip stands a step over the one under it and apart strips share the first step", () => {
    const tops = stripTops([
      { at: [0, 0, 0], size: [10, 2] },
      { at: [0, 0, 0], size: [2, 6] },
      { at: [20, 0, 0], size: [4, 2] },
      { at: [0, 0, Math.PI / 4], size: [3, 1] },
    ]);
    expect(tops).toEqual([STRIP_STEP, STRIP_STEP * 2, STRIP_STEP, STRIP_STEP * 3]);
    expect(STRIP_STEP).toBeGreaterThan(FACE_GAP);
    // Two strips that only touch at an edge do not overlap.
    expect(stripTops([{ at: [0, 0, 0], size: [2, 2] }, { at: [2, 0, 0], size: [2, 2] }])).toEqual([STRIP_STEP, STRIP_STEP]);
  });

  test("[R-WORLD-012] given a kerb whose raise brings its top within a centimetre of a strip laid over it, when checked, then it fails; without the overlap it passes", () => {
    const stage = (second: number): FacedStage => ({
      ground: { size: [40, 40] },
      roads: [
        { at: [0, 0, 0], size: [10, 2], raise: 0.03 },
        { at: [second, 0, 0], size: [10, 2], raise: 0.01 },
      ],
      models: [],
    });
    // 0.012 + 0.03 against 0.024 + 0.01: 8 mm apart.
    expect(checkFaces("place.kerb", stage(0), () => [])[0]).toMatch(/^R-WORLD-012: place\.kerb: strip 0 at 0\.042 m and strip 1 at 0\.034 m overlap 8\.0 mm apart$/);
    expect(checkFaces("place.kerb", stage(20), () => [])).toEqual([]);
  });
});
