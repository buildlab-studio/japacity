import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import type { Id, State } from "../engine/types";
import { start } from "../testing/play";
import { appliesHere } from "./place.logic";

const UK: Id<"country"> = "country.uk";
const CANADA: Id<"country"> = "country.canada";

function at(where: State["place"]["where"], country: Id<"country"> | null): State {
  const game = start({ content });
  return { ...game.state, place: { ...game.state.place, where, country } };
}

describe("where an entry applies", () => {
  test("[R-PLACE-003] given entries for home, abroad, one country and anywhere, when the character is at home, abroad in two countries and on the road, then each applies only where its page says", () => {
    const home = at("home", null);
    const uk = at("abroad", UK);
    const canada = at("abroad", CANADA);
    const road = at("road", null);
    const homeEntry = { where: "home" as const };
    const unsaid = {};
    const abroadEntry = { where: "abroad" as const };
    const ukEntry = { where: "abroad" as const, country: UK };
    const anywhere = { where: "any" as const, country: UK };
    expect([home, uk, canada, road].map((state) => appliesHere(homeEntry, state))).toEqual([true, false, false, false]);
    expect([home, uk, canada, road].map((state) => appliesHere(unsaid, state))).toEqual([true, false, false, false]);
    expect([home, uk, canada, road].map((state) => appliesHere(abroadEntry, state))).toEqual([false, true, true, false]);
    expect([home, uk, canada, road].map((state) => appliesHere(ukEntry, state))).toEqual([false, true, false, false]);
    expect([home, uk, canada, road].map((state) => appliesHere(anywhere, state))).toEqual([true, true, true, true]);
  });

  test("[R-PLACE-003] given the real content, when every activity, offer and obligation is read at home, then the abroad ones do not apply and the home ones do", () => {
    const home = at("home", null);
    const entries = [...Object.values(content.activity), ...Object.values(content.offer), ...Object.values(content.obligation)];
    for (const entry of entries) {
      expect(appliesHere(entry, home)).toBe((entry.where ?? "home") !== "abroad");
    }
  });
});
