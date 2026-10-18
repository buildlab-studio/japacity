// The boards as a player reads them (city:boards-switch-when-and-who, city:board-line-and-ranking).

/** city:boards-switch-when-and-who: the four boards behind the pickers, and the joined-the-same-week board kept switched off. */
export type BoardName = "this-week.everyone" | "this-week.friends" | "all-time.everyone" | "all-time.friends" | "joined-week";

/**
 * city:board-line-and-ranking: one line. `figure` is the japacity figure on all time and the rise since Monday on this week. On
 * every board, friends as everyone, the line names the account's username (account:username-and-unconfirmed-email) and carries
 * no first name and no display name (one name a player chose serves both boards). A username
 * is null only for an account no longer there.
 */
export interface BoardRow {
  rank: number;
  username: string | null;
  figure: number;
  me: boolean;
}

/** city:board-line-and-ranking: the top `size` lines, and the player's own line wherever it ranks, null while the player has no route yet. */
export interface BoardReply {
  ok: true;
  board: BoardName;
  size: number;
  rows: BoardRow[];
  own: BoardRow | null;
}
