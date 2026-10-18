// Their room (place.their-room; docs/rules/world.md R-WORLD-020, person.md R-PEOPLE-014): one shared room, on the map
// once a bond is courting, where time together is a visit on its chair and nobody is met. Built
// from the room in a compound's shell, the size such a room is. The checks the other rooms pass, read against the
// interior row; for the two rooms a person is met in, the hub and the family house's parlour, everyone standing at a
// thing stands on walkable ground; and the room is dressed for each computer partner: a prop or two
// from the shared kit and the partner standing as themselves, clear of the chair and the door, the only figure in it:
// a person's room shows no crowd.
import { boxBounds, type Footprint, inBox, isFootprint, onWalkable, type PlacedBox } from "@japacity/assets";
import { content, partnerMeetings } from "@japacity/content";
import type { Id } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import budgets from "../../../../../../assets-src/budgets.json";
import { checkWalkable, placedBoxes, standingProblem } from "../../../../../../tools/assets/footprint-check";
import { checkLimits, SHEET_KINDS, WORLD_LIMITS } from "../../../../../../tools/assets/world-check";
import parlourRaw from "../../../../public/assets/places/home-family-house/place.json";
import placeFile from "../../../../public/assets/places/their-room/place.json";
import hubRaw from "../../../../public/assets/places/yaba-hub/place.json";
import { courted, linkedFriend, peopleGame, TOBI } from "../../../shared/testing/person";
import { crowdSize } from "../../../shared/scene/crowd";
import { crowdTuning } from "../../../shared/scene/limits";
import { roomPartner, standingAsThemselves, withStanding } from "../meetings";
import { dressPlace, type Dressing, filesOf, type PlaceFile, stageOf } from "../../../shared/scene/placeFile";
import { personOfLook } from "../../../shared/scene/roster";
import { thingSpot, thingsNow, thingsOf } from "../scene/things";
import { groundGeometry } from "../../../shared/scene/world";
import { actEntries } from "./frontage.testing";
import { allPalette, city, instancesOf, measured, rowOf, staged, totalsOf } from "./place.testing";
import { cityWords } from "../city.words";

const ID = "place.their-room";
const { file, stage, entry } = staged(placeFile, ID);
const crowd = (mode: "low" | "high"): number => crowdSize(entry, mode, crowdTuning(city, "interior", false));
const things = stage.things ?? [];

/** The footprints of every model a file stages, its dressings' too. */
async function footprintsOf(of: PlaceFile): Promise<Map<string, Footprint>> {
  const found = new Map<string, Footprint>();
  for (const path of new Set([...(of.stage?.models ?? []), ...(of.stage?.dressings ?? []).flatMap((dressing) => dressing.models)].map((model) => model.file))) {
    const footprint = (await measured(path)).extras.footprint;
    if (isFootprint(footprint)) found.set(path, footprint);
  }
  return found;
}

