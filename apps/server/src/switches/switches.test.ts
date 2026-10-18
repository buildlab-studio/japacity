import { content } from "@japacity/content";
import type { Command, Overlay } from "@japacity/sim";
import { applyOverlay, AUTHORITY_COMMANDS } from "@japacity/sim";
import type { SwitchName } from "@japacity/store";
import { describe, expect, test } from "vitest";

import type { TestServer } from "../authority/testing";
import { harness, makeJar } from "../auth/testing";
import { PASS_PREFIX } from "../account/age";
import { call, held, newLife, restMonth, send, testServer } from "../authority/testing";
import { productionConfig, testConfig } from "../config";
import type { Beacon } from "../draw/beacon";
import { QUICKNET_GENESIS_MS, QUICKNET_PERIOD_MS } from "../draw/beacon";
import { drawJob } from "../jobs/draw";
import { TICKS_CRON } from "../jobs/ticks";
import type { ServerRejection, ServerReply } from "../types";
import { COMPUTER_DIAL, computerAfterMonths, lotteryOdds, namedContent, placeTarget } from "./dials";
import { rollbackCheck } from "../admin/rollback";
import { GATED_COMMANDS } from "./gate";
import { SWITCH_NAMES, readSwitches } from "./switches";

const ADMIN = "account.owner";
const { cacheMs, retryMs } = productionConfig.switches;
const { epoch, worldTickMs } = productionConfig.clock;

function server(): TestServer {
  return testServer({ config: testConfig({ testing: { testLogin: true }, admin: { accounts: [ADMIN] } }) });
}

/** Turns every named switch off as another isolate would: straight in the store, past this isolate's cache. */
async function turnOff(target: TestServer, names: readonly SwitchName[]): Promise<void> {
  for (const name of names) await target.deps.stores.switches.set(name, false, ADMIN, "test", target.deps.now());
}

function accepted(reply: ServerReply): Extract<ServerReply, { ok: true }> {
  if (!reply.ok) throw new Error(`Rejected with ${reply.code}: ${reply.detail}`);
  return reply;
}

function buyOne(v: number): Command {
  return { type: "lottery/buy", tickets: 1, basedOn: v };
}

function expectSwitchedOff(sent: { status: number; body: unknown; headers: Headers }): void {
  expect(sent.status).toBe(503);
  expect(sent.body).toMatchObject({ ok: false, code: "switched-off", retryAfter: retryMs / 1000 });
  expect(sent.headers.get("retry-after")).toBe(String(retryMs / 1000));
}

function fixedBeacon(): Beacon {
  return { genesis: QUICKNET_GENESIS_MS, period: QUICKNET_PERIOD_MS, randomness: () => Promise.resolve("8ada64bae5c6c0f5540a6a13af56e663240edfbd2c76ac6a8f27671eb7259ce3") };
}

