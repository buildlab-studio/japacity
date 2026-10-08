// `GET /api/draw/:n` (docs/rules/lottery.md R-LOTTERY-007, 008, 015): a draw's
// public data for the client's draw page, the same for everyone, with no
// session. The secret leaves only inside the published result (R-SERVER-015).
import type { LotteryResult } from "@japacity/sim";
import { Hono } from "hono";

import { tickStartsAt } from "../clock/view";
import type { ServerDeps } from "../deps";
import type { DrawKeys } from "../draw/draw";
import { closesTickOf, listHashOf, tokensOf } from "../draw/draw";
import type { SessionEnv } from "../limits/limit";
import { limit } from "../limits/limit";
import type { ServerRejection } from "../types";

/**
 * The draw page's data. Before the close: the fingerprint and the beacon
 * round. From the freeze: the list of tokens, its count and hash. From the
 * result: the result, which holds the secret.
 */
export interface DrawReply {
  draw: number;
  closesTick: number;
  closesAt: number;
  fingerprint: string;
  beaconRound: number;
  list: string[] | null;
  count: number | null;
  listHash: string | null;
  result: LotteryResult | null;
}

/** How long a reply may be cached: a published result never changes. */
const OPEN_MAX_AGE = 60;
const DRAWN_MAX_AGE = 86400;

/** The reply for draw `n`, or null when no such draw is stored. */
export async function drawReply(deps: ServerDeps, keys: DrawKeys, draw: number): Promise<DrawReply | null> {
  const row = await deps.stores.world.draw(draw);
  if (row === null) return null;
  const closesTick = closesTickOf(draw);
  const base = { draw, closesTick, closesAt: tickStartsAt(deps.config.clock, closesTick), fingerprint: row.fingerprint, beaconRound: row.beaconRound };
  if (row.closedAt === null) return { ...base, list: null, count: null, listHash: null, result: null };
  const list = await tokensOf(deps, keys.tokenKey, draw, await deps.stores.world.tickets(draw));
  return { ...base, list, count: list.length, listHash: listHashOf(list), result: row.result };
}

function refused(detail: string): ServerRejection {
  return { ok: false, code: "not-legal", detail };
}

export function drawRoute(deps: ServerDeps, keys: DrawKeys): Hono<SessionEnv> {
  const route = new Hono<SessionEnv>();
  route.get("/api/draw/:n", limit(deps, "reads"), async (c) => {
    const asked = c.req.param("n");
    const draw = /^\d{1,9}$/.test(asked) ? Number(asked) : null;
    if (draw === null) return c.json(refused("A draw is a whole number from 0."), 400);
    const reply = await drawReply(deps, keys, draw);
    if (reply === null) return c.json(refused(`There is no draw ${String(draw)}.`), 404);
    c.header("cache-control", `public, max-age=${String(reply.result === null ? OPEN_MAX_AGE : DRAWN_MAX_AGE)}`);
    return c.json(reply);
  });
  return route;
}
