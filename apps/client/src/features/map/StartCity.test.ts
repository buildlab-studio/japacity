// The live city behind the start screen (docs/rules/account.md R-ACCOUNT-029).
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { startPins } from "./StartCity";

describe("the city behind the start screen", () => {
  test("[R-ACCOUNT-029] given the built places, then the map settles over the family house as home, with the built places of Lagos and nothing abroad or unbuilt", () => {
    const built = new Set(["place.ojuelegba", "place.bode-thomas", "place.heathrow"]);
    const pins = startPins(built);
    expect(pins[0]).toMatchObject({ id: "place.family-house", state: "here" });
    expect(pins.slice(1).map((pin) => pin.id)).toEqual(["place.ojuelegba", "place.bode-thomas"]);
    expect(pins.slice(1).every((pin) => pin.state === "can")).toBe(true);
  });

  test("[R-ACCOUNT-029] given no list of built places, then every place of Lagos with a position stands, as the map does until the list is known", () => {
    // The family house stands at its own made-up spot as the home pin; a rented room is on the map only while lived in (R-HOME-010).
    const lagos = Object.values(content.place).filter((place) => place.where === "home" && place.position !== null && place.id !== "place.compound-room");
    expect(startPins(null)).toHaveLength(lagos.length);
  });
});
