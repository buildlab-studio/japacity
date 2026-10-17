// The nightly count of the lives being played (docs/rules/account.md
// R-ACCOUNT-031, analytics.md R-ANALYTICS-008), on the memory stores and on
// Postgres (PGlite, the committed migrations).
import { pgCounterStore, pgStores } from "@japacity/db";
import type { PgliteConnection } from "@japacity/db/pglite";
import { connectPglite } from "@japacity/db/pglite";
import type { State } from "@japacity/sim";
import { newState } from "@japacity/sim";
import type { CounterTotal } from "@japacity/store";
import { afterEach, describe, expect, test, vi } from "vitest";

import { utcDay } from "../admin/day";
import { dayName } from "../analytics/day";
import { memoryStores } from "../deps";
import { newLife, restMonth, send, testServer, view } from "../authority/testing";
import type { TestServer } from "../authority/testing";
import { countLives, LIVES_CRON, livesJob } from "./lives";

const opened: PgliteConnection[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(opened.splice(0).map((connection) => connection.close()));
});

async function onPostgres(): Promise<TestServer> {
  const connection = await connectPglite();
  opened.push(connection);
  return testServer({ stores: { ...memoryStores(), ...pgStores(connection.handle), counters: pgCounterStore(connection.handle) } });
}

/** An account in `country`, as sign-up makes it. */
async function account(server: TestServer, id: string, country: string): Promise<void> {
  const now = server.deps.now();
  const made = await server.deps.stores.account.create({
    id,
    country,
    age: { passed: true, at: now, method: "declared" },
    createdAt: now,
    character: null,
    notifyBankFull: false,
    sendUsageCounts: true,
    state: "secured",
    username: id,
    usernameChangedAt: null,
    lastPlayedAt: now,
  });
  if (!made.ok) throw new Error(made.detail);
}

/** A stored life made from a fresh one by `change`, as the store keeps any state it is given; named by its account when `named`. */
async function storedLife(server: TestServer, owner: string, id: string, change: (state: State) => State, named = true): Promise<void> {
  const current = server.deps.contents.current;
  const state = change(newState("scenario.tunde", `seed-${id}`, current));
  const made = await server.deps.stores.player.create({ id, account: owner, refilledAt: server.deps.now(), content: current.version, start: { base: state }, state });
  if (!made.ok) throw new Error(made.detail);
  if (!named) return;
  const pointed = await server.deps.stores.account.setCharacter(owner, id);
  if (!pointed.ok) throw new Error(pointed.detail);
}

const abroad = (state: State): State => ({ ...state, place: { ...state.place, where: "abroad", country: "country.uk", movedMonth: state.turn.month } });
const onRoad = (state: State): State => ({ ...state, place: { ...state.place, where: "road", country: null, movedMonth: state.turn.month } });
const ended = (state: State): State => ({ ...state, turn: { ...state.turn, ended: true } });

/**
 * Two lives at home in Nigeria (one played on for two months, so its state is
 * read through the rows after its snapshot), one abroad and one on the road in
 * Britain, one ended, one whose account is gone and one its account no longer
 * names.
 */
async function world(server: TestServer): Promise<void> {
  await newLife(server, "account.ada");
  for (let month = 0; month < 2; month += 1) {
    const seen = await view(server, "account.ada");
    if (!seen.body.ok) throw new Error(seen.body.detail);
    const sent = await send(server, "account.ada", restMonth(seen.body.view));
    if (!sent.body.ok) throw new Error(`${sent.body.code}: ${sent.body.detail}`);
  }
  await account(server, "account.tunde", "NG");
  await storedLife(server, "account.tunde", "character-tunde", (state) => state);
  await account(server, "account.zainab", "GB");
  await storedLife(server, "account.zainab", "character-zainab", abroad);
  await account(server, "account.kola", "GB");
  await storedLife(server, "account.kola", "character-kola", onRoad);
  await account(server, "account.ended", "NG");
  await storedLife(server, "account.ended", "character-ended", ended);
  await storedLife(server, "account.gone", "character-gone", abroad, false);
  await account(server, "account.moved", "NG");
  await storedLife(server, "account.moved", "character-old", abroad, false);
  await storedLife(server, "account.moved", "character-new", (state) => state);
}

