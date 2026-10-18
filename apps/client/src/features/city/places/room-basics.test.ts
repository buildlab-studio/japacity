// The room down its length with the basics (world:room-seen-down-its-length, obligation.md
// obligation:cooking-and-fetching-water): the parlour at home and the room abroad, read from their shipped files and
// the real content. The camera turned so the long side runs up a phone held upright, fitted to the
// room's width with nothing cut off; the cooking corner, the drum at home only, the bed, the table,
// the bag by the door, each with its act; and what the month's plan shows on the thing.
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import parlourRaw from "../../../../public/assets/places/home-family-house/place.json";
import compoundRaw from "../../../../public/assets/places/home-room-house/place.json";
import roomRaw from "../../../../public/assets/places/the-room/place.json";
import type { Shot } from "../../../shared/world/contract";
import { abroadView, engineView } from "../../../shared/testing/fixtures";
import { type PlaceFile, showPlanned, stageOf } from "../../../shared/scene/placeFile";
import { cameraAt, projected, SCREENS } from "../scene/scene.testing";
import { aimShot, shotOf, WHOLE } from "../scene/shot";
import { byHandAt } from "../../../shared/scene/staging";
import { stagedNow, thingSpot, thingsNow } from "../scene/things";
import { instancesOf } from "./place.testing";
import { cityWords } from "../city.words";
import { thingIn } from "../../../shared/testing/things";

const parlour = parlourRaw as unknown as PlaceFile;
const room = roomRaw as unknown as PlaceFile;
const compound = compoundRaw as unknown as PlaceFile;
const ROOMS = [
  { name: "the family house", file: parlour, place: "place.family-house" },
  { name: "the room abroad", file: room, place: "place.the-room" },
  { name: "the room in a compound", file: compound, place: "place.compound-room" },
] as const;
/**
 * The rooms seen down their length. The homes at home are wide floors seen whole straight down their length (world:room-seen-down-its-length),
 * tested in homes.test.ts.
 */
const DOWN_ITS_LENGTH = ROOMS.filter((one) => one.place === "place.the-room");
const COOK = "activity.cook-at-home";
/** A meal of your own in a room you rent. */
const OWN = "activity.cook-own";
/** The room abroad's meal in pounds (home:living-by-hand; streets:london-life-by-hand). */
const OWN_UK = "activity.cook-own-uk";
const HOME = { where: "home", country: null } as const;
const WATER = "activity.fetch-water";

/** The room's floor as its ground lies, and the tops of the two walls it has. */
function outline(file: PlaceFile): [number, number, number][] {
  const [width, depth] = stageOf(file).ground.size;
  const [x, z] = [width / 2, depth / 2];
  const floor: [number, number, number][] = [[-x, 0, -z], [x, 0, -z], [x, 0, z], [-x, 0, z]];
  // The back wall along -z and the side wall at the door's end, 3 m high.
  const door = stageOf(file).start[0];
  const side = Math.sign(door) * x;
  return [...floor, [-x, 3, -z], [x, 3, -z], [side, 3, -z], [side, 3, z]];
}

/** The floor's share of the screen in the whole view on a phone held upright. */
function floorShare(file: PlaceFile, shot: Shot): number {
  const aspect = SCREENS.phone;
  const camera = cameraAt(aimShot(shot, WHOLE, { x: 0, z: 0 }, aspect), aspect);
  const corners = outline(file).slice(0, 4).map(([x, y, z]) => projected(camera, x, y, z));
  let twice = 0;
  corners.forEach((corner, index) => {
    const next = corners[(index + 1) % corners.length] ?? corner;
    twice += corner.x * next.y - next.x * corner.y;
  });
  // The screen runs -1 to 1 both ways: an area of 4.
  return Math.abs(twice) / 2 / 4;
}

/** The room seen from the front: the view its length view is measured against. */
const FRONT: Shot = { centre: [0, 0.6, -0.6], far: 30, near: 9, farPitch: 68, nearPitch: 36, turn: 30, yaw: 180, width: 14.5 };

function thingOf(file: PlaceFile, id: string) {
  return thingIn(stageOf(file).things, id);
}

/** The things the view lets the player act on now, as the city reads them. */
function actsNow(file: PlaceFile, place: string, view: PlayerView, extra: string[] = []): Record<string, string[]> {
  const offered = new Set([...view.activities.filter((option) => option.allowed).map((option) => option.id), ...extra]);
  const staged = new Set<string>(content.place[place as keyof typeof content.place]?.stages ?? []);
  const now = thingsNow(stageOf(file).things ?? [], stagedNow(offered, staged, new Set(), null));
  return Object.fromEntries(now.map((thing) => [thing.id, thing.acts.map((act) => act.id)]));
}

