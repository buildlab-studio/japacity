import { content } from "@japacity/content";
import type { Content, State } from "@japacity/sim";
import { int } from "@japacity/sim";
import type { Nudge } from "@japacity/store";
import { describe, expect, test } from "vitest";

import { sendAuthority } from "../authority/command";
import { load } from "../authority/load";
import type { TestServer } from "../authority/testing";
import { call, held, newLife, send, testServer } from "../authority/testing";
import { productionConfig } from "../config";
import { drawJob } from "../jobs/draw";
import { TICKS_CRON } from "../jobs/ticks";
import { drawRoute } from "../routes/draw";
import type { DrawReply } from "../routes/draw";
import type { ServerReply, WorldReply } from "../types";
import { storedWorlds } from "../world/ticks";
import { drawSeed, drawWinners, fromHex, sha256, tiersFor, toHex, topUpPart } from "../../../../packages/sim/src/lottery/lottery.draw";
import type { Beacon } from "./beacon";
import { QUICKNET_GENESIS_MS, QUICKNET_PERIOD_MS, quicknet, roundAfter, roundFallsAt } from "./beacon";
import type { DrawKeys } from "./draw";
import { SECRET_BYTES, closeDraw, closesTickOf, drawOn, fingerprintOf, listHashOf, openDraw, tokenOf } from "./draw";

const { epoch, worldTickMs } = productionConfig.clock;
const tuning = content.tuning.lottery;
const RANDOMNESS = "8ada64bae5c6c0f5540a6a13af56e663240edfbd2c76ac6a8f27671eb7259ce3";
const TOKEN_KEY = "test-draw-token-key";

/** A beacon that answers fixed bytes, or nothing while `down` is set. */
function fakeBeacon(): Beacon & { down: boolean; asked: number[] } {
  const beacon = {
    genesis: QUICKNET_GENESIS_MS,
    period: QUICKNET_PERIOD_MS,
    down: false,
    asked: [] as number[],
    randomness: (round: number) => {
      beacon.asked.push(round);
      return Promise.resolve(beacon.down ? null : RANDOMNESS);
    },
  };
  return beacon;
}

function keysWith(beacon: Beacon): DrawKeys {
  return { beacon };
}

/** The start of `tick`, plus a minute. */
function during(tick: number): number {
  return epoch + tick * worldTickMs + 60000;
}

function accepted(reply: ServerReply): Extract<ServerReply, { ok: true }> {
  if (!reply.ok) throw new Error(`Rejected with ${reply.code}: ${reply.detail}`);
  return reply;
}

async function buy(server: TestServer, account: string, character: string, tickets: number): Promise<ServerReply> {
  const { v } = (await held(server, character)).character;
  return (await send(server, account, { type: "lottery/buy", tickets, basedOn: v })).body;
}

/** The real content with the private settings' top-up set to `topUpTickets`. */
function withTopUp(topUpTickets: number): Content {
  return { ...content, tuning: { ...content.tuning, lottery: { ...tuning, topUpTickets } } };
}

/**
 * A server with draw 0 open at tick 0 and `players` accounts each holding
 * `tickets` tickets. The settings declare no top-up unless `topUpTickets` is given.
 */
async function soldDraw(
  players: number,
  tickets: number,
  topUpTickets = 0,
): Promise<{ server: TestServer; beacon: ReturnType<typeof fakeBeacon>; keys: DrawKeys; lives: { account: string; character: string }[] }> {
  const server = testServer({ contents: { current: withTopUp(topUpTickets), previous: null } });
  const beacon = fakeBeacon();
  const keys = keysWith(beacon);
  await drawJob(server.deps, keys, TICKS_CRON);
  const lives: { account: string; character: string }[] = [];
  for (let index = 0; index < players; index += 1) {
    const account = `acct-${String(index)}`;
    const character = await newLife(server, account);
    accepted(await buy(server, account, character, tickets));
    lives.push({ account, character });
  }
  return { server, beacon, keys, lives };
}

/** `GET /api/draw/:n` with no session, through the route as the Worker mounts it. */
async function drawPage(server: TestServer, draw: number | string): Promise<{ status: number; body: DrawReply; text: string; headers: Headers }> {
  const reply = await drawRoute(server.deps).request(`/api/draw/${String(draw)}`, { headers: { "cf-connecting-ip": "203.0.113.9" } });
  const text = await reply.text();
  return { status: reply.status, body: JSON.parse(text) as DrawReply, text, headers: reply.headers };
}

