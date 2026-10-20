import type { BoardName, BoardReply, ServerRejection } from "@japacity/api";
import type { State } from "@japacity/sim";
import { time } from "@japacity/sim";
import type { SwitchName } from "@japacity/store";
import { describe, expect, test } from "vitest";

import type { Live } from "../authority/load";
import { call, held, newLife, restMonth, send, signUp, testServer, type TestServer } from "../authority/authority.testing";
import { productionConfig, testConfig } from "../config";
import { setSwitch } from "../switches/switches";
import { BOARD_NAMES, BOARD_SWITCH } from "./board";
import { noteFigures } from "./figures";
import { boardsWeekJob } from "./scheduled";
import { accountPorts } from "./ports";
import { lagosWeek, weekBeginsAt } from "./week";
import { TICKS_CRON } from "../scheduled/ticks";

const EPOCH = productionConfig.clock.epoch;
/** The Monday 00:00 in Lagos after the epoch. */
const MONDAY = weekBeginsAt(lagosWeek(EPOCH) + 1);
const UK = "route.uk-masters";

const FOUR: BoardName[] = ["this-week.everyone", "this-week.friends", "all-time.everyone", "all-time.friends"];

function pathOf(board: BoardName): string {
  return board === "joined-week" ? "/api/boards/joined-week" : `/api/boards/${board.replace(".", "/")}`;
}

function board(server: TestServer, account: string | null, name: BoardName) {
  return call<BoardReply | ServerRejection>(server, "GET", pathOf(name), account);
}

function reply(body: BoardReply | ServerRejection): BoardReply {
  if (!body.ok) throw new Error(`Refused: ${body.code} ${body.detail}`);
  return body;
}

/** The state with the UK route known: the life's degree and grade then earn their weight. */
function knowing(state: State): State {
  const known = structuredClone(state);
  const route = known.route[UK];
  if (route === undefined) throw new Error("No UK route.");
  route.state = "known";
  return known;
}

/** A held character as a commit leaves it, for the figure writer. */
async function liveOf(server: TestServer, character: string, loaded: State, state: State, storedV: number): Promise<Live> {
  const found = await held(server, character);
  return {
    id: character,
    account: found.character.account,
    storedV,
    content: server.deps.contents.current,
    state: { ...state, v: storedV + 1 },
    loaded,
    refilledAt: found.character.refilledAt,
    storedRefilledAt: found.character.refilledAt,
    segment: 0,
    opened: null,
    rows: found.tail.length > 0 ? found.tail : [{ character, v: storedV + 1, tick: 0, sender: "player", command: restMonth({ v: storedV }), hash: "hash", at: server.deps.now() }],
    snapshots: [],
    sentFor: [],
  };
}

/**
 * Writes a figure straight into the store, for boards with many lines. A stranger's account is made the first time,
 * with the username `player_<character>`, so the everyone board has a name to show (city:board-line-and-ranking).
 */
async function figure(server: TestServer, character: string, value: number | null, over: { before?: number | null; joinedAt?: number; account?: string; scenario?: string } = {}): Promise<void> {
  const joinedAt = over.joinedAt ?? EPOCH;
  const account = over.account ?? `account-of-${character}`;
  if ((await server.deps.stores.account.get(account)) === null) await signUp(server, account, `player_${character}`);
  await server.deps.stores.boards.setFigure({
    character,
    account,
    scenario: over.scenario ?? "scenario.banker",
    joinedAt,
    joinedWeek: lagosWeek(joinedAt),
    listed: true,
    v: ((await server.deps.stores.boards.get(character))?.v ?? 0) + 1,
    before: over.before ?? null,
    figure: value,
    week: lagosWeek(server.deps.now()),
  });
}

/** A guest's life (account:guest-and-secured-states): the account row as the guest start makes it, then its character. */
async function guestLife(server: TestServer, account: string, username: string): Promise<string> {
  await signUp(server, account, username, "guest");
  const made = await call<{ ok: boolean }>(server, "POST", "/api/character", account, { scenario: "scenario.graduate" });
  expect(made.status).toBe(200);
  const character = (await server.deps.stores.account.get(account))?.character ?? null;
  if (character === null) throw new Error("The guest names no character.");
  return character;
}