describe("the switch row's cache", () => {
  test("[R-SERVER-031] given the row cached and the lottery switch turned off elsewhere, when a ticket is bought a millisecond before the cache ends, then it passes the gate; at the end of the cache and one millisecond after it, it is refused", async () => {
    const target = server();
    const character = await newLife(target, "acc-1");
    const { v } = (await held(target, character)).character;
    expect(await readSwitches(target.deps)).toMatchObject({ switches: { lottery: true } });
    await turnOff(target, ["lottery"]);

    target.wait(cacheMs - 1);
    expect((await send(target, "acc-1", buyOne(v))).status).not.toBe(503);

    const refused = server();
    const other = await newLife(refused, "acc-2");
    const at = (await held(refused, other)).character.v;
    await readSwitches(refused.deps);
    await turnOff(refused, ["lottery"]);
    refused.wait(cacheMs);
    expectSwitchedOff(await send(refused, "acc-2", buyOne(at)));
    refused.wait(1);
    expectSwitchedOff(await send(refused, "acc-2", buyOne(at)));
  });

  const EDGES = [0, 1, cacheMs - 1, cacheMs, cacheMs + 1];
  test.each(EDGES.flatMap((readAfter) => EDGES.map((flipAfter) => [readAfter, flipAfter] as const)))(
    "[R-SERVER-031] given the row read %i ms in and a switch flipped elsewhere %i ms after, when the switch is read the cache time plus one millisecond after the flip, then the flip is seen",
    async (readAfter, flipAfter) => {
      const target = server();
      target.wait(readAfter);
      expect((await readSwitches(target.deps)).switches.adverts).toBe(true);
      target.wait(flipAfter);
      await turnOff(target, ["adverts"]);
      target.wait(cacheMs + 1);
      expect((await readSwitches(target.deps)).switches.adverts).toBe(false);
    },
  );

  test("[R-SERVER-031] given a switch turned off through the admin route, when the same isolate reads it at once, then it is off without waiting for the cache", async () => {
    const target = server();
    await readSwitches(target.deps);
    const sent = await call(target, "POST", "/api/admin/switches", ADMIN, { name: "signups", on: false, reason: "launch rush" });
    expect(sent.status).toBe(200);
    expect((await readSwitches(target.deps)).switches.signups).toBe(false);
    expectSwitchedOff(await call(target, "POST", "/api/age", null, { dateOfBirth: "1990-05-17" }));
  });

  test("[R-SERVER-031] given a clock that went back past the cached read, when the row is read, then it is read afresh", async () => {
    const target = server();
    target.wait(cacheMs);
    await readSwitches(target.deps);
    await turnOff(target, ["partnerPlay"]);
    target.setNow(epoch);
    expect((await readSwitches(target.deps)).switches.partnerPlay).toBe(false);
  });
});