async function pays(server: TestServer, character: string): Promise<{ draw: number; prizes: { tier: string; amount: number; topUp: number }[] }[]> {
  const log = await server.deps.stores.player.log(character, 0);
  return log.filter((row) => row.command.type === "lottery/pay").map((row) => row.command as unknown as { draw: number; prizes: { tier: string; amount: number; topUp: number }[] });
}

/** The character's state now, replayed from its store as a load does. */
async function stateOf(server: TestServer, character: string): Promise<State> {
  const found = await held(server, character);
  const worlds = await storedWorlds(server.deps, found.tail.map((row) => row.tick));
  const loaded = load(found, server.deps.contents, worlds);
  if (!loaded.ok) throw new Error(loaded.diverged.detail);
  return loaded.live.state;
}

describe("opening a draw", () => {
  test("[R-LOTTERY-007] given one secret, when its fingerprint is taken for draws 0, 1 and 2, then each differs and each is the SHA-256 of the secret's bytes followed by the draw as eight bytes", () => {
    const secret = "11".repeat(SECRET_BYTES);
    const prints = [0, 1, 2].map((draw) => fingerprintOf(secret, draw));
    expect(new Set(prints).size).toBe(3);
    const joined = new Uint8Array([...fromHex(secret), 0, 0, 0, 0, 0, 0, 0, 1]);
    expect(prints[1]).toBe(toHex(sha256(joined)));
  });

  test("[R-LOTTERY-007] given secrets of all zeros, all ones and counting bytes, when the fingerprint is taken for draws 0, 1, 255, 256 and the largest safe draw, then no two are equal", () => {
    const secrets = ["00".repeat(SECRET_BYTES), "ff".repeat(SECRET_BYTES), toHex(Uint8Array.from({ length: SECRET_BYTES }, (_, index) => index))];
    const draws = [0, 1, 255, 256, Number.MAX_SAFE_INTEGER];
    const prints = secrets.flatMap((secret) => draws.map((draw) => fingerprintOf(secret, draw)));
    expect(new Set(prints).size).toBe(secrets.length * draws.length);
  });

  test("[R-LOTTERY-007] [R-SERVER-015] given the draw job at tick 0, when it runs twice, then draws 0 and 1 are stored once each with a 256-bit secret, its fingerprint and the first beacon round after the close, and the world of tick 0 carries the fingerprint but never the secret", async () => {
    const server = testServer();
    const beacon = fakeBeacon();
    await drawJob(server.deps, keysWith(beacon), TICKS_CRON);
    const first = await server.deps.stores.world.draw(0);
    await drawJob(server.deps, keysWith(beacon), TICKS_CRON);
    const row = await server.deps.stores.world.draw(0);
    expect(row).toEqual(first);
    expect(await server.deps.stores.world.draw(1)).not.toBeNull();
    expect(row!.secret).toMatch(/^[0-9a-f]{64}$/);
    expect(row!.fingerprint).toBe(fingerprintOf(row!.secret, 0));
    const close = epoch + closesTickOf(0) * worldTickMs;
    expect(roundFallsAt(beacon, row!.beaconRound)).toBeGreaterThan(close);
    expect(roundFallsAt(beacon, row!.beaconRound - 1)).toBeLessThanOrEqual(close);

    const world = await call<WorldReply>(server, "GET", "/api/world", null);
    expect(world.body.world.lottery).toEqual({ draw: 0, closesTick: 14, fingerprint: row!.fingerprint, beaconRound: row!.beaconRound, potSoFar: 0, topUpTickets: tuning.topUpTickets, last: null });
    expect(world.text).not.toContain(row!.secret);
    const page = await drawPage(server, 0);
    expect(page.body).toMatchObject({ draw: 0, fingerprint: row!.fingerprint, beaconRound: row!.beaconRound, list: null, result: null });
    expect(page.text).not.toContain(row!.secret);
  });

  test("[R-LOTTERY-007] given a close that falls exactly on a round, when the round after it is asked for, then it is the next round, and a close a millisecond later still gives that round", () => {
    const beacon = { genesis: QUICKNET_GENESIS_MS, period: QUICKNET_PERIOD_MS };
    const onRound = roundFallsAt(beacon, 500);
    expect(roundAfter(beacon, onRound)).toBe(501);
    expect(roundAfter(beacon, onRound - 1)).toBe(500);
    expect(roundAfter(beacon, onRound + 1)).toBe(501);
    expect(roundAfter(beacon, onRound + QUICKNET_PERIOD_MS - 1)).toBe(501);
  });

  test("[R-LOTTERY-002] given ticks 0, 13 and 14, when the draw on sale is read, then it is draw 0, draw 0 and draw 1, closing at ticks 14, 14 and 28", () => {
    expect([0, 13, 14].map(drawOn)).toEqual([0, 0, 1]);
    expect([0, 0, 1].map(closesTickOf)).toEqual([14, 14, 28]);
  });
});

