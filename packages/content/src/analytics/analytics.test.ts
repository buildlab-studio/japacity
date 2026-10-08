import { describe, expect, test } from "vitest";

import { content } from "../index";

const SERVER = ["players/active", "players/new", "players/returned", "turns/ended", "chapter/closed", "route/moved", "route/refused", "offer/chosen", "place/returned", "command/rejected", "lottery/tickets", "first/early-win", "analytics/dropped"];
const CLIENT = ["screen/opened", "share/pressed", "share/completed", "advert/impression", "advert/tap", "settings/sound", "settings/graphics", "load/time", "client/error", "ask/shown", "ask/accepted"];

const list = content.analytics.counters;
const named = (name: string) => list.find((def) => def.name === name);

describe("the counter list", () => {
  test("[R-ANALYTICS-008] given the page's game counters, when the list is read, then each is there once, made by the server", () => {
    for (const name of SERVER) expect(named(name)?.source, name).toBe("server");
    expect(named("players/returned")?.keys).toEqual(["d1", "d7", "d30"]);
    for (const name of ["players/active", "players/new", "turns/ended", "lottery/tickets"]) expect(named(name)?.keys, name).toBe("region");
    for (const name of ["chapter/closed", "route/moved", "offer/chosen"]) expect(named(name)?.keys, name).toBe("id");
  });

  test("[R-ANALYTICS-002] given what only the client sees, when the list is read, then those names and only those are the client's", () => {
    expect(list.filter((def) => def.source === "client").map((def) => def.name).sort()).toEqual([...CLIENT].sort());
    expect(list.map((def) => def.name).sort()).toEqual([...SERVER, ...CLIENT].sort());
  });

  test("[R-ANALYTICS-011] given the first session's measures, when the list is read, then the early win is keyed by turn and the asks by kind and moment", () => {
    expect(named("first/early-win")).toEqual({ name: "first/early-win", keys: ["1", "2", "3", "later", "none"], source: "server" });
    for (const name of ["ask/shown", "ask/accepted"]) expect(named(name)).toEqual({ name, keys: ["sign-in:before", "sign-in:after", "notify:before", "notify:after"], source: "client" });
  });

  test("[R-ANALYTICS-004] given the content check, when every counter is read, then names are unique, keys are listed once each, and the client never keys by region", () => {
    expect(new Set(list.map((def) => def.name)).size).toBe(list.length);
    for (const def of list) {
      if (Array.isArray(def.keys)) {
        expect(def.keys.length, def.name).toBeGreaterThan(0);
        expect(new Set(def.keys).size, def.name).toBe(def.keys.length);
      }
      if (def.source === "client") expect(def.keys, def.name).not.toBe("region");
    }
  });

  test("[R-ANALYTICS-003] given the Numbers table, when the tuning is read, then each setting holds the page's value", () => {
    expect(content.tuning.analytics).toEqual({ batchSeconds: 60, maxBatchBytes: 16384, maxCount: 500, batchesPerHour: 90, minShown: 10, refD1Bp: 3000, refD7Bp: 900 });
  });
});
