// Makoko's viewing centre (city:makoko-holds-five-scenes, world:room-seen-down-its-length, world:entering-is-a-cut): reached from the
// channel's walk with the cut, one plank room on stilts painted blue below and white above, seen whole with its near walls at the knee.
// Two screens on plank brackets on its back wall show a match with no mark of any club, league or broadcaster; the stereo between them,
// a standing fan, benches in rows with young men sitting watching, the generator on the porch outside the door. The young men are posed
// only; the match's act stands on the screens (activity:watch-the-match). The way out is the walk's plank.
import { type Footprint, isFootprint } from "@japacity/model-kit";
import { describe, expect, test } from "vitest";

import { VIEWING, viewingLines } from "@japacity/models/buildings/makoko-viewing-centre/build";
import { BENCHES, SCREENS } from "@japacity/models/props/makoko-viewing/build";
import { WALKWAY } from "@japacity/models/props/plank-walkway/build";

import budgets from "../../../../../../models/budgets.json";
import { checkFaces, type ModelFace } from "../../../../../../tools/assets/faces-check";
import { checkWalkable } from "../../../../../../tools/assets/footprint-check";
import { checkLimits, checkParts, checkThings, WORLD_LIMITS } from "../../../../../../tools/assets/world-check";
import raw from "../../../../public/assets/places/makoko-viewing-centre/place.json";
import { thingSpot } from "../scene/things";
import { cityWords } from "../city.words";
import { personOfLook } from "../../../shared/scene/roster";
import { allPalette, copiesOf, instancesOf, measured, staged, totalsOf } from "./place.testing";

const ID = "place.makoko";
const { file, stage } = staged(raw, ID);
const SHELL = "places/makoko/building_makoko-viewing-room.glb";
/** The water's highest ripple over the grid's own height: the three waves of the water shader at their crests. */
const CREST = 0.075 + 0.045 + 0.02;

