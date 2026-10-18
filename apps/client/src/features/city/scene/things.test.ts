import { uiCalgaryText } from "@japacity/content/ui/calgary";
import { uiCastelText } from "@japacity/content/ui/castel";
import { uiDubaiText } from "@japacity/content/ui/dubai";
import { uiLondonText } from "@japacity/content/ui/london";
import { describe, expect, test } from "vitest";

import bodeThomas from "../../../../public/assets/places/bode-thomas/place.json";
import { say } from "../../../shared/words/text";
import type { Act, Thing } from "../../../shared/world/contract";
import { type PlaceFile, stageOf } from "../../../shared/scene/placeFile";
import { builtPlaces } from "../../../shared/scene/placeFile.testing";
import { plainActLine } from "../acts/actLines";
import { MAX_ACTS, stagedNow, STOP_SHORT, thingSpot, thingsNow, thingsOf, vehicleOf, walkSpot } from "./things";
import { addLateWords } from "../../../shared/words/late";
import { cityWords } from "../city.words";

// London's words ride their own chunk in the game (shared/words/late.ts); a test of London adds them as the city does.
addLateWords(uiLondonText);
// So do Calgary's, Dubai's and Castel Volturno's, each added once the life is in that country.
for (const table of [uiCalgaryText, uiDubaiText, uiCastelText]) addLateWords(table);

const street = (bodeThomas as unknown as PlaceFile).stage;
if (street === undefined) throw new Error("Bode Thomas has no stage");

const kiosk: Thing = { id: "kiosk", file: "places/x/shop_lotto-kiosk.glb", copy: 0, label: "city.thing.lotto", acts: [{ id: "play-lotto", label: "scene.act.play-lotto", kind: "sheet", stages: "activity.play-lotto" }] };

describe("things in a place", () => {
  test("[world:things-are-tappable-models] given Bode Thomas's file, which declares no things, when its things are read, then the lotto kiosk, the betting shop and the danfo, keke and okada each stand at their model's first copy with one act and a name in words", () => {
    const things = thingsOf(street);
    expect(things.map((thing) => thing.id).sort()).toEqual(["bet-slip", "play-lotto", "veh_danfo", "veh_keke", "veh_okada"]);
    for (const thing of things) {
      expect(thing.copy).toBe(0);
      expect(thing.acts).toHaveLength(1);
      expect(thingSpot(street, thing)).toEqual(street.models.find((model) => model.file === thing.file)?.at[0]?.slice(0, 2));
      expect(cityWords(thing.label)).not.toBe(thing.label);
      for (const act of thing.acts) expect(cityWords(act.label)).not.toBe(act.label);
    }
    expect(things.find((thing) => thing.id === "play-lotto")?.acts[0]).toMatchObject({ kind: "sheet", stages: "activity.play-lotto" });
    expect(things.find((thing) => thing.id === "veh_danfo")?.acts[0]?.kind).toBe("ride");
  });

  test("[world:things-are-tappable-models] given a file that declares its things, when they are read, then they are the file's own, and a thing with three acts offers only two", () => {
    const three: Thing = { ...kiosk, acts: [...kiosk.acts, { id: "look", label: "x", kind: "plain" }, { id: "sit", label: "y", kind: "plain" }] };
    const things = thingsOf({ models: street.models, things: [three] });
    expect(things).toHaveLength(1);
    expect(things[0]?.acts.map((act) => act.id)).toEqual(["play-lotto", "look"]);
    expect(things[0]?.acts).toHaveLength(MAX_ACTS);
  });

  test("[world:things-are-tappable-models] given the view not offering the lotto, when the things are read for now, then the kiosk carries no act and no label, while a ride and a door always stay", () => {
    const danfo: Thing = { id: "danfo", file: "veh_danfo.glb", copy: 0, label: "city.thing.danfo", acts: [{ id: "ride", label: "city.ride.danfo", kind: "ride" }] };
    const door: Thing = { id: "door", file: "", copy: 0, label: "scene.thing.door", at: [0, 0], acts: [{ id: "out", label: "scene.act.out", kind: "out" }] };
    expect(thingsNow([kiosk, danfo, door], () => false).map((thing) => thing.id)).toEqual(["danfo", "door"]);
    expect(thingsNow([kiosk, danfo, door], (stages) => stages === "activity.play-lotto").map((thing) => thing.id)).toEqual(["kiosk", "danfo", "door"]);
    expect(vehicleOf(danfo)).toBe("danfo");
    expect(vehicleOf(kiosk)).toBeNull();
  });
});