describe("each switch, off", () => {
  test("[R-SERVER-031] given lottery off, when a ticket is bought, then it is refused before step and nothing is written; any other command is played as usual", async () => {
    const target = server();
    const character = await newLife(target, "acc-1");
    await turnOff(target, ["lottery"]);
    const before = await held(target, character);

    expectSwitchedOff(await send(target, "acc-1", buyOne(before.character.v)));
    expect(await held(target, character)).toEqual(before);

    const played = await send(target, "acc-1", restMonth(before.snapshot.state));
    expect(played.body.ok).toBe(true);
  });

  test("[R-SERVER-031] given tickets sold and then lottery off, when the draw closes, then it still draws and pays what was sold", async () => {
    const target = server();
    const keys = { beacon: fixedBeacon() };
    await drawJob(target.deps, keys, TICKS_CRON);
    const character = await newLife(target, "acc-1");
    const bought = await send(target, "acc-1", { type: "lottery/buy", tickets: 5, basedOn: (await held(target, character)).character.v });
    expect(bought.body.ok).toBe(true);

    await turnOff(target, ["lottery"]);
    target.setNow(epoch + 14 * worldTickMs + 60_000);
    await drawJob(target.deps, keys, TICKS_CRON);

    expect((await target.deps.stores.world.draw(0))?.result).not.toBeNull();
    expect((await held(target, character)).tail.filter((row) => row.command.type === "lottery/pay")).toHaveLength(1);
  });

  test("[R-SERVER-031] given every switch, then no command the authority sends is gated, so a payout or a turn grant never waits on a switch", () => {
    for (const type of AUTHORITY_COMMANDS) expect(GATED_COMMANDS[type]).toBeUndefined();
    expect(Object.values(GATED_COMMANDS).sort()).toEqual(["lottery", "partnerPlay"]);
  });

  test("[R-SERVER-031] given partnerPlay off, when an invite card is made, then it is refused; courting a computer character is not", async () => {
    const target = server();
    const character = await newLife(target, "acc-1");
    await turnOff(target, ["partnerPlay"]);
    const { v } = (await held(target, character)).character;

    expectSwitchedOff(await send(target, "acc-1", { type: "people/invite", slot: "partner", basedOn: v }));
    expect((await send(target, "acc-1", { type: "people/court", with: "person.nobody", basedOn: v })).status).not.toBe(503);
  });

  test("[R-SERVER-031] given partnerPlay off, when a pair, people or invite path is posted to, then it is refused; when one is read, then it passes to its route", async () => {
    const target = server();
    await turnOff(target, ["partnerPlay"]);
    for (const path of ["/api/pair", "/api/pair/pair.a~b/accept", "/api/people/candidates", "/api/invite/card.x"]) {
      expectSwitchedOff(await call(target, "POST", path, "acc-1", {}));
      expect((await target.app.request(path, { headers: { "x-test-account": "acc-1" } })).status).toBe(404);
    }
  });

  test("[R-SERVER-031] given adverts off, when the adverts route is asked, then no campaign is served; on, the request reaches its route", async () => {
    const target = server();
    // The adverts route exists now: with the switch on it answers the hour's campaigns (R-ADVERT-008).
    expect((await target.app.request("/api/adverts?region=NG")).status).toBe(200);
    await turnOff(target, ["adverts"]);
    target.wait(cacheMs);
    const reply = await target.app.request("/api/adverts?region=NG");
    expect(reply.status).toBe(503);
    expect(await reply.json()).toMatchObject({ ok: false, code: "switched-off" });
    expect((await target.app.request("/api/adverts/slot.x")).status).toBe(503);
  });

  test("[R-SERVER-031] [R-SERVER-032] given signups off, when the age screen is read or sent, then the visitor is answered switched-off with the wait; an account that exists plays on", async () => {
    const target = server();
    const character = await newLife(target, "acc-1");
    await turnOff(target, ["signups"]);
    expectSwitchedOff(await call(target, "POST", "/api/age", null, { dateOfBirth: "1990-05-17" }));
    expectSwitchedOff(await call(target, "GET", "/api/age", null));
    const played = await send(target, "acc-1", restMonth((await held(target, character)).snapshot.state));
    expect(played.body.ok).toBe(true);
  });

  test("[R-SERVER-031] given signups off, when a visitor sends the age screen through the whole sign-up, then no pass is made, so no sign-in method can make an account", async () => {
    const site = harness();
    await site.deps.stores.switches.set("signups", false, ADMIN, "full", site.deps.now());
    const jar = makeJar();
    const refused = await site.passAge(jar);
    expect(refused.status).toBe(503);
    expect(await refused.json()).toMatchObject({ ok: false, code: "switched-off" });
    expect(site.tables.verification.filter((row) => String(row["identifier"]).startsWith(PASS_PREFIX))).toHaveLength(0);
  });

  test("[R-SERVER-031] given every switch off, when the view, the world, the health and a turn are asked for, then none is refused", async () => {
    const target = server();
    const character = await newLife(target, "acc-1");
    await turnOff(target, SWITCH_NAMES);
    expect(Object.values((await readSwitches(target.deps)).switches)).toEqual(SWITCH_NAMES.map(() => false));

    const seen = await call<{ ok: boolean }>(target, "GET", "/api/view", "acc-1");
    expect(seen.status).toBe(200);
    expect(seen.body.ok).toBe(true);
    expect((await call(target, "GET", "/api/world", null)).status).toBe(200);
    expect((await call(target, "GET", "/api/health", null)).status).toBe(200);
    expect((await send(target, "acc-1", restMonth((await held(target, character)).snapshot.state))).body.ok).toBe(true);
  });

  test("[R-SERVER-032] given a wait that is not whole seconds, when a switch refuses, then retryAfter rounds up to the next second; 1 ms waits 1 second", async () => {
    for (const [ms, seconds] of [[1, 1], [999, 1], [1000, 1], [1001, 2], [retryMs, retryMs / 1000]] as const) {
      const target = testServer({ config: testConfig({ testing: { testLogin: true }, switches: { retryMs: ms } }) });
      await turnOff(target, ["signups"]);
      const sent = await call<ServerRejection>(target, "POST", "/api/age", null, {});
      expect(sent.body.retryAfter).toBe(seconds);
    }
  });
});

