// The ride's own lines (text:show-then-tell): one line each, and the pin's line never says again what its
// tag above it says. The drivers' lines are a person speaking and keep their sentences.
import { describe, expect, test } from "vitest";

import { mapWords } from "./map.words";
import { alongOf } from "./Ride";
import { anglesOf, PRE_MS, RIDE_MS, type Way } from "./rideScene";

const WAYS: readonly Way[] = ["okada", "keke", "danfo", "walk"];

/** One line: a single sentence at most, with no full stop inside it. */
function oneLine(said: string): boolean {
  return !/[.?]\s/.test(said.trim()) && said.length <= 48;
}

describe("the ride's lines", () => {
  test("[text:show-then-tell] given the ride's own lines and the pin's lines, then each is one line, and the pin's line does not repeat its tag", () => {
    const keys = ["map.line.here", "map.line.things", "map.line.not", "map.ride.along.start", "map.ride.along.road.1", "map.ride.along.road.2", ...WAYS.map((way) => `map.ride.along.road.3.${way}`), "map.ride.along.near"];
    for (const key of keys) expect({ key, one: oneLine(mapWords(key, { things: 3, from: "Ojuelegba", to: "Bode Thomas Street" })) }).toEqual({ key, one: true });
    expect(mapWords("map.line.here", { things: 3 })).not.toContain(mapWords("map.state.here"));
    expect(mapWords("map.line.not")).not.toContain(mapWords("map.state.not"));
  });

  test("[world:ride-cuts-between-angles] given a danfo ride, when it cuts from the window to the seat, then the two angles carry different captions, whatever the ride's seed", () => {
    const at = (angle: string) => anglesOf("danfo").find((part) => part.angle === angle)?.from ?? Number.NaN;
    const u = (ms: number) => (ms - PRE_MS) / (RIDE_MS - PRE_MS);
    // A moment into each angle, as the catalog's picture of it is taken.
    const window = u(at("window") + 350);
    const seat = u(at("seat") + 350);
    for (let seed = 0; seed < 12; seed += 1) {
      const onWindow = mapWords(alongOf(window, seed, "danfo").key);
      const onSeat = mapWords(alongOf(seat, seed, "danfo").key);
      expect([seed, onWindow === onSeat]).toEqual([seed, false]);
    }
  });

  test("[world:ride-sheet-shows-fares] given each way, when the ride's road line that names a person is said, then it names that way's own: the okada's rider, the keke's and the danfo's driver, and on foot yourself; the other road lines are shared", () => {
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