describe("the straight walk", () => {
  test("[world:nothing-roams] given a thing that names where to stand, when it is tapped, then the character walks straight to that spot", () => {
    expect(walkSpot(street, { ...kiosk, at: [3, 4] }, { x: -10, z: 20 })).toEqual([3, 4]);
  });

  test("[world:nothing-roams] given a thing that names no spot, when it is tapped, then the character walks straight toward its copy and stops short of it, and one already beside it stays", () => {
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
  test("[world:things-are-tappable-models] given a sheet act that names what stands in its place, when none of its entries can open, then that act shows instead, and with one open the sheet act itself", () => {
    const lie: Act = { id: "lie", label: "city.act.lie", kind: "plain", pose: "lie", seat: [0, 0, 0] };
    const bed: Thing = { id: "bed", file: "shared/prop/prop_bed.glb", copy: 0, label: "city.thing.bed", acts: [{ id: "nap", label: "activity.nap.name", kind: "sheet", stages: "activity.nap", otherwise: lie }, { id: "end-month", label: "ui.world.end-month", kind: "end" }] };
    expect(thingsNow([bed], () => true)[0]).toBe(bed);
    expect(thingsNow([bed], () => false)[0]?.acts).toEqual([lie, bed.acts[1]]);
    const plain: Thing = { ...bed, acts: [{ id: "nap", label: "activity.nap.name", kind: "sheet", stages: "activity.nap" }] };
    expect(thingsNow([plain], () => false)).toEqual([]);
  });

  test("[world:things-are-tappable-models] given a desk whose act lists more entries, when some are offered, then the act stays listing only those, and goes once none is", () => {
    const desk: Thing = { id: "desk", file: "places/x/prop_long-desk.glb", copy: 0, label: "city.thing.long-desk", acts: [{ id: "routes", label: "city.act.routes", kind: "sheet", stages: "activity.look-into-route", more: ["activity.see-adviser", "activity.ask-someone-who-went"] }] };
    const some = thingsNow([desk], (stages) => stages === "activity.see-adviser" || stages === "activity.ask-someone-who-went");
    expect(some[0]?.acts[0]).toEqual({ id: "routes", label: "city.act.routes", kind: "sheet", stages: "activity.see-adviser", more: ["activity.ask-someone-who-went"] });
    expect(thingsNow([desk], (stages) => stages === "activity.look-into-route")[0]?.acts[0]).toEqual({ id: "routes", label: "city.act.routes", kind: "sheet", stages: "activity.look-into-route" });
    expect(thingsNow([desk], () => false)).toEqual([]);
    expect(thingsNow([desk], () => true)[0]).toBe(desk);
  });
});

describe("a job on a board", () => {
  test("[world:things-are-tappable-models] given the hunt can ask for a job the place stages, when the things are read, then the job's act shows; a job the hunt cannot ask for does not", () => {
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
  test("[world:things-are-tappable-models] given the view's offered activities, the open offers and the set piece asking, when a thing's acts are read, then an activity stays while offered and staged, an offer while open, the set piece while asking, and the chapter in hand", () => {
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
  test("[route:deposit-secures-school] [world:things-are-tappable-models] given the bank counter, when a school's offer waits, then its deposit act shows and sends the payment; with none waiting it is gone", () => {
    const found = builtPlaces().find((built) => built.folder === "bank-counter");
    if (found === undefined) throw new Error("No bank counter");
    const counter = (stageOf(found.file).things ?? []).find((thing) => thing.id === "counter");
    expect(counter?.acts[0]).toMatchObject({ id: "deposit", kind: "command", command: "route/pay-deposit" });
    expect(cityWords(counter?.acts[0]?.label ?? "")).toBe(say("ui.route.pay-deposit"));
    const due = stagedNow(new Set(["command:route/pay-deposit"]), new Set(), new Set(), null);
    expect(thingsNow([counter as Thing], due)[0]?.acts.map((act) => act.id)).toContain("deposit");
    const none = stagedNow(new Set(), new Set(), new Set(), null);
    expect(thingsNow([counter as Thing], none)[0]?.acts.map((act) => act.id) ?? []).not.toContain("deposit");
  });
});

describe("the gate", () => {
  test("[chapter:send-off-card-on-close] [world:things-are-tappable-models] given the arrivals hall's gate, when a visa is granted, then its act boards the plane, and with none granted it is gone", () => {
    const found = builtPlaces().find((built) => built.folder === "arrivals-hall");
    if (found === undefined) throw new Error("No arrivals hall");
    const gate = (stageOf(found.file).things ?? []).find((thing) => thing.id === "gate");
    expect(gate?.acts[0]).toMatchObject({ id: "depart", kind: "command", command: "route/depart" });
    expect(cityWords(gate?.acts[0]?.label ?? "")).toBe(say("ui.route.depart"));
    const granted = stagedNow(new Set(["command:route/depart"]), new Set(), new Set(), null, "chapter.send-off");
    expect(thingsNow([gate as Thing], granted)[0]?.acts.map((act) => act.id)).toEqual(["depart", "send-off"]);
    const none = stagedNow(new Set(), new Set(), new Set(), null, "chapter.send-off");
    expect(thingsNow([gate as Thing], none)[0]?.acts.map((act) => act.id)).toEqual(["send-off"]);
  });
});

describe("a seat", () => {
  test("[world:things-are-tappable-models] given every built place, when its acts with a pose are read, then each has a seat to take, and a free act that fills a slot is a do act with the activity offered or gone", () => {
    const seated = builtPlaces().flatMap(({ folder, file }) => (stageOf(file).things ?? []).flatMap((thing) => thing.acts.filter((act) => act.pose !== undefined).map((act) => ({ folder, thing: thing.id, act }))));
    expect(seated.length).toBeGreaterThan(5);
    for (const { folder, thing, act } of seated) expect(act.seat, `${folder} ${thing} ${act.id}`).toHaveLength(3);
    const rest: Thing = { id: "bed", file: "shared/prop/prop_bed.glb", copy: 0, label: "city.thing.bed", acts: [{ id: "rest", label: "city.act.rest", kind: "do", stages: "activity.rest", pose: "lie", seat: [0, 0, 0] }] };
    expect(thingsNow([rest], (stages) => stages === "activity.rest")[0]).toBe(rest);
    expect(thingsNow([rest], () => false)).toEqual([]);
  });
});

describe("lying on a thing", () => {
  // The bed's mattress is 0.40 to 0.60 m with the wrapper over its foot to 0.64 and the pillow to 0.72; the couch's
  // cushions are at 0.48 (assets-src/prop/furniture.ts). A fixed 0.5 would put the figure inside the mattress.
  test("[world:things-are-tappable-models] given every bed and the couch, when its rest act is read, then it names the top it is lain on, the bed's on its mattress and under its pillow's top, and the bed's head toward its pillow", () => {
    const lain = builtPlaces().flatMap(({ folder, file }) => (stageOf(file).things ?? []).flatMap((thing) => thing.acts.filter((act) => act.pose === "lie").map((act) => ({ folder, thing, act }))));
    const beds = lain.filter(({ thing }) => thing.file.endsWith("prop_bed.glb"));
    expect(beds.map(({ folder }) => folder).sort()).toEqual(["home-room-house", "the-room"]);
    /** The turn of the copy a thing stands at. */
    const turnOf = (folder: string, thing: Thing): number => stageOf(builtPlaces().find((built) => built.folder === folder)?.file ?? ({} as PlaceFile)).models.find((model) => model.file === thing.file)?.at[thing.copy]?.[2] ?? 0;
    // The pillow is at the bed's -z end and the head goes toward the seat's facing: the bed's own turn and a half turn.
    const headToPillow = (folder: string, thing: Thing, act: Act): boolean => Math.cos((act.seat?.[2] ?? 0) - turnOf(folder, thing) - Math.PI) > 0.99;
    for (const { folder, thing, act } of beds) {
      const top = act.top ?? 0;
      expect({ folder, onMattress: top >= 0.6 && top < 0.72, headToPillow: headToPillow(folder, thing, act) }).toEqual({ folder, onMattress: true, headToPillow: true });
    }
    // The family house's mattress on the floor (its sheet at 0.19 m, its pillow to 0.29) and the hostel's lower bunk (its
    // mattress at 0.48 m, its pillow to 0.56; assets-src/prop/home/build.ts): each lain on, under the pillow's top, head to it.
    for (const [file, low, high] of [["prop_mattress.glb", 0.16, 0.29], ["prop_bunk-bed.glb", 0.48, 0.56]] as const) {
      const found = lain.filter(({ thing }) => thing.file.endsWith(file));
      expect({ file, found: found.length > 0 }).toEqual({ file, found: true });
      for (const { folder, thing, act } of found) {
        const top = act.top ?? 0;
        expect({ folder, file, onMattress: top >= low && top < high, headToPillow: headToPillow(folder, thing, act) }).toEqual({ folder, file, onMattress: true, headToPillow: true });
      }
    }
    const couch = lain.find(({ thing }) => thing.file.endsWith("prop_sofa.glb"));
    expect(couch?.act.top).toBe(0.48);
  });
});

describe("the things of the built places", () => {
  test("[world:things-are-tappable-models] given every built place, when its things and acts are read, then each label has words and no thing offers more than two acts", () => {
    const files = builtPlaces().filter(({ file }) => stageOf(file).things !== undefined);
    expect(files.length).toBeGreaterThan(10);
    for (const { folder, file } of files) {
      for (const thing of stageOf(file).things ?? []) {
        expect(cityWords(thing.label), `${folder} ${thing.id}`).not.toBe(thing.label);
        expect(thing.acts.length, `${folder} ${thing.id}`).toBeLessThanOrEqual(2);
        for (const act of thing.acts) expect(cityWords(act.label), `${folder} ${thing.id} ${act.id}`).not.toBe(act.label);
      }
    }
  });

  test("[world:sleep-ends-the-month] [turn:free-slots-per-month] [activity:acts-may-repeat-in-month] given the bed at home, in a compound, in the hostel and in the room abroad, when their acts are read, then each offers a nap on its sheet lain on the bed, and Sleep, the band's own act; while no nap can be had, Lie down stands in its place, done at once with the lying pose and no slot", () => {
    for (const folder of ["home-family-house", "home-room-house", "home-hostel-house", "the-room"]) {
      const found = builtPlaces().find((built) => built.folder === folder);
      if (found === undefined) throw new Error(`No ${folder}`);
      // The thing the month turns from: the bed, the family house's mattress, the hostel's bunk.
      const bed = (stageOf(found.file).things ?? []).find((thing) => thing.acts.some((act) => act.kind === "end"));
      if (bed === undefined) throw new Error(`No bed in ${folder}`);
      expect(bed.acts.map((act) => [act.id, act.kind, act.stages, act.pose])).toEqual([
        ["nap", "sheet", "activity.nap", "lie"],
        ["end-month", "end", undefined, undefined],
      ]);
      const [nap, sleep] = bed.acts;
      expect(cityWords(nap?.label ?? "")).toBe("Nap");
      expect(cityWords(sleep?.label ?? "")).toBe(say("ui.world.end-month"));
      expect(say("ui.world.end-month")).toBe("Sleep");
      const lie = nap?.otherwise;
      expect([lie?.id, lie?.kind, lie?.stages, lie?.pose]).toEqual(["lie", "plain", undefined, "lie"]);
      expect(cityWords(lie?.label ?? "")).toBe("Lie down");
      expect(lie?.seat).toEqual(nap?.seat);
      expect(lie?.top).toBe(nap?.top);
      // A nap to be had: Nap and Sleep. None (night, spent, abroad): Lie down and Sleep. Never three.
      expect(thingsNow([bed], (stages) => stages === "activity.nap")[0]?.acts.map((act) => act.id)).toEqual(["nap", "end-month"]);
      expect(thingsNow([bed], () => false)[0]?.acts.map((act) => act.id)).toEqual(["lie", "end-month"]);
    }
  });

  test("[world:things-are-tappable-models] [world:sleep-ends-the-month] [activity:acts-may-repeat-in-month] given the family house, when its things are read, then the cooking corner offers both meals on one sheet, the drum the water and the bath on one, the television Nollywood with Papa from the sofa, Mama her gist and her shop on one beside the bills, and the table the study, the course, the portfolio and the night support on one beside the fees", () => {
    const found = builtPlaces().find((built) => built.folder === "home-family-house");
    if (found === undefined) throw new Error("No parlour");
    const stage = stageOf(found.file);
    const acts = (id: string) => (stage.things ?? []).find((thing) => thing.id === id)?.acts.map((act) => [act.kind, act.stages ?? null, act.more ?? null, cityWords(act.label)]);
    expect(acts("cooking")).toEqual([["sheet", "activity.cook-at-home", ["activity.cook-jollof"], "Cook"]]);
    expect(acts("drum")).toEqual([["sheet", "activity.fetch-water", ["activity.bucket-bath"], "Water and a bath"]]);
    expect(acts("tv")).toEqual([["sheet", "activity.watch-tv", null, "Nollywood with Papa"]]);
    expect(acts("mama")).toEqual([
      ["sheet", "activity.family-time", ["activity.help-shop"], "Gist"],
      ["sheet", "offer.nepa-bill", null, "The bills"],
    ]);
    expect(acts("table")).toEqual([
      ["sheet", "activity.study-english", ["activity.learn-tech", "activity.build-portfolio", "activity.night-support"], "Study or work"],
      ["sheet", "offer.brother-fees", null, "School fees"],
    ]);
    // The television stands on its stand, and Nollywood is watched sitting on the sofa facing it.
    const tv = (stage.things ?? []).find((thing) => thing.id === "tv");
    if (tv === undefined) throw new Error("No television");
    expect(tv.file).toBe("places/family-house-parlour/prop_tv-stand.glb");
    expect(thingSpot(stage, tv)).toEqual(stage.models.find((model) => model.file === tv.file)?.at[0]?.slice(0, 2));
    const sit = (stage.things ?? []).find((thing) => thing.id === "sofa")?.acts.find((act) => act.id === "sit");
    expect(tv.acts[0]?.pose).toBe("sit");
    expect(tv.acts[0]?.seat).toEqual(sit?.seat);
    // Each act's sheet lists only what can open now, and the names come from content.
    expect(cityWords("activity.cook-jollof.name")).toBe("A big pot for the house");
    const cooking = (stage.things ?? []).find((thing) => thing.id === "cooking");
    expect(thingsNow(cooking === undefined ? [] : [cooking], (stages) => stages === "activity.cook-at-home")[0]?.acts[0]).toEqual({ id: "cook", label: "city.act.cook", kind: "sheet", stages: "activity.cook-at-home" });
  });

  test("[world:phone-holds-what-phones-hold] given the family house, when its papers box is read, then it stands at the bed, its one act opens the Papers app, and its words resolve", () => {
    const found = builtPlaces().find((built) => built.folder === "home-family-house");
    if (found === undefined) throw new Error("No parlour");
    const stage = stageOf(found.file);
    const box = (stage.things ?? []).find((thing) => thing.id === "papers-box");
    if (box === undefined) throw new Error("No papers box");
    expect(box.file).toBe("places/family-house-parlour/prop_papers-box.glb");
    const copyOf = (file: string) => stage.models.find((model) => model.file === file)?.at[0];
    const tin = copyOf(box.file);
    // The bed is your corner's mattress.
    const bed = copyOf((stage.things ?? []).find((thing) => thing.acts.some((act) => act.kind === "end"))?.file ?? "");
    if (tin === undefined || bed === undefined) throw new Error("The box or the bed stands nowhere");
    expect(Math.hypot(tin[0] - bed[0], tin[1] - bed[1])).toBeLessThan(1.5);
    // The box has no sheet of papers: they are on the phone.
    expect(box.acts.map((act) => [act.id, act.kind, act.app])).toEqual([["papers", "app", "papers"]]);
    expect(cityWords(box.label)).toBe("Papers box");
    expect(box.acts.map((act) => cityWords(act.label))).toEqual(["Look in the box"]);
  });
});

describe("the hours a thing keeps", () => {
  const match: Act = { id: "match", label: "city.act.match", kind: "sheet", stages: "activity.viewing-centre", parts: ["evening", "night"], pose: "sit", seat: [1, 2, Math.PI] };
  const viewing: Thing = { id: "viewing", file: "places/x/shop_viewing-centre.glb", copy: 0, label: "city.thing.viewing", acts: [match] };
  const drink: Act = { id: "drink", label: "city.act.joint", kind: "sheet", stages: "activity.beer-joint", more: ["activity.night-out"], parts: ["evening", "night"], pose: "sit", seat: [3, 4, 0] };
  const joint: Thing = { id: "joint", file: "shared/prop/prop_joint-set.glb", copy: 0, label: "city.thing.joint", acts: [drink] };
  const late: Thing = { id: "late", file: "x.glb", copy: 0, label: "city.thing.joint", acts: [{ ...drink, parts: ["night"] }] };
  const all = () => true;

  test("[clock:game-day-on-real-time] [world:things-are-tappable-models] given a thing open in the evening and at night, when the world stands in either, then its act stands as the file gives it, the seat and the pose kept", () => {
    for (const part of ["evening", "night"] as const) {
      expect(thingsNow([viewing], all, part)[0]).toBe(viewing);
      expect(thingsNow([joint], all, part)[0]).toBe(joint);
    }
    // With the night out not offered, the joint's act still sits the figure at its table.
    expect(thingsNow([joint], (stages) => stages === "activity.beer-joint", "evening")[0]?.acts[0]).toMatchObject({ id: "drink", stages: "activity.beer-joint", pose: "sit", seat: [3, 4, 0], parts: ["evening", "night"] });
    expect(thingsNow([joint], (stages) => stages === "activity.beer-joint", "evening")[0]?.acts[0]?.more).toBeUndefined();
  });

  test("[clock:game-day-on-real-time] [world:things-are-tappable-models] given a thing open in the evening and at night, when the world stands in the morning or the afternoon, then it still stands with one plain act saying when it opens, its line saying it is shut, no seat and no pose", () => {
    for (const part of ["morning", "afternoon"] as const) {
      const [shut] = thingsNow([viewing], all, part);
      expect(shut?.id).toBe("viewing");
      expect(shut?.acts).toEqual([{ id: "shut", label: "city.act.opens-evening", kind: "plain", tells: "city.act.match.shut" }]);
      expect(cityWords("city.act.opens-evening")).toBe("Opens in the evening");
      expect(plainActLine(viewing, shut?.acts[0] ?? match)).toEqual({ kind: "tell", words: "Shut till evening. The screen is dark." });
      const [stacked] = thingsNow([joint], all, part);
      expect(stacked?.acts).toEqual([{ id: "shut", label: "city.act.opens-evening", kind: "plain", tells: "city.act.joint.shut" }]);
      expect(plainActLine(joint, stacked?.acts[0] ?? drink)).toEqual({ kind: "tell", words: "The chairs are stacked. Come back in the evening." });
    }
    // Shut by the hour it says so whether or not the view offers the act: the hour is the reason it is shut.
    expect(thingsNow([viewing], () => false, "morning")[0]?.acts[0]?.label).toBe("city.act.opens-evening");
  });

  test("[clock:game-day-on-real-time] [world:things-are-tappable-models] given a thing open only at night, when the world stands in the evening, then its shut act names the night, the first part it opens in", () => {
    expect(thingsNow([late], all, "evening")[0]?.acts[0]?.label).toBe("city.act.opens-night");
    expect(thingsNow([late], all, "morning")[0]?.acts[0]?.label).toBe("city.act.opens-night");
    expect(cityWords("city.act.opens-night")).toBe("Opens at night");
    expect(thingsNow([late], all, "night")[0]).toBe(late);
  });

  test("[clock:game-day-on-real-time] [world:things-are-tappable-models] given acts with no hours and a thing open by the hour but not offered, when the things are read, then the first stand at every part and the second goes", () => {
    for (const part of ["morning", "afternoon", "evening", "night"] as const) expect(thingsNow([kiosk], all, part)[0]).toBe(kiosk);
    expect(thingsNow([viewing], () => false, "evening")).toEqual([]);
    // Read with no part (a test of the acts alone), the hours are not read.
    expect(thingsNow([viewing], all)[0]).toBe(viewing);
  });
});