describe("the admin routes for switches and dials", () => {
  const PATHS: [method: "GET" | "POST", path: string][] = [
    ["GET", "/api/admin/switches"],
    ["GET", "/api/admin/switches/log"],
    ["POST", "/api/admin/switches"],
    ["POST", "/api/admin/dials"],
  ];

  test("[R-SERVER-030] [R-SERVER-031] given a session not in the admin accounts or none, when any switch or dial route is asked, then it answers 404 as a route that does not exist and nothing changes", async () => {
    const target = server();
    const missing = await target.app.request("/api/admin/nothing-here", { headers: { "x-test-account": ADMIN } });
    const body = await missing.text();
    for (const [method, path] of PATHS) {
      for (const account of [null, "account.player"]) {
        const sent = await target.app.request(path, {
          method,
          headers: { "content-type": "application/json", ...(account === null ? {} : { "x-test-account": account }) },
          ...(method === "POST" ? { body: JSON.stringify({ name: "lottery", on: false, dial: "computerAfterMonths", value: 1, reason: "x" }) } : {}),
        });
        expect(sent.status).toBe(404);
        expect(await sent.text()).toBe(body);
      }
    }
    expect(await target.deps.stores.switches.log()).toEqual([]);
  });

  test("[R-SERVER-031] given switches and dials changed by two admins, when the log is read, then it holds every change with who, when and why, in order", async () => {
    const config = testConfig({ testing: { testLogin: true }, admin: { accounts: [ADMIN, "account.second"] } });
    const target = testServer({ config });
    await call(target, "POST", "/api/admin/switches", ADMIN, { name: "lottery", on: false, reason: "draw fault" });
    target.wait(5_000);
    await call(target, "POST", "/api/admin/dials", "account.second", { dial: "placeTarget", place: "place.ojuelegba", value: 12, reason: "quiet night" });
    target.wait(5_000);
    await call(target, "POST", "/api/admin/switches", "account.second", { name: "lottery", on: true, reason: "fixed" });
    await call(target, "POST", "/api/admin/dials", ADMIN, { dial: "computerAfterMonths", value: null, reason: "crowd came" });

    const { body } = await call<{ ok: true; log: { at: number; admin: string; reason: string; change: unknown }[] }>(target, "GET", "/api/admin/switches/log", ADMIN);
    expect(body.log.map(({ at, admin, reason, change }) => ({ at: at - epoch, admin, reason, change }))).toEqual([
      { at: 0, admin: ADMIN, reason: "draw fault", change: { switch: "lottery", on: false } },
      { at: 5_000, admin: "account.second", reason: "quiet night", change: { dial: "placeTarget", place: "place.ojuelegba", value: 12 } },
      { at: 10_000, admin: "account.second", reason: "fixed", change: { switch: "lottery", on: true } },
      { at: 10_000, admin: ADMIN, reason: "crowd came", change: { dial: "computerAfterMonths", value: null } },
    ]);
    expect(await call(target, "GET", "/api/admin/switches", ADMIN)).toMatchObject({
      status: 200,
      body: { ok: true, switches: { signups: true, lottery: true, adverts: true, partnerPlay: true }, dials: { placeTargets: { "place.ojuelegba": 12 }, computerAfterMonths: null } },
    });
  });

  test("[R-SERVER-030] [R-SERVER-031] given a change with no reason, an unknown switch, an unknown place, a target over the place's high or a value below 0, when it is sent, then it is refused with 400 and nothing is logged", async () => {
    const target = server();
    const high = content.place["place.ojuelegba"]!.crowd.high;
    const bad: [string, Record<string, unknown>][] = [
      ["/api/admin/switches", { name: "lottery", on: false }],
      ["/api/admin/switches", { name: "lottery", on: false, reason: "   " }],
      ["/api/admin/switches", { name: "lottery", on: false, reason: "x".repeat(501) }],
      ["/api/admin/switches", { name: "everything", on: false, reason: "x" }],
      ["/api/admin/switches", { name: "lottery", on: "no", reason: "x" }],
      ["/api/admin/dials", { dial: "placeTarget", place: "place.nowhere", value: 1, reason: "x" }],
      ["/api/admin/dials", { dial: "placeTarget", place: "place.ojuelegba", value: high + 1, reason: "x" }],
      ["/api/admin/dials", { dial: "computerAfterMonths", value: -1, reason: "x" }],
      ["/api/admin/dials", { dial: "computerAfterMonths", value: 2.5, reason: "x" }],
      ["/api/admin/dials", { dial: "computerAfterMonths", value: "5", reason: "x" }],
      // Decision 0016 has no raffle top-up, so it is no dial.
      ["/api/admin/dials", { dial: "topUpTickets", value: 5, reason: "x" }],
      ["/api/admin/dials", { dial: "surge", value: 1, reason: "x" }],
    ];
    for (const [path, body] of bad) expect((await call(target, "POST", path, ADMIN, body)).status).toBe(400);
    expect(await target.deps.stores.switches.log()).toEqual([]);

    expect((await call(target, "POST", "/api/admin/dials", ADMIN, { dial: "placeTarget", place: "place.ojuelegba", value: high, reason: "x".repeat(500) })).status).toBe(200);
    expect((await call(target, "POST", "/api/admin/dials", ADMIN, { dial: "computerAfterMonths", value: 0, reason: "x" })).status).toBe(200);
  });
});

