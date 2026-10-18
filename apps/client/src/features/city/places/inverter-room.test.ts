// The Inverter Room (place.yaba-hub): the desks-by-the-day room in Yaba, with its own file so its things are its own
// and not the hub's, which it showed with every act hidden (docs/rules/world.md R-WORLD-005, 009, 011, 012). The
// checks the rebuilt frontages pass, read against the interior row.
import { type Footprint, isFootprint } from "@japacity/assets";
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import budgets from "../../../../../../assets-src/budgets.json";
import { checkFaces, type ModelFace } from "../../../../../../tools/assets/faces-check";
import { checkWalkable } from "../../../../../../tools/assets/footprint-check";
import { checkLimits, SHEET_KINDS, WORLD_LIMITS } from "../../../../../../tools/assets/world-check";
import placeFile from "../../../../public/assets/places/inverter-room/place.json";
import hubFile from "../../../../public/assets/places/yaba-hub/place.json";
import { plainActLine } from "../actLines";
import { crowdSize } from "../crowd";
import { crowdTuning } from "../limits";
import { personOfLook } from "../roster";
import { sceneWords } from "../scene.words";
import { thingSpot, thingsNow, thingsOf } from "../things";
import { groundGeometry } from "../world";
import { actEntries } from "./frontage.testing";
import { allPalette, city, instancesOf, measured, rowOf, staged, totalsOf } from "./place.testing";

const ID = "place.yaba-hub";
const { file, stage, entry } = staged(placeFile, ID);
const models = [...new Set(stage.models.map((model) => model.file))];
const crowd = (mode: "low" | "high"): number => crowdSize(entry, mode, crowdTuning(city, "interior", false));
const things = stage.things ?? [];
const thing = (id: string) => things.find((candidate) => candidate.id === id);

describe("the Inverter Room's file", () => {
  test("[R-WORLD-011] given the Inverter Room in content, when its folder is read, then it is its own file for its own entry, not the hub's", () => {
    expect(entry.assets).toBe("inverter-room");
    expect(file.place).toBe(ID);
    expect(content.place["place.yaba"]?.assets).not.toBe(entry.assets);
  });

  test("[R-WORLD-011] given the hub and the Inverter Room, when their dressings are read, then they are two pictures: the inverter with its batteries, the laptop desks and the fan are the room's alone, the hub's long table and meetup corner are not in it, and their floors differ", () => {
    const hub = staged(hubFile, "place.yaba").stage;
    const hubModels = new Set(hub.models.map((model) => model.file));
    for (const own of ["shared/prop/prop_inverter.glb", "shared/prop/prop_laptop-desk.glb", "shared/prop/prop_fan.glb"]) {
      expect(models).toContain(own);
      expect(hubModels.has(own)).toBe(false);
    }
    for (const hubs of ["places/yaba-hub/prop_long-desk.glb", "places/yaba-hub/prop_meetup-corner.glb"]) {
      expect(hubModels.has(hubs)).toBe(true);
      expect(models).not.toContain(hubs);
    }
    expect(stage.ground.colour).not.toBe(hub.ground.colour);
    expect(thing("inverter")?.file).toBe("shared/prop/prop_inverter.glb");
    expect(thing("laptops")?.file).toBe("shared/prop/prop_laptop-desk.glb");
  });

  test("[R-ASSET-007] given the room's shipped files measured as the build check measures them, when it is counted, then both modes fit the interior row and its download fits the row's bytes", async () => {
    expect(file.scope).toBe("interior");
    const totals = await totalsOf(file);
    for (const mode of ["low", "high"] as const) {
      expect(totals[mode].drawCalls).toBeLessThanOrEqual(rowOf(file).drawCalls);
      expect(totals[mode].triangles).toBeLessThanOrEqual(rowOf(file).triangles);
    }
    expect(totals.bytes).toBeLessThanOrEqual(budgets.place.interior.bytes);
  });

  test("[R-ASSET-007] given the room's file, when its counts are read, then the instances are the copies staged, the crowd is the world's indoor figure in each mode, the floor is one draw call of the triangles drawn, and every colour is a palette name", () => {
    expect(file.scope).toBe(entry.scope);
    expect(file.instances).toEqual(instancesOf(stage));
    expect(file.people.low).toBe(crowd("low"));
    expect(file.people.high).toBe(crowd("high"));
    expect(placeFile.groundRoadSky.drawCalls).toBe(1);
    expect(placeFile.groundRoadSky.triangles).toBe(groundGeometry(stage).getAttribute("position").count / 3);
    expect(allPalette(stage)).toBe(true);
  });

  test("[R-WORLD-011] given the room's file, when its limits are read, then it is one room of about 12 by 10 metres with at most 4 people in low mode and 6 in high and no moving sheet", () => {
    expect(checkLimits(file)).toEqual([]);
    expect(file.people.low).toBeLessThanOrEqual(WORLD_LIMITS.people.interior.low);
    expect(file.people.high).toBeLessThanOrEqual(WORLD_LIMITS.people.interior.high);
    expect(stage.motion.filter((motion) => SHEET_KINDS.has(motion.kind))).toEqual([]);
  });

  test("[R-WORLD-009] given the room's file, when its camera is read, then it declares a whole view and a close view raised between eye level and straight down, a turn limit, its facing and the width the whole view must show", () => {
    const shot = stage.shot;
    if (shot === undefined) throw new Error("The Inverter Room declares no shot");
    expect(shot.far).toBeGreaterThan(shot.near);
    for (const pitch of [shot.farPitch, shot.nearPitch]) {
      expect(pitch).toBeGreaterThan(0);
      expect(pitch).toBeLessThan(90);
    }
    expect(shot.farPitch).toBeGreaterThanOrEqual(shot.nearPitch);
    expect(shot.turn).toBeGreaterThan(0);
    expect(shot.yaw).toBeDefined();
    expect(shot.width).toBeDefined();
  });

  test("[R-WORLD-012] given the room's models, when their faces are read, then no two overlap within a centimetre of the same height", async () => {
    const floors = new Map<string, readonly ModelFace[]>(await Promise.all(models.map(async (path) => [path, (await measured(path)).floors ?? []] as const)));
    expect(checkFaces(ID, stage, (path) => floors.get(path) ?? [])).toEqual([]);
  });

  test("[R-CITY-014] given the room's crowd spots, when the high mode's crowd stands, then there is a spot for everyone on walkable ground clear of every footprint, none where the player starts, and everyone in the sample a person of the city", async () => {
    expect(stage.people.length).toBeGreaterThanOrEqual(crowd("high"));
    const footprints = new Map<string, Footprint>();
    for (const path of models) {
      const footprint = (await measured(path)).extras.footprint;
      if (isFootprint(footprint)) footprints.set(path, footprint);
    }
    expect(checkWalkable(ID, stage, footprints)).toEqual([]);
    const [x, z] = stage.start;
    expect(stage.people.filter(([px, pz]) => Math.hypot(px - x, pz - z) < 0.8)).toEqual([]);
    expect(file.people.sample.filter((path) => personOfLook(path) === null)).toEqual([]);
    expect(file.people.sample.length).toBeGreaterThan(crowd("high"));
  });
});

