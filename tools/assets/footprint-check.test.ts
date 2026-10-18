import { type Footprint, isFootprint } from "@japacity/assets";
import { describe, expect, test } from "vitest";

import { CATALOG } from "./catalog";
import { checkFootprints, checkWalkable, type StagedGround } from "./footprint-check";

const DANFO = "shared/veh/veh_danfo.glb";
const CHAIR = "shared/prop/prop_plastic-chair.glb";
const footprints = new Map<string, Footprint>([
  [DANFO, [{ x: 0, z: 0, width: 2, depth: 5 }]],
  [CHAIR, [{ x: 0, z: 0, width: 0.5, depth: 0.5 }]],
  ["shared/chr/chr_ada.glb", "none"],
]);
const square: [number, number][] = [[-10, -10], [10, -10], [10, 10], [-10, 10]];
const stage = (over: Partial<StagedGround> = {}): StagedGround => ({
  start: [0, 8, 0],
  walkable: [square],
  models: [{ file: DANFO, at: [[0, 0, Math.PI / 2]] }],
  people: [[0, 3, 0], [5, 5, 0]],
  ...over,
});

describe("footprints", () => {
  test("[assets:models-record-their-footprint] given shipped models, when their extras are checked, then boxes and none pass, a model with neither fails, and a picture is not a model", () => {
    const shipped = [
      { file: "shared/veh/veh_danfo.glb", extras: { footprint: [{ x: 0, z: 0, width: 2, depth: 5 }] } },
      { file: "shared/chr/chr_ada.glb", extras: { footprint: "none" } },
      { file: "shared/prop/prop_stall.glb", extras: {} },
      { file: "shared/prop/prop_pole.glb", extras: { footprint: [] } },
      { file: "shared/tex/tex_ankara_4.png", extras: {} },
    ];
    expect(checkFootprints(shipped)).toEqual([
      "assets:models-record-their-footprint: shared/prop/prop_stall.glb has no footprint in its extras (boxes in metres, or none)",
      "assets:models-record-their-footprint: shared/prop/prop_pole.glb has no footprint in its extras (boxes in metres, or none)",
    ]);
  });

  test("[assets:models-record-their-footprint] given every model the export builds, when it is baked, then its root's extras carry a footprint", () => {
    const missing = CATALOG.filter((entry) => !entry.name.startsWith("chr_") || entry.name === "chr_ada").filter((entry) => !isFootprint(entry.build().extras.footprint));
    expect(missing.map((entry) => entry.name)).toEqual([]);
  }, 60_000);
});

describe("walkable ground", () => {
  test("[assets:models-record-their-footprint] given a staged place with no walkable ground, or polygons of too few corners, when it is checked, then it fails", () => {
    expect(checkWalkable("place.x", stage({ walkable: undefined }), footprints)).toEqual(["assets:models-record-their-footprint: place.x has no walkable ground (polygons of at least three corners in metres)"]);
    expect(checkWalkable("place.x", stage({ walkable: [[[0, 0], [1, 1]]] }), footprints)).toHaveLength(1);
    expect(checkWalkable("place.x", undefined, footprints)).toEqual([]);
  });

  test("[assets:models-record-their-footprint] given spots and a start on walkable ground clear of every footprint, when the place is checked, then it passes", () => {
    expect(checkWalkable("place.x", stage(), footprints)).toEqual([]);
  });

  test("[assets:models-record-their-footprint] given a spot on a turned danfo's footprint and the start off the walkable ground, when the place is checked, then both fail by name", () => {
    // A quarter turn lays the 5 m danfo along x: 2.4 m out along x is on it, 2.6 m is clear.
    const problems = checkWalkable("place.x", stage({ start: [0, 10.5, 0], people: [[2.4, 0.5, 0], [2.6, 0.5, 0]] }), footprints);
    expect(problems).toEqual(["assets:models-record-their-footprint: place.x: the start at 0.00, 10.50 is off its walkable ground", "assets:models-record-their-footprint: place.x: spot 0 at 2.40, 0.50 stands on a model's footprint"]);
  });

  test("[assets:models-record-their-footprint] given a dressing that brings in a model over a spot and hides another, when the place is checked, then the dressed spots are checked against the dressed models", () => {
    const dressed = stage({
      models: [{ file: DANFO, at: [[0, 0, 0]] }],
      dressings: [
        { offer: "offer.party", hide: [DANFO], models: [{ file: CHAIR, at: [[4, 4, 0]] }], people: [[0, 0, 0], [4.1, 4.1, 0]] },
      ],
    });
    expect(checkWalkable("place.x", dressed, footprints)).toEqual(["assets:models-record-their-footprint: place.x dressed for offer.party: spot 1 at 4.10, 4.10 stands on a model's footprint"]);
  });

  test("[assets:models-record-their-footprint] given a place that stands a model with no footprint, when it is checked, then the model is named", () => {
    expect(checkWalkable("place.x", stage({ models: [{ file: "shared/prop/prop_new.glb", at: [[8, 8, 0]] }] }), footprints)).toEqual(["assets:models-record-their-footprint: place.x places shared/prop/prop_new.glb, which carries no footprint"]);
  });
});