describe("the room down its length", () => {
  test("[world:room-seen-down-its-length] given the room abroad on a phone held upright, when the room opens whole, then the camera looks along the long side, the door's wall at the top, and the floor and both walls stand on screen with nothing cut off", () => {
    for (const { name, file } of DOWN_ITS_LENGTH) {
      const shot = shotOf(stageOf(file));
      // A quarter turn from the front: the long side runs up the screen.
      expect(Math.abs(shot.yaw ?? 0)).toBe(90);
      const aspect = SCREENS.phone;
      const camera = cameraAt(aimShot(shot, WHOLE, { x: 0, z: 0 }, aspect), aspect);
      for (const [x, y, z] of outline(file)) {
        const at = projected(camera, x, y, z);
        expect({ name, x, y, z, shown: at.inFront && Math.abs(at.x) <= 1 && Math.abs(at.y) <= 1 }).toEqual({ name, x, y, z, shown: true });
      }
      // The door's end is the far end, at the top.
      const [doorX, , doorZ] = stageOf(file).start;
      const door = projected(camera, doorX, 0, doorZ);
      const near = projected(camera, -doorX, 0, doorZ);
      expect(door.y).toBeGreaterThan(near.y);
    }
  });

  test("[world:room-seen-down-its-length] given the room fitted to its width, when the floor's share of the screen is measured against the view from the front, then it is more than half as large again on a phone (a room this long cannot fill more of a tall screen with nothing cut off)", () => {
    for (const { file } of DOWN_ITS_LENGTH) {
      const shot = shotOf(stageOf(file));
      const before = floorShare(file, FRONT);
      const after = floorShare(file, shot);
      expect(after / before).toBeGreaterThan(1.5);
      // Fitted to the room's width, not a fixed distance: at least the ground across, never its length.
      expect(shot.width).toBeLessThan(stageOf(file).ground.size[0]);
      expect(shot.width).toBeGreaterThanOrEqual(stageOf(file).ground.size[1]);
    }
  });
});

describe("the basics at home", () => {
  test("[world:room-seen-down-its-length] [obligation:cooking-and-fetching-water] [activity:acts-may-repeat-in-month] [city:party-room-sets-the-bar] given the family house, when its things are read, then the cooking corner cooks, the drum fetches water, the bed naps and sleeps, and the bag by the door packs and throws the send-off; each says its act in words", () => {
    const acts = (id: string) => thingOf(parlour, id).acts.map((act) => [act.kind, act.stages ?? act.command ?? null, cityWords(act.label)]);
    expect(acts("cooking")).toEqual([["sheet", COOK, "Cook"]]);
    expect(acts("drum")).toEqual([["sheet", WATER, "Water and a bath"]]);
    expect(acts("bag")).toEqual([
      ["command", "route/depart", "Pack and go"],
      ["sheet", "offer.send-off-party", "The send-off"],
    ]);
    expect(acts("mattress").map(([kind]) => kind)).toEqual(["sheet", "end"]);
    expect(thingOf(parlour, "table").acts.length).toBeGreaterThan(0);
    expect(["cooking", "drum", "bag"].map((id) => cityWords(thingOf(parlour, id).label))).toEqual(["Cooking corner", "Water drum", "Bag"]);
    // The bag stands by the door.
    const bag = thingSpot(stageOf(parlour), thingOf(parlour, "bag"));
    const door = thingSpot(stageOf(parlour), thingOf(parlour, "out"));
    if (bag === null || door === null) throw new Error("The bag or the door stands nowhere");
    expect(Math.hypot(bag[0] - door[0], bag[1] - door[1])).toBeLessThan(2);
  });

  test("[world:room-seen-down-its-length] [obligation:cooking-and-fetching-water] given Ada at home, when the parlour's acts are read for now, then cooking and water are both there, and the bag packs only once the route is granted", () => {
    const now = actsNow(parlour, "place.family-house", engineView("scenario.ada"));
    expect(now["cooking"]).toEqual(["cook"]);
    expect(now["drum"]).toEqual(["fetch-water"]);
    expect(now["bag"]).toBeUndefined();
    const granted = actsNow(parlour, "place.family-house", engineView("scenario.ada"), ["command:route/depart"]);
    expect(granted["bag"]).toEqual(["pack"]);
  });
});

