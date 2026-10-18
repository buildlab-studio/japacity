// The room abroad named per country (world:painted-maps-abroad, design page 15 section 3): content keeps its full
// name for each country, and the band says it short enough to stand beside the age (world:top-band-is-lively-pill).
import { roomName } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { engineView } from "../../shared/testing/fixtures";
import { homeLine } from "./City";

describe("the room per country", () => {
  test("[world:painted-maps-abroad] [world:top-band-is-lively-pill] given a life in each country abroad, when the band's line for the room is read, then it is the country's room said short: the basement in Calgary, the bed space in Dubai, the shared flat at Castel Volturno, London's by its hub; each within the band's room", () => {
    const base = engineView();
    const line = (country: "country.uk" | "country.canada" | "country.uae" | "country.italy") => homeLine("place.the-room", { ...base, place: { ...base.place, where: "abroad", country } });
    expect(line("country.canada")).toBe("The basement, Calgary");
    expect(line("country.uae")).toBe("The bed space, Dubai");
    expect(line("country.italy")).toBe("The shared flat, Castel");
    expect(line("country.uk")).toBe("The shared room, Peckham");
    for (const country of ["country.canada", "country.uae", "country.italy"] as const) expect((line(country) ?? "").length).toBeLessThanOrEqual(24);
  });

  test("[world:painted-maps-abroad] given content's room per country, when its full names are read, then each country has its own and none is the plain room", () => {
    const names = (["country.uk", "country.canada", "country.uae", "country.italy"] as const).map((country) => roomName(country));
    expect(new Set(names).size).toBe(4);
    expect(names.filter((name) => name === roomName(null))).toEqual([]);
    expect(roomName("country.canada")).toBe("the basement room in north-east Calgary");
  });
});