describe("the Inverter Room's things", () => {
  test("[R-WORLD-005] given the room's things, when their names and acts are read, then each stands at a copy of a staged model, offers one or two acts, its name and every act's label resolve, and a plain act says what happened unless the scene shows it", () => {
    expect(things.length).toBeGreaterThanOrEqual(4);
    expect(new Set(things.map((one) => one.id)).size).toBe(things.length);
    const wrong: string[] = [];
    const say = (bad: boolean, what: string) => {
      if (bad) wrong.push(what);
    };
    for (const one of things) {
      const copies = stage.models.find((model) => model.file === one.file)?.at.length ?? 0;
      say(one.copy >= copies, `${one.id} stands at no copy`);
      say(thingSpot(stage, one) === null, `${one.id} has no spot`);
      say(one.acts.length < 1 || one.acts.length > 2, `${one.id} offers ${String(one.acts.length)} acts`);
      say(sceneWords(one.label) === one.label, `${one.id} has no name`);
      for (const act of one.acts) {
        say(sceneWords(act.label) === act.label, `${one.id} ${act.id} has no label`);
        say(act.kind === "sheet" && act.stages === undefined, `${one.id} ${act.id} stages nothing`);
        say(act.kind === "plain" && act.pose === undefined && plainActLine(one, act) === null, `${one.id} ${act.id} says nothing`);
        say(act.kind === "plain" && act.pose !== undefined && plainActLine(one, act) !== null, `${one.id} ${act.id} says a line the scene shows`);
      }
    }
    expect(wrong).toEqual([]);
  });

  test("[R-WORLD-005] given the inverter, a chair and the notices, when their acts are read, then the inverter offers a look, the chair a seat the character takes, and the notices a line, each happening at once with no sheet", () => {
    const inverter = thing("inverter");
    const chair = thing("chair");
    const notices = thing("notices");
    expect(sceneWords(inverter?.label ?? "")).toBe("Inverter");
    expect(inverter?.acts.map((act) => [act.kind, sceneWords(act.label)])).toEqual([["plain", "Look"]]);
    const sit = chair?.acts[0];
    expect(sit?.kind).toBe("plain");
    expect(sit?.pose).toBe("sit");
    expect(sit?.seat).toBeDefined();
    expect(notices?.acts.map((act) => act.kind)).toEqual(["plain"]);
    for (const act of [...(inverter?.acts ?? []), ...(notices?.acts ?? [])]) expect(sceneWords(`${act.label}.done`).length).toBeGreaterThan(20);
  });

  test("[R-WORLD-005] given a month where the view offers nothing, when the room's things are read for now, then the inverter, the chair, the notices and the door keep their acts, so the room is never a door alone", () => {
    const now = thingsNow(thingsOf(stage), () => false);
    expect(now.filter((one) => one.acts.length > 0).map((one) => one.id).sort()).toEqual(["chair", "door", "inverter", "notices"]);
  });

  test("[R-WORLD-005] given what the room stages in content, when its things' acts are read, then every staged entry opens from an act of a thing there", () => {
    const opened = new Set(actEntries(placeFile, ID));
    expect(entry.stages.filter((staged) => !opened.has(staged))).toEqual([]);
  });
});
