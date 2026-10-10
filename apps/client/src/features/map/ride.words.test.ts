// The ride's own lines (docs/rules/text.md R-TEXT-008): one line each, and the pin's line never says again what its
// tag above it says. The drivers' lines are a person speaking and keep their sentences.
import { describe, expect, test } from "vitest";

import { mapWords } from "./map.words";
import { alongOf } from "./Ride";
import type { Way } from "./rideScene";

const WAYS: readonly Way[] = ["okada", "keke", "danfo", "walk"];

/** One line: a single sentence at most, with no full stop inside it. */
function oneLine(said: string): boolean {
  return !/[.?]\s/.test(said.trim()) && said.length <= 48;
}

describe("the ride's lines", () => {
  test("[R-TEXT-008] given the ride's own lines and the pin's lines, then each is one line, and the pin's line does not repeat its tag", () => {
    const keys = ["map.line.here", "map.line.things", "map.line.not", "map.ride.along.start", "map.ride.along.road.1", "map.ride.along.road.2", ...WAYS.map((way) => `map.ride.along.road.3.${way}`), "map.ride.along.near"];
    for (const key of keys) expect({ key, one: oneLine(mapWords(key, { things: 3, from: "Ojuelegba", to: "Bode Thomas Street" })) }).toEqual({ key, one: true });
    expect(mapWords("map.line.here", { things: 3 })).not.toContain(mapWords("map.state.here"));
    expect(mapWords("map.line.not")).not.toContain(mapWords("map.state.not"));
  });

  test("[R-WORLD-017] given each way, when the ride's road line that names a person is said, then it names that way's own: the okada's rider, the keke's and the danfo's driver, and on foot yourself; the other road lines are shared", () => {
    const said = (way: Way) => mapWords(alongOf(0.5, 2, way).key);
    expect(said("okada")).toBe("The rider cuts through a side street.");
    expect(said("keke")).toBe("The driver cuts through a side street.");
    expect(said("danfo")).toBe("The driver cuts through a side street.");
    expect(said("walk")).toBe("You cut through a side street.");
    for (const way of WAYS) {
      expect(mapWords(`map.ride.along.road.3.${way}`)).not.toBe(`map.ride.along.road.3.${way}`);
      expect(alongOf(0.5, 0, way).key).toBe("map.ride.along.road.1");
      expect(alongOf(0.5, 1, way).key).toBe("map.ride.along.road.2");
    }
  });
});
