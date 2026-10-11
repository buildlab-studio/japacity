// A board as a player reads it (city.md R-CITY-039, R-CITY-040): the top
// `board.size` lines and the player's own line, the account's username and
// nothing else about the player on `everyone`, first names and display names on
// `friends`. Computer characters have no row, so they are on no board
// (people.md R-PEOPLE-056).
import { text } from "@japacity/content";
import type { BoardQuery, BoardWhen, BoardWho, RankedRow, SwitchName } from "@japacity/store";
import { pairIds } from "@japacity/store";

import type { ServerDeps } from "../deps";
import type { BoardPorts } from "./ports";
import { lagosWeek } from "./week";

/** R-CITY-039: the four boards behind the pickers, and the joined-the-same-week board kept switched off. */
export type BoardName = "this-week.everyone" | "this-week.friends" | "all-time.everyone" | "all-time.friends" | "joined-week";

export const BOARD_NAMES: readonly BoardName[] = ["this-week.everyone", "this-week.friends", "all-time.everyone", "all-time.friends", "joined-week"];

/** R-CITY-039: each board's own switch in the switch row. */
export const BOARD_SWITCH: Record<BoardName, SwitchName> = {
  "this-week.everyone": "boards.this-week.everyone",
  "this-week.friends": "boards.this-week.friends",
  "all-time.everyone": "boards.all-time.everyone",
  "all-time.friends": "boards.all-time.friends",
  "joined-week": "boards.joined-week",
};

/**
 * R-CITY-040: one line. `figure` is the japacity figure on all time and the rise since Monday on this week. On
 * `everyone` (and the joined-week board, also strangers) the line names the account's username (account.md
 * R-ACCOUNT-024) and carries no first name and no display name; on `friends` it carries the character's first name
 * and the display name, and no username. A username is null only for an account no longer there.
 */
export interface BoardRow {
  rank: number;
  username: string | null;
  firstName: string | null;
  figure: number;
  me: boolean;
  name: string | null;
}

/** R-CITY-040: the top `size` lines, and the player's own line wherever it ranks, null while the player has no route yet. */
export interface BoardReply {
  ok: true;
  board: BoardName;
  size: number;
  rows: BoardRow[];
  own: BoardRow | null;
}

/** The board a when and a who name, or null for words that name none. */
export function boardNamed(when: string, who: string): BoardName | null {
  const name = `${when}.${who}`;
  return BOARD_NAMES.find((each) => each === name) ?? null;
}

function pickers(board: BoardName): { when: BoardWhen; who: BoardWho } {
  switch (board) {
    case "this-week.everyone":
      return { when: "this-week", who: "everyone" };
    case "this-week.friends":
      return { when: "this-week", who: "friends" };
    case "all-time.everyone":
      return { when: "all-time", who: "everyone" };
    case "all-time.friends":
      return { when: "all-time", who: "friends" };
    case "joined-week":
      // the joined-week board ranks the japacity figure among the accounts made in the player's week, named as everyone is (usernames, R-CITY-040 as amended 11 Oct 2026).
      return { when: "all-time", who: "everyone" };
    default: {
      const never: never = board;
      throw new Error(`Unknown board ${String(never)}.`);
    }
  }
}

/** R-CITY-040: the player's friends, accounts joined to theirs by an invite or a pair record, and the player. */
async function friendsOf(deps: ServerDeps, character: string): Promise<string[]> {
  const friends = [character];
  for (const key of await deps.stores.invite.pairsOf(character)) {
    const ids = pairIds(key);
    if (ids === null) continue;
    const other = ids.a === character ? ids.b : ids.a;
    if (!friends.includes(other)) friends.push(other);
  }
  return friends;
}

/** R-CITY-040: the scenario's first name, the same the share card shows. */
export function firstNameOf(scenario: string): string {
  return text[`share.first-name.${scenario}`] ?? "";
}

/** R-CITY-039, R-CITY-040: the board for the player whose character is `character`. */
export async function readBoard(deps: ServerDeps, ports: BoardPorts, character: string, board: BoardName): Promise<BoardReply> {
  const { when, who } = pickers(board);
  const week = lagosWeek(deps.now());
  const query: BoardQuery = { when, week };
  if (who === "friends") query.among = await friendsOf(deps, character);
  if (board === "joined-week") {
    const mine = await deps.stores.boards.get(character);
    query.joinedWeek = mine?.joinedWeek ?? week;
  }
  const size = deps.config.board.size;
  const top = await deps.stores.boards.top(query, size);
  const own = top.find((line) => line.character === character) ?? (await deps.stores.boards.lineOf(query, character));
  const lines = own === null || top.includes(own) ? top : [...top, own];
  const accounts = lines.map((line) => line.account);
  const friends = who === "friends";
  // One read for every line's name: the display names among friends, the usernames on everyone (R-CITY-040).
  const names = friends ? await ports.displayNames(accounts) : new Map<string, string>();
  const usernames = friends ? new Map<string, string>() : await deps.stores.account.usernames(accounts);
  const row = (line: RankedRow): BoardRow => ({
    rank: line.rank,
    username: friends ? null : (usernames.get(line.account) ?? null),
    firstName: friends ? firstNameOf(line.scenario) : null,
    figure: line.score,
    me: line.character === character,
    name: friends ? (names.get(line.account) ?? null) : null,
  });
  return { ok: true, board, size, rows: top.map(row), own: own === null ? null : row(own) };
}
