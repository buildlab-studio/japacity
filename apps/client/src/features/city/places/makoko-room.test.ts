// The room on the water in Makoko (home:home-is-the-home-point, world:room-seen-down-its-length, world:entering-is-a-cut): the rented
// house's door on the channel opens into it with the cut. One room of about 5 by 4 metres on short stilts and its porch over the
// water, seen whole with its near walls at the knee; the house stood lowered by its floor's height, so the floor is where the
// character walks and the stilts go down into the lagoon. Its things carry the parlour's acts for the home's own entries, and
// the porch's plank is the way back out to the walk.
import { type Footprint, isFootprint } from "@japacity/model-kit";
import { describe, expect, test } from "vitest";

import { DOOR, ROOM_SPOTS, WATER_HOUSE, waterLines } from "@japacity/models/buildings/makoko-house/water";
import { FLOOR_BED, STONES } from "@japacity/models/props/makoko-room/build";
import { WALKWAY } from "@japacity/models/props/plank-walkway/build";

import budgets from "../../../../../../models/budgets.json";
import { checkWalkable } from "../../../../../../tools/assets/footprint-check";
import { checkLimits, checkThings, WORLD_LIMITS } from "../../../../../../tools/assets/world-check";
import raw from "../../../../public/assets/places/makoko-room/place.json";
import { cameraAt, projected, SCREENS } from "../scene/scene.testing";
import { aimRoom, shotOf } from "../scene/shot";
import { thingSpot } from "../scene/things";
import { cityWords } from "../city.words";
import { thingIn } from "../../../shared/testing/things";
import { allPalette, copiesOf, instancesOf, measured, staged, totalsOf } from "./place.testing";

const ID = "place.makoko";
const { file, stage } = staged(raw, ID);
const thing = (id: string) => thingIn(stage.things, id);
const SHELL = "places/makoko/building_makoko-room.glb";
/** The water's highest ripple over the grid's own height: the three waves of the water shader at their crests. */
const CREST = 0.075 + 0.045 + 0.02;