describe("selling", () => {
  test("[R-LOTTERY-005] [R-LOTTERY-006] given two players buying 2 and then 3 tickets, when the next tick's world is made, then the tickets are numbered in the order bought and the pot so far is the five tickets' price", async () => {
    const { server, lives } = await soldDraw(1, 2);
    const second = await newLife(server, "acct-b");
    accepted(await buy(server, "acct-b", second, 3));
    const tickets = await server.deps.stores.world.tickets(0);
    expect(tickets.map((ticket) => [ticket.n, ticket.character])).toEqual([
      [0, lives[0]!.character],
      [1, lives[0]!.character],
      [2, second],
      [3, second],
      [4, second],
    ]);
    server.setNow(during(1));
    const world = await call<WorldReply>(server, "GET", "/api/world", null);
    expect(world.body.world.lottery?.potSoFar).toBe(5 * tuning.ticket);
  });

  test("[R-LOTTERY-005] [R-LOTTERY-008] given a list frozen while the world still sells, when a player buys, then the purchase is rejected with not-legal and nothing is written or taken", async () => {
    const { server } = await soldDraw(0, 0);
    const character = await newLife(server, "acct-late");
    const before = await held(server, character);
    const frozen = await server.deps.stores.world.freeze(0, server.deps.now());
    expect(frozen.ok).toBe(true);
    const reply = await buy(server, "acct-late", character, 1);
    expect(reply).toMatchObject({ ok: false, code: "not-legal" });
    expect(await held(server, character)).toEqual(before);
    expect(await server.deps.stores.world.tickets(0)).toEqual([]);
  });
});

