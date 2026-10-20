// The room in a compound in Ojuelegba (home:compound-room-is-a-home, home:home-is-the-home-point; world:room-seen-down-its-length): your
// room in a wide floor with its bathroom and nook behind it and the compound's yard through your door,
// the home's five things, the mattress, the stove, the drum by the door, the papers box and the bag, each with the act
// the family house's has. It stages nothing of its own (city:places-stage-their-acts): while the character lives there the city opens the
// family house's acts on its things.
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { setPockets } from "@japacity/sim/testing";
import { describe, expect, test } from "vitest";

import raw from "../../../../public/assets/places/home-room-house/place.json";
import { engineView, newGame } from "../../../shared/testing/fixtures";
import { cameraAt, projected, SCREENS } from "../scene/scene.testing";
import { aimRoom, shotOf } from "../scene/shot";
import { type PlaceFile, stageOf } from "../../../shared/scene/placeFile";
import { byHandAt, homeStagesAt } from "../../../shared/scene/staging";
import { stagedNow, thingSpot, thingsNow, thingsOf, withMoreAt } from "../scene/things";
import { cityWords } from "../city.words";
import { thingIn } from "../../../shared/testing/things";

const ID = "place.compound-room";
const file = raw as unknown as PlaceFile;
const stage = stageOf(file);
const PLACES = Object.values(content.place);
const HOME = { where: "home", country: null } as const;

function thingOf(id: string) {
  return thingIn(stage.things, id);
}

/** The graduate's view living in the room: moved in through the game, so its upkeep is the room's own (home:compound-room-is-a-home). */
function livingThere(): PlayerView {
  const game = newGame("scenario.graduate");
  setPockets(game, { NGN: 5_000_000_00 });
  game.accept({ type: "home/move", to: ID });
  return game.view();
}

/** The things the player can act on in the room now, as the city reads them for the home `home`. */
function actsNow(view: PlayerView, home: string | null): Record<string, string[]> {
  const offered = new Set(view.activities.filter((option) => option.allowed).map((option) => option.id));
  const staged = new Set<string>([...(content.place[ID]?.stages ?? []), ...homeStagesAt(ID, home, HOME, PLACES), ...byHandAt(ID, home, HOME, content.activity)]);
  const now = thingsNow(withMoreAt(thingsOf(stage), ID), stagedNow(offered, staged, new Set(), null));
  return Object.fromEntries(now.map((thing) => [thing.id, thing.acts.map((act) => act.id)]));
}

