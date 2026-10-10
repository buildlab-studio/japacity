// The room in a compound in Ojuelegba (docs/rules/home.md R-HOME-010, R-HOME-006; world.md R-WORLD-029): one
// room seen down its length with the home's five things, the mattress, the stove, the drum, the papers box and
// the bag by the door, each with the act the parlour's has. It stages nothing of its own (R-CITY-010): while the
// character lives there the city opens the family house's acts on its things.
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import raw from "../../../../public/assets/places/compound-room/place.json";
import { engineView } from "../../../shared/testing/fixtures";
import { type PlaceFile, stageOf } from "../placeFile";
import { sceneWords } from "../scene.words";
import { homeStagesAt } from "../staging";
import { stagedNow, thingSpot, thingsNow, thingsOf, withMoreAt } from "../things";

const ID = "place.compound-room";
const file = raw as unknown as PlaceFile;
const stage = stageOf(file);
const PLACES = Object.values(content.place);
const HOME = { where: "home", country: null } as const;

function thingOf(id: string) {
  const found = (stage.things ?? []).find((thing) => thing.id === id);
  if (found === undefined) throw new Error(`No ${id}`);
  return found;
}

/** Ada's view living in the room. */
function livingThere(): PlayerView {
  const view = engineView("scenario.ada");
  return { ...view, home: { ...view.home, place: ID } };
}

/** The things the player can act on in the room now, as the city reads them for the home `home`. */
function actsNow(view: PlayerView, home: string | null): Record<string, string[]> {
  const offered = new Set(view.activities.filter((option) => option.allowed).map((option) => option.id));
  const staged = new Set<string>([...(content.place[ID]?.stages ?? []), ...homeStagesAt(ID, home, HOME, PLACES)]);
  const now = thingsNow(withMoreAt(thingsOf(stage), ID), stagedNow(offered, staged, new Set(), null));
  return Object.fromEntries(now.map((thing) => [thing.id, thing.acts.map((act) => act.id)]));
}

describe("the room in a compound", () => {
  test("[R-HOME-010] [R-WORLD-029] given the room's file, when it is read, then it is the room's own interior, nobody else lives in it, and its five home things carry the parlour's acts in the room's own words", () => {
    expect(file.place).toBe(ID);
    expect(file.scope).toBe("interior");
    expect(content.place[ID]).toMatchObject({ scope: "interior", assets: "compound-room", stages: [] });
    expect(stage.people).toEqual([]);
    const acts = (id: string) => thingOf(id).acts.map((act) => [act.kind, act.stages ?? act.command ?? null]);
    expect(acts("bed")).toEqual([
      ["do", "activity.rest"],
      ["end", null],
    ]);
    expect(acts("cooking")).toEqual([["do", "activity.cook-at-home"]]);
    expect(acts("drum")).toEqual([["do", "activity.fetch-water"]]);
    expect(acts("papers-box")).toEqual([
      ["sheet", "activity.get-passport"],
      ["plain", null],
    ]);
    expect(acts("bag")).toEqual([["command", "route/depart"]]);
    expect(["bed", "cooking", "drum", "papers-box", "bag", "door"].map((id) => sceneWords(thingOf(id).label))).toEqual(["Mattress", "Stove", "Water drum", "Papers box", "Bag", "Door"]);
    // The bag and the drum stand by the door, where the water comes in from the yard's tap.
    const door = thingSpot(stage, thingOf("door"));
    for (const id of ["bag", "drum"]) {
      const spot = thingSpot(stage, thingOf(id));
      if (spot === null || door === null) throw new Error(`${id} or the door stands nowhere`);
      expect({ id, near: Math.hypot(spot[0] - door[0], spot[1] - door[1]) < 3.5 }).toEqual({ id, near: true });
    }
  });

  test("[R-HOME-006] [R-HOME-010] given Ada living in the room, when its acts are read for now, then the mattress rests, the stove cooks, the drum fetches water and the papers box starts the passport, staged by the family house; for a life living elsewhere the room opens none of them", () => {
    const view = livingThere();
    const now = actsNow(view, ID);
    expect(now["bed"]).toEqual(["rest", "end-month"]);
    expect(now["cooking"]).toEqual(["cook"]);
    expect(now["drum"]).toEqual(["fetch-water"]);
    expect(now["papers-box"]).toEqual(["start", "look"]);
    expect(homeStagesAt(ID, ID, HOME, PLACES)).toEqual(content.place["place.family-house"]?.stages);
    // Lived elsewhere, the room stages nothing; the family house stages its own acts as before.
    expect(homeStagesAt(ID, "place.family-house", HOME, PLACES)).toEqual([]);
    expect(homeStagesAt("place.family-house", "place.family-house", HOME, PLACES)).toEqual([]);
    expect(homeStagesAt(ID, ID, { where: "abroad", country: "country.uk" }, PLACES)).toEqual([]);
    const elsewhere = actsNow(engineView("scenario.ada"), "place.family-house");
    expect(elsewhere["cooking"]).toBeUndefined();
    expect(elsewhere["drum"]).toBeUndefined();
  });

  test("[R-HOME-006] given a life living in Makoko, when Makoko's room is read, then the family house's acts are staged on the water too", () => {
    expect(homeStagesAt("place.makoko", "place.makoko", HOME, PLACES)).toContain("activity.cook-at-home");
  });
});
