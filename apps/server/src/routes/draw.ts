// `GET /api/draw/:n` (docs/rules/lottery.md R-LOTTERY-007, 008, 015): a draw's
// public data for the client's draw page, the same for everyone, with no
// session. The secret leaves only inside the published result (R-SERVER-015).
// Kept in the server's cache (the Cache API beside the Worker) by the draw's number for as long as a browser may
// keep it (server.md R-SERVER-039).
import type { DrawReply, ServerRejection } from "@japacity/api";
import { time } from "@japacity/sim";
import { Hono } from "hono";

import { tickStartsAt } from "../clock/view";
import type { ServerDeps } from "../deps";
import { closesTickOf } from "../lottery/draw";
import type { SessionEnv } from "../limits/limit";
import { limit } from "../limits/limit";
import type { EdgeCache } from "./cache";
import { edgeCache, edgeKey, JSON_TYPE, sent, throughEdgeIfAny } from "./cache";

/** How long a reply may be cached, in seconds: a published result never changes. */
const OPEN_MAX_AGE = 60;
const DRAWN_MAX_AGE = time.DAY_S;

/**
 * The reply for draw `n`, or null when no such draw is stored. The list is the
 * one the close stored (R-LOTTERY-008), so it never changes once published.
 */
async function drawReply(deps: ServerDeps, draw: number): Promise<DrawReply | null> {
  const row = await deps.stores.world.draw(draw);
  if (row === null) return null;
  const closesTick = closesTickOf(draw);
  const base = { draw, closesTick, closesAt: tickStartsAt(deps.config.clock, closesTick), fingerprint: row.fingerprint, beaconRound: row.beaconRound, odds: row.odds, jackpot: row.jackpot };
  if (row.list === null) return { ...base, list: null, count: null, listHash: null, result: null };
  return { ...base, list: row.list, count: row.list.length, listHash: row.listHash, result: row.result };
}

function refused(detail: string): ServerRejection {
  return { ok: false, code: "not-legal", detail };
}

/**
 * R-SERVER-039: the limit first, then the cache by the draw's number, then the
 * database. The number alone makes the reply the same for everyone; an open
 * draw's reply is kept a minute, as the browser was always told.
 */
export function drawRoute(deps: ServerDeps, edge: EdgeCache | null = edgeCache()): Hono<SessionEnv> {
  const route = new Hono<SessionEnv>();
  route.get("/api/draw/:n", limit(deps, "reads"), async (c) => {
    const asked = c.req.param("n");
    const draw = /^\d{1,9}$/.test(asked) ? Number(asked) : null;
    if (draw === null) return c.json(refused("A draw is a whole number from 0."), 400);
    const now = deps.now();
    const served = await throughEdgeIfAny(edge, edgeKey(new URL(c.req.url).origin, ["draw", draw]), now, async () => {
      const reply = await drawReply(deps, draw);
      if (reply === null) return null;
      const maxAge = reply.result === null ? OPEN_MAX_AGE : DRAWN_MAX_AGE;
      return { body: JSON.stringify(reply), type: JSON_TYPE, freshUntil: now + maxAge * time.SECOND_MS };
    });
    if (served === null) return c.json(refused(`There is no draw ${String(draw)}.`), 404);
    return sent(c, served);
  });
  return route;
}
