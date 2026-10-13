// A named speaker who stands as a thing (world.md R-WORLD-026 as the small items wave amends it; the talk budget, design
// page 13 section 5): a line overheard floats over Mama only while she stands near the player's figure, as every voice
// does; her own words when spoken to, and any act's, are not held by it.
import { describe, expect, test } from "vitest";

import { NEAR_M, thingVoice } from "./CityScene";

describe("a named speaker who stands as a thing", () => {
  const mama: readonly [number, number] = [2, -3];

  test("[R-WORLD-026] given Mama's overheard line, when the player's figure stands near her, then the words float over her; when far, they are held", () => {
    expect(thingVoice(mama, true, { x: 2, z: -3 + NEAR_M })).toEqual(mama);
    expect(thingVoice(mama, true, { x: 4, z: -1 })).toEqual(mama);
    expect(thingVoice(mama, true, { x: 2, z: -3 + NEAR_M + 0.5 })).toBeNull();
    expect(thingVoice(mama, true, { x: -9, z: 6 })).toBeNull();
  });

  test("[R-WORLD-026] [R-WORLD-005] given words Mama says to the player (not overheard), when the figure is far, then they still float over her, and a thing with no spot has none", () => {
    expect(thingVoice(mama, false, { x: -9, z: 6 })).toEqual(mama);
    expect(thingVoice(null, true, { x: 2, z: -3 })).toBeNull();
  });
});
