import type { DrawReply, ServerReply, ViewReply, WorldReply } from "@japacity/api";
import { content } from "@japacity/content";
import type { Content, LotteryOdds, State } from "@japacity/sim";
import { drawResults, drawSeed, forcedTicket, fromHex, jackpotHit, prizesOwed, rollJackpot, sha256, toHex } from "@japacity/sim";
import type { Nudge } from "@japacity/store";
import { describe, expect, test } from "vitest";

import { sendAuthority } from "../authority/command";
import { load } from "../authority/load";
import type { TestServer } from "../authority/authority.testing";
import { accepted, call, held, newLife, send, testServer } from "../authority/authority.testing";
import { productionConfig } from "../config";
import { drawJob } from "../scheduled/draw";
import { TICKS_CRON } from "../scheduled/ticks";
import { drawRoute } from "../routes/draw";
import { storedWorlds } from "../world/ticks";
import type { Beacon } from "./beacon";
import { QUICKNET_GENESIS_MS, QUICKNET_PERIOD_MS, quicknet, roundAfter, roundFallsAt } from "./beacon";
import type { DrawKeys } from "./draw";
import { SECRET_BYTES, closeDraw, closesTickOf, drawOn, fingerprintOf, forcedWin, listHashOf, openDraw, resultOf, tokenOf } from "./draw";

const { epoch, worldTickMs } = productionConfig.clock;
const tuning = content.tuning.lottery;
const { odds } = tuning;

/** Odds that pay often and little, still under the ticket's price at the start and the cap, so a few tickets win in every tier. */
const GENEROUS: LotteryOdds = {
  smallPerMillion: 300_000,
  small: 10_000,
  midPerMillion: 100_000,
  mid: 20_000,
  jackpotPerMillion: 50_000,
  jackpotStart: 100_000,
  jackpotGrowthBp: 1000,
  jackpotCap: 200_000,
  forcedWinWeeks: null,
};

/** Every ticket hits a jackpot of 10,001 kobo, which three hits cannot share evenly. */
const ALWAYS: LotteryOdds = { ...GENEROUS, smallPerMillion: 0, midPerMillion: 0, jackpotPerMillion: 1_000_000, jackpotStart: 10_001, jackpotCap: 19_999 };
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

async function buy(server: TestServer, account: string, character: string, tickets: number): Promise<ServerReply> {
  const { v } = (await held(server, character)).character;
  return (await send(server, account, { type: "lottery/buy", tickets, basedOn: v })).body;
}

/** The real content with the private settings' odds set to `chosen`. */
function withOdds(chosen: LotteryOdds): Content {
  return { ...content, tuning: { ...content.tuning, lottery: { ...tuning, odds: chosen } } };
}

/**
 * A server with draw 0 open at tick 0 under `chosen` odds and `players`
 * accounts each holding `tickets` tickets.
 */
