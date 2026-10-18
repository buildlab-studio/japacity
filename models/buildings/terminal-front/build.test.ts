// The departures front and the house on stilts, the two buildings the staged places needed.
import { signAnchorsOf } from "@japacity/model-kit";
import { Box3 } from "three";
import { describe, expect, test } from "vitest";

import { buildStiltHouse, STILT_HOUSE } from "../stilt-house/build";
import { buildTerminalFront, TERMINAL } from "./build";

const STYLE = { board: "white", ink: "green" } as const;
const terminal = (): ReturnType<typeof buildTerminalFront> => buildTerminalFront({ fascia: "a", canopy: "b", left: "c", right: "d" }, { fascia: STYLE, canopy: STYLE, hanging: STYLE });

describe("the departures front", () => {
  test("[assets:metre-units-and-origin] given the front, when it is built, then it stands on y = 0, is centred on its footprint and stays inside a building's height", () => {
    const box = new Box3().setFromObject(terminal());
    expect(Math.abs(box.min.y)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(box.min.z + box.max.z)).toBeLessThanOrEqual(0.05);
    expect(box.max.y).toBeLessThanOrEqual(13);
  });

  test("[assets:sign-text-drawn-in-code] given the front, when it is built, then it carries its four boards as anchors facing the kerb, the canopy's board over the canopy's edge and the hanging boards under the canopy", () => {
    const anchors = signAnchorsOf(terminal());
    expect(anchors.map((anchor) => anchor.key)).toEqual(["a", "b", "c", "d"]);
    for (const anchor of anchors) expect(Math.cos(anchor.ry)).toBeCloseTo(1, 6);
    const [, canopy, left] = anchors;
    expect(canopy?.centre[2]).toBeGreaterThan(TERMINAL.canopyEdge - 0.3);
    expect(canopy?.centre[1]).toBeGreaterThan(TERMINAL.canopy.underside + TERMINAL.canopy.depth);
    expect(left?.centre[1]).toBeLessThan(TERMINAL.canopy.underside);
  });
});

describe("the house on stilts", () => {
  test("[assets:metre-units-and-origin] given the house, when it is built, then its stilts stand on y = 0, its floor is above the water and it is at least a storey high", () => {
    const box = new Box3().setFromObject(buildStiltHouse());
    expect(Math.abs(box.min.y)).toBeLessThanOrEqual(0.01);
    expect(STILT_HOUSE.floor).toBeGreaterThan(1);
    expect(box.max.y).toBeGreaterThanOrEqual(3);
    expect(box.max.y).toBeLessThanOrEqual(13);
  });
});