async function turnOff(server: TestServer, name: SwitchName, on = false): Promise<void> {
  await setSwitch(server.deps, name, on, "account.owner", "test");
}

describe("the Lagos week", () => {
  test("[city:boards-switch-when-and-who] given the last millisecond of a Sunday and the first of the Monday in Lagos, when the week is worked out, then the Monday begins the next week", () => {
    expect(new Date(MONDAY).toISOString()).toBe("2026-10-11T23:00:00.000Z");
    expect(lagosWeek(MONDAY)).toBe(lagosWeek(MONDAY - 1) + 1);
    expect(lagosWeek(MONDAY + 7 * time.DAY_MS - 1)).toBe(lagosWeek(MONDAY));
    expect(lagosWeek(MONDAY + 7 * time.DAY_MS)).toBe(lagosWeek(MONDAY) + 1);
  });

  test("[city:boards-switch-when-and-who] given every half hour across three weeks and moments from 1970 to 2100, when each week is worked out, then the moment falls inside that week's seven days, which begin on a Monday", () => {
    const moments = [0, 1, 4_102_444_800_000];
    for (let ms = MONDAY - 7 * time.DAY_MS; ms < MONDAY + 14 * time.DAY_MS; ms += 30 * time.MINUTE_MS) moments.push(ms - 1, ms);
    for (const ms of moments) {
      const week = lagosWeek(ms);
      expect(weekBeginsAt(week)).toBeLessThanOrEqual(ms);
      expect(ms).toBeLessThan(weekBeginsAt(week + 1));
      expect(new Date(weekBeginsAt(week) + time.HOUR_MS).getUTCDay()).toBe(1);
    }
  });
});

describe("the figures a commit writes", () => {
  test("[city:boards-switch-when-and-who] given a new life, when its first command is committed, then its row holds its scenario, its account's time and no figure yet", async () => {
    const server = testServer();
    const character = await newLife(server, "account.ada", "scenario.graduate");
    const start = await held(server, character);
    await send(server, "account.ada", restMonth({ v: start.character.v }));
    expect(await server.deps.stores.boards.get(character)).toMatchObject({
      character,
      account: "account.ada",
      scenario: "scenario.graduate",
      joinedAt: EPOCH,
      joinedWeek: lagosWeek(EPOCH),
      listed: true,
      figure: null,
      week: lagosWeek(EPOCH),
      weekStart: null,
    });
  });

  test("[city:boards-switch-when-and-who] given a route that becomes known in a commit, when the figure is written, then the row holds the new figure and its week starts at the old one", async () => {
    const server = testServer();
    const character = await newLife(server, "account.ada", "scenario.graduate");
    const { snapshot } = await held(server, character);
    await noteFigures(server.deps, [await liveOf(server, character, snapshot.state, knowing(snapshot.state), 0)]);
    const row = await server.deps.stores.boards.get(character);
    expect(row?.figure).toBeGreaterThan(0);
    expect(row).toMatchObject({ weekStart: null, v: 1 });

    // The everyone board names the account's username (city:board-line-and-ranking).
    const line = reply((await board(server, "account.ada", "this-week.everyone")).body).own;
    expect(line).toEqual({ rank: 1, username: "account.ada", figure: row?.figure, me: true });
  });

  test("[city:boards-switch-when-and-who] given a commit that leaves the figure where it was, when it is not the first, then nothing is written", async () => {
    const server = testServer();
    const character = await newLife(server, "account.ada", "scenario.graduate");
    const { snapshot } = await held(server, character);
    await noteFigures(server.deps, [await liveOf(server, character, snapshot.state, snapshot.state, 4)]);
    expect(await server.deps.stores.boards.get(character)).toBeNull();
  });

  // The guest is read from the account's own state, as production reads it, not from a stand-in (account:social-needs-secured-account).
  test("[account:social-needs-secured-account] given a guest's commit, when its figure is written, then the row is on no board", async () => {
    const server = testServer();
    const character = await guestLife(server, "account.guest", "guest_ada");
    const { snapshot } = await held(server, character);
    await noteFigures(server.deps, [await liveOf(server, character, snapshot.state, knowing(snapshot.state), 0)]);
    expect((await server.deps.stores.boards.get(character))?.listed).toBe(false);
    expect(await server.deps.stores.boards.top({ when: "all-time", week: lagosWeek(server.deps.now()) }, 50)).toEqual([]);
  });
});

