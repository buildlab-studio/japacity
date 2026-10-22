import type { PresenceReply, ServerRejection } from "@japacity/api";
import { content, PRIVATE_PLACES } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { call, newLife, signUp, testServer } from "../authority/authority.testing";
import type { Rooms } from "../place/place.rooms";
import { placeOfIn, profileOfIn } from "../postgres";
import { placeSocketRoutes } from "./place";

describe("the presence fetch at a home", () => {
  test("[city:players-fill-the-crowd] given players joined at every home, at Makoko and at the hub, when the presence is fetched, then each home's sample is empty and Makoko's and the hub's are not", async () => {
    const target = testServer();
    // city:players-shown-present-not-tracked: only a character in a place reads it, so the asker stands in each place it asks about.
    let asking = "";
    target.app.route("/", placeSocketRoutes(target.deps, { rooms: {} as Rooms, placeOf: () => Promise.resolve(asking), profileOf: () => Promise.resolve(null) }));
    const places = [...PRIVATE_PLACES, "place.makoko", "place.ojuelegba"];
    for (const place of places) {
      for (let index = 0; index < 3; index += 1) {
        await target.deps.stores.presence.join(place, `${place}-${String(index)}`, { account: `acc-${place}-${String(index)}`, name: `N${String(index)}`, look: "scenario.graduate", place, joinedAt: 0 });
      }
    }
    for (const place of PRIVATE_PLACES) {
      expect(content.place[place]).toBeDefined();
      asking = place;
      const sent = await call<PresenceReply>(target, "GET", `/api/place/${place}`, "acc-asker");
      expect(sent.status).toBe(200);
      expect(sent.body).toEqual({ place, others: [], today: [] });
    }
    for (const place of ["place.makoko", "place.ojuelegba"]) {
      asking = place;
      const sent = await call<PresenceReply>(target, "GET", `/api/place/${place}`, "acc-asker");
      expect(sent.body.others.length).toBeGreaterThan(0);
    }
  });
});

describe("who may read a place's crowd", () => {
  test("[city:players-shown-present-not-tracked] given a guest with no character, a character at home asking for a hub abroad, and a character at the home hub, when each fetches the hub's presence, then only the character in that place is answered: 404 no-character, 409 and 200", async () => {
    const target = testServer();
    target.app.route("/", placeSocketRoutes(target.deps, { rooms: {} as Rooms, placeOf: placeOfIn(target.deps), profileOf: profileOfIn(target.deps) }));
    await signUp(target, "acc-guest", "acc-guest", "guest");
    await newLife(target, "acc-home");
    for (const place of ["place.ojuelegba", "place.peckham"]) {
      await target.deps.stores.presence.join(place, `socket-${place}`, { account: "acc-watched", name: "watched", look: "scenario.graduate", place, joinedAt: 0 });
    }

    const guest = await call<ServerRejection>(target, "GET", "/api/place/place.ojuelegba", "acc-guest");
    const elsewhere = await call<ServerRejection>(target, "GET", "/api/place/place.peckham", "acc-home");
    const here = await call<PresenceReply>(target, "GET", "/api/place/place.ojuelegba", "acc-home");

    expect({ status: guest.status, code: guest.body.code }).toEqual({ status: 404, code: "no-character" });
    expect({ status: elsewhere.status, code: elsewhere.body.code }).toEqual({ status: 409, code: "not-legal" });
    expect(guest.text).not.toContain("watched");
    expect(elsewhere.text).not.toContain("watched");
    expect(here.status).toBe(200);
    expect(here.body.others).toEqual([{ name: "watched", look: "scenario.graduate" }]);
  });
});

describe("a block in a place", () => {
  test("[moderation:block-refuses-both-ways] given one player blocked by another and a third in the place, when each fetches the presence, then neither of the two sees the other and the third sees both", async () => {
    const target = testServer();
    target.app.route("/", placeSocketRoutes(target.deps, { rooms: {} as Rooms, placeOf: placeOfIn(target.deps), profileOf: profileOfIn(target.deps) }));
    const place = "place.ojuelegba";
    for (const account of ["acc-blocker", "acc-blocked", "acc-third"]) {
      await newLife(target, account);
      await target.deps.stores.presence.join(place, `socket-${account}`, { account, name: account, look: "scenario.graduate", place, joinedAt: 0 });
    }
    await target.deps.stores.moderation.block({ from: "acc-blocker", to: "acc-blocked", at: target.deps.now() });

    const names = async (account: string) => (await call<PresenceReply>(target, "GET", `/api/place/${place}`, account)).body.others.map((other) => other.name).sort();

    expect(await names("acc-blocker")).toEqual(["acc-third"]);
    expect(await names("acc-blocked")).toEqual(["acc-third"]);
    expect(await names("acc-third")).toEqual(["acc-blocked", "acc-blocker"]);
  });

  test("[moderation:block-refuses-both-ways] [clock:presence-is-a-sample] given more players than the sample and a blocked one among them, when the blocker fetches the presence, then the sample is still full and never holds the blocked player", async () => {
    const target = testServer();
    target.app.route("/", placeSocketRoutes(target.deps, { rooms: {} as Rooms, placeOf: placeOfIn(target.deps), profileOf: profileOfIn(target.deps) }));
    const place = "place.ojuelegba";
    const size = Math.min(target.deps.config.presence.sample, content.place[place]!.crowd.target);
    await newLife(target, "acc-blocker");
    for (const account of ["acc-blocked", ...Array.from({ length: size }, (_unused, index) => `acc-${String(index)}`)]) {
      await target.deps.stores.presence.join(place, `socket-${account}`, { account, name: account, look: "scenario.graduate", place, joinedAt: 0 });
    }
    await target.deps.stores.moderation.block({ from: "acc-blocked", to: "acc-blocker", at: target.deps.now() });

    for (let fetch = 0; fetch < 6; fetch += 1) {
      const others = (await call<PresenceReply>(target, "GET", `/api/place/${place}`, "acc-blocker")).body.others.map((other) => other.name);
      expect(others).toHaveLength(size);
      expect(others).not.toContain("acc-blocked");
    }
  });
});