describe("closing, drawing and paying", () => {
  test("[R-LOTTERY-008] given tickets of three accounts, when the draw closes, then the list holds one 16-hex-digit token per ticket in order, no token holds its account id, an account's tickets share a token, and the hash is of the tokens in order", async () => {
    const { server, keys, lives } = await soldDraw(3, 2);
    server.setNow(during(14));
    await drawJob(server.deps, keys, TICKS_CRON);
    const page = await drawPage(server, 0);
    const list = page.body.list!;
    expect(list).toHaveLength(6);
    for (const token of list) expect(token).toMatch(/^[0-9a-f]{16}$/);
    for (const [index, life] of lives.entries()) {
      const token = await tokenOf(TOKEN_KEY, life.account, 0);
      expect(list.slice(index * 2, index * 2 + 2)).toEqual([token, token]);
      expect(page.text).not.toContain(life.account);
      expect(page.text).not.toContain(life.character);
    }
    expect(page.body.count).toBe(6);
    expect(page.body.listHash).toBe(listHashOf(list));
    expect(page.body.result?.listHash).toBe(page.body.listHash);
  });

  test("[R-LOTTERY-008] given account ids of many shapes and draws at the edges, when their tokens are made, then each is 16 hex digits, never contains its account id, and changes with the draw", async () => {
    const accounts = ["acct-0", "abcdef", "0123456789abcdef", "deadbeefdeadbeef", "a1b2c3d4-e5f6-4789-8abc-def012345678", "user@example.test"];
    for (const account of accounts) {
      for (const draw of [0, 1, 9999]) {
        const token = await tokenOf(TOKEN_KEY, account, draw);
        expect(token).toMatch(/^[0-9a-f]{16}$/);
        expect(token).not.toContain(account);
        expect(token).not.toBe(await tokenOf(TOKEN_KEY, account, draw + 1));
      }
    }
  });

  test("[R-LOTTERY-008] given no token key, when a token is made, then it is refused rather than made under an empty key", async () => {
    await expect(tokenOf("", "acct-0", 0)).rejects.toThrow(/token key/);
  });

  test("[R-LOTTERY-009] [R-LOTTERY-010] [R-LOTTERY-015] given a drawn draw, when its page is read, then the seed is recomputed from the published secret, list hash and beacon randomness, the secret matches the fingerprint, and the winners equal drawWinners on that seed", async () => {
    const { server, keys, beacon } = await soldDraw(4, 5);
    server.setNow(during(14));
    const run = await drawJob(server.deps, keys, TICKS_CRON);
    expect(run.drawn).toEqual([0]);
    const page = (await drawPage(server, 0)).body;
    const result = page.result!;
    expect(beacon.asked).toEqual([page.beaconRound]);
    expect(result.beaconRound).toBe(page.beaconRound);
    expect(result.beaconRandomness).toBe(RANDOMNESS);
    expect(fingerprintOf(result.revealed, 0)).toBe(page.fingerprint);
    expect(listHashOf(page.list!)).toBe(result.listHash);
    const seed = drawSeed(result.revealed, result.listHash, result.beaconRandomness);
    const tiers = tiersFor(result.count, tuning);
    expect(result.winners.map((tier) => tier.tickets)).toEqual(drawWinners(seed, result.count, tiers));
    expect(result.winners.map((tier) => tier.tier)).toEqual(["jackpot", "mid", "small"]);
    expect(result.count).toBe(20);
    expect(result.pot).toBe(20 * tuning.ticket);
  });

  test("[R-LOTTERY-011] [R-LOTTERY-012] [R-LOTTERY-013] given ten tickets, when the draw is paid, then one jackpot and nine mid tickets are paid, the small tier is left unfilled and pays nobody, and the wallets show every kobo of the pot not paid destroyed", async () => {
    const { server, keys, lives } = await soldDraw(2, 5);
    server.setNow(during(14));
    await drawJob(server.deps, keys, TICKS_CRON);
    const result = (await server.deps.stores.world.draw(0))!.result!;
    const [jackpot, mid, small] = result.winners;
    expect(jackpot!.tickets).toHaveLength(1);
    expect(mid!.tickets).toHaveLength(9);
    expect(small!.tickets).toEqual([]);
    const pot = 10 * tuning.ticket;
    expect(result.pot).toBe(pot);
    expect(result.fund).toBe(int.mulDiv(pot, 10000 - tuning.burnBp, 10000));
    expect(jackpot!.amount).toBe(int.mulDiv(result.fund, tuning.jackpotBp, 10000));
    expect(mid!.amount).toBe(int.mulDiv(result.fund, tuning.midBp, 10000 * tuning.midCount));

    let won = 0;
    let staked = 0;
    for (const life of lives) {
      const payments = await pays(server, life.character);
      expect(payments).toHaveLength(1);
      expect(payments[0]!.draw).toBe(0);
      const { tail } = await held(server, life.character);
      expect(tail.filter((row) => row.command.type === "lottery/pay").map((row) => row.sender)).toEqual(["authority"]);
      const { totals } = (await stateOf(server, life.character)).wallet;
      expect(totals.in.win?.NGN ?? 0).toBe(payments[0]!.prizes.reduce((sum, prize) => sum + prize.amount, 0));
      won += totals.in.win?.NGN ?? 0;
      staked += totals.out.ticket?.NGN ?? 0;
    }
    const paid = jackpot!.amount + 9 * mid!.amount;
    expect(won).toBe(paid);
    expect(staked).toBe(pot);
    expect(pot - won).toBeGreaterThan(pot - result.fund);
  });

  test("[R-LOTTERY-013] [R-LOTTERY-015] given a draw paid by one run, when the job runs again, then nobody is paid twice and the stored result is unchanged", async () => {
    const { server, keys, lives } = await soldDraw(3, 5);
    server.setNow(during(14));
    await drawJob(server.deps, keys, TICKS_CRON);
    const result = (await server.deps.stores.world.draw(0))!.result;
    const logs = await Promise.all(lives.map((life) => server.deps.stores.player.log(life.character, 0)));
    const again = await drawJob(server.deps, keys, TICKS_CRON);
    expect(again.drawn).toEqual([]);
    expect((await server.deps.stores.world.draw(0))!.result).toEqual(result);
    expect(await Promise.all(lives.map((life) => server.deps.stores.player.log(life.character, 0)))).toEqual(logs);
    expect(await closeDraw(server.deps, keys, 0)).toEqual({ kind: "drawn", result });
  });

  test("[R-LOTTERY-013] given a winner already paid when a run stopped before the result was stored, when the draw is closed again, then the kind refuses the second payment and the draw is published with that winner paid once", async () => {
    const { server, keys, lives } = await soldDraw(1, 5);
    server.setNow(during(14));
    const character = lives[0]!.character;
    const early = await sendAuthority(server.deps, character, { type: "lottery/pay", draw: 0, prizes: [{ tier: "jackpot", amount: 1, topUp: 0 }], basedOn: 0 });
    expect(early.kind).toBe("done");
    const closed = await closeDraw(server.deps, keys, 0);
    expect(closed.kind).toBe("drawn");
    expect(await pays(server, character)).toHaveLength(1);
  });

  test("[R-LOTTERY-008] [R-LOTTERY-009] given the beacon cannot be read at the close, when the job runs, then the draw stays without a result and nobody is paid, and the next run with the beacon back draws and pays it", async () => {
    const { server, keys, beacon, lives } = await soldDraw(2, 3);
    server.setNow(during(14));
    beacon.down = true;
    const first = await drawJob(server.deps, keys, TICKS_CRON);
    expect(first.drawn).toEqual([]);
    expect(first.waiting).toMatchObject([{ draw: 0 }]);
    expect((await server.deps.stores.world.draw(0))!.result).toBeNull();
    for (const life of lives) expect(await pays(server, life.character)).toEqual([]);
    const page = (await drawPage(server, 0)).body;
    expect(page.result).toBeNull();
    expect(page.list).toHaveLength(6);
    expect(JSON.stringify(page)).not.toContain((await server.deps.stores.world.draw(0))!.secret);

    beacon.down = false;
    server.wait(5 * 60000);
    const second = await drawJob(server.deps, keys, TICKS_CRON);
    expect(second.drawn).toEqual([0]);
    expect((await server.deps.stores.world.draw(0))!.result?.listHash).toBe(page.listHash);
  });

  test("[R-LOTTERY-008] given a draw still on sale, when it is closed, then it waits and nothing is frozen", async () => {
    const { server, keys } = await soldDraw(1, 1);
    server.setNow(during(13));
    expect(await closeDraw(server.deps, keys, 0)).toMatchObject({ kind: "waiting" });
    expect((await server.deps.stores.world.draw(0))!.closedAt).toBeNull();
  });
});

