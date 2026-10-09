import { describe, expect, test } from "vitest";

import bodeThomas from "../../../public/assets/places/bode-thomas/place.json";
import { say } from "../../shared/words/text";
import type { Thing } from "../../shared/world/contract";
import { type PlaceFile, stageOf } from "./placeFile";
import { builtPlaces } from "./scene.testing";
import { sceneWords } from "./scene.words";
import { MAX_ACTS, stagedNow, STOP_SHORT, thingSpot, thingsNow, thingsOf, vehicleOf, walkSpot } from "./things";

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

describe("a third act on a sheet", () => {
  test("[R-WORLD-005] given a desk whose act lists more entries, when some are offered, then the act stays listing only those, and goes once none is", () => {
    const desk: Thing = { id: "desk", file: "places/x/prop_long-desk.glb", copy: 0, label: "city.thing.long-desk", acts: [{ id: "routes", label: "city.act.routes", kind: "sheet", stages: "activity.look-into-route", more: ["activity.see-adviser", "activity.ask-someone-who-went"] }] };
    const some = thingsNow([desk], (stages) => stages === "activity.see-adviser" || stages === "activity.ask-someone-who-went");
    expect(some[0]?.acts[0]).toEqual({ id: "routes", label: "city.act.routes", kind: "sheet", stages: "activity.see-adviser", more: ["activity.ask-someone-who-went"] });
    expect(thingsNow([desk], (stages) => stages === "activity.look-into-route")[0]?.acts[0]).toEqual({ id: "routes", label: "city.act.routes", kind: "sheet", stages: "activity.look-into-route" });
    expect(thingsNow([desk], () => false)).toEqual([]);
    expect(thingsNow([desk], () => true)[0]).toBe(desk);
  });
});

describe("a job on a board", () => {
  test("[R-WORLD-005] given the hunt can ask for a job the place stages, when the things are read, then the job's act shows; a job the hunt cannot ask for does not", () => {
    const things: Thing[] = [
      { id: "stall", label: "city.thing.accessories", file: "x.glb", copy: 0, acts: [{ id: "sales", kind: "sheet", label: "city.act.phone-sales", stages: "activity.job-phone-sales" }, { id: "learn", kind: "sheet", label: "city.act.apprentice", stages: "activity.apprentice-repair" }] },
    ];
    const staged = new Set(["activity.job-phone-sales", "activity.apprentice-repair"]);
    const withJob = thingsNow(things, stagedNow(new Set(["activity.job-phone-sales", "activity.apprentice-repair"]), staged, new Set(), null));
    expect(withJob[0]?.acts.map((act) => act.id)).toEqual(["sales", "learn"]);
    const without = thingsNow(things, stagedNow(new Set(["activity.apprentice-repair"]), staged, new Set(), null));
    expect(without[0]?.acts.map((act) => act.id)).toEqual(["learn"]);
  });
});

describe("what an act can open now", () => {
  test("[R-WORLD-005] given the view's offered activities, the open offers and the set piece asking, when a thing's acts are read, then an activity stays while offered and staged, an offer while open, the set piece while asking, and the chapter in hand", () => {
    const now = stagedNow(new Set(["activity.play-lotto"]), new Set(["activity.play-lotto", "activity.rest"]), new Set(["offer.nepa-bill"]), "setpiece.december", "chapter.find-your-feet");
    expect(now("activity.play-lotto")).toBe(true);
    expect(now("activity.rest")).toBe(false);
    expect(now("offer.nepa-bill")).toBe(true);
    expect(now("offer.roof")).toBe(false);
    expect(now("setpiece.december")).toBe(true);
    expect(now("setpiece.road-night")).toBe(false);
    expect(now("chapter.find-your-feet")).toBe(true);
    expect(now("chapter.send-off")).toBe(false);
  });
});

describe("a command act", () => {
  test("[R-ROUTE-008] [R-WORLD-005] given the bank counter, when a school's offer waits, then its deposit act shows and sends the payment; with none waiting it is gone", () => {
    const found = builtPlaces().find((built) => built.folder === "bank-counter");
    if (found === undefined) throw new Error("No bank counter");
    const counter = (stageOf(found.file).things ?? []).find((thing) => thing.id === "counter");
    expect(counter?.acts[0]).toMatchObject({ id: "deposit", kind: "command", command: "route/pay-deposit" });
    expect(sceneWords(counter?.acts[0]?.label ?? "")).toBe(say("ui.route.pay-deposit"));
    const due = stagedNow(new Set(["command:route/pay-deposit"]), new Set(), new Set(), null);
    expect(thingsNow([counter as Thing], due)[0]?.acts.map((act) => act.id)).toContain("deposit");
    const none = stagedNow(new Set(), new Set(), new Set(), null);
    expect(thingsNow([counter as Thing], none)[0]?.acts.map((act) => act.id) ?? []).not.toContain("deposit");
  });
});

