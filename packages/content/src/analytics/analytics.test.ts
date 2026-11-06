import { describe, expect, test } from "vitest";

import { content, CSP_BLOCKED_KINDS, CSP_DIRECTIVES, CSP_DISPOSITIONS, FUNNEL_STEPS, HELD_BANDS, MONTH_BANDS, ONLINE_MINUTES, SESSION_BANDS, SESSION_GAP_MINUTES } from "../index";

/** analytics:nightly-game-counters: the admin's numbers. */
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
  "lives/started",
  "lives/secured",
  "japa/departed",
  "economy/held",
  "wallet/topped-up",
  "advert/revenue",
  "moderation/open",
  "feedback/sent",
];
/** analytics:nightly-game-counters (server:csp-reports-to-own-origin): the page policy's reports, counted by the server. */
const REPORTS = ["client/csp", "client/csp-blocked"];
/** analytics:nightly-game-counters (account:two-lights-and-wink-lines): the lives being played, for the two lights. */
const LIVES = ["lives/playing"];
const SERVER = ["players/active", "players/new", "players/returned", "turns/ended", "chapter/closed", "chapter/reopened", "route/moved", "route/refused", "offer/chosen", "place/returned", "command/rejected", "lottery/tickets", "first/early-win", "first/lead", "analytics/dropped", ...LAUNCH, ...REPORTS, ...LIVES];
const CLIENT = ["screen/opened", "share/pressed", "share/completed", "advert/impression", "advert/tap", "settings/sound", "settings/graphics", "load/time", "client/error", "ask/shown", "ask/accepted"];

const list = content.analytics.counters;
const named = (name: string) => list.find((def) => def.name === name);