describe("their room's file", () => {
  test("[R-WORLD-020] given their room in content, when its folder is read, then it is its own file for its own entry, a room with no address where nobody stands to be met", () => {
    expect(entry.assets).toBe("their-room");
    expect(stage.standing).toBeUndefined();
    expect(file.place).toBe(ID);
    expect(entry.position).toBeNull();
    expect(file.scope).toBe("interior");
  });

  test("[R-ASSET-007] given the room's shipped files measured as the build check measures them, when it is counted, then both modes fit the interior row and its download fits the row's bytes", async () => {
    const totals = await totalsOf(file);
    for (const mode of ["low", "high"] as const) {
      expect(totals[mode].drawCalls).toBeLessThanOrEqual(rowOf(file).drawCalls);
      expect(totals[mode].triangles).toBeLessThanOrEqual(rowOf(file).triangles);
    }
    expect(totals.bytes).toBeLessThanOrEqual(budgets.place.interior.bytes);
  });

  test("[R-ASSET-007] given the room's file, when its counts are read, then the instances are the copies staged, the crowd is the entry's figure in each mode, the floor is one draw call of the triangles drawn, and every colour is a palette name", () => {
    expect(file.instances).toEqual(instancesOf(stage));
    expect(file.people.low).toBe(crowd("low"));
    expect(file.people.high).toBe(crowd("high"));
    expect(placeFile.groundRoadSky.drawCalls).toBe(1);
    expect(placeFile.groundRoadSky.triangles).toBe(groundGeometry(stage).getAttribute("position").count / 3);
    expect(allPalette(stage)).toBe(true);
  });

  test("[R-WORLD-011] given the room's file, when its limits are read, then it is within the indoor caps with no moving sheet, and its camera is declared", () => {
    expect(checkLimits(file)).toEqual([]);
    expect(file.people.high).toBeLessThanOrEqual(WORLD_LIMITS.people.interior.high);
    expect(stage.motion.filter((motion) => SHEET_KINDS.has(motion.kind))).toEqual([]);
    expect(stage.shot).toBeDefined();
  });

  test("[R-CITY-014] given the room's crowd spots, when the high mode's crowd stands, then there is a spot for everyone on walkable ground clear of every footprint, none where the player starts, and everyone in the sample a person of the city", async () => {
    expect(stage.people.length).toBeGreaterThanOrEqual(crowd("high"));
    expect(checkWalkable(ID, stage, await footprintsOf(file))).toEqual([]);
    const [x, z] = stage.start;
    expect(stage.people.filter(([px, pz]) => Math.hypot(px - x, pz - z) < 0.8)).toEqual([]);
    expect(file.people.sample.filter((path) => personOfLook(path) === null)).toEqual([]);
    expect(file.people.sample.length).toBeGreaterThan(crowd("high"));
  });
});

describe("their room's things", () => {
  test("[R-WORLD-005] given the room's things, when their names and acts are read, then each stands at a copy of a staged model, offers one or two acts, and its name and every act's label resolve", () => {
    const wrong: string[] = [];
    for (const one of things) {
      const copies = stage.models.find((model) => model.file === one.file)?.at.length ?? 0;
      if (one.copy >= copies) wrong.push(`${one.id} stands at no copy`);
      if (thingSpot(stage, one) === null) wrong.push(`${one.id} has no spot`);
      if (one.acts.length < 1 || one.acts.length > 2) wrong.push(`${one.id} offers ${String(one.acts.length)} acts`);
      if (cityWords(one.label) === one.label) wrong.push(`${one.id} has no name`);
      for (const act of one.acts) if (cityWords(act.label) === act.label) wrong.push(`${one.id} ${act.id} has no label`);
    }
    expect(wrong).toEqual([]);
    expect(new Set(things.map((one) => one.id)).size).toBe(things.length);
  });

  test("[R-PEOPLE-014] [R-WORLD-005] given what the room stages in content, when its things' acts are read, then the visit opens from the chair, and with nothing offered the door alone stays, so the room is never shown with a dead act", () => {
    expect(entry.stages).toEqual(["activity.see-someone"]);
    expect(actEntries(placeFile, ID)).toEqual(["activity.see-someone"]);
    expect(thingsNow(thingsOf(stage), () => false).map((one) => one.id)).toEqual(["door"]);
  });
});

describe("everyone standing at a thing", () => {
  test("[R-WORLD-020] [R-ASSET-030] given the hub and the family house's parlour, where people are met, when everyone who can stand at a thing stands there, then each stands on walkable ground clear of every footprint, apart from where the player starts, and each thing's own spot is clear too", async () => {
    for (const [id, raw] of [
      ["place.yaba", hubRaw],
      ["place.family-house", parlourRaw],
    ] as const) {
      const room = raw as unknown as PlaceFile;
      const here = room.stage;
      expect(here?.walkable).toBeDefined();
      const boxes = placedBoxes(here?.models ?? [], await footprintsOf(room));
      const walkable = here?.walkable ?? [];
      const standers = here?.standing ?? [];
      expect(standers.length).toBeGreaterThan(0);
      const problems = [
        ...standers.map((one) => [`${id} ${one.thing} ${one.person ?? ""}`, standingProblem(walkable, boxes, one.at[0], one.at[1])] as const),
        ...(here?.things ?? []).filter((one) => one.at !== undefined).map((one) => [`${id} ${one.id}'s spot`, standingProblem(walkable, boxes, one.at?.[0] ?? 0, one.at?.[1] ?? 0)] as const),
      ].filter(([, problem]) => problem !== null);
      expect(problems).toEqual([]);
      const [x, z] = here?.start ?? [0, 0];
      expect(standers.filter((one) => Math.hypot(one.at[0] - x, one.at[1] - z) < 0.8)).toEqual([]);
      expect(standers.filter((one) => content.person[one.person as keyof typeof content.person] === undefined && one.person !== undefined)).toEqual([]);
    }
  });
});

