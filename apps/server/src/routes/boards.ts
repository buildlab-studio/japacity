// The boards (docs/rules/city.md R-CITY-039, R-CITY-040), each behind its own
// switch (server.md R-SERVER-031): a board switched off is refused 503
// `switched-off` with Retry-After before anything is read.
//
// GET /api/boards/:when/:who   when this-week|all-time, who everyone|friends
// GET /api/boards/joined-week  the joined-the-same-week board, its switch off by default
import type { BoardName, BoardReply, ServerCode, ServerRejection } from "@japacity/api";
import { Hono } from "hono";
import type { Context } from "hono";

import { BOARD_SWITCH, boardNamed, readBoard } from "../boards/board";
import type { BoardPorts } from "../boards/ports";
import { accountPorts } from "../boards/ports";
import type { ServerDeps } from "../deps";
import type { SessionEnv } from "../limits/limit";
import { limit, sessionOf } from "../limits/limit";
import { BOARDS_DETAIL, guestOnly } from "../account/guest";
import { isOn, retryAfterSeconds, switchedOff } from "../switches/switches";

type Reply = { status: 200 | 401 | 403 | 404 | 503; body: BoardReply | ServerRejection };

function refuse(status: Exclude<Reply["status"], 200>, code: ServerCode, detail: string): Reply {
  return { status, body: { ok: false, code, detail } };
}

async function answer(deps: ServerDeps, ports: BoardPorts, c: Context<SessionEnv>, board: BoardName | null): Promise<Reply> {
  if (board === null) return refuse(404, "unknown-id", "A board is this-week or all-time, then everyone or friends.");
  if (!(await isOn(deps, BOARD_SWITCH[board]))) return { status: 503, body: switchedOff(deps, BOARD_SWITCH[board]) };
  const session = sessionOf(c);
  if (session === null) return refuse(401, "signed-out", "Sign in to see the boards.");
  // R-ACCOUNT-022: the guest gate refuses a guest first (account/guest.ts); this holds for a route mounted without it.
  if ((await ports.guests([session.account])).has(session.account)) return { status: 403, body: guestOnly(BOARDS_DETAIL) };
  const character = (await deps.stores.account.get(session.account))?.character ?? null;
  if (character === null) return refuse(404, "no-character", "Start a life to be on the boards.");
  return { status: 200, body: await readBoard(deps, character, board) };
}

function send(c: Context<SessionEnv>, deps: ServerDeps, reply: Reply): Response {
  if (reply.status === 503) c.header("Retry-After", String(retryAfterSeconds(deps)));
  // A board changes with every commit and differs for each player.
  c.header("cache-control", "private, no-store");
  return c.json(reply.body, reply.status);
}

export function boardRoutes(deps: ServerDeps, ports: BoardPorts = accountPorts(deps)): Hono<SessionEnv> {
  const route = new Hono<SessionEnv>();
  route.get("/api/boards/joined-week", limit(deps, "reads"), async (c) => send(c, deps, await answer(deps, ports, c, "joined-week")));
  route.get("/api/boards/:when/:who", limit(deps, "reads"), async (c) => send(c, deps, await answer(deps, ports, c, boardNamed(c.req.param("when"), c.req.param("who")))));
  return route;
}
