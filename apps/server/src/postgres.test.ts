import { content, text } from "@japacity/content";
import { DatabaseUnavailable } from "@japacity/db";
import { describe, expect, test } from "vitest";

import { newLife, testServer } from "./authority/authority.testing";
import { productionConfig } from "./config";
import { openLimiters } from "./dependencies";
import type { Place } from "./place/place.object";
import { hubFor, isolateFor, openRequest, placeOfIn, profileOfIn, socketPlaces } from "./postgres";

const PLACES = Object.values(content.place);

describe("the place a character's socket is for", () => {
  test("[city:players-shown-present-not-tracked] [city:ojuelegba-is-the-hub] given each where and every country, when the hub is read, then it is the content place the client opens on: the home hub, each country's own hub, the road's stylised place", () => {
    expect(hubFor("home", null, PLACES)).toBe("place.ojuelegba");
    expect(hubFor("road", null, PLACES)).toBe("place.road-night");
    for (const country of Object.values(content.country)) {
      const hub = hubFor("abroad", country.id, PLACES);
      expect(content.place[hub]).toMatchObject({ where: "abroad", country: country.id, hub: true });
    }
    expect(hubFor("abroad", "country.uk", PLACES)).toBe("place.peckham");
    expect(hubFor("abroad", "country.uae", PLACES)).toBe("place.deira");
  });

  test("[account:player-deletes-account] given the content with its hubs and with none, when the places a socket can be open in are listed, then every place the hub read can answer is among them, and few enough to visit at once", () => {
    const none = PLACES.map((place) => ({ ...place, hub: false }));
    for (const places of [PLACES, none]) {
      const listed = socketPlaces(places);
      const answers = [hubFor("home", null, places), hubFor("road", null, places), ...[null, ...Object.values(content.country).map((country) => country.id)].map((country) => hubFor("abroad", country, places))];
      for (const answer of answers) expect(listed).toContain(answer);
      expect(new Set(listed).size).toBe(listed.length);
      expect(listed.length).toBeLessThanOrEqual(PLACES.filter((place) => place.hub).length + 3);
    }
  });

  test("[city:players-shown-present-not-tracked] given content with no hub for a where, when the hub is read, then the client's fallback place is answered", () => {
    const none = PLACES.map((place) => ({ ...place, hub: false }));
    expect(hubFor("home", null, none)).toBe("place.family-house");
    expect(hubFor("abroad", "country.uk", none)).toBe("place.the-room");
    expect(hubFor("road", null, [])).toBe("place.road-night");
  });

  test("[clock:presence-is-a-sample] [city:players-shown-present-not-tracked] [account:person-kept-with-character] given a character at home with a person kept, one without, and an account with none, when the production readers are asked, then the place is the home hub, the profile is the account's username with the kept look (empty with none kept), never the character's name, and null for the account with none", async () => {
    const server = testServer();
    await newLife(server, "account-a", "scenario.graduate", { name: "Adaeze", look: "person_ada", archetype: null });
    await newLife(server, "account-b", "scenario.graduate");
    expect(await placeOfIn(server.deps)("account-a")).toBe("place.ojuelegba");
    expect(await profileOfIn(server.deps)("account-a")).toEqual({ name: "account-a", look: "person_ada" });
    expect(await profileOfIn(server.deps)("account-b")).toEqual({ name: "account-b", look: "" });
    expect(await placeOfIn(server.deps)("account-z")).toBeNull();
    expect(await profileOfIn(server.deps)("account-z")).toBeNull();
  });
});

describe("the deployment's own connection (server:one-command-one-transaction)", () => {
  // Nothing listens on port 1, so a connection, if one were tried, would be refused.
  const NOWHERE = "postgres://test:test@127.0.0.1:1/test";

  test("[server:one-command-one-transaction] [server:no-platform-error-page] given the default connection to a database that is not there, when a request's scope is opened and closed without a statement, then nothing fails; its first statement fails with DatabaseUnavailable and the scope says so", async () => {
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