describe("the dials' readers", () => {
  const SENTINEL = 4_321;
  const overlay = { version: "overlay-dials", tuning: { people: { computerAfterMonths: 7 }, lottery: { odds: { smallPerMillion: SENTINEL } } } } as unknown as Overlay;

  test("[R-SERVER-030] [R-SERVER-018] given no dial set, when each is read, then it is the content's number with the overlay applied", async () => {
    const target = testServer({ contents: { current: applyOverlay(content, overlay), previous: null } });
    expect(await computerAfterMonths(target.deps)).toBe(7);
    expect(lotteryOdds(target.deps)).toEqual({ ...content.tuning.lottery.odds, smallPerMillion: SENTINEL });
    for (const [id, entry] of Object.entries(content.place)) expect(await placeTarget(target.deps, id)).toBe(entry.crowd.target);
  });

  test("[R-SERVER-030] given the public content alone and no dial set, when each is read, then it is the public content's working value", async () => {
    const target = server();
    expect(await computerAfterMonths(target.deps)).toBe(content.tuning.people.computerAfterMonths);
    expect(lotteryOdds(target.deps)).toEqual(content.tuning.lottery.odds);
  });

  test("[R-SERVER-030] [R-LOTTERY-021] given decision 0016, under which the raffle has no top-up, when its dial is sent, then it is refused as no dial, nothing is logged and the row holds no top-up", async () => {
    const target = server();
    expect((await call(target, "POST", "/api/admin/dials", ADMIN, { dial: "topUpTickets", value: 5000, reason: "test" })).status).toBe(400);
    expect(await target.deps.stores.switches.log()).toEqual([]);
    expect(Object.keys((await target.deps.stores.switches.read()).dials)).not.toContain("topUpTickets");
  });

  test("[R-SERVER-030] given each dial set to 0 and then unset, when it is read, then it is 0 while set and falls back once unset", async () => {
    const target = server();
    const entry = content.place["place.ojuelegba"]!;
    for (const body of [
      { dial: "placeTarget", place: "place.ojuelegba", value: 0 },
      { dial: "computerAfterMonths", value: 0 },
    ]) {
      expect((await call(target, "POST", "/api/admin/dials", ADMIN, { ...body, reason: "test" })).status).toBe(200);
    }
    expect(await placeTarget(target.deps, "place.ojuelegba")).toBe(0);
    expect(await computerAfterMonths(target.deps)).toBe(0);

    await call(target, "POST", "/api/admin/dials", ADMIN, { dial: "placeTarget", place: "place.ojuelegba", value: null, reason: "test" });
    await call(target, "POST", "/api/admin/dials", ADMIN, { dial: "computerAfterMonths", value: null, reason: "test" });
    expect(await placeTarget(target.deps, "place.ojuelegba")).toBe(entry.crowd.target);
    expect(await computerAfterMonths(target.deps)).toBe(content.tuning.people.computerAfterMonths);
  });

  test("[R-SERVER-030] given a place target set at the place's high and the content later lowering high, when it is read, then it is the new high", async () => {
    const target = server();
    const entry = content.place["place.ojuelegba"]!;
    await call(target, "POST", "/api/admin/dials", ADMIN, { dial: "placeTarget", place: "place.ojuelegba", value: entry.crowd.high, reason: "test" });
    expect(await placeTarget(target.deps, "place.ojuelegba")).toBe(entry.crowd.high);
    const lowered = { ...content, place: { ...content.place, "place.ojuelegba": { ...entry, crowd: { ...entry.crowd, high: entry.crowd.high - 1 } } } };
    expect(await placeTarget({ ...target.deps, contents: { current: lowered, previous: null } }, "place.ojuelegba")).toBe(entry.crowd.high - 1);
  });

  test("[R-SERVER-030] given a place the content does not hold, when its target is read, then it throws", async () => {
    await expect(placeTarget(server().deps, "place.nowhere")).rejects.toThrow("No place place.nowhere.");
  });
});

