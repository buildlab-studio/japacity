import { describe, expect, test } from "vitest";

import bodeThomas from "../../../public/assets/places/bode-thomas/place.json";
import { say } from "../../shared/words/text";
import type { Thing } from "../../shared/world/contract";
import { type PlaceFile, stageOf } from "./placeFile";
import { builtPlaces } from "./scene.testing";
import { sceneWords } from "./scene.words";
import { MAX_ACTS, STOP_SHORT, thingSpot, thingsNow, thingsOf, vehicleOf, walkSpot } from "./things";

const street = (bodeThomas as unknown as PlaceFile).stage;
if (street === undefined) throw new Error("Bode Thomas has no stage");

const kiosk: Thing = { id: "kiosk", file: "places/x/shop_lotto-kiosk.glb", copy: 0, label: "city.thing.lotto", acts: [{ id: "play-lotto", label: "scene.act.play-lotto", kind: "sheet", stages: "activity.play-lotto" }] };

describe("things in a place", () => {
  test("[R-WORLD-005] given Bode Thomas's file, which declares no things yet, when its things are read, then the lotto kiosk, the betting shop and the danfo, keke and okada each stand at their model's first copy with one act and a name in words", () => {
    const things = thingsOf(street);
    expect(things.map((thing) => thing.id).sort()).toEqual(["bet-slip", "play-lotto", "veh_danfo", "veh_keke", "veh_okada"]);
    for (const thing of things) {
      expect(thing.copy).toBe(0);
      expect(thing.acts).toHaveLength(1);
      expect(thingSpot(street, thing)).toEqual(street.models.find((model) => model.file === thing.file)?.at[0]?.slice(0, 2));
      expect(sceneWords(thing.label)).not.toBe(thing.label);
      for (const act of thing.acts) expect(sceneWords(act.label)).not.toBe(act.label);
    }
    expect(things.find((thing) => thing.id === "play-lotto")?.acts[0]).toMatchObject({ kind: "sheet", stages: "activity.play-lotto" });
    expect(things.find((thing) => thing.id === "veh_danfo")?.acts[0]?.kind).toBe("ride");
  });

  test("[R-WORLD-005] given a file that declares its things, when they are read, then they are the file's own, and a thing with three acts offers only two", () => {
    const three: Thing = { ...kiosk, acts: [...kiosk.acts, { id: "look", label: "x", kind: "plain" }, { id: "sit", label: "y", kind: "plain" }] };
    const things = thingsOf({ models: street.models, things: [three] });
    expect(things).toHaveLength(1);
    expect(things[0]?.acts.map((act) => act.id)).toEqual(["play-lotto", "look"]);
    expect(things[0]?.acts).toHaveLength(MAX_ACTS);
  });

  test("[R-WORLD-005] given the view not offering the lotto, when the things are read for now, then the kiosk carries no act and no label, while a ride and a door always stay", () => {
    const danfo: Thing = { id: "danfo", file: "veh_danfo.glb", copy: 0, label: "city.thing.danfo", acts: [{ id: "ride", label: "city.ride.danfo", kind: "ride" }] };
    const door: Thing = { id: "door", file: "", copy: 0, label: "scene.thing.door", at: [0, 0], acts: [{ id: "out", label: "scene.act.out", kind: "out" }] };
    expect(thingsNow([kiosk, danfo, door], () => false).map((thing) => thing.id)).toEqual(["danfo", "door"]);
    expect(thingsNow([kiosk, danfo, door], (stages) => stages === "activity.play-lotto").map((thing) => thing.id)).toEqual(["kiosk", "danfo", "door"]);
    expect(vehicleOf(danfo)).toBe("danfo");
    expect(vehicleOf(kiosk)).toBeNull();
  });
});

describe("the straight walk", () => {
  test("[R-WORLD-010] given a thing that names where to stand, when it is tapped, then the character walks straight to that spot", () => {
    expect(walkSpot(street, { ...kiosk, at: [3, 4] }, { x: -10, z: 20 })).toEqual([3, 4]);
  });

  test("[R-WORLD-010] given a thing that names no spot, when it is tapped, then the character walks straight toward its copy and stops short of it, and one already beside it stays", () => {
    const thing = thingsOf(street).find((candidate) => candidate.id === "play-lotto");
    if (thing === undefined) throw new Error("No kiosk");
    const spot = thingSpot(street, thing);
    if (spot === null) throw new Error("The kiosk stands nowhere");
    const from = { x: spot[0] + 6, z: spot[1] + 8 };
    const to = walkSpot(street, thing, from);
    if (to === null) throw new Error("No walk");
    expect(Math.hypot(to[0] - spot[0], to[1] - spot[1])).toBeCloseTo(STOP_SHORT, 6);
    // On the straight line from where the character stood.
    const cross = (to[0] - from.x) * (spot[1] - from.z) - (to[1] - from.z) * (spot[0] - from.x);
    expect(Math.abs(cross)).toBeLessThan(1e-9);
    const beside = { x: spot[0] + 1, z: spot[1] };
    expect(walkSpot(street, thing, beside)).toEqual([beside.x, beside.z]);
  });
});

describe("the things of the built places", () => {
  test("[R-WORLD-005] given every built place, when its things and acts are read, then each label has words and no thing offers more than two acts", () => {
    const files = builtPlaces().filter(({ file }) => stageOf(file).things !== undefined);
    expect(files.length).toBeGreaterThan(10);
    for (const { folder, file } of files) {
      for (const thing of stageOf(file).things ?? []) {
        expect(sceneWords(thing.label), `${folder} ${thing.id}`).not.toBe(thing.label);
        expect(thing.acts.length, `${folder} ${thing.id}`).toBeLessThanOrEqual(2);
        for (const act of thing.acts) expect(sceneWords(act.label), `${folder} ${thing.id} ${act.id}`).not.toBe(act.label);
      }
    }
  });

  test("[R-WORLD-025] given the bed at home and the bed in the room abroad, when their acts are read, then each offers rest and End month, the band's own act", () => {
    for (const folder of ["family-house-parlour", "the-room"]) {
      const found = builtPlaces().find((built) => built.folder === folder);
      if (found === undefined) throw new Error(`No ${folder}`);
      const bed = (stageOf(found.file).things ?? []).find((thing) => thing.file.endsWith("prop_bed.glb"));
      expect(bed?.acts.map((act) => [act.id, act.kind, act.stages])).toEqual([
        ["rest", "sheet", "activity.rest"],
        ["end-month", "end", undefined],
      ]);
      expect(sceneWords(bed?.acts[1]?.label ?? "")).toBe(say("ui.world.end-month"));
    }
  });
});