async function soldDraw(
  players: number,
  tickets: number,
  chosen: LotteryOdds = odds,
): Promise<{ server: TestServer; beacon: ReturnType<typeof fakeBeacon>; keys: DrawKeys; lives: { account: string; character: string }[] }> {
  const server = testServer({ contents: { current: withOdds(chosen), previous: null } });
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

async function pays(server: TestServer, character: string): Promise<{ draw: number; prizes: { tier: string; amount: number }[] }[]> {
  const log = await server.deps.stores.player.log(character, 0);
  return log.flatMap((row) => (row.command.type === "lottery/pay" ? [{ draw: row.command.draw, prizes: row.command.prizes }] : []));
}

/** What each life was credited as `win` and paid as `ticket`, from its replayed wallet. */
async function wallets(server: TestServer, lives: { character: string }[]): Promise<{ won: number; staked: number; house: number }> {
  let won = 0;
  let staked = 0;
  let house = 0;
  for (const life of lives) {
    const { totals } = (await stateOf(server, life.character)).wallet;
    won += totals.in.win?.NGN ?? 0;
    staked += totals.out.ticket?.NGN ?? 0;
    house += totals.in["pot-top-up"]?.NGN ?? 0;
  }
  return { won, staked, house };
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
  test("[lottery:fingerprint-commits-secret] given one secret, when its fingerprint is taken for draws 0, 1 and 2, then each differs and each is the SHA-256 of the secret's bytes followed by the draw as eight bytes", () => {
    const secret = "11".repeat(SECRET_BYTES);
    const prints = [0, 1, 2].map((draw) => fingerprintOf(secret, draw));
    expect(new Set(prints).size).toBe(3);
    const joined = new Uint8Array([...fromHex(secret), 0, 0, 0, 0, 0, 0, 0, 1]);
    expect(prints[1]).toBe(toHex(sha256(joined)));
  });

  test("[lottery:fingerprint-commits-secret] given secrets of all zeros, all ones and counting bytes, when the fingerprint is taken for draws 0, 1, 255, 256 and the largest safe draw, then no two are equal", () => {
    const secrets = ["00".repeat(SECRET_BYTES), "ff".repeat(SECRET_BYTES), toHex(Uint8Array.from({ length: SECRET_BYTES }, (_, index) => index))];
    const draws = [0, 1, 255, 256, Number.MAX_SAFE_INTEGER];
    const prints = secrets.flatMap((secret) => draws.map((draw) => fingerprintOf(secret, draw)));
    expect(new Set(prints).size).toBe(secrets.length * draws.length);
  });

  test("[lottery:fingerprint-commits-secret] [lottery:jackpot-rolls-over] [server:secrets-stay-on-server] given the draw job at tick 0, when it runs twice, then draw 0 is stored once with a 256-bit secret, its fingerprint, the first beacon round after the close, the odds and the starting jackpot, draw 1 waits for it, and the world of tick 0 carries all but the secret", async () => {
    const server = testServer();
    const beacon = fakeBeacon();
    await drawJob(server.deps, keysWith(beacon), TICKS_CRON);
    const first = await server.deps.stores.world.draw(0);
    await drawJob(server.deps, keysWith(beacon), TICKS_CRON);
    const row = await server.deps.stores.world.draw(0);
    expect(row).toEqual(first);
    expect(row).toMatchObject({ odds, jackpot: odds.jackpotStart });
    expect(await server.deps.stores.world.draw(1)).toBeNull();
    expect(row!.secret).toMatch(/^[0-9a-f]{64}$/);
    expect(row!.fingerprint).toBe(fingerprintOf(row!.secret, 0));
    const close = epoch + closesTickOf(0) * worldTickMs;
    expect(roundFallsAt(beacon, row!.beaconRound)).toBeGreaterThan(close);
    expect(roundFallsAt(beacon, row!.beaconRound - 1)).toBeLessThanOrEqual(close);

    const world = await call<WorldReply>(server, "GET", "/api/world", null);
    expect(world.body.world.lottery).toEqual({
      draw: 0,
      closesTick: 14,
      onSale: true,
      fingerprint: row!.fingerprint,
      beaconRound: row!.beaconRound,
      salesSoFar: 0,
      jackpot: odds.jackpotStart,
      rolledOver: false,
      odds,
      last: null,
    });
    expect(world.text).not.toContain(row!.secret);
    const page = await drawPage(server, 0);
    expect(page.body).toMatchObject({ draw: 0, fingerprint: row!.fingerprint, beaconRound: row!.beaconRound, odds, jackpot: odds.jackpotStart, list: null, result: null });
    expect(page.text).not.toContain(row!.secret);
  });

  test("[lottery:fingerprint-commits-secret] given a close that falls exactly on a round, when the round after it is asked for, then it is the next round, and a close a millisecond later still gives that round", () => {
    const beacon = { genesis: QUICKNET_GENESIS_MS, period: QUICKNET_PERIOD_MS };
    const onRound = roundFallsAt(beacon, 500);
    expect(roundAfter(beacon, onRound)).toBe(501);
    expect(roundAfter(beacon, onRound - 1)).toBe(500);
    expect(roundAfter(beacon, onRound + 1)).toBe(501);
    expect(roundAfter(beacon, onRound + QUICKNET_PERIOD_MS - 1)).toBe(501);
  });

  test("[lottery:draw-sells-between-ticks] given ticks 0, 13 and 14, when the draw on sale is read, then it is draw 0, draw 0 and draw 1, closing at ticks 14, 14 and 28", () => {
    expect([0, 13, 14].map(drawOn)).toEqual([0, 0, 1]);
    expect([0, 0, 1].map(closesTickOf)).toEqual([14, 14, 28]);
  });
});

