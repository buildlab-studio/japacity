import { describe, expect, test } from "vitest";

import { content } from "../index";

const SERVER = ["players/active", "players/new", "players/returned", "turns/ended", "chapter/closed", "chapter/reopened", "route/moved", "route/refused", "offer/chosen", "place/returned", "command/rejected", "lottery/tickets", "first/early-win", "analytics/dropped"];
const CLIENT = ["screen/opened", "share/pressed", "share/completed", "advert/impression", "advert/tap", "settings/sound", "settings/graphics", "load/time", "client/error", "ask/shown", "ask/accepted"];

const list = content.analytics.counters;
const named = (name: string) => list.find((def) => def.name === name);

describe("the counter list", () => {
  test("[R-ANALYTICS-008] given the page's game counters, when the list is read, then each is there once, made by the server", () => {
    expect(SERVER.map((name) => [name, named(name)?.source])).toEqual(SERVER.map((name) => [name, "server"]));
    expect(named("players/returned")?.keys).toEqual(["d1", "d7", "d30"]);
    const byRegion = ["players/active", "players/new", "turns/ended", "lottery/tickets"];
    const byId = ["chapter/closed", "chapter/reopened", "route/moved", "offer/chosen"];
    expect(byRegion.map((name) => named(name)?.keys)).toEqual(byRegion.map(() => "region"));
    expect(byId.map((name) => named(name)?.keys)).toEqual(byId.map(() => "id"));
  });

  test("[R-ANALYTICS-002] given what only the client sees, when the list is read, then those names and only those are the client's", () => {
    expect(list.filter((def) => def.source === "client").map((def) => def.name).sort()).toEqual([...CLIENT].sort());
    expect(list.map((def) => def.name).sort()).toEqual([...SERVER, ...CLIENT].sort());
  });

  test("[R-ANALYTICS-011] given the first session's measures, when the list is read, then the early win is keyed by turn and the asks by kind and moment", () => {
    expect(named("first/early-win")).toEqual({ name: "first/early-win", keys: ["1", "2", "3", "later", "none"], source: "server" });
    const asks = ["ask/shown", "ask/accepted"];
    expect(asks.map(named)).toEqual(asks.map((name) => ({ name, keys: ["sign-in:before", "sign-in:after", "notify:before", "notify:after"], source: "client" })));
  });

  test("[R-ANALYTICS-004] given the content check, when every counter is read, then names are unique, keys are listed once each, and the client never keys by region", () => {
    expect(new Set(list.map((def) => def.name)).size).toBe(list.length);
    const listed = list.flatMap((def) => (Array.isArray(def.keys) ? [def] : []));
    expect(listed.filter((def) => def.keys.length === 0 || new Set(def.keys).size !== def.keys.length)).toEqual([]);
    expect(list.filter((def) => def.source === "client" && def.keys === "region")).toEqual([]);
  });

  test("[R-ANALYTICS-003] given the Numbers table, when the tuning is read, then each setting holds the page's value", () => {
    expect(content.tuning.analytics).toEqual({ batchSeconds: 60, maxBatchBytes: 16384, maxCount: 500, batchesPerHour: 90, minShown: 10, refD1Bp: 3000, refD7Bp: 900 });
  });
});
