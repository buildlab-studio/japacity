// The boards as a player reads them (city.md R-CITY-039, R-CITY-040).

/** R-CITY-039: the four boards behind the pickers, and the joined-the-same-week board kept switched off. */
export type BoardName = "this-week.everyone" | "this-week.friends" | "all-time.everyone" | "all-time.friends" | "joined-week";

/**
 * R-CITY-040: one line. `figure` is the japacity figure on all time and the rise since Monday on this week. On
 * every board, friends as everyone, the line names the account's username (account.md R-ACCOUNT-024) and carries
 * no first name and no display name (one name a player chose serves both boards). A username
 * is null only for an account no longer there.
 */
export interface BoardRow {
  rank: number;
  username: string | null;
  figure: number;
  me: boolean;
}

/** R-CITY-040: the top `size` lines, and the player's own line wherever it ranks, null while the player has no route yet. */
export interface BoardReply {
  ok: true;
  board: BoardName;
  size: number;
  rows: BoardRow[];
  own: BoardRow | null;
}