describe("the gate", () => {
  test("[R-CHAPTER-006] [R-WORLD-005] given the arrivals hall's gate, when a visa is granted, then its act boards the plane, and with none granted it is gone", () => {
    const found = builtPlaces().find((built) => built.folder === "arrivals-hall");
    if (found === undefined) throw new Error("No arrivals hall");
    const gate = (stageOf(found.file).things ?? []).find((thing) => thing.id === "gate");
    expect(gate?.acts[0]).toMatchObject({ id: "depart", kind: "command", command: "route/depart" });
    expect(sceneWords(gate?.acts[0]?.label ?? "")).toBe(say("ui.route.depart"));
    const granted = stagedNow(new Set(["command:route/depart"]), new Set(), new Set(), null, "chapter.send-off");
    expect(thingsNow([gate as Thing], granted)[0]?.acts.map((act) => act.id)).toEqual(["depart", "send-off"]);
    const none = stagedNow(new Set(), new Set(), new Set(), null, "chapter.send-off");
    expect(thingsNow([gate as Thing], none)[0]?.acts.map((act) => act.id)).toEqual(["send-off"]);
  });
});

describe("a seat", () => {
  test("[R-WORLD-005] given every built place, when its acts with a pose are read, then each has a seat to take, and a free act that fills a slot is a do act with the activity offered or gone", () => {
    const seated = builtPlaces().flatMap(({ folder, file }) => (stageOf(file).things ?? []).flatMap((thing) => thing.acts.filter((act) => act.pose !== undefined).map((act) => ({ folder, thing: thing.id, act }))));
    expect(seated.length).toBeGreaterThan(5);
    for (const { folder, thing, act } of seated) expect(act.seat, `${folder} ${thing} ${act.id}`).toHaveLength(3);
    const rest: Thing = { id: "bed", file: "shared/prop/prop_bed.glb", copy: 0, label: "city.thing.bed", acts: [{ id: "rest", label: "city.act.rest", kind: "do", stages: "activity.rest", pose: "lie", seat: [0, 0, 0] }] };
    expect(thingsNow([rest], (stages) => stages === "activity.rest")[0]).toBe(rest);
    expect(thingsNow([rest], () => false)).toEqual([]);
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
      expect(bed?.acts.map((act) => [act.id, act.kind, act.stages, act.pose])).toEqual([
        ["rest", "do", "activity.rest", "lie"],
        ["end-month", "end", undefined, undefined],
      ]);
      expect(bed?.acts[0]?.seat).toHaveLength(3);
      expect(sceneWords(bed?.acts[1]?.label ?? "")).toBe(say("ui.world.end-month"));
    }
  });

  test("[R-WORLD-019] given the parlour, when its papers box is read, then it stands at the bed, starts the passport with the transcript on the same sheet, offers a look, and its words resolve", () => {
    const found = builtPlaces().find((built) => built.folder === "family-house-parlour");
    if (found === undefined) throw new Error("No parlour");
    const stage = stageOf(found.file);
    const box = (stage.things ?? []).find((thing) => thing.id === "papers-box");
    if (box === undefined) throw new Error("No papers box");
    expect(box.file).toBe("places/family-house-parlour/prop_papers-box.glb");
    const copyOf = (file: string) => stage.models.find((model) => model.file === file)?.at[0];
    const tin = copyOf(box.file);
    const bed = copyOf("shared/prop/prop_bed.glb");
    if (tin === undefined || bed === undefined) throw new Error("The box or the bed stands nowhere");
    expect(Math.hypot(tin[0] - bed[0], tin[1] - bed[1])).toBeLessThan(1.5);
    expect(box.acts.map((act) => [act.id, act.kind, act.stages, act.more])).toEqual([
      ["start", "sheet", "activity.get-passport", ["activity.get-transcript"]],
      ["look", "plain", undefined, undefined],
    ]);
    expect(sceneWords(box.label)).toBe("Papers box");
    expect(box.acts.map((act) => sceneWords(act.label))).toEqual(["Start a paper", "Look in the box"]);
  });
});
