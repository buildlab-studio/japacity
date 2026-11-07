// Makoko's channel on the lagoon (city:makoko-holds-five-scenes, home:home-is-the-home-point): houses of many shapes on stilts over
// the water beside the Third Mainland Bridge, a plank walk in front of them, the pylons and the bridge in the haze behind, wires on
// bamboo poles, the classroom and the church, canoes moored at the walk and canoes paddled along the channel. Its doors cut into the
// place's other scenes: the rented house into the room on the water (makoko-room.test.ts), the smoking deck (makoko-smoking-deck.test.ts),
// the net shed down the spur (makoko-net-shed.test.ts) and the viewing centre (makoko-viewing-centre.test.ts).
import { content, text } from "@japacity/content";
import type { Id } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { RAMP_X, WATER_HOUSE, waterLines } from "@japacity/models/buildings/makoko-house/water";
import { VIEWING_RAMP_X, viewingLines } from "@japacity/models/buildings/makoko-viewing-centre/build";
import { SMOKING_DECK } from "@japacity/models/buildings/makoko-smoking-deck/build";
import { KILNS } from "@japacity/models/props/makoko-smoking/build";
import { WALKWAY } from "@japacity/models/props/plank-walkway/build";

import manifest from "../../../../public/assets/manifest.json";
import raw from "../../../../public/assets/places/makoko/place.json";
import roomRaw from "../../../../public/assets/places/makoko-room/place.json";
import shedRaw from "../../../../public/assets/places/makoko-net-shed/place.json";
import deckRaw from "../../../../public/assets/places/makoko-smoking-deck/place.json";
import viewingRaw from "../../../../public/assets/places/makoko-viewing-centre/place.json";
import { type PlaceFile, stageOf } from "../../../shared/scene/placeFile";
import { stopReached } from "../nudge/stops";
import { thingSpot, vehicleOf } from "../scene/things";
import { frontageTests } from "./frontage.testing";
import { copiesOf, onGround, staged, wordsOf } from "./place.testing";
import { cityWords } from "../city.words";
import { thingIn } from "../../../shared/testing/things";

const ID = "place.makoko";
const { file, stage, entry } = staged(raw, ID);
const thing = (id: string) => thingIn(stage.things, id);
/** The water's highest ripple over the grid's own height: the three waves of the water shader at their crests. */
const CREST = 0.075 + 0.045 + 0.02;
const water = stage.motion.filter((motion) => motion.kind === "water");
/** The scenes behind the channel's doors, by their folder. */
const SCENES: Readonly<Record<string, unknown>> = { "makoko-room": roomRaw, "makoko-net-shed": shedRaw, "makoko-smoking-deck": deckRaw, "makoko-viewing-centre": viewingRaw };

/** A copy's spot turned into the place's frame: a point `[x, z]` of the model's own frame. */
function inPlace([x, z, turn]: readonly number[], [px, pz]: readonly [number, number]): [number, number] {
  const cos = Math.cos(turn ?? 0);
  const sin = Math.sin(turn ?? 0);
  return [(x ?? 0) + px * cos + pz * sin, (z ?? 0) - px * sin + pz * cos];
}

