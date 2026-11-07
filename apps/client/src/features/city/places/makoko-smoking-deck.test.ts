// Makoko's smoking deck (city:makoko-holds-five-scenes, world:place-is-one-screen, world:entering-is-a-cut): reached from the channel's
// walk with the cut, a wide plank deck at the walk's height, half open, where the women smoke and sell the catch. Drum kilns with round
// trays of fish and thin smoke, baskets and a cooler, the pot the fish are washed in, firewood by the sawdust sacks, the striped tarp,
// and the racks with their board beside the deck. The racks' job, the kiln and the canoes' trade stand here (activity:fish-racks-at-makoko,
// activity:capital-opens-own-work); the plank of the walk is the way back out.
import { type Footprint, isFootprint } from "@japacity/model-kit";
import { describe, expect, test } from "vitest";

import { SMOKING_DECK } from "@japacity/models/buildings/makoko-smoking-deck/build";
import { KILNS } from "@japacity/models/props/makoko-smoking/build";
import { WALKWAY } from "@japacity/models/props/plank-walkway/build";

import budgets from "../../../../../../models/budgets.json";
import { checkFaces, type ModelFace } from "../../../../../../tools/assets/faces-check";
import { checkWalkable } from "../../../../../../tools/assets/footprint-check";
import { checkLimits, checkParts, checkThings, SHEET_KINDS, WORLD_LIMITS } from "../../../../../../tools/assets/world-check";
import raw from "../../../../public/assets/places/makoko-smoking-deck/place.json";
import { thingSpot } from "../scene/things";
import { cityWords } from "../city.words";
import { personOfLook } from "../../../shared/scene/roster";
import { thingIn } from "../../../shared/testing/things";
import { allPalette, copiesOf, instancesOf, measured, staged, totalsOf, wordsOf } from "./place.testing";

const ID = "place.makoko";
const { file, stage } = staged(raw, ID);
const thing = (id: string) => thingIn(stage.things, id);
/** The water's highest ripple over the grid's own height: the three waves of the water shader at their crests. */
const CREST = 0.075 + 0.045 + 0.02;
const lift = (name: string) => stage.models.find((model) => model.file.endsWith(name))?.lift;