describe("telling", () => {
  test("[R-LOTTERY-015] given draw 0 drawn during tick 14, after that tick's row was made, when the world of tick 15 is fetched, then it sells draw 1 and its last result is draw 0's", async () => {
    const { server, keys } = await soldDraw(2, 2);
    server.setNow(during(14));
    await drawJob(server.deps, keys, TICKS_CRON);
    const result = (await server.deps.stores.world.draw(0))!.result;
    expect((await server.deps.stores.world.tick(14))!.world.lottery).toMatchObject({ draw: 1, last: null });
    server.setNow(during(15));
    const world = (await call<WorldReply>(server, "GET", "/api/world", null)).body;
    expect(world.world.lottery).toMatchObject({ draw: 1, closesTick: 28, last: result });
  });

  test("[R-LOTTERY-017] [R-CLOCK-020] given a winner online and one away, when the draw is paid, then the online one is nudged with its new version and the away one's payment waits in its log", async () => {
    const { server, keys, lives } = await soldDraw(2, 5);
    const nudges: Nudge[] = [];
    const stop = server.deps.stores.nudges.subscribe(lives[0]!.account, (nudge) => nudges.push(nudge));
    server.setNow(during(14));
    await drawJob(server.deps, keys, TICKS_CRON);
    stop();
    const online = await held(server, lives[0]!.character);
    expect(nudges).toContainEqual({ nudge: "view", v: online.character.v });
    expect(await pays(server, lives[1]!.character)).toHaveLength(1);
  });
});

