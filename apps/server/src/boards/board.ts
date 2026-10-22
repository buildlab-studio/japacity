// A board as a player reads it (city:boards-switch-when-and-who, city:board-line-and-ranking): the top
// `board.size` lines and the player's own line, each naming the account's
// username and nothing else about the player, on every board, friends too.
// Computer characters have no row, so they are on no board (person.md
// person:computers-never-win-scarce).
import type { BoardName, BoardReply, BoardRow } from "@japacity/api";
import type { BoardQuery, BoardWhen, BoardWho, RankedRow, SwitchName } from "@japacity/store";
import { pairIds } from "@japacity/store";

import type { ServerDeps } from "../dependencies";
import { lagosWeek } from "./week";

export const BOARD_NAMES: readonly BoardName[] = ["this-week.everyone", "this-week.friends", "all-time.everyone", "all-time.friends", "joined-week"];

/** city:boards-switch-when-and-who: each board's own switch in the switch row. */
export const BOARD_SWITCH: Record<BoardName, SwitchName> = {
  "this-week.everyone": "boards.this-week.everyone",
  "this-week.friends": "boards.this-week.friends",
  "all-time.everyone": "boards.all-time.everyone",
  "all-time.friends": "boards.all-time.friends",
  "joined-week": "boards.joined-week",
};

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
      // The joined-week board ranks the japacity figure among the accounts made in the player's week, named as everyone is (usernames, city:board-line-and-ranking).
      return { when: "all-time", who: "everyone" };
    default: {
      const never: never = board;
      throw new Error(`Unknown board ${String(never)}.`);
    }
  }
}

/** The characters of every account with a block between it and `account`, whichever side blocked (moderation:blocks-off-friends-board). */
async function blockedCharacters(deps: ServerDeps, account: string): Promise<Set<string>> {
  const characters = new Set<string>();
  for (const other of await deps.stores.moderation.blockedWith(account)) {
    const character = (await deps.stores.account.get(other))?.character ?? null;
    if (character !== null) characters.add(character);
  }
  return characters;
}

/**
 * city:board-line-and-ranking, moderation:blocks-off-friends-board: the player's friends, accounts joined to theirs
 * by an invite or a pair record less any with a block between the two, and the player.
 */
async function friendsOf(deps: ServerDeps, account: string, character: string): Promise<string[]> {
  const friends = [character];
  const blocked = await blockedCharacters(deps, account);
  for (const key of await deps.stores.invite.pairsOf(character)) {
    const ids = pairIds(key);
    if (ids === null) continue;
    const other = ids.a === character ? ids.b : ids.a;
    if (!friends.includes(other) && !blocked.has(other)) friends.push(other);
  }
  return friends;
}

/** city:boards-switch-when-and-who, city:board-line-and-ranking: the board for the player of `account`, whose character is `character`. */
export async function readBoard(deps: ServerDeps, account: string, character: string, board: BoardName): Promise<BoardReply> {
  const { when, who } = pickers(board);
  const week = lagosWeek(deps.now());
  const query: BoardQuery = { when, week };
  if (who === "friends") query.among = await friendsOf(deps, account, character);
  if (board === "joined-week") {
    const mine = await deps.stores.boards.get(character);
    query.joinedWeek = mine?.joinedWeek ?? week;
  }
  const size = deps.config.board.size;
  const top = await deps.stores.boards.top(query, size);
  const own = top.find((line) => line.character === character) ?? (await deps.stores.boards.lineOf(query, character));
  const lines = own === null || top.includes(own) ? top : [...top, own];
  // One read for every line's name: the usernames, on every board (city:board-line-and-ranking).
  const usernames = await deps.stores.account.usernames(lines.map((line) => line.account));
  const row = (line: RankedRow): BoardRow => ({
    rank: line.rank,
    username: usernames.get(line.account) ?? null,
    figure: line.score,
    me: line.character === character,
  });
  return { ok: true, board, size, rows: top.map(row), own: own === null ? null : row(own) };
}