async function totals(server: TestServer): Promise<CounterTotal[]> {
  return (await server.deps.stores.counters.days("2000-01-01", "2100-01-01")).filter((row) => row.name === "lives/playing");
}

const row = (day: string, region: string, key: string, count: number): CounterTotal => ({ day, region, name: "lives/playing", key, count });

for (const [where, make] of [
  ["the memory stores", () => Promise.resolve(testServer())],
  ["Postgres", onPostgres],
] as const) {
  describe(`the nightly count of lives on ${where}`, () => {
    test("[R-ACCOUNT-031] [R-ANALYTICS-008] given lives at home, abroad, on the road, ended, and with an account gone or moved on, when the day is counted, then only the lives being played are counted, by where each stands, under its region and the whole game's, once a day, with no name in the result and no log line", async () => {
      const server = await make();
      await world(server);
      const day = utcDay(server.deps.now());
      const named = dayName(day);
      const lines = [vi.spyOn(console, "log"), vi.spyOn(console, "error"), vi.spyOn(console, "warn")];

      const first = await countLives(server.deps, day);
      const again = await countLives(server.deps, day);

      expect(first).toEqual({ day: named, added: true, lives: { home: 3, abroad: 1, road: 1 }, skipped: 0 });
      expect(again).toEqual({ ...first, added: false });
      expect(await totals(server)).toEqual([
        row(named, "GB", "abroad", 1),
        row(named, "GB", "road", 1),
        row(named, "NG", "home", 3),
        row(named, "all", "abroad", 1),
        row(named, "all", "home", 3),
        row(named, "all", "road", 1),
      ]);
      expect(JSON.stringify(first)).not.toMatch(/account|character-/);
      for (const line of lines) expect(line).not.toHaveBeenCalled();
    });
  });
}

describe("the nightly job of lives", () => {
  test("[R-ACCOUNT-031] given no life at all, when the job runs at 00:00, then the day just ended is counted with the whole game's three keys at 0, so the lights know the count has run", async () => {
    const server = testServer();
    const today = utcDay(server.deps.now());
    const yesterday = dayName(today - 1);

    expect(LIVES_CRON).toBe("0 0 * * *");
    expect(await livesJob(server.deps)).toEqual({ day: yesterday, added: true, lives: { home: 0, abroad: 0, road: 0 }, skipped: 0 });
    expect(await totals(server)).toEqual([row(yesterday, "all", "abroad", 0), row(yesterday, "all", "home", 0), row(yesterday, "all", "road", 0)]);
  });

  test("[R-ACCOUNT-031] given a life whose state is under a content the server no longer bundles, when the day is counted, then it is skipped by count alone and the rest are counted", async () => {
    const server = testServer();
    await account(server, "account.old", "NG");
    const current = server.deps.contents.current;
    const state = newState("scenario.tunde", "seed-old", current);
    must(await server.deps.stores.player.create({ id: "character-old", account: "account.old", refilledAt: server.deps.now(), content: "m-gone", start: { base: state }, state }));
    must(await server.deps.stores.account.setCharacter("account.old", "character-old"));
    await account(server, "account.tunde", "NG");
    await storedLife(server, "account.tunde", "character-tunde", (each) => each);

    const counted = await countLives(server.deps, utcDay(server.deps.now()));

    expect(counted.lives).toEqual({ home: 1, abroad: 0, road: 0 });
    expect(counted.skipped).toBe(1);
  });
});

function must<T extends { ok: boolean }>(result: T): T {
  if (!result.ok) throw new Error(JSON.stringify(result));
  return result;
}
