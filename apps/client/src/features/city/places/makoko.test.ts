// Makoko on the lagoon (city.md place.makoko, home.md R-HOME-006): houses on stilts over the water
// beside the Third Mainland Bridge, a plank walk in front of them, the racks where fish is smoked,
// the classroom on stilts, canoes moored at the walk and canoes paddled along the channel, the
// bridge far off behind. The room a character may rent carries the parlour's acts for the home's
// own entries; the acts open once the shell stages them while the character lives there.
import { content, text } from "@japacity/content";
import type { Id } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { roomBunk, ROOM_HOUSE } from "@japacity/assets-src/bld/makoko-house/build";
import { RACKS } from "@japacity/assets-src/prop/fish-racks/build";
import { WALKWAY } from "@japacity/assets-src/prop/plank-walkway/build";

import manifest from "../../../../public/assets/manifest.json";
import raw from "../../../../public/assets/places/makoko/place.json";
import { sceneWords } from "../scene.words";
import { stopReached } from "../stops";
import { thingSpot, vehicleOf } from "../things";
import { frontageTests } from "./frontageTesting";
import { copiesOf, staged, wordsOf } from "./placeTesting";

const ID = "place.makoko";
const { file, stage, entry } = staged(raw, ID);
const thing = (id: string) => {
  const found = (stage.things ?? []).find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`No ${id}`);
  return found;
};
/** The water's highest ripple over the grid's own height: the three waves of the water shader at their crests. */
const CREST = 0.075 + 0.045 + 0.02;
const water = stage.motion.filter((motion) => motion.kind === "water");

/** A copy's spot turned into the place's frame: a point `[x, z]` of the model's own frame. */
function inPlace([x, z, turn]: readonly number[], [px, pz]: readonly [number, number]): [number, number] {
  const cos = Math.cos(turn ?? 0);
  const sin = Math.sin(turn ?? 0);
  return [(x ?? 0) + px * cos + pz * sin, (z ?? 0) - px * sin + pz * cos];
}

