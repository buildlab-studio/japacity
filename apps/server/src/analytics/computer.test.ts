// A computer character is never counted (docs/rules/people.md R-PEOPLE-055): every count of players the nightly
// job keeps, the online count and the boards are built from lives whose families are computer characters, and
// each counts only the players.
import type { State } from "@japacity/sim";
import { time } from "@japacity/sim";
import type { AccountRow, CounterTotal, DayLog, NumbersLog, RegionCount } from "@japacity/store";
import { describe, expect, test } from "vitest";

import { utcDay } from "../admin/day";
import type { Live } from "../authority/load";
import { held, newLife, restMonth, send, testServer, view, type TestServer } from "../authority/testing";
import { noteFigures } from "../boards/figures";
import { lagosWeek } from "../boards/week";
import { countDay } from "../jobs/counters";
import { onlineAt } from "../jobs/online";
import { dayName } from "./day";

const LIVES = [
  ["account.ada", "scenario.ada"],
  ["account.tunde", "scenario.tunde"],
  ["account.zainab", "scenario.zainab"],
] as const;
const UK = "route.uk-masters";

/** The day's log and the counts by region over the lives a test made, read from the memory stores. */
function knownLogs(server: TestServer, characters: readonly string[], accounts: readonly string[]): DayLog & NumbersLog {
  const { player, account } = server.deps.stores;
  const byRegion = (regions: readonly string[]): RegionCount[] => {
    const found = new Map<string, number>();
    for (const region of regions) found.set(region, (found.get(region) ?? 0) + 1);
    return [...found.entries()].map(([region, count]) => ({ region, count }));
  };
  return {
    active: async (start, end) => {
      const found: string[] = [];
      for (const character of characters) if ((await player.log(character, 0)).some((row) => row.at >= start && row.at < end)) found.push(character);
      return found;
    },
    created: async (start, end) => {
      const found: AccountRow[] = [];
      for (const id of accounts) {
        const row = await account.get(id);
        if (row !== null && row.createdAt >= start && row.createdAt < end) found.push(row);
      }
      return found;
    },
    players: async (start, end) => {
      const regions: string[] = [];
      for (const character of characters) {
        const found = await player.load(character);
        const row = found === null ? null : await account.get(found.character.account);
        if ((await player.log(character, 0)).some((each) => each.sender === "player" && each.at >= start && each.at < end)) regions.push(row?.country ?? "XX");
      }
      return byRegion(regions);
    },
    accounts: async (end) => {
      const regions: string[] = [];
      for (const id of accounts) {
        const row = await account.get(id);
        if (row !== null && row.createdAt < end) regions.push(row.country);
      }
      return byRegion(regions);
    },
  };
}

/** The state with the UK route known, so the board has a figure to show. */
function knowing(state: State): State {
  const known = structuredClone(state);
  known.route[UK]!.state = "known";
  return known;
}

/** A held character as a commit leaves it, for the figure writer. */
async function liveOf(server: TestServer, character: string): Promise<Live> {
  const found = await held(server, character);
  const loaded = found.snapshot.state;
  return {
    id: character,
    account: found.character.account,
    // As on a life's first commit, when the row is always written.
    storedV: 0,
    content: server.deps.contents.current,
    state: { ...knowing(loaded), v: loaded.v + 1 },
    loaded,
    refilledAt: found.character.refilledAt,
    storedRefilledAt: found.character.refilledAt,
    segment: 0,
    opened: null,
    rows: found.tail.length > 0 ? found.tail : [{ character, v: loaded.v + 1, tick: 0, sender: "player", command: restMonth({ v: loaded.v }), hash: "hash", at: server.deps.now() }],
    snapshots: [],
    sentFor: [],
  };
}

const sum = (rows: readonly CounterTotal[], day: string, name: string) => rows.filter((row) => row.day === day && row.name === name).reduce((total, row) => total + row.count, 0);

describe("a computer character is never counted", () => {
  test("[R-PEOPLE-055] given three players whose lives hold computer characters, when the day's players, the online count and the board are built, then each counts the three players and no computer", async () => {
    const server = testServer();
    const day = utcDay(server.deps.now());
    const characters: string[] = [];
    let computers = 0;
    for (const [account, scenario] of LIVES) {
      const character = await newLife(server, account, scenario);
      // The board row a life's first commit writes.
      await noteFigures(server.deps, [await liveOf(server, character)]);
      for (let month = 0; month < 2; month += 1) {
        const seen = await view(server, account);
        if (!seen.body.ok) throw new Error(seen.body.detail);
        const sent = await send(server, account, restMonth(seen.body.view));
        if (!sent.body.ok) throw new Error(`${sent.body.code}: ${sent.body.detail}`);
        server.wait(time.MINUTE_MS);
      }
      const { snapshot } = await held(server, character);
      computers += Object.values(snapshot.state.people.slots).filter((slot) => slot.state === "computer").length;
      characters.push(character);
    }
    expect(computers).toBeGreaterThan(LIVES.length);

    const accounts = LIVES.map(([account]) => account);
    const logs = knownLogs(server, characters, accounts);
    await countDay(server.deps, logs, day, logs);
    const rows = await server.deps.stores.counters.days("2000-01-01", "2100-01-01");
    const today = dayName(day);
    const counted = ["players/active", "players/new", "players/weekly", "players/monthly", "players/total", "lives/started", "sessions/count"];
    expect(counted.map((name) => [name, sum(rows, today, name)])).toEqual(counted.map((name) => [name, LIVES.length]));
    const online = await onlineAt(logs, server.deps.now());
    expect(online.reduce((total, region) => total + region.count, 0)).toBe(LIVES.length);

    const board = await server.deps.stores.boards.top({ when: "all-time", week: lagosWeek(server.deps.now()) }, 50);
    expect(board.map((row) => row.character).sort()).toEqual([...characters].sort());
  });
});