describe("the beacon over HTTP", () => {
  test("[R-LOTTERY-007] [R-LOTTERY-009] given drand's answer for quicknet round 42, when its randomness is read, then it is the SHA-256 of the signature, the value drand's v1 API publishes", async () => {
    const asked: string[] = [];
    const fetcher = ((url: string) => {
      asked.push(url);
      return Promise.resolve(new Response(JSON.stringify({ round: 42, signature: "95a9f9f5b231b7714de1553105d8ffdf3dcda24cfdb1e689319bccf79a9c8ce430a91b811fbfaf763900bc998b5d686a" })));
    }) as typeof fetch;
    expect(await quicknet(fetcher).randomness(42)).toBe(RANDOMNESS);
    expect(asked).toEqual(["https://api.drand.sh/v2/beacons/quicknet/rounds/42"]);
  });

  test("[R-LOTTERY-009] given a relay that fails, answers another round or is unreachable, when the randomness is read, then it is null", async () => {
    const answers = [new Response("not found", { status: 404 }), new Response(JSON.stringify({ round: 41, signature: "00" }))];
    const fetcher = (() => {
      const next = answers.shift();
      return next === undefined ? Promise.reject(new Error("offline")) : Promise.resolve(next);
    }) as typeof fetch;
    const beacon = quicknet(fetcher);
    expect(await beacon.randomness(42)).toBeNull();
    expect(await beacon.randomness(42)).toBeNull();
    expect(await beacon.randomness(42)).toBeNull();
  });
});

describe("the draw page", () => {
  test("[R-LOTTERY-015] given no such draw or a number that is not one, when the page is asked for, then it answers 404 and 400", async () => {
    const server = testServer();
    expect((await drawPage(server, 3)).status).toBe(404);
    expect((await drawPage(server, "x1")).status).toBe(400);
  });

  test("[R-LOTTERY-007] given draw 0 on sale, when it is opened by the job with the world's own secret bytes, then the fingerprint is published before any ticket is sold", async () => {
    const server = testServer();
    const row = await openDraw(server.deps, fakeBeacon(), 0);
    expect(row.closedAt).toBeNull();
    expect(row.result).toBeNull();
    expect(await server.deps.stores.world.tickets(0)).toEqual([]);
  });
});