describe("the room in a compound", () => {
  test("[home:compound-room-is-a-home] [world:room-seen-down-its-length] given the room's file, when it is read, then it is the room's own interior, nobody else lives in it, the neighbours keep to the compound's yard, and its five home things carry the family house's acts in the room's own words", () => {
    expect(file.place).toBe(ID);
    expect(file.scope).toBe("interior");
    expect(content.place[ID]).toMatchObject({ scope: "interior", assets: "home-room-house", stages: [] });
    // Your room ends at its door's wall (x 0.475); everyone else stands in the yard beyond it.
    expect(stage.people.filter(([x]) => x < 0.475)).toEqual([]);
    const acts = (id: string) => thingOf(id).acts.map((act) => [act.kind, act.stages ?? act.command ?? null]);
    // The mattress naps on its sheet and sleeps (decision 0012, activity:acts-may-repeat-in-month); while no nap can be had its act is Lie
    // down, done at once with the lying pose; an empty slot rests (turn:free-slots-per-month).
    expect(acts("bed")).toEqual([
      ["sheet", "activity.nap"],
      ["end", null],
    ]);
    expect(thingOf("bed").acts[0]?.otherwise).toMatchObject({ id: "lie", kind: "plain", pose: "lie" });
    // A home of your own buys its meal and its pot: the family house's pot is the house's.
    expect(acts("cooking")).toEqual([["sheet", "activity.cook-own"]]);
    expect(thingOf("cooking").acts[0]?.more).toEqual(["activity.cook-own-pot"]);
    // The drum is filled free from the yard's tap: its own act, not the water seller's; the bath on its sheet.
    expect(acts("drum")).toEqual([["sheet", "activity.fill-drum"]]);
    expect(thingOf("drum").acts[0]?.more).toEqual(["activity.bucket-bath"]);
    // The box opens the phone's Papers (world:phone-holds-what-phones-hold), where the papers' acts are.
    expect(acts("papers-box")).toEqual([["app", null]]);
    expect(thingOf("papers-box").acts[0]?.app).toBe("papers");
    expect(acts("bag")).toEqual([["command", "route/depart"]]);
    expect(["bed", "cooking", "drum", "papers-box", "bag", "out"].map((id) => cityWords(thingOf(id).label))).toEqual(["Mattress", "Stove", "Water drum", "Papers box", "Bag", "Door"]);
    // The bag and the drum stand by the door, the drum just outside it, where the water comes from the yard's tap.
    const door = thingSpot(stage, thingOf("out"));
    for (const id of ["bag", "drum"]) {
      const spot = thingSpot(stage, thingOf(id));
      if (spot === null || door === null) throw new Error(`${id} or the door stands nowhere`);
      expect({ id, near: Math.hypot(spot[0] - door[0], spot[1] - door[1]) < 3.5 }).toEqual({ id, near: true });
    }
  });

  test("[home:home-is-the-home-point] [home:compound-room-is-a-home] [activity:acts-may-repeat-in-month] given the graduate living in the room, when its acts are read for now, then the mattress naps, the stove cooks, the drum fetches water and the papers box opens Papers, staged by the family house and the acts lived by hand; for a life living elsewhere the room opens none of them", () => {
    const view = livingThere();
    const now = actsNow(view, ID);
    expect(now["bed"]).toEqual(["nap", "end-month"]);
    expect(now["cooking"]).toEqual(["cook"]);
    expect(now["drum"]).toEqual(["fill-drum"]);
    expect(now["papers-box"]).toEqual(["papers"]);
    expect(homeStagesAt(ID, ID, HOME, PLACES)).toEqual(content.place["place.family-house"]?.stages);
    // Lived elsewhere, the room stages nothing; the family house stages its own acts.
    expect(homeStagesAt(ID, "place.family-house", HOME, PLACES)).toEqual([]);
    expect(homeStagesAt("place.family-house", "place.family-house", HOME, PLACES)).toEqual([]);
    expect(homeStagesAt(ID, ID, { where: "abroad", country: "country.uk" }, PLACES)).toEqual([]);
    const elsewhere = actsNow(engineView("scenario.graduate"), "place.family-house");
    expect(elsewhere["cooking"]).toBeUndefined();
    expect(elsewhere["drum"]).toBeUndefined();
  });

  test("[home:compound-room-is-a-home] [world:room-seen-down-its-length] given the room in a compound as a wide floor, about 5 by 5 metres of your own in a house of about 9 by 8, when it opens whole on a phone held upright, then its five things stand within a few steps of the character at the door, and the character reads at a phone's size: over 5 in a hundred of the screen's height in the whole view, and over 7 eased in on your room", () => {
    const [x, z] = stage.start;
    for (const id of ["bed", "papers-box", "cooking", "drum", "bag"]) {
      const spot = thingSpot(stage, thingOf(id));
      if (spot === null) throw new Error(`${id} stands nowhere`);
      expect({ id, close: Math.hypot(spot[0] - x, spot[1] - z) < 4.2 }).toEqual({ id, close: true });
    }
    const aspect = SCREENS.phone;
    const room = (stage.rooms ?? []).find((one) => one.id === "room");
    if (room === undefined) throw new Error("No room to ease in on");
    const tall = (zoom: number): number => {
      const camera = cameraAt(aimRoom(shotOf(stage), room, zoom, aspect), aspect);
      // The screen runs -1 to 1 from foot to top.
      return (projected(camera, x, 1.7, z).y - projected(camera, x, 0, z).y) / 2;
    };
    expect(tall(1)).toBeGreaterThan(0.05);
    expect(tall(0)).toBeGreaterThan(0.07);
  });

  test("[home:home-is-the-home-point] given a life living in Makoko, when Makoko's room is read, then the family house's acts are staged on the water too", () => {
    expect(homeStagesAt("place.makoko", "place.makoko", HOME, PLACES)).toContain("activity.cook-at-home");
  });
});