/** Whose room each dressing is: the computer partners whose home content makes their room. */
const HOMES = partnerMeetings.filter((meeting) => meeting.home.place === ID);
const dressings = stage.dressings ?? [];
const CHAIR = things.find((one) => one.id === "time-together");
const DOOR = things.find((one) => one.id === "door");

/** The model a person stands as where content meets them, so they look the same in their room. */
function metAs(person: Id<"person">): string | undefined {
  const meeting = partnerMeetings.find((one) => one.person === person);
  const met = meeting?.met.place === "place.yaba" ? (hubRaw as unknown as PlaceFile) : (parlourRaw as unknown as PlaceFile);
  return met.stage?.standing?.find((one) => one.thing === meeting?.met.thing && (one.person === undefined || one.person === person))?.file;
}

/** Whether two placed boxes cover any of the same ground. */
function overlap(one: PlacedBox, two: PlacedBox): boolean {
  const [ax, az, bx, bz] = boxBounds(one);
  const [cx, cz, dx, dz] = boxBounds(two);
  return ax < dx && cx < bx && az < dz && cz < bz;
}

describe("their room dressed for each person", () => {
  test("[R-WORLD-020] given the computer partners whose home is their room, when the room's dressings are read, then there is one for each, named by the person and by no offer, each a prop or two from the shared kit with nothing hidden, no crowd and no motion, and the partner standing as themselves in the model they are met in", () => {
    expect(HOMES).toHaveLength(6);
    expect(dressings.map((one) => one.person).sort()).toEqual(HOMES.map((meeting) => meeting.person).sort());
    const wrong: string[] = [];
    for (const dressing of dressings) {
      const who = dressing.person ?? "";
      if (dressing.offer !== undefined) wrong.push(`${who} names an offer`);
      const props = dressing.models.flatMap((model) => model.at.map(() => model.file));
      if (props.length < 1 || props.length > 2) wrong.push(`${who} has ${String(props.length)} props`);
      if (props.some((path) => !path.startsWith("shared/prop/"))) wrong.push(`${who} has a prop from outside the shared kit`);
      if (dressing.hide !== undefined || dressing.motion.length > 0 || dressing.dancers.length > 0) wrong.push(`${who} hides or moves something`);
      if (dressing.crowd.low !== 0 || dressing.crowd.high !== 0 || dressing.crowd.target !== 0) wrong.push(`${who} lets strangers into the room`);
      const [partner, ...more] = dressing.standing ?? [];
      if (partner === undefined || more.length > 0) wrong.push(`${who} has no one partner standing`);
      if (partner?.person !== dressing.person) wrong.push(`${who} stands someone else`);
      if (things.some((one) => one.id === partner?.thing)) wrong.push(`${who} stands at a thing of the room`);
      if (dressing.person === undefined || partner?.file !== metAs(dressing.person)) wrong.push(`${who} looks other than where they are met`);
    }
    expect(wrong).toEqual([]);
  });

  test("[R-WORLD-020] [R-ASSET-030] given each dressing, when its props and the partner stand in the room, then each prop stands on walkable ground clear of every other footprint, the chair's spot, the door's and the start, and the partner on walkable ground clear of every footprint, away from the chair's spot, the door's and the start", async () => {
    const footprints = await footprintsOf(file);
    // Each prop's copy apart, so two copies of the bag are each checked against the other.
    const placed = (models: Dressing["models"]): PlacedBox[][] => models.flatMap((model) => model.at.map((at) => placedBoxes([{ file: model.file, at: [at] }], footprints)));
    const plain = placedBoxes(stage.models, footprints);
    const walkable = stage.walkable ?? [];
    const chair = CHAIR === undefined ? null : thingSpot(stage, CHAIR);
    const door = DOOR === undefined ? null : thingSpot(stage, DOOR);
    expect(chair).not.toBeNull();
    expect(door).not.toBeNull();
    const kept = [chair, door, [stage.start[0], stage.start[1]]].flatMap((spot) => (spot === null ? [] : [spot as [number, number]]));
    const wrong: string[] = [];
    for (const dressing of dressings) {
      const who = dressing.person ?? "";
      const props = placed(dressing.models);
      dressing.models.forEach((model) => {
        for (const at of model.at) if (!onWalkable(walkable, at[0], at[1])) wrong.push(`${who} ${model.file} stands off the walkable ground`);
      });
      props.forEach((boxes, index) => {
        const others = [...plain, ...props.filter((_, other) => other !== index).flat()];
        if (boxes.some((box) => others.some((other) => overlap(box, other)))) wrong.push(`${who} prop ${String(index)} covers another footprint`);
        if (boxes.some((box) => kept.some(([x, z]) => inBox(box, x, z, 0.25)))) wrong.push(`${who} prop ${String(index)} stands on the chair, the door or the start`);
      });
      const all = [...plain, ...props.flat()];
      for (const one of dressing.standing ?? []) {
        const [x, z] = one.at;
        const problem = standingProblem(walkable, all, x, z);
        if (problem !== null) wrong.push(`${who} ${problem}`);
        if (all.some((box) => inBox(box, x, z, 0.2))) wrong.push(`${who} stands against a footprint`);
        if (kept.some(([kx, kz]) => Math.hypot(kx - x, kz - z) < 0.8)) wrong.push(`${who} stands by the chair, the door or the start`);
      }
    }
    expect(wrong).toEqual([]);
    // The build check reads the dressings too: every spot of each clear of its props.
    expect(checkWalkable(ID, stage, footprints)).toEqual([]);
  });

  test("[R-WORLD-020] [R-CITY-011] [R-PEOPLE-054] given Tobi courted, when their room opens, then it is dressed for him: his props join the room, he stands in it alone as a thing with his name and the computer mark and no act, no stranger stands there in either mode, and the chair's visit and the door stay; a bond with a player, or no bond, keeps the plain room", () => {
    const game = peopleGame();
    expect(roomPartner(game.view())).toBeNull();
    courted(game, TOBI);
    expect(roomPartner(game.view())).toBe(TOBI);
    const dressed = dressPlace(file, [], roomPartner(game.view()));
    // Nobody is met here, so no meeting takes the partner away (R-WORLD-020).
    const room = stageOf(withStanding(dressed.file, []));
    const own = dressings.find((one) => one.person === TOBI);
    expect(room.models).toEqual([...stage.models, ...(own?.models ?? [])]);
    expect(room.standing).toEqual(own?.standing);
    expect(dressed.crowd).toEqual({ low: 0, high: 0, target: 0 });
    for (const mode of ["low", "high"] as const) expect(crowdSize({ crowd: dressed.crowd ?? entry.crowd }, mode, crowdTuning(city, "interior", true))).toBe(0);
    expect(room.things).toEqual(stage.things);
    const partner = standingAsThemselves(room);
    expect(partner).toEqual([{ id: "partner", file: own?.standing?.[0]?.file, copy: 0, label: `${TOBI}.name`, mark: "computer", acts: [] }]);
    expect(thingSpot(room, partner[0]!)).toEqual(own?.standing?.[0]?.at.slice(0, 2));
    expect(filesOf(dressed.file, [])).toContain(own?.standing?.[0]?.file);
    // A friend who is a player has no dressing: the room stays plain, and nobody stands in it.
    const pair = peopleGame();
    linkedFriend(pair);
    expect(roomPartner(pair.view())).toBeNull();
    expect(dressPlace(file, [], null).file).toBe(file);
    expect(dressPlace(file, [], "person.nobody").file).toBe(file);
    expect(standingAsThemselves(stage)).toEqual([]);
  });

  test("[R-WORLD-020] given two computer partners courted, one with a home in Lagos and one home only for December, when their room opens, then it is the one the map puts it near, whichever was courted first", () => {
    const game = peopleGame();
    courted(game, "person.kelechi-dev");
    expect(roomPartner(game.view())).toBe("person.kelechi-dev");
    courted(game, TOBI);
    expect(roomPartner(game.view())).toBe(TOBI);
  });
});