describe("the counter list", () => {
  test("[analytics:nightly-game-counters] given the page's game counters, when the list is read, then each is there once, made by the server", () => {
    expect(SERVER.map((name) => [name, named(name)?.source])).toEqual(SERVER.map((name) => [name, "server"]));
    expect(named("players/returned")?.keys).toEqual(["d1", "d3", "d7", "d14", "d30"]);
    const byRegion = ["players/active", "players/new", "turns/ended", "lottery/tickets"];
    const byId = ["chapter/closed", "chapter/reopened", "route/moved", "offer/chosen"];
    expect(byRegion.map((name) => named(name)?.keys)).toEqual(byRegion.map(() => "region"));
    expect(byId.map((name) => named(name)?.keys)).toEqual(byId.map(() => "id"));
  });

  test("[analytics:nightly-game-counters] given the admin's numbers, when the list is read, then each is keyed as the page gives it", () => {
    const byRegion = ["players/weekly", "players/monthly", "players/guest", "players/secured", "players/secured-by-signup", "players/total", "sessions/count", "lives/started", "lives/secured", "japa/departed", "feedback/sent"];
    expect(byRegion.map((name) => named(name)?.keys)).toEqual(byRegion.map(() => "region"));
    expect(named("players/online-peak")?.keys).toEqual(["peak"]);
    expect(named("sessions/length")?.keys).toEqual(["under-2", "2-5", "5-15", "15-30", "over-30"]);
    expect(named("funnel/step")?.keys).toEqual(["begin", "world", "month-1", "chapter-1", "secured"]);
    expect(named("share/arrival")).toBeUndefined();
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

  test("[analytics:nightly-game-counters] [server:csp-reports-to-own-origin] given the page policy's reports, when the list is read, then the blocked counter is the server's, keyed by whether the policy enforced or only reported, each directive and each kind of blocked thing, from fixed lists with no address in them", () => {
    expect(CSP_DISPOSITIONS).toEqual(["enforce", "report", "other"]);
    expect(CSP_BLOCKED_KINDS).toEqual(["inline", "eval", "wasm-eval", "trusted-types-policy", "trusted-types-sink", "data", "blob", "extension", "self", "challenges.cloudflare.com", "static.cloudflareinsights.com", "cloudflareinsights.com", "other-host", "other"]);
    const keys = CSP_DISPOSITIONS.flatMap((disposition) => CSP_DIRECTIVES.flatMap((directive) => CSP_BLOCKED_KINDS.map((kind) => `${disposition}:${directive}:${kind}`)));
    expect(named("client/csp-blocked")).toEqual({ name: "client/csp-blocked", keys, source: "server" });
    expect(named("client/csp-blocked")?.keys).toContain("enforce:script-src-elem:inline");
    expect(named("client/csp-blocked")?.keys).toContain("report:require-trusted-types-for:trusted-types-sink");
    expect(named("client/csp-blocked")?.keys).toContain("other:other:other");
    // A kind is a word or a host the policy names, never a path, a query or a scheme with something after it.
    expect(CSP_BLOCKED_KINDS.filter((kind) => !/^[a-z][a-z0-9.-]*$/.test(kind))).toEqual([]);
  });

  test("[analytics:nightly-game-counters] [account:two-lights-and-wink-lines] given the lives being played, when the list is read, then the counter is the server's, keyed by where a life stands", () => {
    expect(named("lives/playing")).toEqual({ name: "lives/playing", keys: ["home", "abroad", "road"], source: "server" });
  });

  test("[analytics:nightly-game-counters] [analytics:client-sends-interface-counts] given the onboarding funnel, when its steps are read, then they run in the page's order and the door's three are client screens", () => {
    expect(FUNNEL_STEPS.map((each) => each.step)).toEqual(["door-1", "door-2", "page", "begin", "world", "month-1", "chapter-1", "secured"]);
    const keysOf = (name: string) => named(name)?.keys ?? [];
    expect(FUNNEL_STEPS.filter((each) => !(keysOf(each.from) as string[]).includes(each.step))).toEqual([]);
    expect(FUNNEL_STEPS.filter((each) => each.from === "screen/opened").map((each) => each.step)).toEqual(["door-1", "door-2", "page"]);
  });

  test("[analytics:session-split-by-command-gaps] given a session's and the online count's settings, when they are read, then the gap is 30 minutes, online is 5 and the length bands start at 0, 2, 5, 15 and 30 minutes", () => {
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

  test("[analytics:client-sends-interface-counts] given what only the client sees, when the list is read, then those names and only those are the client's", () => {
    expect(list.filter((def) => def.source === "client").map((def) => def.name).sort()).toEqual([...CLIENT].sort());
    expect(list.map((def) => def.name).sort()).toEqual([...SERVER, ...CLIENT].sort());
  });

  test("[analytics:day-one-and-seven-return] given the first session's measures, when the list is read, then the early win is keyed by turn and the asks by kind and moment", () => {
    expect(named("first/early-win")).toEqual({ name: "first/early-win", keys: ["1", "2", "3", "later", "none"], source: "server" });
    const asks = ["ask/shown", "ask/accepted"];
    expect(asks.map(named)).toEqual(asks.map((name) => ({ name, keys: ["sign-in:before", "sign-in:after", "notify:before", "notify:after"], source: "client" })));
  });

  test("[analytics:first-lead-counted] given the lead after a first miss, when the list is read, then the server counts it by what came of it and the month it opened in", () => {
    const outcomes = ["shown", "taken", "declined", "lapsed"];
    expect(named("first/lead")).toEqual({ name: "first/lead", keys: outcomes.flatMap((outcome) => ["1", "2", "3"].map((month) => `${outcome}:${month}`)), source: "server" });
  });

  test("[analytics:server-checks-every-batch] given the content check, when every counter is read, then names are unique, keys are listed once each, and the client never keys by region", () => {
    expect(new Set(list.map((def) => def.name)).size).toBe(list.length);
    const listed = list.flatMap((def) => (Array.isArray(def.keys) ? [def] : []));
    expect(listed.filter((def) => def.keys.length === 0 || new Set(def.keys).size !== def.keys.length)).toEqual([]);
    expect(list.filter((def) => def.source === "client" && def.keys === "region")).toEqual([]);
  });

  test("[analytics:client-batches-counters] given the Numbers table, when the tuning is read, then each setting holds the page's value", () => {
    expect(content.tuning.analytics).toEqual({ batchSeconds: 60, maxBatchBytes: 16384, maxCount: 500, batchesPerHour: 90, minShown: 10, refD1Bp: 3000, refD7Bp: 900 });
  });
});