describe("the house top-up", () => {
  test("[R-LOTTERY-021] given the settings' top-up, when the job opens a draw and the settings change after, then the draw keeps the figure declared at its opening and the world and the draw page publish it", async () => {
    const server = testServer({ contents: { current: withTopUp(120), previous: null } });
    const keys = keysWith(fakeBeacon());
    await drawJob(server.deps, keys, TICKS_CRON);
    server.deps.contents.current = withTopUp(7);
    expect((await server.deps.stores.world.draw(0))?.topUpTickets).toBe(120);
    expect((await server.deps.stores.world.draw(1))?.topUpTickets).toBe(120);
    const world = await call<WorldReply>(server, "GET", "/api/world", null);
    expect(world.body.world.lottery?.topUpTickets).toBe(120);
    expect((await drawPage(server, 0)).body.topUpTickets).toBe(120);
    server.setNow(during(14));
    await drawJob(server.deps, keys, TICKS_CRON);
    expect((await server.deps.stores.world.draw(2))?.topUpTickets).toBe(7);
  });

  test("[R-LOTTERY-021] [R-SERVER-030] given the top-up dial set in the switch row, when the job opens a draw, then the draw declares the dial's figure, and the content's once the dial is unset", async () => {
    const server = testServer({ contents: { current: withTopUp(120), previous: null } });
    await server.deps.stores.switches.setDial({ dial: "topUpTickets", value: 40 }, "account.owner", "launch", server.deps.now());
    await drawJob(server.deps, keysWith(fakeBeacon()), TICKS_CRON);
    expect((await server.deps.stores.world.draw(0))?.topUpTickets).toBe(40);
    await server.deps.stores.switches.setDial({ dial: "topUpTickets", value: null }, "account.owner", "crowd came", server.deps.now());
    server.setNow(during(14) + server.deps.config.switches.cacheMs);
    await drawJob(server.deps, keysWith(fakeBeacon()), TICKS_CRON);
    expect((await server.deps.stores.world.draw(2))?.topUpTickets).toBe(120);
  });

  test("[R-LOTTERY-021] [R-LOTTERY-022] given 10 tickets sold under a top-up of 100, when the draw is paid, then the pot is 100 tickets' worth, each prize carries its top-up part, and the wallets credit that part as pot-top-up and the rest as win", async () => {
    const { server, keys, lives } = await soldDraw(2, 5, 100);
    server.setNow(during(14));
    await drawJob(server.deps, keys, TICKS_CRON);
    const result = (await server.deps.stores.world.draw(0))!.result!;
    expect(result.count).toBe(10);
    expect(result.topUp).toBe(90 * tuning.ticket);
    expect(result.pot).toBe(100 * tuning.ticket);
    expect(result.fund).toBe(int.mulDiv(result.pot, 10000 - tuning.burnBp, 10000));

    let house = 0;
    let paid = 0;
    for (const life of lives) {
      const [payment] = await pays(server, life.character);
      for (const prize of payment!.prizes) expect(prize.topUp).toBe(topUpPart(prize.amount, result.topUp, result.pot));
      const { totals } = (await stateOf(server, life.character)).wallet;
      const fromHouse = payment!.prizes.reduce((sum, prize) => sum + prize.topUp, 0);
      const whole = payment!.prizes.reduce((sum, prize) => sum + prize.amount, 0);
      expect(totals.in["pot-top-up"]?.NGN ?? 0).toBe(fromHouse);
      expect(totals.in.win?.NGN ?? 0).toBe(whole - fromHouse);
      house += fromHouse;
      paid += whole;
    }
    expect(house).toBeGreaterThan(0);
    expect(house).toBeLessThanOrEqual(result.topUp);
    expect(paid).toBeLessThanOrEqual(result.fund);
  });

  test("[R-LOTTERY-021] given sales at and past the declared number, when the draw is drawn, then the top-up is 0 and the pot is the sales alone", async () => {
    for (const declared of [10, 9]) {
      const { server, keys, lives } = await soldDraw(2, 5, declared);
      server.setNow(during(14));
      await drawJob(server.deps, keys, TICKS_CRON);
      const result = (await server.deps.stores.world.draw(0))!.result!;
      expect(result.topUp).toBe(0);
      expect(result.pot).toBe(10 * tuning.ticket);
      for (const life of lives) for (const prize of (await pays(server, life.character))[0]!.prizes) expect(prize.topUp).toBe(0);
    }
  });

  test("[R-LOTTERY-021] given one ticket under the declared number, when the draw is drawn, then the top-up is one ticket's price", async () => {
    const { server, keys } = await soldDraw(2, 5, 11);
    server.setNow(during(14));
    await drawJob(server.deps, keys, TICKS_CRON);
    expect((await server.deps.stores.world.draw(0))!.result!.topUp).toBe(tuning.ticket);
  });
});

describe("the stored list", () => {
  test("[R-LOTTERY-008] given a draw frozen and its beacon down, when the job runs, then the list and its hash are stored once at the close and the page publishes the stored list", async () => {
    const { server, keys, beacon } = await soldDraw(2, 2);
    server.setNow(during(14));
    beacon.down = true;
    await drawJob(server.deps, keys, TICKS_CRON);
    const row = (await server.deps.stores.world.draw(0))!;
    expect(row.list).toHaveLength(4);
    expect(row.listHash).toBe(listHashOf(row.list!));
    const page = (await drawPage(server, 0)).body;
    expect(page.list).toEqual(row.list);
    expect(page.listHash).toBe(row.listHash);

    beacon.down = false;
    server.wait(5 * 60000);
    await drawJob(server.deps, keys, TICKS_CRON);
    const drawn = (await server.deps.stores.world.draw(0))!;
    expect(drawn.list).toEqual(row.list);
    expect(drawn.result?.listHash).toBe(row.listHash);
  });

  test("[R-LOTTERY-008] given a stored list, when another list is offered for the draw before it is drawn, then it is refused and the draw is drawn from the stored list", async () => {
    const { server, keys, beacon } = await soldDraw(2, 2);
    server.setNow(during(14));
    beacon.down = true;
    await drawJob(server.deps, keys, TICKS_CRON);
    const stored = (await server.deps.stores.world.draw(0))!;
    expect(await server.deps.stores.world.setList(0, ["00".repeat(8)], "11".repeat(32))).toMatchObject({ ok: false, code: "conflict" });
    beacon.down = false;
    server.wait(5 * 60000);
    await drawJob(server.deps, keys, TICKS_CRON);
    expect((await server.deps.stores.world.draw(0))!.result?.listHash).toBe(stored.listHash);
  });
});