describe("the acts lived by hand at home", () => {
  test("[activity:acts-may-repeat-in-month] [world:things-are-tappable-models] given Ada at home, when the parlour's acts are read with the acts that repeat staged at home, then the bed naps, the television plays, the drum's sheet holds the bath, Mama's her shop and the table's the study and the course; jollof only once it can be had", () => {
    const view = engineView("scenario.ada");
    const offered = new Set(view.activities.filter((option) => option.allowed).map((option) => option.id));
    const staged = new Set<string>([...(content.place["place.family-house"]?.stages ?? []), ...byHandAt("place.family-house", "place.family-house", HOME, content.activity)]);
    const now = thingsNow(stageOf(parlour).things ?? [], stagedNow(offered, staged, new Set(), null));
    const of = (id: string) => now.find((thing) => thing.id === id)?.acts.map((act) => [act.id, act.stages, act.more ?? []]);
    expect(of("mattress")).toEqual([["nap", "activity.nap", []], ["end-month", undefined, []]]);
    expect(of("tv")).toEqual([["watch-tv", "activity.watch-tv", []]]);
    expect(of("drum")?.[0]).toEqual(["fetch-water", WATER, ["activity.bucket-bath"]]);
    expect(of("mama")?.[0]).toEqual(["family-time", "activity.family-time", ["activity.help-shop"]]);
    const table = of("table")?.[0];
    expect(table?.[1]).toBe("activity.study-english");
    expect(table?.[2]).toEqual(expect.arrayContaining(["activity.learn-tech"]));
    const cooking = of("cooking")?.[0];
    expect(cooking?.[2]).toEqual(offered.has("activity.cook-jollof") ? ["activity.cook-jollof"] : []);
  });
});

describe("the basics abroad", () => {
  test("[world:room-seen-down-its-length] [obligation:cooking-and-fetching-water] given the room abroad, when its things are read and its acts for a life just landed, then the cooking corner cooks and there is no drum: the room has a tap", () => {
    expect(thingOf(room, "cooking").acts.map((act) => [act.kind, act.stages])).toEqual([["sheet", OWN_UK]]);
    expect((stageOf(room).things ?? []).some((thing) => thing.id === "drum")).toBe(false);
    expect(stageOf(room).models.some((model) => model.file.endsWith("prop_water-drum.glb"))).toBe(false);
    expect(thingOf(room, "bag").acts.map((act) => act.command)).toEqual(["route/depart", "return/home"]);
    const now = actsNow(room, "place.the-room", abroadView());
    expect(now["cooking"]).toEqual(["cook"]);
    expect(content.place["place.the-room"]?.stages).not.toContain(WATER);
  });
});

describe("the state on the thing", () => {
  test("[world:room-seen-down-its-length] [obligation:cooking-and-fetching-water] given nothing planned, when the room is shown, then it is the file as shipped, so the scene is not rebuilt", () => {
    expect(showPlanned(parlour, [])).toBe(parlour);
    expect(showPlanned(parlour, ["activity.rest"])).toBe(parlour);
  });

  test("[world:room-seen-down-its-length] [obligation:cooking-and-fetching-water] given cooking planned for the month, when each room is shown, at home, abroad and in a compound, then steam rises over the pot of the cooking corner", () => {
    for (const { name, file } of ROOMS) {
      const shown = stageOf(showPlanned(file, [COOK, OWN, OWN_UK]));
      const steam = shown.motion.filter((motion) => motion.kind === "smoke");
      expect(steam).toHaveLength(1);
      const corner = thingSpot(stageOf(file), thingOf(file, "cooking"));
      const at = steam[0]?.at;
      if (corner === null || at === undefined) throw new Error(`${name}: no pot`);
      expect(Math.hypot(at[0] - corner[0], at[2] - corner[1])).toBeLessThan(0.5);
      expect(at[1]).toBeGreaterThan(0.9);
      expect(stageOf(file).motion.some((motion) => motion.kind === "smoke")).toBe(false);
    }
  });

  test("[world:room-seen-down-its-length] [obligation:cooking-and-fetching-water] given water planned for the month at home, when the parlour is shown, then the drum stands filled, its water over the drum's own spot, counted in the file's instances", () => {
    const drum = stageOf(parlour).models.find((model) => model.file.endsWith("prop_water-drum.glb"))?.at[0];
    const shown = stageOf(showPlanned(parlour, [WATER, COOK]));
    const water = shown.models.find((model) => model.file.endsWith("prop_drum-water.glb"))?.at[0];
    expect(water).toEqual(drum);
    expect(stageOf(parlour).models.some((model) => model.file.endsWith("prop_drum-water.glb"))).toBe(false);
    expect(parlour.instances).toEqual(instancesOf(stageOf(parlour)));
    expect(room.instances).toEqual(instancesOf(stageOf(room)));
  });
});