describe("selling", () => {
  test("[lottery:tickets-numbered-by-commit] [lottery:view-shows-draw-state] given two players buying 2 and then 3 tickets, when the next tick's world is made, then the tickets are numbered in the order bought and the sales so far are the five tickets' price", async () => {
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
    expect(world.body.world.lottery?.salesSoFar).toBe(5 * tuning.ticket);
  });

  test("[lottery:tickets-numbered-by-commit] [lottery:ticket-list-frozen-anonymously] given a list frozen while the world still sells, when a player buys, then the purchase is rejected with not-legal and nothing is written or taken", async () => {
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
  test("[lottery:ticket-list-frozen-anonymously] given tickets of three accounts, when the draw closes, then the list holds one 16-hex-digit token per ticket in order, no token holds its account id, an account's tickets share a token, and the hash is of the tokens in order", async () => {
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

  test("[lottery:ticket-list-frozen-anonymously] given account ids of many shapes and draws at the edges, when their tokens are made, then each is 16 hex digits, never contains its account id, and changes with the draw", async () => {
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

  test("[lottery:ticket-list-frozen-anonymously] given no token key, when a token is made, then it is refused rather than made under an empty key", async () => {
    await expect(tokenOf("", "acct-0", 0)).rejects.toThrow(/token key/);
  });

  test("[lottery:seed-from-secret-and-beacon] [lottery:ticket-result-is-public-function] [lottery:result-published-in-tick-row] given a drawn draw, when its page is read, then the seed is recomputed from the published secret, list hash and beacon randomness, the secret matches the fingerprint, and the winners equal drawResults on that seed at the published odds and jackpot", async () => {
    const { server, keys, beacon } = await soldDraw(4, 5, GENEROUS);
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
    expect(result).toMatchObject({ odds: GENEROUS, jackpot: GENEROUS.jackpotStart, count: 20 });
    expect(result.winners).toEqual(drawResults(seed, result.count, result.odds, result.jackpot));
    expect(result.winners.map((tier) => tier.tier)).toEqual(["jackpot", "mid", "small"]);
    expect(prizesOwed(result.winners)).toBeGreaterThan(0);
    expect(result.nextJackpot).toBe(rollJackpot(result.jackpot, 20 * tuning.ticket, jackpotHit(result.winners), result.odds));
  });

  test("[lottery:fixed-prizes-shared-jackpot] [lottery:winners-paid-by-authority] given twenty tickets under odds that pay often, when the draw is paid, then every winning ticket is paid its tier's amount as win to its own player once, and nothing else is credited", async () => {
    const { server, keys, lives } = await soldDraw(4, 5, GENEROUS);
    server.setNow(during(14));
    await drawJob(server.deps, keys, TICKS_CRON);
    const result = (await server.deps.stores.world.draw(0))!.result!;
    const tickets = await server.deps.stores.world.tickets(0);
    for (const life of lives) {
      const payments = await pays(server, life.character);
      const owed = result.winners.flatMap((tier) => tier.tickets.filter((number) => tickets[number]?.character === life.character).map(() => ({ tier: tier.tier, amount: tier.amount })));
      expect(payments).toEqual(owed.length === 0 ? [] : [{ draw: 0, prizes: owed }]);
      const { tail } = await held(server, life.character);
      expect(tail.filter((row) => row.command.type === "lottery/pay").map((row) => row.sender)).toEqual(owed.length === 0 ? [] : ["authority"]);
    }
    const { won, staked, house } = await wallets(server, lives);
    expect(won).toBe(prizesOwed(result.winners));
    expect(won).toBeGreaterThan(0);
    expect(staked).toBe(20 * tuning.ticket);
    expect(house).toBe(0);
  });

  test("[lottery:fixed-prizes-shared-jackpot] given three tickets that all hit a jackpot of 10,001 kobo, when the draw is paid, then each is paid 3,333 and the 2 kobo left over are destroyed", async () => {
    const { server, keys, lives } = await soldDraw(3, 1, ALWAYS);
    server.setNow(during(14));
    await drawJob(server.deps, keys, TICKS_CRON);
    const result = (await server.deps.stores.world.draw(0))!.result!;
    expect(result.winners[0]).toEqual({ tier: "jackpot", tickets: [0, 1, 2], amount: 3333 });
    for (const life of lives) expect(await pays(server, life.character)).toEqual([{ draw: 0, prizes: [{ tier: "jackpot", amount: 3333 }] }]);
    expect((await wallets(server, lives)).won).toBe(9999);
  });

  test.each([
    [25, 8000],
    [5000, 40],
  ])(
    "[lottery:fixed-prizes-shared-jackpot] [lottery:expected-return-below-price] given %i tickets sold, when the server draws them under %i seeds at the starting jackpot and at the cap, then a ticket is paid on average under its price",
    async (count, seeds) => {
      const server = testServer();
      const row = (await openDraw(server.deps, fakeBeacon(), 0))!;
      const tokens = Array.from({ length: count }, (_, index) => toHex(sha256(new Uint8Array([index & 255, index >> 8]))).slice(0, 16));
      for (const jackpot of [odds.jackpotStart, odds.jackpotCap]) {
        let paid = 0;
        for (let index = 0; index < seeds; index += 1) {
          const randomness = toHex(sha256(new Uint8Array([index & 255, index >> 8, count & 255, count >> 8])));
          paid += prizesOwed(resultOf({ ...row, jackpot }, tokens, randomness, tuning.ticket).winners);
        }
        expect(paid).toBeLessThan(count * seeds * tuning.ticket);
      }
    },
    // Hundreds of thousands of hashes: slow on a busy machine.
    60_000,
  );

  test("[lottery:winners-paid-by-authority] [lottery:result-published-in-tick-row] given a draw paid by one run, when the job runs again, then nobody is paid twice and the stored result is unchanged", async () => {
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

  test("[lottery:winners-paid-by-authority] given a winner already paid when a run stopped before the result was stored, when the draw is closed again, then the kind refuses the second payment and the draw is published with that winner paid once", async () => {
    const { server, keys, lives } = await soldDraw(1, 5, ALWAYS);
    server.setNow(during(14));
    const character = lives[0]!.character;
    const early = await sendAuthority(server.deps, character, { type: "lottery/pay", draw: 0, prizes: [{ tier: "jackpot", amount: 1 }], basedOn: 0 });
    expect(early.kind).toBe("done");
    const closed = await closeDraw(server.deps, keys, 0);
    expect(closed.kind).toBe("drawn");
    expect(await pays(server, character)).toHaveLength(1);
  });

  test("[lottery:ticket-list-frozen-anonymously] [lottery:seed-from-secret-and-beacon] given the beacon cannot be read at the close, when the job runs, then the draw stays without a result, nobody is paid and the next draw does not open, and the next run with the beacon back draws and pays it and opens the next", async () => {
    const { server, keys, beacon, lives } = await soldDraw(2, 3, GENEROUS);
    server.setNow(during(14));
    beacon.down = true;
    const first = await drawJob(server.deps, keys, TICKS_CRON);
    expect(first.drawn).toEqual([]);
    expect(first.waiting).toMatchObject([{ draw: 0 }]);
    expect(first.opened).toEqual([]);
    expect(await server.deps.stores.world.draw(1)).toBeNull();
    expect((await server.deps.stores.world.draw(0))!.result).toBeNull();
    for (const life of lives) expect(await pays(server, life.character)).toEqual([]);
    const page = (await drawPage(server, 0)).body;
    expect(page.result).toBeNull();
    expect(page.list).toHaveLength(6);
    expect(JSON.stringify(page)).not.toContain((await server.deps.stores.world.draw(0))!.secret);

    beacon.down = false;
    server.wait(5 * 60000);
    const second = await drawJob(server.deps, keys, TICKS_CRON);
    expect(second).toMatchObject({ drawn: [0], opened: [1] });
    expect((await server.deps.stores.world.draw(0))!.result?.listHash).toBe(page.listHash);
    expect((await wallets(server, lives)).won).toBe(prizesOwed((await server.deps.stores.world.draw(0))!.result!.winners));
  });

  test("[lottery:ticket-list-frozen-anonymously] given a draw still on sale, when it is closed, then it waits and nothing is frozen", async () => {
    const { server, keys } = await soldDraw(1, 1);
    server.setNow(during(13));
    expect(await closeDraw(server.deps, keys, 0)).toMatchObject({ kind: "waiting" });
    expect((await server.deps.stores.world.draw(0))!.closedAt).toBeNull();
  });
});

describe("telling", () => {
  test("[lottery:result-published-in-tick-row] [lottery:jackpot-rolls-over] given draw 0 drawn during tick 14, after that tick's row was made, when the world of tick 15 is fetched, then it sells draw 1 with the jackpot draw 0 left, and its last result is draw 0's", async () => {
    const { server, keys, lives } = await soldDraw(2, 2);
    server.setNow(during(14));
    await drawJob(server.deps, keys, TICKS_CRON);
    const result = (await server.deps.stores.world.draw(0))!.result!;
    // The close's own row still shows draw 0, closed and being drawn, and a purchase in it is refused.
    expect((await server.deps.stores.world.tick(14))!.world.lottery).toMatchObject({ draw: 0, closesTick: 14, last: null });
    expect(await buy(server, lives[0]!.account, lives[0]!.character, 1)).toMatchObject({ ok: false, code: "not-legal" });
    server.setNow(during(15));
    const world = (await call<WorldReply>(server, "GET", "/api/world", null)).body;
    const hit = jackpotHit(result.winners);
    expect(world.world.lottery).toMatchObject({ draw: 1, closesTick: 28, last: result, jackpot: hit ? odds.jackpotStart : result.nextJackpot, rolledOver: !hit, odds });
    accepted(await buy(server, lives[0]!.account, lives[0]!.character, 1));
  });

  test("[lottery:jackpot-rolls-over] given a draw nobody hit and then one every ticket hit, when each next draw opens, then the first rolls over by a tenth of the sales and the second starts again", async () => {
    const { server, keys, lives } = await soldDraw(2, 5);
    const hitting: LotteryOdds = { ...odds, smallPerMillion: 0, midPerMillion: 0, jackpotPerMillion: 1_000_000 };
    server.deps.contents.current = withOdds(hitting);
    server.setNow(during(14));
    await drawJob(server.deps, keys, TICKS_CRON);
    const missed = (await server.deps.stores.world.draw(0))!.result!;
    expect(jackpotHit(missed.winners)).toBe(false);
    // A tenth of ten tickets' ₦2,000 is ₦200.
    expect(missed.nextJackpot).toBe(odds.jackpotStart + 20_000);
    expect((await server.deps.stores.world.draw(1))!.jackpot).toBe(missed.nextJackpot);

    server.setNow(during(15));
    for (const life of lives) accepted(await buy(server, life.account, life.character, 1));
    server.setNow(during(28));
    await drawJob(server.deps, keys, TICKS_CRON);
    const second = (await server.deps.stores.world.draw(1))!.result!;
    expect(second.jackpot).toBe(missed.nextJackpot);
    expect(second.odds).toEqual(hitting);
    // ₦200,200 shared by the two tickets.
    expect(second.winners[0]).toEqual({ tier: "jackpot", tickets: [0, 1], amount: 10_010_000 });
    expect((await server.deps.stores.world.draw(2))!.jackpot).toBe(odds.jackpotStart);
  });

  test("[lottery:payment-waits-for-away-player] [clock:socket-only-nudges] given a winner online and one away, when the draw is paid, then the online one is nudged with its new version and the away one's payment waits in its log", async () => {
    const { server, keys, lives } = await soldDraw(2, 5, ALWAYS);
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

describe("what the players see of a paid draw", () => {
  test("[lottery:winners-paid-by-authority] [lottery:payment-waits-for-away-player] [server:client-never-predicts] given a winner away while the draw was paid, when they come back and fetch the view since the version they last held, then the reply carries the letter; without since, or since the paid version, it carries no lines", async () => {
    const { server, keys, lives } = await soldDraw(2, 5, ALWAYS);
    const away = lives[1]!;
    const before = (await held(server, away.character)).character.v;
    server.setNow(during(14));
    await drawJob(server.deps, keys, TICKS_CRON);
    const paid = (await held(server, away.character)).character.v;
    expect(paid).toBeGreaterThan(before);

    const back = await call<ViewReply>(server, "GET", `/api/view?since=${String(before)}`, away.account);
    if (!back.body.ok) throw new Error(back.body.detail);
    expect(back.body.lines.map((line) => line.key)).toContain("line.lottery.letter");
    const plain = await call<ViewReply>(server, "GET", "/api/view", away.account);
    expect(plain.body.ok && plain.body.lines).toEqual([]);
    const caughtUp = await call<ViewReply>(server, "GET", `/api/view?since=${String(back.body.view.v)}`, away.account);
    expect(caughtUp.body.ok && caughtUp.body.lines).toEqual([]);
    expect((await call<ViewReply>(server, "GET", "/api/view?since=-1", away.account)).status).toBe(400);
  });

  test("[lottery:tickets-numbered-by-commit] given two players' tickets numbered 0 to 4 and 5 to 9, when the view is read while the draw sells and after it closes, then the numbers are hidden while it sells and each sees only their own after", async () => {
    const { server, keys, lives } = await soldDraw(2, 5);
    const selling = await call<ViewReply>(server, "GET", "/api/view", lives[0]!.account);
    expect(selling.body.ok && selling.body.view.lottery?.numbers).toBeNull();
    server.setNow(during(14));
    await drawJob(server.deps, keys, TICKS_CRON);
    for (const [index, life] of lives.entries()) {
      const shown = await call<ViewReply>(server, "GET", "/api/view", life.account);
      expect(shown.body.ok && shown.body.view.lottery?.numbers).toEqual([0, 1, 2, 3, 4].map((n) => n + index * 5));
    }
    const sent = await send(server, lives[0]!.account, { type: "turn/end", slots: [], basedOn: (await held(server, lives[0]!.character)).character.v });
    expect(sent.body.ok && sent.body.view.lottery?.numbers).toEqual([0, 1, 2, 3, 4]);
  });
});

describe("the beacon over HTTP", () => {
  test("[lottery:fingerprint-commits-secret] [lottery:seed-from-secret-and-beacon] given drand's answer for quicknet round 42, when its randomness is read, then it is the SHA-256 of the signature, the value drand's v1 API publishes", async () => {
    const asked: string[] = [];
    const fetcher = ((url: string) => {
      asked.push(url);
      return Promise.resolve(new Response(JSON.stringify({ round: 42, signature: "95a9f9f5b231b7714de1553105d8ffdf3dcda24cfdb1e689319bccf79a9c8ce430a91b811fbfaf763900bc998b5d686a" })));
    }) as typeof fetch;
    expect(await quicknet(fetcher).randomness(42)).toBe(RANDOMNESS);
    expect(asked).toEqual(["https://api.drand.sh/v2/beacons/quicknet/rounds/42"]);
  });

  test("[lottery:seed-from-secret-and-beacon] given a relay that fails, answers another round or is unreachable, when the randomness is read, then it is null", async () => {
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
  test("[lottery:result-published-in-tick-row] given no such draw or a number that is not one, when the page is asked for, then it answers 404 and 400", async () => {
    const server = testServer();
    expect((await drawPage(server, 3)).status).toBe(404);
    expect((await drawPage(server, "x1")).status).toBe(400);
  });

  test("[lottery:fingerprint-commits-secret] given draw 0 on sale, when it is opened by the job with the world's own secret bytes, then the fingerprint is published before any ticket is sold", async () => {
    const server = testServer();
    const row = (await openDraw(server.deps, fakeBeacon(), 0))!;
    expect(row.closedAt).toBeNull();
    expect(row.result).toBeNull();
    expect(await server.deps.stores.world.tickets(0)).toEqual([]);
  });
});

describe("the odds are settings", () => {
  test("[lottery:odds-fixed-at-draw-open] given the settings' odds, when the job opens a draw and the settings change after, then the draw keeps the odds it opened with, the world and the draw page publish them, and the next draw opens with the new ones", async () => {
    const server = testServer({ contents: { current: withOdds(GENEROUS), previous: null } });
    const keys = keysWith(fakeBeacon());
    await drawJob(server.deps, keys, TICKS_CRON);
    const later: LotteryOdds = { ...GENEROUS, smallPerMillion: 200_000 };
    server.deps.contents.current = withOdds(later);
    expect((await server.deps.stores.world.draw(0))?.odds).toEqual(GENEROUS);
    const world = await call<WorldReply>(server, "GET", "/api/world", null);
    expect(world.body.world.lottery?.odds).toEqual(GENEROUS);
    expect((await drawPage(server, 0)).body.odds).toEqual(GENEROUS);
    server.setNow(during(14));
    await drawJob(server.deps, keys, TICKS_CRON);
    expect((await server.deps.stores.world.draw(0))?.result?.odds).toEqual(GENEROUS);
    expect((await server.deps.stores.world.draw(1))?.odds).toEqual(later);
  });

  test("[lottery:odds-fixed-at-draw-open] [server:private-settings-and-dials] given decision 0016, under which the raffle has no top-up, when the job opens a draw, then the draw carries no top-up and the switch row no top-up dial", async () => {
    const server = testServer();
    await drawJob(server.deps, keysWith(fakeBeacon()), TICKS_CRON);
    expect(Object.keys((await server.deps.stores.world.draw(0)) ?? {})).not.toContain("topUpTickets");
    expect(Object.keys((await server.deps.stores.switches.read()).dials)).not.toContain("topUpTickets");
  });

  test("[lottery:jackpot-rolls-over] given a forced win after three draws, when the stored results before a draw are read, then the third draw since a hit is forced and the second is not, and the forced draw pays its jackpot to the ticket whose draw is highest", async () => {
    const forced: LotteryOdds = { ...odds, forcedWinWeeks: 2 };
    const { server, keys, lives } = await soldDraw(2, 5, forced);
    const first = (await server.deps.stores.world.draw(0))!;
    expect(await forcedWin(server.deps.stores.world, first)).toBe(false);
    expect(await forcedWin(server.deps.stores.world, { ...first, odds: { ...forced, forcedWinWeeks: 1 } })).toBe(true);
    server.setNow(during(14));
    await drawJob(server.deps, keys, TICKS_CRON);
    expect(jackpotHit((await server.deps.stores.world.draw(0))!.result!.winners)).toBe(false);
    server.setNow(during(15));
    for (const life of lives) accepted(await buy(server, life.account, life.character, 5));
    const second = (await server.deps.stores.world.draw(1))!;
    expect(await forcedWin(server.deps.stores.world, second)).toBe(true);
    server.setNow(during(28));
    await drawJob(server.deps, keys, TICKS_CRON);
    const result = (await server.deps.stores.world.draw(1))!.result!;
    const seed = drawSeed(result.revealed, result.listHash, result.beaconRandomness);
    expect(result.winners[0]).toEqual({ tier: "jackpot", tickets: [forcedTicket(seed, 10)], amount: second.jackpot });
    expect(await forcedWin(server.deps.stores.world, (await server.deps.stores.world.draw(2))!)).toBe(false);
  });
});

describe("the stored list", () => {
  test("[lottery:ticket-list-frozen-anonymously] given a draw frozen and its beacon down, when the job runs, then the list and its hash are stored once at the close and the page publishes the stored list", async () => {
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

  test("[lottery:ticket-list-frozen-anonymously] given a stored list, when another list is offered for the draw before it is drawn, then it is refused and the draw is drawn from the stored list", async () => {
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

describe("one lottery for everyone", () => {
  test("[server:one-shared-world] given players signed up from Nigeria, Britain, Canada, the Emirates and nowhere known, when each buys a ticket, then all five are in the one draw on sale, numbered in the order bought", async () => {
    const { server } = await soldDraw(0, 0);
    const characters: string[] = [];
    for (const country of ["NG", "GB", "CA", "AE", "XX"]) {
      const account = `acct-${country}`;
      const made = await server.deps.stores.account.create({
        id: account,
        country,
        age: { passed: true, at: server.deps.now(), method: "declared" },
        createdAt: server.deps.now(),
        character: null,
        notifyBankFull: false,
        sendUsageCounts: true,
        state: "secured",
        username: account,
        usernameChangedAt: null,
        lastPlayedAt: server.deps.now(),
      });
      expect(made.ok).toBe(true);
      expect((await call<ViewReply>(server, "POST", "/api/character", account, { scenario: "scenario.ada" })).body.ok).toBe(true);
      const character = (await server.deps.stores.account.get(account))?.character;
      if (character === null || character === undefined) throw new Error(`${account} names no character.`);
      accepted(await buy(server, account, character, 1));
      characters.push(character);
    }
    const tickets = await server.deps.stores.world.tickets(drawOn(0));
    expect(tickets.map((ticket) => [ticket.n, ticket.character])).toEqual(characters.map((character, n) => [n, character]));
  });
});