describe("Makoko", () => {
  frontageTests(raw, ID);

  test("[R-HOME-006] [R-ACTIVITY-019] given the room on the water, when its things are read, then the room naps on its bunk and sleeps, lying down at once while no nap can be had, the porch's cooking corner cooks and fetches water with the meals and the bath on their sheets, and the papers box opens the phone's Papers, each thing with at most two acts", () => {
    const room = thing("room");
    expect(room.file).toBe("places/makoko/bld_makoko-house_a.glb");
    expect(room.acts.map((act) => [act.id, act.kind, act.stages ?? null, act.pose ?? null])).toEqual([
      ["nap", "sheet", "activity.nap", "lie"],
      ["end-month", "end", null, null],
    ]);
    const lie = room.acts[0]?.otherwise;
    expect([lie?.id, lie?.kind, lie?.pose, lie?.seat, lie?.top]).toEqual(["lie", "plain", "lie", room.acts[0]?.seat, room.acts[0]?.top]);
    const [house] = copiesOf(stage, "bld_makoko-house_a.glb");
    if (house === undefined) throw new Error("No room");
    const [bx, bz, top] = roomBunk();
    const seat = room.acts[0]?.seat;
    if (seat === undefined) throw new Error("No seat");
    // The character lies on the bunk: its middle under the seat and its top at the lying height.
    const [x, z] = inPlace(house, [bx, bz]);
    expect(Math.hypot(seat[0] - x, seat[1] - z)).toBeLessThan(0.3);
    expect(top).toBeGreaterThan(0.35);
    expect(top).toBeLessThan(0.5);
    expect(thing("room-chores").acts.map((act) => [act.kind, act.stages, act.more])).toEqual([
      // A home of your own buys its meals and its pot.
      ["sheet", "activity.cook-own", ["activity.cook-own-pot"]],
      ["sheet", "activity.fetch-water", ["activity.bucket-bath"]],
    ]);
    const papers = thing("room-papers").acts;
    // the passport is a visit to Immigration, the transcript a call from the phone.
    expect(papers.map((act) => [act.id, act.kind, act.app])).toEqual([["papers", "app", "papers"]]);
    for (const id of ["room", "room-chores", "room-papers"]) expect(thing(id).acts.length).toBeLessThanOrEqual(2);
    // The parlour's own words for the same acts.
    expect([sceneWords(room.acts[0]?.otherwise?.label ?? ""), ...room.acts.map((act) => sceneWords(act.label))]).toEqual([sceneWords("city.act.lie"), sceneWords("activity.nap.name"), sceneWords("ui.world.end-month")]);
  });

  test("[R-HOME-006] given the room's porch, when it is read against the walk, then it stands at the walk's height, joins the walk, and the room's things stand on it", () => {
    const [house] = copiesOf(stage, "bld_makoko-house_a.glb");
    if (house === undefined) throw new Error("No room");
    const { depth, porch, width } = ROOM_HOUSE;
    const [, porchEnd] = inPlace(house, [0, (depth + porch) / 2]);
    const walk = copiesOf(stage, "prop_plank-walkway.glb");
    // The walk's copies along x meet the porch's front edge.
    expect(walk.some(([wx, wz]) => Math.abs(wz - WALKWAY.width / 2 - porchEnd) < 0.05 && Math.abs(wx - house[0]) < WALKWAY.length)).toBe(true);
    for (const id of ["room-chores", "room-papers"]) {
      const spot = thingSpot(stage, thing(id));
      if (spot === null) throw new Error(`No ${id}`);
      expect(Math.abs(spot[0] - house[0])).toBeLessThan(width / 2 + 0.1);
      expect(spot[1]).toBeLessThan(porchEnd);
      expect(spot[1]).toBeGreaterThan(porchEnd - porch);
    }
  });

  test("[R-WORLD-017] given the canoe moored at the walk, when it is tapped, then Go by canoe opens the ride sheet, the way back to the city by water", () => {
    const canoe = thing("canoe");
    expect(canoe.file).toBe("places/third-mainland-bridge/prop_canoe.glb");
    expect(canoe.acts.map((act) => [act.kind, sceneWords(act.label)])).toEqual([["ride", "Go by canoe"]]);
    expect(vehicleOf(canoe)).toBeNull();
    const moored = stage.models.find((model) => model.file === canoe.file && model.glide === undefined);
    expect(moored?.bob).toBe(true);
    expect(thingSpot(stage, canoe)).not.toBeNull();
  });

  test("[R-WORLD-005] given the racks and the classroom, when their acts are read, then Look at the racks says what happened, the racks stage the job (R-ACTIVITY-017), the racks' sheet until content has it, and the classroom is looked at", () => {
    const racks = thing("racks");
    expect(racks.acts.map((act) => [act.kind, act.stages ?? null])).toEqual([
      ["plain", null],
      ["sheet", "activity.job-fish-racks"],
    ]);
    expect(sceneWords(racks.acts[0]?.label ?? "")).toBe("Look");
    expect(wordsOf(`${racks.acts[0]?.label ?? ""}.done`)).not.toBe("");
    const school = thing("school");
    expect(school.acts.map((act) => act.kind)).toEqual(["plain"]);
    expect(wordsOf(`${school.acts[0]?.label ?? ""}.done`)).not.toBe("");
    expect(school.file).toBe("places/makoko/bld_makoko-school.glb");
  });

  test("[R-CITY-026] given the lagoon, when the place is read, then one water grid in the lagoon's colour runs under the houses and the walk, and the walk, the porch and the racks stand over its highest ripple", () => {
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

  test("[R-CITY-027] given the canoes paddled along the channel, when their lanes are read, then goods and the children to school travel on the shared clock, each lane in the water and clear of the walk and of the canoes moored there", () => {
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

  test("[R-CITY-025] given the racks, when the place's motion is read, then the smoke rises from the kiln's trays and the washing on its line is the place's one moving sheet", () => {
    const [racks] = copiesOf(stage, "prop_fish-racks.glb");
    if (racks === undefined) throw new Error("No racks");
    const [sx, sy, sz] = RACKS.smoke;
    const [x, z] = inPlace(racks, [sx, sz]);
    const smoke = stage.motion.find((motion) => motion.kind === "smoke");
    if (smoke === undefined) throw new Error("No smoke");
    expect(Math.hypot(smoke.at[0] - x, smoke.at[2] - z)).toBeLessThan(0.5);
    expect(Math.abs(smoke.at[1] - sy)).toBeLessThan(0.3);
    expect(stage.motion.filter((motion) => motion.kind === "hang")).toHaveLength(1);
    expect(stage.motion.filter((motion) => motion.kind === "leaves")).toHaveLength(1);
  });

  test("[R-CITY-024] given Makoko's boards, when their words are read, then the classroom, the church and the fish seller each have one, in the place's own keys, and none names a business or a sum of money", () => {
    const boards = stage.models.flatMap((model) => (model.signs ?? []).flat());
    expect(boards.length).toBeGreaterThanOrEqual(3);
    const said = boards.map(wordsOf);
    expect(said.some((words) => words.includes("SCHOOL"))).toBe(true);
    expect(said.some((words) => words.includes("CHURCH"))).toBe(true);
    expect(said.some((words) => words.includes("FISH"))).toBe(true);
    expect(said.filter((words) => /₦|naira|N[0-9]|[0-9],[0-9]{3}/i.test(words))).toEqual([]);
    const lettered = stage.models.find((model) => model.file.endsWith("bld_makoko-school.glb"));
    expect(lettered?.signs?.[0]?.map(wordsOf).join(" ")).toContain("SCHOOL");
  });

  test("[R-WORLD-026] given the talk overheard in Makoko, when its lines are read, then there are at least five, about the water, the fish, the school and the bridge, and the clearing is told straight", () => {
    const lines = Object.keys(text).filter((key) => /^place\.makoko\.overheard\.[0-9]+$/.test(key)).map((key) => text[key] ?? "");
    expect(lines.length).toBeGreaterThanOrEqual(5);
    for (const about of [/water/i, /fish/i, /school/i, /bridge/i, /clear/i]) expect(lines.some((line) => about.test(line))).toBe(true);
    expect(lines.filter((line) => /!|\{|route\.|news\.|[–—]/.test(line))).toEqual([]);
  });

  test("[R-WORLD-015] given Makoko's published file, when the map's stops are drawn, then its stop stands beside the bridge, open to a life at home from the start", () => {
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

  test("[R-HOME-006] given the whole view, when the bridge is read against the houses, then the span stands far behind them in the direction the view looks, so the two share a view", () => {
    const spans = copiesOf(stage, "lm_third-mainland-span.glb");
    expect(spans.length).toBeGreaterThanOrEqual(1);
    const houses = stage.models.filter((model) => model.file.includes("bld_")).flatMap((model) => model.at);
    const farthest = Math.min(...houses.map(([, z]) => z));
    // The view's yaw of 180 degrees looks toward -z: the span stands beyond the last house that way.
    expect(stage.shot?.yaw).toBe(180);
    for (const [, z] of spans) expect(z).toBeLessThan(farthest - 50);
  });
});
