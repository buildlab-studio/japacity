// The airport staged (city.md place.airport-lagos): the departures kerb with taxis, trolleys, the
// glass front, the flag on its mast and the send-off's goodbye round a loaded trolley.
import { describe, expect, test } from "vitest";

import { FLAGPOLE } from "@japacity/models/props/flagpole/build";
import { TERMINAL } from "@japacity/models/buildings/terminal-front/build";

import raw from "../../../../public/assets/places/airport-lagos/place.json";
import { copiesOf, staged } from "./place.testing";
import { nearest, stagedPlaceTests } from "./staged.testing";

const ID = "place.airport-lagos";
const { stage, entry } = staged(raw, ID);
const at = (name: string) => copiesOf(stage, name);

describe("the airport", () => {
  stagedPlaceTests(raw, ID);

  test("[city:set-piece-shown-where-staged] given the send-off staged here, when the low mode's few stand, then they are the family round a loaded trolley under the canopy, the elder's spot among them", () => {
    expect(entry.stages).toContain("chapter.send-off");
    const trolleys = at("prop_trolley.glb");
    const family = stage.people.slice(0, 5);
    const trolley = trolleys.find((spot) => family.every((person) => Math.hypot(person[0] - spot[0], person[1] - spot[1]) < 2.5));
    if (trolley === undefined) throw new Error("No trolley at the goodbye");
    expect(trolley[1]).toBeLessThan(TERMINAL.canopyEdge);
    expect(trolley[1]).toBeGreaterThan(TERMINAL.face);
    for (const index of stage.prefer?.elder ?? []) expect(index).toBeLessThan(5);
  });

  test("[city:motion-in-vertex-shader] given the kerb, when the place is read, then a flag flies from the top of its mast, pinned at the mast, and taxis wait at the kerb outside the canopy", () => {
    const [mast] = at("prop_flagpole.glb");
    if (mast === undefined) throw new Error("No mast");
    const flag = stage.motion.find((motion) => motion.kind === "flag");
    if (flag === undefined) throw new Error("No flag");
    expect(Math.hypot(flag.at[0] - mast[0], flag.at[2] - mast[1])).toBeLessThan(0.2);
    const [, height] = flag.size ?? [0, 0];
    expect(flag.at[1] + height / 2).toBeLessThanOrEqual(FLAGPOLE.height);
    expect(flag.at[1] + height / 2).toBeGreaterThan(FLAGPOLE.height - 0.6);
    const taxis = at("veh_taxi.glb");
    expect(taxis.filter(([, z]) => z > TERMINAL.canopyEdge && z < TERMINAL.canopyEdge + 5).length).toBeGreaterThanOrEqual(2);
    expect(nearest(stage.start, at("bld_terminal-front.glb"))).toBeLessThan(30);
  });
});