describe("Makoko", () => {
  frontageTests(raw, ID, { scenes: Object.values(SCENES) });

  test("[world:entering-is-a-cut] [home:home-is-the-home-point] [city:makoko-holds-five-scenes] given the channel's doors, when their things are read, then each has one act, Go in, into its own scene of the place: the rented house's, a home's door, into the room on the water the file names, the others into the smoking deck, the net shed and the viewing centre", () => {
    const doors = (stage.things ?? []).filter((one) => one.acts.some((act) => act.kind === "enter"));
    expect(doors.map((door) => [door.id, door.file, door.acts.map((act) => [act.id, act.kind, act.inside ?? null, act.home ?? null])])).toEqual([
      ["room", "places/makoko/building_makoko-house_a.glb", [["enter", "enter", null, true]]],
      ["smoking-deck", "places/makoko/building_makoko-smoking-deck.glb", [["enter", "enter", "makoko-smoking-deck", null]]],
      ["net-shed", "places/makoko/building_makoko-net-shed.glb", [["enter", "enter", "makoko-net-shed", null]]],
      ["viewing-centre", "places/makoko/building_makoko-viewing-centre.glb", [["enter", "enter", "makoko-viewing-centre", null]]],
    ]);
    expect(stage.inside).toBe("makoko-room");
    expect(thing("room").copy).toBe(0);
    expect(doors.map((door) => cityWords(door.label))).toEqual(["The room", "Smoking deck", "Net shed", "Viewing centre"]);
    expect(new Set(doors.map((door) => cityWords(door.acts[0]?.label ?? "")))).toEqual(new Set(["Go in"]));
    // The life's things and the home's acts stand in the room, the trade's things on the deck; none on the walk.
    for (const id of ["room-chores", "room-papers", "racks", "kiln", "canoe-trade"]) expect(stage.things?.some((one) => one.id === id)).toBe(false);
    expect(stage.owned).toBeUndefined();
    // Every scene behind a door belongs to the place, and its file names itself for the band.
    for (const [folder, scene] of Object.entries(SCENES)) {
      expect({ folder, place: (scene as PlaceFile).place }).toEqual({ folder, place: ID });
      expect({ folder, named: stageOf(scene as PlaceFile).name !== undefined }).toEqual({ folder, named: true });
    }
  });

  test("[world:entering-is-a-cut] given each door on the channel, when what it leads to is read, then it names every thing of the scene behind it but the way out, so a nudge pointing at one of them from the walk points at the door", () => {
    for (const door of (stage.things ?? []).filter((one) => one.acts.some((act) => act.kind === "enter"))) {
      const act = door.acts[0];
      const folder = act?.inside ?? stage.inside ?? "";
      const scene = stageOf(SCENES[folder] as PlaceFile);
      const inside = (scene.things ?? []).filter((one) => !one.acts.some((each) => each.kind === "out")).map((one) => one.id);
      expect({ door: door.id, leads: act?.leads ?? [] }).toEqual({ door: door.id, leads: inside });
    }
  });

  test("[home:home-is-the-home-point] given the rented house's ramp, when it is read against the walk, then its foot rests on the walk's back edge, its head on the porch over the water, and the house's thing is tapped from the walk at the ramp's foot", () => {
    const [house] = copiesOf(stage, "building_makoko-house_a.glb");
    if (house === undefined) throw new Error("No room");
    const { foot, edge } = waterLines();
    const walkBack = Math.min(...copiesOf(stage, "prop_plank-walkway.glb").filter(([, , turn]) => Math.abs(turn) > 1).map(([, z]) => z)) - WALKWAY.width / 2;
    const [footX, footZ] = inPlace(house, [RAMP_X, foot]);
    expect(Math.abs(footZ - walkBack)).toBeLessThan(0.05);
    // The porch stands well over the walk, as the houses on stilts stand over the water, and its edge is back from the walk.
    expect(WATER_HOUSE.floor - WALKWAY.top).toBeGreaterThan(0.5);
    expect(inPlace(house, [0, edge])[1]).toBeLessThan(walkBack - 1);
    // The character walks to the ramp's foot on the walk; the mark stands on the house.
    const spot = thing("room").at;
    if (spot === undefined) throw new Error("The room names no spot to walk to");
    expect(Math.hypot(spot[0] - footX, spot[1] - footZ)).toBeLessThan(0.6);
    expect(onGround(stage, [spot[0], spot[1], 0])).toBe(true);
    expect(thingSpot(stage, thing("room"))).toEqual([house[0], house[1]]);
  });

  test("[world:ride-sheet-shows-fares] given the canoe moored at the walk, when it is tapped, then Go by canoe opens the ride sheet, the way back to the city by water", () => {
    const canoe = thing("canoe");
    expect(canoe.file).toBe("places/third-mainland-bridge/prop_canoe.glb");
    expect(canoe.acts.map((act) => [act.kind, cityWords(act.label)])).toEqual([["ride", "Go by canoe"]]);
    expect(vehicleOf(canoe)).toBeNull();
    const moored = stage.models.find((model) => model.file === canoe.file && model.glide === undefined);
    expect(moored?.bob).toBe(true);
    expect(thingSpot(stage, canoe)).not.toBeNull();
  });

  test("[world:things-are-tappable-models] given the classroom, when its act is read, then it is looked at and says what happened", () => {
    const school = thing("school");
    expect(school.acts.map((act) => act.kind)).toEqual(["plain"]);
    expect(wordsOf(`${school.acts[0]?.label ?? ""}.done`)).not.toBe("");
    expect(school.file).toBe("places/makoko/building_makoko-school.glb");
  });

  test("[city:motion-in-vertex-shader] given the lagoon, when the place is read, then one water grid in the lagoon's colour runs under the houses and the walk, and the walk, the porch and the racks stand over its highest ripple", () => {
    expect(water).toHaveLength(1);
    const [grid] = water;
    if (grid === undefined) throw new Error("No water");
    expect(grid.colours).toEqual(["lagoon"]);
    expect(grid.at[1] + CREST).toBeLessThanOrEqual(WALKWAY.top + 0.001);
    const [width, depth] = grid.size ?? [0, 0];
    for (const [x, z] of copiesOf(stage, "prop_plank-walkway.glb")) {
      expect(Math.abs(x - grid.at[0])).toBeLessThan(width / 2);
      expect(Math.abs(z - grid.at[2])).toBeLessThan(depth / 2);
    }
    expect(stage.ground.colour).toBe("lagoon");
  });

  test("[city:no-script-loop-per-sheet] given the canoes paddled along the channel, when their lanes are read, then goods and the children to school travel on the shared clock, each lane in the water and clear of the walk and of the canoes moored there", () => {
    const travelling = stage.models.filter((model) => model.glide !== undefined);
    expect(travelling.map((model) => model.file).sort()).toEqual(["places/makoko/prop_canoe-goods.glb", "places/makoko/prop_canoe-school.glb"]);
    const [grid] = water;
    if (grid === undefined) throw new Error("No water");
    const [width, depth] = grid.size ?? [0, 0];
    const walkFront = Math.max(...copiesOf(stage, "prop_plank-walkway.glb").map(([, z]) => z)) + WALKWAY.width / 2;
    const moored = stage.models.filter((model) => model.bob === true && model.glide === undefined).flatMap((model) => model.at);
    for (const model of travelling) {
      for (const at of model.at) {
        // Out along the canoe's own length and back, its hull's half-length past each end.
        for (const along of [-3.2, (model.glide ?? 0) + 3.2]) {
          const [x, z] = inPlace(at, [0, along]);
          expect(Math.abs(x - grid.at[0])).toBeLessThan(width / 2);
          expect(Math.abs(z - grid.at[2])).toBeLessThan(depth / 2);
        }
        expect(at[1]).toBeGreaterThan(walkFront + 1.5);
        for (const [, mz] of moored) expect(Math.abs(at[1] - mz)).toBeGreaterThan(1.5);
      }
    }
  });

  test("[city:one-clock-one-wind] given the smoking deck's kilns, when the place's motion is read, then thin smoke rises from the kilns' trays and the washing on its line is the place's one moving sheet", () => {
    const [kilns] = copiesOf(stage, "prop_drum-kilns.glb");
    if (kilns === undefined) throw new Error("No kilns");
    const smokes = stage.motion.filter((motion) => motion.kind === "smoke");
    expect(smokes.length).toBeGreaterThanOrEqual(1);
    for (const smoke of smokes) {
      expect(Math.abs(smoke.at[2] - kilns[1])).toBeLessThan(0.5);
      expect(Math.abs(smoke.at[0] - kilns[0])).toBeLessThan(((KILNS.count - 1) * KILNS.apart) / 2 + 0.3);
      expect(Math.abs(smoke.at[1] - (KILNS.top + SMOKING_DECK.floor))).toBeLessThan(0.2);
      expect(smoke.count ?? 0).toBeLessThanOrEqual(8);
    }
    // The kilns stand on the deck's boards, lifted to them.
    expect(stage.models.find((model) => model.file.endsWith("prop_drum-kilns.glb"))?.lift).toBe(SMOKING_DECK.floor);
    expect(stage.motion.filter((motion) => motion.kind === "hang")).toHaveLength(1);
    expect(stage.motion.filter((motion) => motion.kind === "leaves")).toHaveLength(1);
  });

  test("[city:place-words-are-text-keys] given the channel's boards, when their words are read, then the classroom, the church and the viewing centre each have one, in the place's own keys, and none names a business, a club or a sum of money", () => {
    const boards = stage.models.flatMap((model) => (model.signs ?? []).flat());
    expect(boards.length).toBeGreaterThanOrEqual(3);
    const said = boards.map(wordsOf);
    expect(said.some((words) => words.includes("SCHOOL"))).toBe(true);
    expect(said.some((words) => words.includes("CHURCH"))).toBe(true);
    expect(said.some((words) => words.includes("FOOTBALL"))).toBe(true);
    expect(said.filter((words) => /\b(FC|UNITED|CITY|LEAGUE|TV|SPORTS)\b/i.test(words))).toEqual([]);
    expect(said.filter((words) => /₦|naira|N[0-9]|[0-9],[0-9]{3}/i.test(words))).toEqual([]);
    const lettered = stage.models.find((model) => model.file.endsWith("building_makoko-school.glb"));
    expect(lettered?.signs?.[0]?.map(wordsOf).join(" ")).toContain("SCHOOL");
  });

  test("[world:street-talk-budget] given the talk overheard in Makoko, when its lines are read, then there are at least five, about the water, the fish, the school and the bridge, and the clearing is told straight", () => {
    const lines = Object.keys(text).filter((key) => /^place\.makoko\.overheard\.[0-9]+$/.test(key)).map((key) => text[key] ?? "");
    expect(lines.length).toBeGreaterThanOrEqual(5);
    for (const about of [/water/i, /fish/i, /school/i, /bridge/i, /clear/i]) expect(lines.some((line) => about.test(line))).toBe(true);
    expect(lines.filter((line) => /!|\{|route\.|news\.|[–—]/.test(line))).toEqual([]);
  });

  test("[world:map-is-painted-lagos] given Makoko's published file, when the map's stops are drawn, then its stop stands beside the bridge, open to a life at home from the start", () => {
    expect((manifest as { files: Record<string, string> }).files["places/makoko/place.json"]).toBeDefined();
    const position = entry.position;
    const bridge = content.place["place.third-mainland-bridge" as Id<"place">]?.position;
    if (position === null || bridge === undefined || bridge === null) throw new Error("No position");
    // Beside the bridge: within two and a half kilometres of its stop (a thousandth of a degree is about 111 m).
    const metres = Math.hypot(position.latE3 - bridge.latE3, position.lonE3 - bridge.lonE3) * 111;
    expect(metres).toBeLessThan(2500);
    expect(entry.area).toBe("makoko");
    expect(stopReached({ current: "chapter.find-your-feet", done: [] } as never, "home", ID)).toBe(true);
    expect(file.place).toBe(ID);
  });

  test("[city:makoko-holds-five-scenes] [assets:neighbours-never-identical] given the channel's houses, when their models are read, then at least three shapes stand on the water in at least six looks, no look stands more than three times, and no house's nearest neighbour is the same look", () => {
    const houses = stage.models.filter((model) => /building_(makoko-house|stilt-house|makoko-church)/.test(model.file));
    expect(houses.length).toBeGreaterThanOrEqual(6);
    for (const model of houses) expect({ file: model.file, copies: model.at.length <= 3 }).toEqual({ file: model.file, copies: true });
    // The low one-room (c, f, g and the rented house), the taller house up its ladder (d, b, the church) and the two-room with its annex (e).
    const files = new Set(houses.map((model) => model.file.replace(/^.*\//, "")));
    for (const shape of [["building_makoko-house_c.glb", "building_makoko-house_f.glb", "building_makoko-house_g.glb"], ["building_makoko-house_d.glb", "building_makoko-church.glb"], ["building_makoko-house_e.glb"]]) {
      expect(shape.some((name) => files.has(name))).toBe(true);
    }
    const copies = houses.flatMap((model) => model.at.map(([x, z]) => ({ file: model.file, x, z })));
    for (const one of copies) {
      const others = copies.filter((other) => other !== one);
      const nearest = others.reduce((best, other) => (Math.hypot(other.x - one.x, other.z - one.z) < Math.hypot(best.x - one.x, best.z - one.z) ? other : best));
      expect({ at: [one.x, one.z], same: nearest.file === one.file }).toEqual({ at: [one.x, one.z], same: false });
    }
  });

  test("[city:makoko-holds-five-scenes] given the channel's skyline, when it is read, then the pylons stand far off in the haze, beyond the houses and short of the bridge, and the wires the houses take their light from hang on bamboo poles over the water", () => {
    const pylons = copiesOf(stage, "prop_pylon.glb");
    expect(pylons.length).toBeGreaterThanOrEqual(2);
    const spans = copiesOf(stage, "landmark_third-mainland-span.glb");
    const houses = stage.models.filter((model) => model.file.includes("building_")).flatMap((model) => model.at);
    for (const [, z] of pylons) {
      expect(z).toBeLessThan(Math.min(...houses.map(([, hz]) => hz)) - 10);
      expect(z).toBeGreaterThan(Math.max(...spans.map(([, sz]) => sz)));
    }
    expect(copiesOf(stage, "prop_bamboo-wires.glb").length).toBeGreaterThanOrEqual(1);
  });

  test("[city:makoko-holds-five-scenes] given the smoking deck and the viewing centre on the walk, when they are read against it, then the deck's front edge stands a hand back from the walk's back edge at the walk's height, the centre's plank comes down onto it, and each door is tapped from the walk", () => {
    const walkBack = Math.min(...copiesOf(stage, "prop_plank-walkway.glb").filter(([, , turn]) => Math.abs(turn) > 1).map(([, z]) => z)) - WALKWAY.width / 2;
    const [deck] = copiesOf(stage, "building_makoko-smoking-deck.glb");
    const [centre] = copiesOf(stage, "building_makoko-viewing-centre.glb");
    if (deck === undefined || centre === undefined) throw new Error("No deck or no centre");
    const front = deck[1] + SMOKING_DECK.depth / 2;
    expect(walkBack - front).toBeGreaterThan(0.08);
    expect(walkBack - front).toBeLessThan(0.15);
    expect(Math.abs(SMOKING_DECK.floor - WALKWAY.top)).toBeLessThan(0.01);
    const [footX, footZ] = inPlace(centre, [VIEWING_RAMP_X, viewingLines().foot]);
    expect(Math.abs(footZ - walkBack)).toBeLessThan(0.05);
    for (const id of ["smoking-deck", "viewing-centre"]) {
      const at = thing(id).at;
      if (at === undefined) throw new Error(`${id} names no spot to walk to`);
      expect({ id, onWalk: at[1] > walkBack && at[1] < walkBack + WALKWAY.width }).toEqual({ id, onWalk: true });
    }
    expect(Math.abs((thing("viewing-centre").at?.[0] ?? 0) - footX)).toBeLessThan(0.6);
  });

  test("[home:home-is-the-home-point] given the whole view, when the bridge is read against the houses, then the span stands far behind them in the direction the view looks, so the two share a view", () => {
    const spans = copiesOf(stage, "landmark_third-mainland-span.glb");
    expect(spans.length).toBeGreaterThanOrEqual(1);
    const houses = stage.models.filter((model) => model.file.includes("building_")).flatMap((model) => model.at);
    const farthest = Math.min(...houses.map(([, z]) => z));
    // The view's yaw of 180 degrees looks toward -z: the span stands beyond the last house that way.
    expect(stage.shot?.yaw).toBe(180);
    for (const [, z] of spans) expect(z).toBeLessThan(farthest - 50);
  });
});