describe("the dials' callers", () => {
  test("[R-SERVER-030] [R-SERVER-024] [R-PEOPLE-060] given the partner dial set and later unset, when the player plays on, then each change opens a segment whose content carries the dial and records it in its overlay name, and the life still replays from its first segment", async () => {
    const target = server();
    const character = await newLife(target, "acc-1");
    accepted((await send(target, "acc-1", restMonth({ v: 0 }))).body);
    expect((await held(target, character)).segments).toHaveLength(1);

    await call(target, "POST", "/api/admin/dials", ADMIN, { dial: "computerAfterMonths", value: 3, reason: "launch" });
    accepted((await send(target, "acc-1", restMonth({ v: 1 }))).body);
    const dialed = await held(target, character);
    expect(dialed.segments.map((segment) => segment.overlay)).toEqual([undefined, `${COMPUTER_DIAL}3`]);
    expect(namedContent(target.deps.contents, content.version, `${COMPUTER_DIAL}3`)?.tuning.people.computerAfterMonths).toBe(3);

    await call(target, "POST", "/api/admin/dials", ADMIN, { dial: "computerAfterMonths", value: null, reason: "players came" });
    const v = dialed.character.v;
    accepted((await send(target, "acc-1", restMonth({ v }))).body);
    const after = await held(target, character);
    expect(after.segments.at(-1)?.overlay).toBeUndefined();
    expect(after.segments.at(-1)?.segment).toBe((dialed.segments.at(-1)?.segment ?? 0) + 1);
    expect(await rollbackCheck(target.deps, character)).toMatchObject({ ok: true, report: { firstDiff: null } });
  });

  test("[R-SERVER-030] given the partner dial at the content's own value, when a command is played, then no segment opens", async () => {
    const target = server();
    const character = await newLife(target, "acc-1");
    await call(target, "POST", "/api/admin/dials", ADMIN, { dial: "computerAfterMonths", value: content.tuning.people.computerAfterMonths, reason: "same" });
    accepted((await send(target, "acc-1", restMonth({ v: 0 }))).body);
    expect((await held(target, character)).segments).toHaveLength(1);
  });

  test("[R-SERVER-030] [R-CITY-032] [R-CLOCK-028] given five players in a place whose target is dialed to 2, when the presence is fetched, then at most 2 others are sampled, and the config's sample once the dial is unset", async () => {
    const target = server();
    const place = "place.ojuelegba";
    for (let index = 0; index < 6; index += 1) await target.deps.stores.presence.join(place, `socket-${String(index)}`, { account: `acc-${String(index)}`, name: `N${String(index)}`, look: "look.a", place, joinedAt: 0 });
    await call(target, "POST", "/api/admin/dials", ADMIN, { dial: "placeTarget", place, value: 2, reason: "quiet" });
    const sampled = await call<{ others: unknown[] }>(target, "GET", `/api/place/${place}`, "acc-0");
    expect(sampled.body.others).toHaveLength(2);
    await call(target, "POST", "/api/admin/dials", ADMIN, { dial: "placeTarget", place, value: null, reason: "busy" });
    const full = await call<{ others: unknown[] }>(target, "GET", `/api/place/${place}`, "acc-0");
    expect(full.body.others).toHaveLength(Math.min(5, productionConfig.presence.sample, content.place[place]!.crowd.target));
  });
});
