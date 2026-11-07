// Makoko's net shed (world:place-is-one-screen, world:entering-is-a-cut): reached from the channel's spur with the cut, a plank
// platform on poles over the lagoon under a rusty roof, no walls but one end of sacks, nets on the rail, canoes alongside and the
// bridge in the haze behind. A fisherman sits mending a net and two more sit in the shade; they are posed only, and the shed's one
// thing is the way back out.
import { type Footprint, isFootprint } from "@japacity/model-kit";
import { describe, expect, test } from "vitest";

import { NET_SHED, SHED_BENCH, SHED_CRATE } from "@japacity/models/buildings/makoko-net-shed/build";
import { WALKWAY } from "@japacity/models/props/plank-walkway/build";

import budgets from "../../../../../../models/budgets.json";
import { checkWalkable } from "../../../../../../tools/assets/footprint-check";
import { checkLimits, checkParts, checkThings } from "../../../../../../tools/assets/world-check";
import raw from "../../../../public/assets/places/makoko-net-shed/place.json";
import { thingSpot } from "../scene/things";
import { cityWords } from "../city.words";
import { personOfLook } from "../../../shared/scene/roster";
import { allPalette, copiesOf, instancesOf, measured, staged, totalsOf } from "./place.testing";

const ID = "place.makoko";
const { file, stage } = staged(raw, ID);
/** The water's highest ripple over the grid's own height: the three waves of the water shader at their crests. */
const CREST = 0.075 + 0.045 + 0.02;

describe("the net shed", () => {
  test("[world:things-are-tappable-models] [world:entering-is-a-cut] given the shed's things, when they are read, then the one thing is the plank back to the walk, which goes out, and nobody in the shed is a thing with an act", () => {
    expect(file.place).toBe(ID);
    expect((stage.things ?? []).map((thing) => [thing.id, thing.acts.map((act) => act.kind)])).toEqual([["out", ["out"]]]);
    expect(checkThings(file)).toEqual([]);
    const out = stage.things?.[0];
    if (out === undefined) throw new Error("No way out");
    expect(cityWords(out.label)).toBe("Out");
    expect(thingSpot(stage, out)).not.toBeNull();
  });

  test("[city:residents-fill-to-target] given the shed's crowd, when its spots are read, then three men of the city sit: the fisherman on the crate where the net is mended, kept for the place, and two on the bench along the sacks", () => {
    expect(checkParts(file)).toEqual([]);
    expect(stage.people).toHaveLength(3);
    expect([file.people.low, file.people.high]).toEqual([3, 3]);
    expect((stage.acts ?? []).map((act) => [act.spot, act.pose, act.sex ?? null, act.staff ?? null])).toEqual([
      [0, "sit", "m", true],
      [1, "sit", "m", null],
      [2, "sit", null, null],
    ]);
    const [fisher, ...bench] = stage.people;
    expect(Math.hypot((fisher?.[0] ?? 0) - SHED_CRATE.x, (fisher?.[1] ?? 0) - SHED_CRATE.z)).toBeLessThan(0.1);
    for (const [x, z] of bench) {
      expect(Math.abs(x - SHED_BENCH.x)).toBeLessThan(0.1);
      expect(Math.abs(z - SHED_BENCH.z)).toBeLessThan(SHED_BENCH.length / 2);
    }
    expect(file.people.sample.filter((path) => personOfLook(path) === null)).toEqual([]);
    expect(file.people.sample.length).toBeGreaterThan(file.people.high);
  });

  test("[world:place-is-one-screen] [assets:assets-and-places-within-budget] [assets:models-record-their-footprint] given the shed's file, when it is checked and counted, then it is one half-open scene inside the outdoor limits, both modes fit the exterior row, its instances are its copies, every colour is a palette name, and the start and the spots stand on free deck", async () => {
    expect(file.scope).toBe("exterior");
    expect(checkLimits(file)).toEqual([]);
    const totals = await totalsOf(file);
    for (const mode of ["low", "high"] as const) {
      expect(totals[mode].drawCalls).toBeLessThanOrEqual(budgets.place.exterior.drawCalls);
      expect(totals[mode].triangles).toBeLessThanOrEqual(budgets.place.exterior.triangles);
    }
    expect(totals.bytes).toBeLessThanOrEqual(budgets.place.exterior.bytes);
    expect(file.instances).toEqual(instancesOf(stage));
    expect(allPalette(stage)).toBe(true);
    const footprints = new Map<string, Footprint>();
    for (const model of stage.models) {
      const footprint = (await measured(model.file)).extras.footprint;
      if (isFootprint(footprint)) footprints.set(model.file, footprint);
    }
    expect(checkWalkable(ID, stage, footprints)).toEqual([]);
  });

  test("[city:motion-in-vertex-shader] given the shed stood lowered by its deck's height, when the deck, the walk, the canoes, the water and the bridge are read, then the deck is the ground walked on, the water lies below with the walk over its highest ripple and the canoes riding it, and the bridge stands far behind in the direction the view looks", () => {
    const lift = (name: string) => stage.models.find((model) => model.file.endsWith(name))?.lift;
    const shed = lift("building_makoko-net-shed.glb") ?? 0;
    expect(NET_SHED.floor + shed).toBeGreaterThan(0.01);
    expect(NET_SHED.floor + shed).toBeLessThan(0.03);
    expect(stage.ground.size[0] * stage.ground.size[1]).toBeLessThan(0.1);
    const [water] = stage.motion.filter((motion) => motion.kind === "water");
    if (water === undefined) throw new Error("No water");
    expect(water.at[1] + CREST).toBeLessThanOrEqual(shed + WALKWAY.top + 0.001);
    expect([lift("prop_plank-walkway.glb"), lift("prop_canoe.glb")]).toEqual([shed, shed]);
    expect(stage.models.find((model) => model.file.endsWith("prop_canoe.glb"))?.bob).toBe(true);
    expect(stage.shot?.yaw).toBe(180);
    for (const [, z] of copiesOf(stage, "landmark_third-mainland-span.glb")) expect(z).toBeLessThan(-50);
  });
});
