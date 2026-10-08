// Computer Village staged (city.md place.computer-village): phone and laptop shops with loud boards
// across the street, a repairer's pitch on the pavement with the queue for a repair along the kerb.
import { describe, expect, test } from "vitest";

import raw from "../../../../public/assets/places/computer-village/place.json";
import { nearest, staged, stagedPlaceTests } from "./staged";

const ID = "place.computer-village";
const { stage, at } = staged(raw, ID);

describe("Computer Village", () => {
  stagedPlaceTests(raw, ID);

  test("[R-CITY-014] given the street's crowd, when the low mode's sample stands, then a repairer is behind the pitch facing the street and at least three wait in a line in front of it, each a step from the one before", () => {
    const pitches = at("prop_repair-table.glb");
    const trader = stage.people[stage.prefer?.trader?.[0] ?? -1];
    if (trader === undefined) throw new Error("No repairer's spot");
    const pitch = pitches.find((candidate) => Math.hypot(candidate[0] - trader[0], candidate[1] - trader[1]) < 1.2);
    if (pitch === undefined) throw new Error("The repairer stands at no pitch");
    expect(trader[1]).toBeLessThan(pitch[1]);
    const queue = stage.people.slice(1, 4);
    expect(queue.every(([, z]) => z > pitch[1])).toBe(true);
    queue.slice(1).forEach((spot, index) => {
      const before = queue[index] ?? spot;
      const step = Math.hypot(spot[0] - before[0], spot[1] - before[1]);
      expect(step).toBeGreaterThan(0.6);
      expect(step).toBeLessThan(1.4);
    });
    expect(nearest(queue[0] ?? [0, 0], [pitch])).toBeLessThan(2);
  });

  test("[R-CITY-024] given the street's shops, when the place is read, then the shops across the street carry at least seven boards between them and their phone covers hang at the doors on the wind", () => {
    const facing = stage.models.filter((model) => model.signs !== undefined).flatMap((model) => model.at.flatMap((spot, index) => (spot[1] < 0 ? (model.signs?.[index] ?? []) : [])));
    expect(facing.length).toBeGreaterThanOrEqual(7);
    expect(stage.motion.filter((motion) => motion.kind === "hang").length).toBeGreaterThanOrEqual(2);
    expect(stage.motion.some((motion) => motion.kind === "smoke")).toBe(true);
  });
});