describe("the room on the water", () => {
  test("[home:home-is-the-home-point] [activity:acts-may-repeat-in-month] given the room's things, when they are read, then the mattress naps and sleeps, lying down at once while no nap can be had, the fire cooks, the drum fetches water with the bath on its sheet, the tin trunk opens the phone's Papers and the plank goes out, each with at most two acts in the parlour's words", () => {
    const acts = (id: string) => thing(id).acts.map((act) => [act.kind, act.stages ?? act.app ?? null, act.more ?? null]);
    expect(acts("bed")).toEqual([
      ["sheet", "activity.nap", null],
      ["end", null, null],
    ]);
    const nap = thing("bed").acts[0];
    expect(nap?.otherwise).toMatchObject({ id: "lie", kind: "plain", pose: "lie" });
    expect(acts("cooking")).toEqual([["sheet", "activity.cook-own", ["activity.cook-own-pot"]]]);
    expect(acts("drum")).toEqual([["sheet", "activity.fetch-water", ["activity.bucket-bath"]]]);
    expect(acts("papers-box")).toEqual([["app", "papers", null]]);
    expect(thing("out").acts.map((act) => act.kind)).toEqual(["out"]);
    expect(checkThings(file)).toEqual([]);
    expect(["bed", "cooking", "drum", "papers-box", "out"].map((id) => cityWords(thing(id).label))).toEqual(["Mattress", "Cooking corner", "Water drum", "Papers box", "Out"]);
    // The character lies on the mattress on the floor: the seat over its middle, the top its own.
    const [bx, bz] = ROOM_SPOTS.bed;
    expect(Math.hypot((nap?.seat?.[0] ?? 0) - bx, (nap?.seat?.[1] ?? 0) - bz)).toBeLessThan(0.2);
    expect(nap?.top).toBe(FLOOR_BED.top);
  });

  test("[world:room-seen-down-its-length] [world:place-is-one-screen] [city:players-fill-the-crowd] given the room's file, when it is read, then it is an interior of the place, a room of about 5 by 4 metres and its porch inside the room's limits, nobody else in it, its walls in pairs that turn with the view, and the room and the porch each eased in on", async () => {
    expect(file.place).toBe(ID);
    expect(file.scope).toBe("interior");
    expect(checkLimits(file)).toEqual([]);
    expect([file.people.low, file.people.high, stage.people.length]).toEqual([0, 0, 0]);
    expect([WATER_HOUSE.width, WATER_HOUSE.depth]).toEqual([5, 4]);
    expect(stage.walkable?.flat().every(([x, z]) => Math.abs(x) <= WATER_HOUSE.width / 2 && Math.abs(z) <= (WATER_HOUSE.depth + WATER_HOUSE.porch) / 2)).toBe(true);
    // Every outer side twice, full and at the knee, one of each showing as the view turns.
    expect((await measured(SHELL)).pairs).toBe(4);
    expect((stage.rooms ?? []).map((room) => room.id)).toEqual(["room", "porch"]);
    expect(stage.shot?.turn).toBe(360);
    expect(WORLD_LIMITS.people.interior.high).toBeGreaterThan(0);
  });

  test("[world:room-seen-down-its-length] given the room seen whole on a phone held upright, when the character stands at the top of the plank, then the room's things are reached within a few steps and the character reads at a phone's size: over 5 in a hundred of the screen's height whole, over 7 eased in", () => {
    const [x, z] = stage.start;
    for (const id of ["bed", "cooking", "drum", "papers-box", "out"]) {
      // Where the character walks to for each, and where its mark stands.
      const spot = thing(id).at;
      if (spot === undefined || thingSpot(stage, thing(id)) === null) throw new Error(`${id} stands nowhere`);
      expect({ id, close: Math.hypot(spot[0] - x, spot[1] - z) < 4.6 }).toEqual({ id, close: true });
    }
    const aspect = SCREENS.phone;
    const room = (stage.rooms ?? []).find((one) => one.id === "porch");
    if (room === undefined) throw new Error("No porch to ease in on");
    const tall = (zoom: number): number => {
      const camera = cameraAt(aimRoom(shotOf(stage), room, zoom, aspect), aspect);
      return (projected(camera, x, 1.7, z).y - projected(camera, x, 0, z).y) / 2;
    };
    expect(tall(1)).toBeGreaterThan(0.05);
    expect(tall(0)).toBeGreaterThan(0.07);
  });

  test("[city:motion-in-vertex-shader] [home:home-is-the-home-point] given the house stood lowered by its floor's height, when its floor, the walk, the canoe and the water are read, then the floor is the ground walked on, the water lies the floor's height below with the walk over its highest ripple and the canoe on it, and the plank's foot rests on the walk", () => {
    const lift = (name: string) => stage.models.find((model) => model.file.endsWith(name))?.lift;
    const shell = lift("building_makoko-room.glb") ?? 0;
    // The boards stand just over the ground, clear of a fight with it, and the ground is a scrap under them, so the water shows through their gaps.
    expect(WATER_HOUSE.floor + shell).toBeGreaterThan(0.01);
    expect(WATER_HOUSE.floor + shell).toBeLessThan(0.03);
    expect(stage.ground.size[0] * stage.ground.size[1]).toBeLessThan(0.1);
    const [water] = stage.motion.filter((motion) => motion.kind === "water");
    if (water === undefined) throw new Error("No water");
    expect(water.at[1]).toBeLessThan(-0.5);
    expect(water.at[1] + CREST).toBeLessThanOrEqual(shell + WALKWAY.top + 0.001);
    expect([lift("prop_plank-walkway.glb"), lift("prop_canoe.glb")]).toEqual([shell, shell]);
    expect(stage.models.find((model) => model.file.endsWith("prop_canoe.glb"))?.bob).toBe(true);
    const { foot } = waterLines();
    const walkBack = Math.min(...copiesOf(stage, "prop_plank-walkway.glb").map(([, z]) => z)) - WALKWAY.width / 2;
    expect(Math.abs(walkBack - foot)).toBeLessThan(0.05);
  });

  test("[assets:assets-and-places-within-budget] [assets:models-record-their-footprint] given the room's shipped files, when it is counted as the build check counts it, then both modes fit the interior row and its bytes, its instances are its copies with what the life may own, every colour is a palette name, and the start stands on free floor inside the door's reach", async () => {
    const totals = await totalsOf(file);
    for (const mode of ["low", "high"] as const) {
      expect(totals[mode].drawCalls).toBeLessThanOrEqual(budgets.place.interior.drawCalls);
      expect(totals[mode].triangles).toBeLessThanOrEqual(budgets.place.interior.triangles);
    }
    expect(totals.bytes).toBeLessThanOrEqual(budgets.place.interior.bytes);
    expect(file.instances).toEqual(instancesOf(stage));
    expect(allPalette(stage)).toBe(true);
    const footprints = new Map<string, Footprint>();
    for (const model of stage.models) {
      const footprint = (await measured(model.file)).extras.footprint;
      if (isFootprint(footprint)) footprints.set(model.file, footprint);
    }
    expect(checkWalkable(ID, stage, footprints)).toEqual([]);
    // The door in the front wall is the one way between the room and the porch.
    expect(DOOR.width).toBeGreaterThanOrEqual(0.8);
  });

  test("[city:makoko-holds-five-scenes] [home:home-is-the-home-point] given the room's dressing, when its models are read, then something stands against every wall, the cooking is a small pot on three stones, a bucket stands under the drips of the leak, and the band names the room", async () => {
    const at = (name: string) => copiesOf(stage, name)[0];
    const near = (name: string, side: "back" | "left" | "right" | "front") => {
      const spot = at(name);
      if (spot === undefined) throw new Error(`No ${name}`);
      const { back, front } = waterLines();
      const half = WATER_HOUSE.width / 2;
      const gap = { back: spot[1] - back, front: front - spot[1], left: spot[0] + half, right: half - spot[0] }[side];
      // Its middle within a metre of the wall: a thing stood against it, never out on the floor.
      return { name, side, against: gap < 1.0 };
    };
    for (const [name, side] of [["prop_floor-bed.glb", "back"], ["prop_cupboard-clothes.glb", "back"], ["prop_tin-trunk.glb", "left"], ["prop_clothes-sack.glb", "right"], ["prop_leak-bucket.glb", "front"]] as const) expect(near(name, side)).toEqual({ name, side, against: true });
    // A pot at a pot's size, never a drum: the pot and its stones under half a metre.
    expect(thing("cooking").file).toBe("places/makoko/prop_three-stones.glb");
    expect(STONES.top).toBeLessThan(0.5);
    expect((await measured("places/makoko/prop_three-stones.glb")).maxY).toBeLessThan(0.5);
    const bucket = at("prop_leak-bucket.glb");
    const drips = stage.motion.find((motion) => motion.kind === "drops");
    if (bucket === undefined || drips === undefined) throw new Error("No bucket or no drips");
    expect(Math.hypot(drips.at[0] - bucket[0], drips.at[2] - bucket[1])).toBeLessThan(0.1);
    expect(cityWords(stage.name ?? "")).toBe("Your room, Makoko");
  });

  test("[assets:lighting-set-by-place] given the room at night, when its lamps are read, then the kerosene lamp on its stool carries the room's one real light and the fire on the porch only glows", () => {
    const lamps = stage.light.lamps ?? [];
    expect(stage.light.room).toBe(true);
    expect(lamps.filter((lamp) => lamp.light !== undefined)).toHaveLength(1);
    const [lit] = lamps.filter((lamp) => lamp.light !== undefined);
    const [lx, lz] = ROOM_SPOTS.lamp;
    expect(Math.hypot((lit?.at[0] ?? 0) - lx, (lit?.at[2] ?? 0) - lz)).toBeLessThan(0.2);
  });
});
