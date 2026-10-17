import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { call, testServer } from "../authority/testing";
import type { PresenceReply } from "../types";
import { HOMES } from "./place";

describe("the presence fetch at a home", () => {
  test("[R-CITY-015] given players joined at every home and at the hub, when the presence is fetched, then each home's sample is empty and the hub's is not", async () => {
    const target = testServer();
    const places = [...HOMES, "place.ojuelegba"];
    for (const place of places) {
      for (let index = 0; index < 3; index += 1) {
        await target.deps.stores.presence.join(place, `${place}-${String(index)}`, { account: `acc-${place}-${String(index)}`, name: `N${String(index)}`, look: "scenario.ada", place, joinedAt: 0 });
      }
    }
    for (const place of HOMES) {
      expect(content.place[place as keyof typeof content.place]).toBeDefined();
      const sent = await call<PresenceReply>(target, "GET", `/api/place/${place}`, "acc-asker");
      expect(sent.status).toBe(200);
      expect(sent.body).toEqual({ place, others: [], today: [] });
    }
    const hub = await call<PresenceReply>(target, "GET", "/api/place/place.ojuelegba", "acc-asker");
    expect(hub.body.others.length).toBeGreaterThan(0);
  });
});
