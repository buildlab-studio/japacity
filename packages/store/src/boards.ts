// The boards' figures (city.md R-CITY-039, R-CITY-040): one row per character
// with its japacity figure now and the figure it held when the Lagos week
// began, so a board is one ordered read and never a load of every life.
// Weeks are whole Lagos weeks counted by the caller; no store reads a clock.

/** R-CITY-039: the when picker. */
export type BoardWhen = "this-week" | "all-time";

/** R-CITY-039: the who picker. */
export type BoardWho = "everyone" | "friends";

/** One character's figures as stored. */
export interface FigureRow {
  character: string;
  account: string;
  /** The scenario the life began in: its first name is the content's `share.first-name.<scenario>`. */
  scenario: string;
  /** When the account was made: the tie-break of R-CITY-040 ("the earlier account"). */
  joinedAt: number;
  /** The Lagos week the account was made in, for the joined-week board. */
  joinedWeek: number;
  /** R-ACCOUNT-022: false while the account is a guest, which is on no board. */
  listed: boolean;
  /** The character's version the figure was worked out at; an older write never replaces a newer one. */
  v: number;
  /** R-JAPACITY-003: the japacity figure, null for "no route yet". */
  figure: number | null;
  /** The Lagos week `weekStart` belongs to. */
  week: number;
  /** R-CITY-039: the figure when `week` began, null when there was none. */
  weekStart: number | null;
}

/** What a commit writes: the row without the week, and the figure before the commit, which opens a week the row has not seen. */
export interface FigureWrite {
  character: string;
  account: string;
  scenario: string;
  joinedAt: number;
  joinedWeek: number;
  listed: boolean;
  v: number;
  /** The figure before this commit. */
  before: number | null;
  figure: number | null;
  /** The Lagos week of the commit. */
  week: number;
}

/** Which rows a board ranks, and by what. */
export interface BoardQuery {
  when: BoardWhen;
  /** The current Lagos week: a row whose week is behind it has risen by nothing yet. */
  week: number;
  /** Only these characters (the friends board, the player included), or every one when absent. */
  among?: readonly string[];
  /** Only the accounts made in this Lagos week (the joined-week board). */
  joinedWeek?: number;
}

/** One ranked line. `score` is the figure on all time and its rise since the week began on this week. */
export interface RankedRow {
  rank: number;
  character: string;
  account: string;
  scenario: string;
  joinedAt: number;
  score: number;
}

/**
 * R-CITY-039, R-CITY-040. A board holds only listed rows with a figure,
 * ranked by score, then by the earlier account, then by character id.
 */
export interface BoardStore {
  /**
   * Writes a commit's figure. A write at or under the stored `v` changes
   * nothing and answers false. A new row, or one whose week is behind the
   * write's, takes the week of the write, and its week start is the figure
   * it held before (a new row: `before`).
   */
  setFigure: (write: FigureWrite) => Promise<boolean>;
  /** R-CITY-039: saves each row's figure as the start of `week` where its week is behind. Idempotent; answers how many rows moved. */
  turnWeek: (week: number) => Promise<number>;
  /** R-ACCOUNT-022: lists or unlists every row of an account. */
  setListed: (account: string, listed: boolean) => Promise<void>;
  /** Null for a character with no row. */
  get: (character: string) => Promise<FigureRow | null>;
  /** The first `limit` lines of the board. */
  top: (query: BoardQuery, limit: number) => Promise<RankedRow[]>;
  /** The character's own line on the board, or null when it is not on it. */
  lineOf: (query: BoardQuery, character: string) => Promise<RankedRow | null>;
  /** R-ACCOUNT-017: the character's row goes. */
  remove: (character: string) => Promise<void>;
}

/** R-CITY-039: a row's rise this week; a row whose week is behind has not risen yet, and no figure counts as 0. */
export function riseOf(row: Pick<FigureRow, "figure" | "week" | "weekStart">, week: number): number {
  const now = row.figure ?? 0;
  const start = row.week >= week ? (row.weekStart ?? 0) : now;
  return now - start;
}

/** R-CITY-040: the row's score on a board, or null when the row is not on it. */
export function scoreOf(row: FigureRow, query: BoardQuery): number | null {
  if (!row.listed || row.figure === null) return null;
  if (query.among !== undefined && !query.among.includes(row.character)) return null;
  if (query.joinedWeek !== undefined && row.joinedWeek !== query.joinedWeek) return null;
  return query.when === "all-time" ? row.figure : riseOf(row, query.week);
}
