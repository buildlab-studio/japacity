// The ride's own lines (docs/rules/text.md R-TEXT-008): one line each, and the pin's line never says again what its
// tag above it says. The drivers' lines are a person speaking and keep their sentences.
import { describe, expect, test } from "vitest";

import { mapWords } from "./map.words";

/** One line: a single sentence at most, with no full stop inside it. */
function oneLine(said: string): boolean {
  return !/[.?]\s/.test(said.trim()) && said.length <= 48;
}

describe("the ride's lines", () => {
  test("[R-TEXT-008] given the ride's own lines and the pin's lines, then each is one line, and the pin's line does not repeat its tag", () => {
    const keys = ["map.line.here", "map.line.things", "map.line.not", "map.ride.along.start", "map.ride.along.road.1", "map.ride.along.road.2", "map.ride.along.road.3", "map.ride.along.near"];
    for (const key of keys) expect(oneLine(mapWords(key, { things: 3, from: "Ojuelegba", to: "Bode Thomas Street" })), key).toBe(true);
    expect(mapWords("map.line.here", { things: 3 })).not.toContain(mapWords("map.state.here"));
    expect(mapWords("map.line.not")).not.toContain(mapWords("map.state.not"));
  });
});
