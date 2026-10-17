// The server's boards (docs/rules/city.md R-CITY-039, R-CITY-040), as the
// boards screen reaches them. Only online: offline there are no other players,
// so the screen gets null and shows nothing.
import { createContext, createElement, use, useMemo, type ReactNode } from "react";

import { authorityMode } from "../../authority/mode";
import type { ServerRejection } from "../../shared/net/contract";
import { api, type Api, type Fetch } from "../../shared/net/http";

/** apps/server/src/boards/board.ts BoardName. */
export type BoardName = "this-week.everyone" | "this-week.friends" | "all-time.everyone" | "all-time.friends" | "joined-week";

/** apps/server/src/boards/board.ts BoardRow: the account's username on every board, friends too. */
export interface BoardRow {
  rank: number;
  username: string | null;
  figure: number;
  me: boolean;
}

/** apps/server/src/boards/board.ts BoardReply. */
export interface BoardReply {
  ok: true;
  board: BoardName;
  size: number;
  rows: BoardRow[];
  own: BoardRow | null;
}

export type BoardAnswer = BoardReply | ServerRejection;

export type When = "this-week" | "all-time";
export type Who = "everyone" | "friends";

export const WHENS: readonly When[] = ["this-week", "all-time"];
export const WHOS: readonly Who[] = ["everyone", "friends"];

export function boardOf(when: When, who: Who): BoardName {
  return `${when}.${who}`;
}

function pathOf(board: BoardName): string {
  return board === "joined-week" ? "/api/boards/joined-week" : `/api/boards/${board.replace(".", "/")}`;
}

export interface BoardsApi {
  board(board: BoardName): Promise<BoardAnswer>;
}

function boardsApi(server: Api): BoardsApi {
  return { board: (board) => server.get(pathOf(board)) };
}

/** Builds the routes against a server, for tests that answer for it. */
export function boardsApiFor(baseUrl: string, fetch?: Fetch): BoardsApi {
  return boardsApi(fetch === undefined ? api({ baseUrl }) : api({ baseUrl, fetch }));
}

/** Undefined: decide from the build. Null: offline. */
const BoardsApiContext = createContext<BoardsApi | null | undefined>(undefined);

/** Gives the screens below a set of routes, or null to play offline. Tests and the shell use it. */
export function BoardsApiProvider({ value, children }: { value: BoardsApi | null; children: ReactNode }) {
  return createElement(BoardsApiContext, { value }, children);
}

/** The server's board routes when the build plays online, else null. */
export function useBoardsApi(): BoardsApi | null {
  const given = use(BoardsApiContext);
  const built = useMemo(() => {
    if (given !== undefined) return null;
    const mode = authorityMode();
    return mode.authority === "remote" ? boardsApiFor(mode.baseUrl) : null;
  }, [given]);
  return given === undefined ? built : given;
}
