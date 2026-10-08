import { content, text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { newLife, testServer } from "./authority/testing";
import { hubFor, placeOfIn, profileOfIn } from "./production";

const PLACES = Object.values(content.place);

describe("the place a character's socket is for", () => {
  test("[R-CITY-036] [R-CITY-013] given each where and every country, when the hub is read, then it is the content place the client opens on: the home hub, each country's own hub, the road's stylised place", () => {
    expect(hubFor("home", null, PLACES)).toBe("place.ojuelegba");
    expect(hubFor("road", null, PLACES)).toBe("place.road-night");
    for (const country of Object.values(content.country)) {
      const hub = hubFor("abroad", country.id, PLACES);
      expect(content.place[hub]).toMatchObject({ where: "abroad", country: country.id, hub: true });
    }
    expect(hubFor("abroad", "country.uk", PLACES)).toBe("place.peckham");
    expect(hubFor("abroad", "country.uae", PLACES)).toBe("place.deira");
  });

  test("[R-CITY-036] given content with no hub for a where, when the hub is read, then the client's fallback place is answered", () => {
    const none = PLACES.map((place) => ({ ...place, hub: false }));
    expect(hubFor("home", null, none)).toBe("place.family-house");
    expect(hubFor("abroad", "country.uk", none)).toBe("place.the-room");
    expect(hubFor("road", null, [])).toBe("place.road-night");
  });

  test("[R-CLOCK-028] [R-CITY-036] given a character at home and an account with none, when the production readers are asked, then the place is the home hub with the profile's name and look, and null for the account with none", async () => {
    const server = testServer();
    await newLife(server, "account-a", "scenario.ada");
    expect(await placeOfIn(server.deps)("account-a")).toBe("place.ojuelegba");
    expect(await profileOfIn(server.deps, text)("account-a")).toEqual({ name: text["share.first-name.scenario.ada"], look: "scenario.ada" });
    expect(await placeOfIn(server.deps)("account-z")).toBeNull();
  });
});