describe("the viewing centre", () => {
  test("[world:entering-is-a-cut] [world:things-are-tappable-models] [city:makoko-holds-five-scenes] [activity:watch-the-match] given the centre's things, when they are read, then the screens carry the match, open from the evening with a seat on a bench, the walk's plank goes out, and the band names the centre", () => {
    expect(file.place).toBe(ID);
    expect((stage.things ?? []).map((one) => [one.id, one.acts.map((act) => act.kind)])).toEqual([
      ["tvs", ["sheet"]],
      ["out", ["out"]],
    ]);
    expect(checkThings(file)).toEqual([]);
    const tvs = stage.things?.find((one) => one.id === "tvs");
    expect(tvs?.file).toBe("places/makoko/prop_match-tvs.glb");
    expect(tvs?.acts).toEqual([expect.objectContaining({ stages: "activity.watch-match", parts: ["evening", "night"], pose: "sit" })]);
    if (tvs === undefined) throw new Error("No screens");
    expect(cityWords(tvs.label)).toBe("The match");
    expect(thingSpot(stage, tvs)).not.toBeNull();
    const out = stage.things?.find((one) => one.id === "out");
    if (out === undefined) throw new Error("No way out");
    expect(cityWords(out.label)).toBe("Out");
    expect(thingSpot(stage, out)).not.toBeNull();
    expect(cityWords(stage.name ?? "")).toBe("Viewing centre");
  });

  test("[world:room-seen-down-its-length] [world:place-is-one-screen] given the centre's file, when it is read, then it is an interior of the place inside the room's limits, its walls in pairs that turn with the view, and the room and the porch each eased in on", async () => {
    expect(file.scope).toBe("interior");
    expect(checkLimits(file)).toEqual([]);
    expect((await measured(SHELL)).pairs).toBe(4);
    expect((stage.rooms ?? []).map((room) => room.id)).toEqual(["room", "porch"]);
    expect(stage.shot?.turn).toBe(360);
    expect(stage.walkable?.flat().every(([x, z]) => Math.abs(x) <= VIEWING.width / 2 && Math.abs(z) <= (VIEWING.depth + VIEWING.porch) / 2)).toBe(true);
  });

  test("[city:residents-fill-to-target] [city:makoko-holds-five-scenes] given the centre's crowd, when its spots are read, then young men sit on the benches facing the screens, as many as the room's crowd holds, the low mode's kept for men and every one of the sample a man of the city", () => {
    expect(checkParts(file)).toEqual([]);
    expect([file.people.low, file.people.high]).toEqual([WORLD_LIMITS.people.interior.low, WORLD_LIMITS.people.interior.high]);
    expect(stage.people.length).toBeGreaterThanOrEqual(file.people.high);
    const seated = (stage.acts ?? []).filter((act) => act.pose === "sit");
    expect(seated.length).toBe(file.people.high);
    const [benches] = copiesOf(stage, "prop_viewing-benches.glb");
    if (benches === undefined) throw new Error("No benches");
    const rows = Array.from({ length: BENCHES.rows }, (_, row) => benches[1] + row * BENCHES.apart);
    for (const act of seated) {
      const spot = stage.people[act.spot];
      if (spot === undefined) throw new Error(`No spot ${String(act.spot)}`);
      // On a bench's plank, looking toward the screens on the back wall.
      expect(Math.min(...rows.map((z) => Math.abs(spot[1] - z)))).toBeLessThan(0.1);
      expect(Math.abs(Math.abs(spot[2]) - Math.PI)).toBeLessThan(0.01);
    }
    expect(seated.filter((act) => act.sex === "m").map((act) => act.spot)).toEqual(Array.from({ length: file.people.low }, (_, spot) => spot));
    expect(file.people.sample.filter((path) => personOfLook(path)?.sex !== "m")).toEqual([]);
    expect(file.people.sample.length).toBeGreaterThan(file.people.high);
  });

  test("[city:makoko-holds-five-scenes] [assets:no-real-brands-on-assets] [assets:lighting-set-by-place] given the screens, when they are read, then two stand on the back wall facing the room, they carry no lettering, and at night one bulb carries the room's real light while the two screens glow", async () => {
    const [screens] = copiesOf(stage, "prop_match-tvs.glb");
    if (screens === undefined) throw new Error("No screens");
    expect(Math.abs(screens[1] - viewingLines().back)).toBeLessThan(0.15);
    expect(screens[2]).toBe(0);
    expect((await measured("places/makoko/prop_match-tvs.glb")).signs).toBe(0);
    const lamps = stage.light.lamps ?? [];
    expect(lamps.filter((lamp) => lamp.light !== undefined)).toHaveLength(1);
    const glows = lamps.filter((lamp) => lamp.light === undefined);
    expect(glows).toHaveLength(2);
    for (const glow of glows) {
      expect(Math.abs(Math.abs(glow.at[0] - screens[0]) - SCREENS.apart / 2)).toBeLessThan(0.1);
      expect(glow.at[1]).toBeGreaterThan(SCREENS.bottom);
    }
  });

  test("[assets:assets-and-places-within-budget] [assets:models-record-their-footprint] [world:faces-never-share-height] given the centre's shipped files, when it is counted as the build check counts it, then both modes fit the interior row and its bytes, its instances are its copies, every colour is a palette name, its floors stand apart, and the start stands on free floor", async () => {
    const totals = await totalsOf(file);
    for (const mode of ["low", "high"] as const) {
      expect(totals[mode].drawCalls).toBeLessThanOrEqual(budgets.place.interior.drawCalls);
      expect(totals[mode].triangles).toBeLessThanOrEqual(budgets.place.interior.triangles);
    }
    expect(totals.bytes).toBeLessThanOrEqual(budgets.place.interior.bytes);
    expect(file.instances).toEqual(instancesOf(stage));
    expect(allPalette(stage)).toBe(true);
    const footprints = new Map<string, Footprint>();
    const floors = new Map<string, readonly ModelFace[]>();
    for (const model of stage.models) {
      const one = await measured(model.file);
      if (isFootprint(one.extras.footprint)) footprints.set(model.file, one.extras.footprint);
      floors.set(model.file, one.floors ?? []);
    }
    expect(checkWalkable(ID, stage, footprints)).toEqual([]);
    expect(checkFaces(ID, stage, (path) => floors.get(path) ?? [])).toEqual([]);
  });

  test("[city:motion-in-vertex-shader] given the room stood lowered by its floor's height, when its floor, the walk, the canoe and the water are read, then the floor is the ground walked on and the water lies the floor's height below with the walk over its highest ripple", () => {
    const lift = (name: string) => stage.models.find((model) => model.file.endsWith(name))?.lift;
    const shell = lift("building_makoko-viewing-room.glb") ?? 0;
    expect(VIEWING.floor + shell).toBeGreaterThan(0.005);
    expect(VIEWING.floor + shell).toBeLessThan(0.03);
    expect(stage.ground.size[0] * stage.ground.size[1]).toBeLessThan(0.1);
    const [water] = stage.motion.filter((motion) => motion.kind === "water");
    if (water === undefined) throw new Error("No water");
    expect(water.at[1]).toBeLessThan(-0.5);
    expect(water.at[1] + CREST).toBeLessThanOrEqual(shell + WALKWAY.top + 0.001);
    expect([lift("prop_plank-walkway.glb"), lift("prop_canoe.glb")]).toEqual([shell, shell]);
  });
});