describe("the smoking deck", () => {
  test("[activity:fish-racks-at-makoko] [activity:capital-opens-own-work] [world:things-are-tappable-models] given the deck's things, when they are read, then the racks are looked at and worked, the kiln is built on the drum kilns, the work canoe trades and delivers, and the walk's plank goes out, each in its own words", () => {
    expect(file.place).toBe(ID);
    const acts = (id: string) => thing(id).acts.map((act) => [act.kind, act.stages ?? null]);
    expect(acts("racks")).toEqual([
      ["plain", null],
      ["sheet", "activity.job-fish-racks"],
    ]);
    expect(wordsOf(`${thing("racks").acts[0]?.label ?? ""}.done`)).not.toBe("");
    expect(thing("kiln").file).toBe("places/makoko/prop_drum-kilns.glb");
    expect(acts("kiln")).toEqual([["sheet", "activity.buy-kiln"]]);
    expect(acts("canoe-trade")).toEqual([
      ["sheet", "activity.canoe-deliveries"],
      ["sheet", "activity.start-fish-trade"],
    ]);
    expect(acts("out")).toEqual([["out", null]]);
    expect(checkThings(file)).toEqual([]);
    expect(["racks", "kiln", "canoe-trade", "out"].map((id) => cityWords(thing(id).label))).toEqual(["Fish racks", "Kiln", "Work canoe", "Out"]);
    for (const id of ["racks", "kiln", "canoe-trade", "out"]) expect({ id, stands: thingSpot(stage, thing(id)) !== null }).toEqual({ id, stands: true });
    expect(cityWords(stage.name ?? "")).toBe("Smoking deck");
  });

  test("[city:residents-fill-to-target] [city:makoko-holds-five-scenes] given the deck's crowd, when its spots are read, then the women work it: one sits washing fish at the pot, one tends the kilns, both kept for the place, and one sits selling by the baskets", () => {
    expect(checkParts(file)).toEqual([]);
    expect([file.people.low, file.people.high]).toEqual([3, 4]);
    expect(stage.people.length).toBeGreaterThanOrEqual(file.people.high);
    expect((stage.acts ?? []).map((act) => [act.spot, act.pose ?? null, act.sex ?? null, act.staff ?? null])).toEqual([
      [0, "sit", "f", true],
      [1, null, "f", true],
      [2, "sit", "f", null],
    ]);
    const [washer, tender] = stage.people;
    const [pot] = copiesOf(stage, "prop_wash-pot.glb");
    const [kilns] = copiesOf(stage, "prop_drum-kilns.glb");
    if (washer === undefined || tender === undefined || pot === undefined || kilns === undefined) throw new Error("No washer or no tender");
    expect(Math.hypot(washer[0] - pot[0], washer[1] - pot[1])).toBeLessThan(0.9);
    expect(Math.hypot(tender[0] - kilns[0], tender[1] - kilns[1])).toBeLessThan(1.2);
    expect(file.people.sample.filter((path) => personOfLook(path) === null)).toEqual([]);
    expect(file.people.sample.length).toBeGreaterThan(file.people.high);
  });

  test("[world:place-is-one-screen] [assets:assets-and-places-within-budget] [assets:models-record-their-footprint] [world:faces-never-share-height] given the deck's file, when it is checked and counted, then it is one half-open scene held to the outdoor limits, both modes fit the exterior row, its instances are its copies, every colour is a palette name, its floors stand apart, and the start and the spots stand on free boards", async () => {
    expect(file.scope).toBe("exterior");
    expect(checkLimits(file)).toEqual([]);
    expect(file.people.high).toBeLessThanOrEqual(WORLD_LIMITS.people.exterior.high);
    expect(stage.motion.filter((motion) => SHEET_KINDS.has(motion.kind)).length).toBeLessThanOrEqual(WORLD_LIMITS.sheets.high);
    const totals = await totalsOf(file);
    for (const mode of ["low", "high"] as const) {
      expect(totals[mode].drawCalls).toBeLessThanOrEqual(budgets.place.exterior.drawCalls);
      expect(totals[mode].triangles).toBeLessThanOrEqual(budgets.place.exterior.triangles);
    }
    expect(totals.bytes).toBeLessThanOrEqual(budgets.place.exterior.bytes);
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

  test("[city:motion-in-vertex-shader] [city:one-clock-one-wind] given the deck stood lowered by its height, when the deck, the racks, the walk, the canoe, the water and the smoke are read, then the boards are the ground walked on, the water lies under the walk's highest ripple, thin smoke rises from the kilns' trays, and the bridge stands far behind", () => {
    const deck = lift("building_makoko-smoking-deck.glb") ?? 0;
    expect(SMOKING_DECK.floor + deck).toBeGreaterThan(0.005);
    expect(SMOKING_DECK.floor + deck).toBeLessThan(0.02);
    expect(stage.ground.size[0] * stage.ground.size[1]).toBeLessThan(0.1);
    const [water] = stage.motion.filter((motion) => motion.kind === "water");
    if (water === undefined) throw new Error("No water");
    expect(water.at[1] + CREST).toBeLessThanOrEqual(deck + WALKWAY.top + 0.001);
    expect([lift("prop_fish-racks.glb"), lift("prop_plank-walkway.glb"), lift("prop_canoe.glb")]).toEqual([deck, deck, deck]);
    expect(stage.models.find((model) => model.file.endsWith("prop_canoe.glb"))?.bob).toBe(true);
    const [kilns] = copiesOf(stage, "prop_drum-kilns.glb");
    if (kilns === undefined) throw new Error("No kilns");
    const smokes = stage.motion.filter((motion) => motion.kind === "smoke");
    expect(smokes.length).toBeGreaterThanOrEqual(1);
    for (const smoke of smokes) {
      expect(Math.abs(smoke.at[2] - kilns[1])).toBeLessThan(0.3);
      expect(Math.abs(smoke.at[1] - KILNS.top)).toBeLessThan(0.2);
      expect(smoke.count ?? 0).toBeLessThanOrEqual(8);
    }
    expect(stage.shot?.yaw).toBe(180);
    for (const [, z] of copiesOf(stage, "landmark_third-mainland-span.glb")) expect(z).toBeLessThan(-50);
  });

  test("[city:place-words-are-text-keys] given the racks' board, when its words are read, then the fish seller's board is lettered in the place's own key and names no business", async () => {
    const racks = stage.models.find((model) => model.file.endsWith("prop_fish-racks.glb"));
    expect(racks?.signs).toEqual([["place.makoko.sign.3"]]);
    expect((await measured(racks?.file ?? "")).signs).toBe(1);
    expect(wordsOf("place.makoko.sign.3")).toContain("FISH");
  });
});
