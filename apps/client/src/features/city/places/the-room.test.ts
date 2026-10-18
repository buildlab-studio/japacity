// The room abroad (world:nudge-says-one-thing, world:things-are-tappable-models): the phone by the bed calls home. Money home is not
// the room's (city:places-stage-their-acts, design page 15), since every country stages it at a counter of its own (Rye Lane's transfer
// shop, the strip mall's transfer counter, Deira's exchange house, Castel Volturno's call shop), so the landing's first request from home has a thing to do it at in each country.
import { content } from "@japacity/content";
import type { Id } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import raw from "../../../../public/assets/places/the-room/place.json";
import calgary from "../../../../public/assets/places/calgary-north-east/place.json";
import castel from "../../../../public/assets/places/castel-volturno/place.json";
import deira from "../../../../public/assets/places/deira/place.json";
import ryeLane from "../../../../public/assets/places/rye-lane/place.json";
import { abroadView } from "../../../shared/testing/fixtures";
import { type PlaceFile, stageOf } from "../../../shared/scene/placeFile";
import { stagedAt } from "../../../shared/scene/staging";
import { stagedNow, thingsNow } from "../scene/things";
import { cityWords } from "../city.words";

const stage = stageOf(raw as unknown as PlaceFile);
const entry = content.place["place.the-room"];

describe("the room abroad", () => {
  test("[world:things-are-tappable-models] [world:nudge-says-one-thing] given the phone by the bed, when its acts are read, then it calls home, staged in the room and open to Ada just landed, and sends no money, which the room does not stage", () => {
    const phone = (stage.things ?? []).find((thing) => thing.id === "phone");
    expect(phone?.acts.map((act) => [act.kind, act.stages, cityWords(act.label)])).toEqual([["sheet", "activity.call-home", "Call home"]]);
    expect(entry?.stages).not.toContain("activity.send-money");
    const staged = new Set<string>(entry?.stages ?? []);
    const view = abroadView();
    const offered = new Set(view.activities.filter((option) => option.allowed).map((option) => option.id));
    const now = thingsNow(stage.things ?? [], stagedNow(offered, staged, new Set(), null));
    expect(now.find((thing) => thing.id === "phone")?.acts.map((act) => act.stages)).toEqual(["activity.call-home"]);
  });

  test("[world:things-are-tappable-models] [city:places-stage-their-acts] [world:nudge-says-one-thing] given each country abroad, when money home is looked for, then it is staged at the country's own counter and a thing there opens it", () => {
    const counters: [Id<"country">, Id<"place">, unknown, string][] = [
      ["country.uk", "place.rye-lane", ryeLane, "transfer"],
      ["country.canada", "place.calgary-north-east", calgary, "transfer"],
      ["country.uae", "place.deira", deira, "exchange"],
      ["country.italy", "place.castel-volturno", castel, "call-shop"],
    ];
    for (const [country, place, file, thing] of counters) {
      expect([country, stagedAt("activity.send-money", { where: "abroad", country }, Object.values(content.place))]).toEqual([country, place]);
      const counter = (stageOf(file as PlaceFile).things ?? []).find((candidate) => candidate.id === thing);
      expect([country, counter?.acts.map((act) => [act.kind, act.stages])]).toEqual([country, [["sheet", "activity.send-money"]]]);
    }
  });
});
