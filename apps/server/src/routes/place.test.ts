import type { PresenceReply } from "@japacity/api";
import { content, PRIVATE_PLACES } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { call, testServer } from "../authority/authority.testing";

describe("the presence fetch at a home", () => {
  test("[city:players-fill-the-crowd] given players joined at every home, at Makoko and at the hub, when the presence is fetched, then each home's sample is empty and Makoko's and the hub's are not", async () => {
    const target = testServer();
    const places = [...PRIVATE_PLACES, "place.makoko", "place.ojuelegba"];
    for (const place of places) {
      for (let index = 0; index < 3; index += 1) {
        await target.deps.stores.presence.join(place, `${place}-${String(index)}`, { account: `acc-${place}-${String(index)}`, name: `N${String(index)}`, look: "scenario.graduate", place, joinedAt: 0 });
      }
    }
    for (const place of PRIVATE_PLACES) {
      expect(content.place[place]).toBeDefined();
      const sent = await call<PresenceReply>(target, "GET", `/api/place/${place}`, "acc-asker");
      expect(sent.status).toBe(200);
      expect(sent.body).toEqual({ place, others: [], today: [] });
    }
    for (const place of ["place.makoko", "place.ojuelegba"]) {
      const sent = await call<PresenceReply>(target, "GET", `/api/place/${place}`, "acc-asker");
      expect(sent.body.others.length).toBeGreaterThan(0);
    }
  });
});