describe("the week's turn", () => {
  test("[city:boards-switch-when-and-who] given figures from last week, when the job runs on the Monday, then each figure is saved as the week's start, once", async () => {
    const server = testServer();
    await figure(server, "c1", 40, { before: 10 });
    server.setNow(MONDAY - 1);
    expect(await boardsWeekJob(server.deps, TICKS_CRON)).toBe(0);
    server.setNow(MONDAY);
    expect(await boardsWeekJob(server.deps, "0 0 * * *")).toBe(0);
    expect(await boardsWeekJob(server.deps, TICKS_CRON)).toBe(1);
    expect(await boardsWeekJob(server.deps, TICKS_CRON)).toBe(0);
    expect(await server.deps.stores.boards.get("c1")).toMatchObject({ figure: 40, week: lagosWeek(MONDAY), weekStart: 40 });

    await figure(server, "c1", 47);
    expect((await server.deps.stores.boards.top({ when: "this-week", week: lagosWeek(MONDAY) }, 1))[0]?.score).toBe(7);
  });
});

describe("the boards", () => {
  test.each(FOUR)("[city:boards-switch-when-and-who] given the switch row as shipped, when the %s board is asked for, then it answers", async (name) => {
    const server = testServer();
    await newLife(server, "account.ada", "scenario.graduate");
    const answered = await board(server, "account.ada", name);
    expect(answered.status).toBe(200);
    expect(reply(answered.body)).toMatchObject({ board: name, size: productionConfig.board.size });
  });

  test.each(FOUR)("[server:four-off-switches] given the %s board switched off, when it is asked for, then it is refused switched-off with Retry-After and the other three still answer", async (name) => {
    const server = testServer();
    await newLife(server, "account.ada", "scenario.graduate");
    await turnOff(server, BOARD_SWITCH[name]);
    const refused = await board(server, "account.ada", name);
    expect(refused.status).toBe(503);
    expect(refused.body).toMatchObject({ ok: false, code: "switched-off" });
    expect(refused.headers.get("Retry-After")).toBe(String(productionConfig.switches.retryMs / 1000));
    expect(await server.deps.stores.boards.top({ when: "all-time", week: 0 }, 1)).toEqual([]);
    for (const other of FOUR.filter((each) => each !== name)) expect((await board(server, "account.ada", other)).status).toBe(200);

    await turnOff(server, BOARD_SWITCH[name], true);
    expect((await board(server, "account.ada", name)).status).toBe(200);
  });

  test("[city:boards-switch-when-and-who] given the joined-week board as shipped, when it is asked for, then it is refused switched-off; when switched on, then it ranks only the accounts made in the player's week", async () => {
    const server = testServer();
    expect(BOARD_NAMES).toContain("joined-week");
    await figure(server, "early", 90, { joinedAt: EPOCH - 7 * time.DAY_MS });
    await figure(server, "same", 20);
    const character = await newLife(server, "account.ada", "scenario.graduate");
    await figure(server, character, 30, { account: "account.ada", scenario: "scenario.graduate" });

    const refused = await board(server, "account.ada", "joined-week");
    expect(refused.status).toBe(503);
    expect(refused.body).toMatchObject({ code: "switched-off" });

    await turnOff(server, "boards.joined-week", true);
    const cohort = reply((await board(server, "account.ada", "joined-week")).body);
    // Strangers in the same week are named by username, as on everyone (city:board-line-and-ranking).
    expect(cohort.rows.map((row) => [row.rank, row.username, row.figure, row.me])).toEqual([
      [1, "account.ada", 30, true],
      [2, "player_same", 20, false],
    ]);
  });

  test("[city:board-line-and-ranking] given more players than the board's size, when the player ranks below it, then the board holds exactly the size and the player's own line with its rank", async () => {
    const server = testServer({ config: testConfig({ testing: { testLogin: true }, board: { size: 3 } }) });
    for (const [at, value] of [90, 80, 70, 60].entries()) await figure(server, `c${String(at)}`, value);
    const character = await newLife(server, "account.ada", "scenario.graduate");
    await figure(server, character, 10, { account: "account.ada", scenario: "scenario.graduate" });

    const read = reply((await board(server, "account.ada", "all-time.everyone")).body);
    expect(read.size).toBe(3);
    expect(read.rows.map((row) => row.figure)).toEqual([90, 80, 70]);
    // The lines name usernames, and no first name or display name travels on a board (city:board-line-and-ranking).
    expect(read.rows.map((row) => row.username)).toEqual(["player_c0", "player_c1", "player_c2"]);
    expect(read.rows.every((row) => !row.me)).toBe(true);
    expect(read.own).toEqual({ rank: 5, username: "account.ada", figure: 10, me: true });

    await figure(server, character, 75, { account: "account.ada", scenario: "scenario.graduate" });
    const inside = reply((await board(server, "account.ada", "all-time.everyone")).body);
    expect(inside.rows.map((row) => [row.rank, row.me])).toEqual([
      [1, false],
      [2, false],
      [3, true],
    ]);
    expect(inside.own?.rank).toBe(3);
  });

  test("[city:board-line-and-ranking] given equal figures, when the board is ranked, then the earlier account comes first", async () => {
    const server = testServer();
    await figure(server, "later", 50, { joinedAt: EPOCH + time.HOUR_MS, scenario: "scenario.developer" });
    await figure(server, "earlier", 50, { joinedAt: EPOCH, scenario: "scenario.nurse" });
    await newLife(server, "account.ada", "scenario.graduate");
    const read = reply((await board(server, "account.ada", "all-time.everyone")).body);
    expect(read.rows.map((row) => row.username)).toEqual(["player_earlier", "player_later"]);
  });

  test("[city:boards-switch-when-and-who] given a long-time leader and a new player who rose more since Monday, when this week is read, then the new player tops it and all time keeps the leader first", async () => {
    const server = testServer();
    server.setNow(MONDAY - time.HOUR_MS);
    await figure(server, "leader", 80, { joinedAt: EPOCH - 30 * time.DAY_MS });
    server.setNow(MONDAY + time.HOUR_MS);
    expect(await boardsWeekJob(server.deps, TICKS_CRON)).toBe(1);
    await figure(server, "leader", 84);
    const character = await newLife(server, "account.ada", "scenario.graduate");
    await figure(server, character, 25, { account: "account.ada", scenario: "scenario.graduate" });

    const week = reply((await board(server, "account.ada", "this-week.everyone")).body);
    expect(week.rows.map((row) => [row.rank, row.figure, row.me])).toEqual([
      [1, 25, true],
      [2, 4, false],
    ]);
    const ever = reply((await board(server, "account.ada", "all-time.everyone")).body);
    expect(ever.rows.map((row) => [row.figure, row.me])).toEqual([
      [84, false],
      [25, true],
    ]);
  });

  test("[city:board-line-and-ranking] given a friend joined by an invite and a stranger, when the friends board is read, then it ranks the player and the friend only, each line naming the account's username as the everyone board does, with no first name", async () => {
    const server = testServer();
    const mine = await newLife(server, "account.ada", "scenario.graduate");
    const friend = await newLife(server, "account.tunde", "scenario.banker");
    await newLife(server, "account.zainab", "scenario.developer");
    await figure(server, mine, 30, { account: "account.ada", scenario: "scenario.graduate" });
    await figure(server, friend, 40, { account: "account.tunde", scenario: "scenario.banker" });
    await figure(server, "stranger", 99, { scenario: "scenario.developer" });
    const made = await server.deps.stores.invite.create({ code: "code-1", from: mine, account: "account.ada", slot: "partner", looking: "partner", fill: null, card: {}, madeAt: EPOCH, expires: EPOCH + time.DAY_MS });
    expect(made.ok).toBe(true);
    const pair = mine < friend ? `${mine}~${friend}` : `${friend}~${mine}`;
    await server.deps.stores.invite.use("code-1", { by: friend, pair, at: EPOCH, before: [] });
    expect((await server.deps.stores.account.setUsername("account.tunde", "tunde_k", EPOCH)).ok).toBe(true);

    const read = reply((await board(server, "account.ada", "all-time.friends")).body);
    // One name a player chose serves both boards, so friends see the username too.
    expect(read.rows).toEqual([
      { rank: 1, username: "tunde_k", figure: 40, me: false },
      { rank: 2, username: "account.ada", figure: 30, me: true },
    ]);
    expect(read.own).toEqual({ rank: 2, username: "account.ada", figure: 30, me: true });

    const everyone = reply((await board(server, "account.ada", "all-time.everyone")).body);
    expect(everyone.rows.map((row) => row.username)).toEqual(["player_stranger", "tunde_k", "account.ada"]);
    const week = reply((await board(server, "account.ada", "this-week.friends")).body);
    expect(week.rows.map((row) => row.username)).toEqual(["tunde_k", "account.ada"]);
  });

  test("[city:board-line-and-ranking] given a player who changed their username, when the everyone and friends boards and the player's own line are read, then each line names the username as it stands now and nothing else about the player travels", async () => {
    const server = testServer({ config: testConfig({ testing: { testLogin: true }, board: { size: 1 } }) });
    await figure(server, "leader", 90, { scenario: "scenario.developer" });
    const mine = await newLife(server, "account.ada", "scenario.graduate");
    await figure(server, mine, 30, { account: "account.ada", scenario: "scenario.graduate" });
    const renamed = await server.deps.stores.account.setUsername("account.ada", "ada_from_yaba", server.deps.now());
    expect(renamed.ok).toBe(true);

    const read = reply((await board(server, "account.ada", "all-time.everyone")).body);
    expect(read.rows).toEqual([{ rank: 1, username: "player_leader", figure: 90, me: false }]);
    expect(read.own).toEqual({ rank: 2, username: "ada_from_yaba", figure: 30, me: true });
    const friends = reply((await board(server, "account.ada", "all-time.friends")).body);
    expect(friends.rows).toEqual([{ rank: 1, username: "ada_from_yaba", figure: 30, me: true }]);
    for (const row of [...read.rows, read.own, ...friends.rows, friends.own]) expect(Object.keys(row ?? {}).sort()).toEqual(["figure", "me", "rank", "username"]);
  });

  test("[person:computers-never-win-scarce] given lives whose families are computer characters, when every board is read, then only the players' own characters are on it", async () => {
    const server = testServer();
    const characters: string[] = [];
    for (const [name, life] of [["ada", "scenario.graduate"], ["tunde", "scenario.banker"], ["zainab", "scenario.developer"]] as const) {
      const character = await newLife(server, `account.${name}`, life);
      const { snapshot } = await held(server, character);
      expect(Object.values(snapshot.state.people.slots).some((slot) => slot.state === "computer")).toBe(true);
      await noteFigures(server.deps, [await liveOf(server, character, snapshot.state, knowing(snapshot.state), 0)]);
      characters.push(character);
    }
    const rows = await server.deps.stores.boards.top({ when: "all-time", week: lagosWeek(server.deps.now()) }, 50);
    expect(rows.map((row) => row.character).sort()).toEqual([...characters].sort());
    const read = reply((await board(server, "account.ada", "all-time.everyone")).body);
    expect(read.rows).toHaveLength(3);
  });

  // The guest is the account's own state, and the refusal is `guest-only` with the way to secure (account:social-needs-secured-account).
  test.each([...FOUR, "joined-week" as const])("[account:social-needs-secured-account] given a guest account, when it asks for the %s board, then it is refused guest-only and sees no board", async (name) => {
    const server = testServer();
    await turnOff(server, "boards.joined-week", true);
    await guestLife(server, "account.guest", "guest_ada");
    const asked = await board(server, "account.guest", name);
    expect(asked.status).toBe(403);
    expect(asked.body).toEqual({ ok: false, code: "guest-only", detail: "Secure this life with Google or an email code to be on the boards." });
  });

  test("[account:social-needs-secured-account] [city:board-line-and-ranking] given a guest and a secured player whose commits wrote their figures, when the secured player reads everyone, then the guest is on no line and the secured player shows by username; once the guest is secured and listed again, then its line shows by its username", async () => {
    const server = testServer();
    const guest = await guestLife(server, "account.guest", "guest_ada");
    const mine = await newLife(server, "account.tunde", "scenario.banker");
    for (const character of [guest, mine]) {
      const { snapshot } = await held(server, character);
      await noteFigures(server.deps, [await liveOf(server, character, snapshot.state, knowing(snapshot.state), 0)]);
    }
    const before = reply((await board(server, "account.tunde", "all-time.everyone")).body);
    expect(before.rows.map((row) => [row.username, row.me])).toEqual([["account.tunde", true]]);

    // What securing does (account/link.ts): the account is secured and its rows are listed.
    await server.deps.stores.account.secure("account.guest");
    await server.deps.stores.boards.setListed("account.guest", true);
    const after = reply((await board(server, "account.tunde", "all-time.everyone")).body);
    expect(after.rows.map((row) => row.username).sort()).toEqual(["account.tunde", "guest_ada"]);
    expect((await accountPorts(server.deps).guests(["account.guest", "account.tunde", "account.unknown"])).size).toBe(0);
  });

  test("[city:boards-switch-when-and-who] given no session, no character or a board that does not exist, when a board is asked for, then each is refused", async () => {
    const server = testServer();
    expect((await board(server, null, "all-time.everyone")).body).toMatchObject({ code: "signed-out" });
    await newLife(server, "account.ada", "scenario.graduate");
    await server.deps.stores.account.setCharacter("account.ada", null);
    expect((await board(server, "account.ada", "all-time.everyone")).body).toMatchObject({ code: "no-character" });
    for (const path of ["/api/boards/next-week/everyone", "/api/boards/all-time/family", "/api/boards/joined/week"]) {
      const asked = await call<ServerRejection>(server, "GET", path, "account.ada");
      expect([asked.status, asked.body.code]).toEqual([404, "unknown-id"]);
    }
  });
});

describe("the board switches on the admin page", () => {
  test("[server:four-off-switches] given an admin, when the switch row is read and the joined-week board is turned on with a reason, then the five board switches are listed and the change is logged", async () => {
    const owner = "account.owner";
    const server = testServer({ config: testConfig({ testing: { testLogin: true }, admin: { accounts: [owner] } }) });
    const row = await call<{ ok: true; switches: Record<string, boolean> }>(server, "GET", "/api/admin/switches", owner);
    expect(row.body.switches).toMatchObject({
      "boards.this-week.everyone": true,
      "boards.this-week.friends": true,
      "boards.all-time.everyone": true,
      "boards.all-time.friends": true,
      "boards.joined-week": false,
    });

    const set = await call<{ ok: boolean }>(server, "POST", "/api/admin/switches", owner, { name: "boards.joined-week", on: true, reason: "a week of play" });
    expect(set.status).toBe(200);
    expect((await server.deps.stores.switches.log()).map((logged) => logged.change)).toEqual([{ switch: "boards.joined-week", on: true }]);
  });
});
