import { content, text } from "@japacity/content";
import { DatabaseUnavailable } from "@japacity/db";
import { describe, expect, test } from "vitest";

import { newLife, testServer } from "./authority/testing";
import { productionConfig } from "./config";
import { openLimiters } from "./deps";
import type { Place } from "./place/place.object";
import { hubFor, isolateFor, openRequest, placeOfIn, profileOfIn } from "./production";

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

describe("the deployment's own connection (R-SERVER-002)", () => {
  // Nothing listens on port 1, so a connection, if one were tried, would be refused.
  const NOWHERE = "postgres://test:test@127.0.0.1:1/test";

  test("[R-SERVER-002] [R-SERVER-043] given the default connection to a database that is not there, when a request's scope is opened and closed without a statement, then nothing fails; its first statement fails with DatabaseUnavailable and the scope says so", async () => {
    const isolate = isolateFor(
      { connectionString: NOWHERE, place: {} as DurableObjectNamespace<Place> },
      { config: productionConfig, contents: { current: content, previous: null }, secrets: { worldSeed: "w", banSalt: "b", drawTokenKey: "d" }, limits: openLimiters, text, now: () => 0, randomBytes: (count) => new Uint8Array(count) },
    );
    const idle = await openRequest(isolate, NOWHERE);
    expect(idle.unavailable()).toBe(false);
    await idle.close();

    const asked = await openRequest(isolate, NOWHERE);
    const failure = await asked.deps.stores.world.latest().catch((error: unknown) => error);
    expect((failure as Error).cause).toBeInstanceOf(DatabaseUnavailable);
    expect(asked.unavailable()).toBe(true);
    await asked.close();
  });
});
