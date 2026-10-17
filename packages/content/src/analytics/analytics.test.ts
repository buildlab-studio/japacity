import { describe, expect, test } from "vitest";

import { content, FUNNEL_STEPS, HELD_BANDS, MONTH_BANDS, ONLINE_MINUTES, SESSION_BANDS, SESSION_GAP_MINUTES } from "../index";

/** R-ANALYTICS-008: the admin's numbers. */
const LAUNCH = [
  "players/weekly",
  "players/monthly",
  "players/online-peak",
  "players/guest",
  "players/secured",
  "players/secured-by-signup",
  "players/total",
  "sessions/count",
  "sessions/length",
  "funnel/step",
  "share/arrival",
  "lives/started",
  "lives/secured",
  "japa/departed",
  "economy/held",
  "wallet/topped-up",
  "advert/revenue",
  "moderation/open",
  "feedback/sent",
];
/** R-ANALYTICS-008 (server.md R-SERVER-041): the page policy's reports, counted by the server. */
const REPORTS = ["client/csp"];
/** R-ANALYTICS-008 (account.md R-ACCOUNT-031): the lives being played, for the two lights. */
const LIVES = ["lives/playing"];
const SERVER = ["players/active", "players/new", "players/returned", "turns/ended", "chapter/closed", "chapter/reopened", "route/moved", "route/refused", "offer/chosen", "place/returned", "command/rejected", "lottery/tickets", "first/early-win", "analytics/dropped", ...LAUNCH, ...REPORTS, ...LIVES];
const CLIENT = ["screen/opened", "share/pressed", "share/completed", "advert/impression", "advert/tap", "settings/sound", "settings/graphics", "load/time", "client/error", "ask/shown", "ask/accepted"];

const list = content.analytics.counters;
const named = (name: string) => list.find((def) => def.name === name);

describe("the counter list", () => {
  test("[R-ANALYTICS-008] given the page's game counters, when the list is read, then each is there once, made by the server", () => {
    expect(SERVER.map((name) => [name, named(name)?.source])).toEqual(SERVER.map((name) => [name, "server"]));
    expect(named("players/returned")?.keys).toEqual(["d1", "d3", "d7", "d14", "d30"]);
    const byRegion = ["players/active", "players/new", "turns/ended", "lottery/tickets"];
    const byId = ["chapter/closed", "chapter/reopened", "route/moved", "offer/chosen"];
    expect(byRegion.map((name) => named(name)?.keys)).toEqual(byRegion.map(() => "region"));
    expect(byId.map((name) => named(name)?.keys)).toEqual(byId.map(() => "id"));
  });

  test("[R-ANALYTICS-008] given the admin's numbers, when the list is read, then each is keyed as the page gives it", () => {
    const byRegion = ["players/weekly", "players/monthly", "players/guest", "players/secured", "players/secured-by-signup", "players/total", "sessions/count", "lives/started", "lives/secured", "japa/departed", "feedback/sent"];
    expect(byRegion.map((name) => named(name)?.keys)).toEqual(byRegion.map(() => "region"));
    expect(named("players/online-peak")?.keys).toEqual(["peak"]);
    expect(named("sessions/length")?.keys).toEqual(["under-2", "2-5", "5-15", "15-30", "over-30"]);
    expect(named("funnel/step")?.keys).toEqual(["holding", "invited", "begin", "world", "month-1", "chapter-1", "secured"]);
    expect(named("share/arrival")?.keys).toEqual(named("share/pressed")?.keys);
    expect(named("wallet/topped-up")?.keys).toEqual(["count", "kobo"]);
    expect(named("advert/revenue")?.keys).toEqual(["kobo"]);
    // The page policy's reports, keyed by directive, `other` for any directive off the list.
    expect(named("client/csp")?.source).toBe("server");
    expect(named("client/csp")?.keys).toContain("script-src-elem");
    expect(named("client/csp")?.keys).toContain("other");
    expect(named("economy/held")?.keys).toHaveLength(12);
    expect(named("economy/held")?.keys).toContain("1-3:0");
    expect(named("economy/held")?.keys).toContain("13+:over-500k");
    expect(HELD_BANDS.map((band) => band.from)).toEqual([0, 1, 5_000_000, 50_000_001]);
    expect(MONTH_BANDS.map((band) => band.from)).toEqual([1, 4, 13]);
  });

  test("[R-ANALYTICS-008] [R-ACCOUNT-031] given the lives being played, when the list is read, then the counter is the server's, keyed by where a life stands", () => {
    expect(named("lives/playing")).toEqual({ name: "lives/playing", keys: ["home", "abroad", "road"], source: "server" });
  });

  test("[R-ANALYTICS-008] [R-ANALYTICS-002] given the onboarding funnel, when its steps are read, then they run in the page's order and the door's three are client screens", () => {
    expect(FUNNEL_STEPS.map((each) => each.step)).toEqual(["holding", "invited", "door-1", "door-2", "page", "begin", "world", "month-1", "chapter-1", "secured"]);
    const keysOf = (name: string) => named(name)?.keys ?? [];
    expect(FUNNEL_STEPS.filter((each) => !(keysOf(each.from) as string[]).includes(each.step))).toEqual([]);
    expect(FUNNEL_STEPS.filter((each) => each.from === "screen/opened").map((each) => each.step)).toEqual(["door-1", "door-2", "page"]);
  });

  test("[R-ANALYTICS-013] given a session's and the online count's settings, when they are read, then the gap is 30 minutes, online is 5 and the length bands start at 0, 2, 5, 15 and 30 minutes", () => {
    expect(SESSION_GAP_MINUTES).toBe(30);
    expect(ONLINE_MINUTES).toBe(5);
    expect(SESSION_BANDS.map((band) => [band.key, band.from])).toEqual([
      ["under-2", 0],
      ["2-5", 2],
      ["5-15", 5],
      ["15-30", 15],
      ["over-30", 30],
    ]);
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
